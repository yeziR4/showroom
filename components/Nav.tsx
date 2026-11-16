import Link from "next/link";
import Logo from "./Logo";

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-in">
        <Link href="/" aria-label="Showroom home"><Logo /></Link>
        <nav className="nav-links">
          <Link href="/explore">3D mall</Link>
          <Link href="/studio" className="nav-hide-xs">For sellers</Link>
          <Link href="/studio/ad" className="nav-hide-sm">Ad studio</Link>
          <Link href="/#build" className="nav-cta">Build in 3D</Link>
        </nav>
      </div>
    </header>
  );
}
