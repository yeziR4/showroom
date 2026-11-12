"""
ModelScope Studio entry point (Gradio SDK — no Docker, no real-name step).

How ModelScope serves a Gradio Studio: its own Gradio front-end is shown at "/"
and asks this server for the Gradio config; every other path is passed through
to this server on port 7860. So this file runs a real (tiny) Gradio app whose
only content is a full-screen frame showing Showroom at /app/, and proxies
/app/* to the Next.js server (the same app as on Vercel, built with
basePath=/app) running on 127.0.0.1:3000. Node.js and the Next.js runtime
libraries are fetched from the npmmirror China mirror on first start and
cached on the persistent /mnt/workspace volume.

Set these in the Studio's Settings → environment variables:
  AHOLO_API_KEY            required
  KV_REST_API_URL/_TOKEN   optional, shares the showcase with the Vercel site
  ADMIN_KEY                optional
"""
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

NODE_VERSION = "22.12.0"
MIRRORS = [
    "https://npmmirror.com/mirrors/node",          # fast inside mainland China
    "https://cdn.npmmirror.com/binaries/node",
    "https://nodejs.org/dist",
]
HERE = os.path.dirname(os.path.abspath(__file__))


def log(msg: str) -> None:
    print(f"[showroom] {msg}", flush=True)


def writable_dir(*candidates: str) -> str:
    for d in candidates:
        try:
            os.makedirs(d, exist_ok=True)
            probe = os.path.join(d, ".probe")
            with open(probe, "w") as f:
                f.write("ok")
            os.remove(probe)
            return d
        except OSError:
            continue
    return tempfile.mkdtemp()


def node_binary() -> str:
    existing = shutil.which("node")
    if existing:
        try:
            major = int(subprocess.check_output([existing, "--version"], text=True).strip().lstrip("v").split(".")[0])
            if major >= 20:
                return existing
        except Exception:
            pass

    cache = writable_dir("/mnt/workspace/.node", os.path.expanduser("~/.cache/showroom-node"), "/tmp/showroom-node")
    folder = os.path.join(cache, f"node-v{NODE_VERSION}-linux-x64")
    binary = os.path.join(folder, "bin", "node")
    if os.path.exists(binary):
        return binary

    name = f"node-v{NODE_VERSION}-linux-x64.tar.gz"
    for base in MIRRORS:
        url = f"{base}/v{NODE_VERSION}/{name}"
        try:
            log(f"downloading Node.js {NODE_VERSION} from {base} …")
            archive = os.path.join(cache, name)
            urllib.request.urlretrieve(url, archive)
            with tarfile.open(archive) as t:
                t.extractall(cache)
            os.remove(archive)
            if os.path.exists(binary):
                return binary
        except Exception as e:  # try the next mirror
            log(f"  failed: {e}")
    sys.exit("[showroom] could not download Node.js from any mirror")


def unpack_bundle() -> str:
    """Return the folder holding server.js. If the app was uploaded as a single
    zip (easier through the web uploader), extract it once and use that."""
    if os.path.exists(os.path.join(HERE, "server.js")):
        return HERE
    archive = os.path.join(HERE, "showroom-app.zip")
    if not os.path.exists(archive):
        sys.exit("[showroom] neither server.js nor showroom-app.zip found next to app.py")
    stamp = str(os.path.getsize(archive)) + "-" + str(int(os.path.getmtime(archive)))
    target = os.path.join(writable_dir(os.path.join(HERE, "_app"), "/tmp/showroom-app"), "")
    marker = os.path.join(target, ".unpacked")
    if not (os.path.exists(marker) and open(marker).read() == stamp):
        import zipfile
        log("unpacking showroom-app.zip …")
        with zipfile.ZipFile(archive) as z:
            z.extractall(target)
        with open(marker, "w") as f:
            f.write(stamp)
    return target


# Runtime libraries of the standalone server. ModelScope's web uploader drops
# node_modules folders, so they are installed from npmmirror on first start
# and cached on the persistent volume.
RUNTIME_DEPS = ["next@16.4.5", "react@19.3.1", "react-dom@19.3.1"]
NPM_REGISTRY = "https://registry.npmmirror.com"


def ensure_node_modules(app_dir: str, node: str) -> None:
    if os.path.exists(os.path.join(app_dir, "node_modules", "next", "package.json")):
        return
    key = "-".join(d.replace("@", "_").replace("/", "_") for d in RUNTIME_DEPS)
    cache = os.path.join(writable_dir("/mnt/workspace/.showroom-modules", "/tmp/showroom-modules"), key)
    if not os.path.exists(os.path.join(cache, "node_modules", "next", "package.json")):
        os.makedirs(cache, exist_ok=True)
        with open(os.path.join(cache, "package.json"), "w") as f:
            f.write('{"name":"showroom-runtime","private":true}')
        npm = os.path.join(os.path.dirname(node), "npm")
        env = dict(os.environ, PATH=os.path.dirname(node) + os.pathsep + os.environ.get("PATH", ""))
        log(f"installing {', '.join(RUNTIME_DEPS)} from {NPM_REGISTRY} …")
        subprocess.check_call(
            [npm, "install", *RUNTIME_DEPS, "--registry", NPM_REGISTRY, "--omit=optional",
             "--no-audit", "--no-fund", "--no-package-lock", "--loglevel=error"],
            cwd=cache, env=env,
        )
    link = os.path.join(app_dir, "node_modules")
    if os.path.islink(link) or os.path.exists(link):
        if os.path.islink(link):
            os.remove(link)
        else:
            shutil.rmtree(link)
    try:
        os.symlink(os.path.join(cache, "node_modules"), link)
    except OSError:
        shutil.copytree(os.path.join(cache, "node_modules"), link)


def runnable_dir(app_dir: str) -> str:
    """The app folder must be writable (node_modules link, Next cache). If the
    Studio checkout is read-only, run from a copy in a writable place."""
    try:
        probe = os.path.join(app_dir, ".write-probe")
        open(probe, "w").close()
        os.remove(probe)
        return app_dir
    except OSError:
        target = "/tmp/showroom-run"
        if not os.path.exists(os.path.join(target, "server.js")):
            shutil.copytree(app_dir, target, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git", "node_modules"))
        return target


NODE_PORT = 3000
BASE = "/app"
_state = {"ready": False, "error": None}

STARTING_PAGE = """<!doctype html><meta charset=utf-8><meta http-equiv=refresh content=4>
<title>Showroom is starting</title><body style="font:17px system-ui;background:#f3efe8;color:#17140f;
display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center;max-width:420px">
<b>Showroom is starting up…</b><br><span style="color:#6b6457">{msg}</span></div>"""


def start_node() -> None:
    """Runs in a background thread: prepare Node + libraries, start Next.js."""
    import threading  # noqa: F401
    import time

    try:
        node = node_binary()
        app_dir = runnable_dir(unpack_bundle())
        ensure_node_modules(app_dir, node)
        env = dict(os.environ)
        env.update({
            "PORT": str(NODE_PORT), "HOSTNAME": "127.0.0.1", "NODE_ENV": "production",
            "NEXT_TELEMETRY_DISABLED": "1",
            "DATA_DIR": env.get("DATA_DIR") or writable_dir("/mnt/workspace/showroom", "/tmp/showroom"),
        })
        if not env.get("AHOLO_API_KEY"):
            log("WARNING: AHOLO_API_KEY is not set — browsing works, building 3D models will fail")
        log(f"starting Next.js with {node} on 127.0.0.1:{NODE_PORT}")
        proc = subprocess.Popen([node, "server.js"], cwd=app_dir, env=env)
        for _ in range(240):
            if proc.poll() is not None:
                raise RuntimeError(f"Next.js exited with code {proc.returncode}")
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{NODE_PORT}{BASE}/api/quota", timeout=2)
                _state["ready"] = True
                log("Showroom is ready")
                return
            except Exception:
                time.sleep(0.5)
        raise RuntimeError("Next.js did not become ready in 2 minutes")
    except BaseException as e:  # shown on the starting page and in the log
        _state["error"] = repr(e)
        log(f"startup failed: {e!r}")


def build_app():
    import threading

    import gradio as gr
    import httpx
    from fastapi import FastAPI, Request
    from fastapi.responses import HTMLResponse, Response

    threading.Thread(target=start_node, daemon=True).start()

    app = FastAPI()
    client = httpx.AsyncClient(base_url=f"http://127.0.0.1:{NODE_PORT}", timeout=120)
    hop = {"connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade",
           "proxy-authorization", "proxy-authenticate", "content-encoding", "content-length", "host"}

    methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]

    @app.api_route(BASE, methods=methods)
    async def app_root(request: Request):
        return await proxy("", request)

    @app.api_route(BASE + "/{path:path}", methods=methods)
    async def proxy(path: str, request: Request):
        if not _state["ready"]:
            msg = f"Something went wrong: {_state['error']}" if _state["error"] else \
                "First start downloads Node.js and takes about a minute. This page refreshes itself."
            return HTMLResponse(STARTING_PAGE.format(msg=msg), status_code=503)
        # Next.js (basePath=/app) serves the home page at "/app", not "/app/".
        url = (f"{BASE}/{path}" if path else BASE) + (f"?{request.url.query}" if request.url.query else "")
        headers = {k: v for k, v in request.headers.items() if k.lower() not in hop}
        headers["x-forwarded-for"] = request.headers.get("x-forwarded-for", request.client.host if request.client else "")
        r = await client.request(request.method, url, headers=headers, content=await request.body())
        out = {k: v for k, v in r.headers.items() if k.lower() not in hop}
        return Response(content=r.content, status_code=r.status_code, headers=out)

    frame = (
        f'<iframe src="{BASE}" title="Showroom" allow="xr-spatial-tracking; fullscreen; clipboard-write" '
        'style="width:100%;height:calc(100vh - 24px);min-height:720px;border:0;border-radius:12px;display:block"></iframe>'
    )
    with gr.Blocks(title="Showroom — one photo to a 3D product") as demo:
        gr.HTML(frame)
    return gr.mount_gradio_app(app, demo, path="/")


def main() -> None:
    import uvicorn

    log("starting Gradio front on 0.0.0.0:7860")
    uvicorn.run(build_app(), host="0.0.0.0", port=7860, log_level="warning")


if __name__ == "__main__":
    main()
