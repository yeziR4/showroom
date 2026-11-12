"""
ModelScope Studio entry point (Gradio/Python SDK — no Docker, no real-name step).

ModelScope runs `python app.py` and shows whatever listens on port 7860.
This script fetches a Node.js runtime from the npmmirror China mirror (once,
cached), then replaces itself with the prebuilt Next.js server that sits next
to it (`server.js`, `.next/`, `public/`) — the exact app that runs on Vercel.

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


def main() -> None:
    node = node_binary()
    env = dict(os.environ)
    env.update({
        "PORT": "7860",
        "HOSTNAME": "0.0.0.0",
        "NODE_ENV": "production",
        "NEXT_TELEMETRY_DISABLED": "1",
        "DATA_DIR": env.get("DATA_DIR") or writable_dir("/mnt/workspace/showroom", os.path.join(HERE, "data"), "/tmp/showroom"),
    })
    if not env.get("AHOLO_API_KEY"):
        log("WARNING: AHOLO_API_KEY is not set — browsing works, building 3D models will fail")
    log(f"starting Showroom with {node} on port 7860")
    os.chdir(HERE)
    os.execve(node, [node, "server.js"], env)


if __name__ == "__main__":
    main()
