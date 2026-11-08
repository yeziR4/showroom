import Link from "next/link";

export default function Nav() {
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link href="/" className="brand">
          <span className="brand-mark" /> Showroom
        </Link>
        <nav className="nav-links">
          <Link href="/explore">Explore stores</Link>
          <Link href="/studio">Seller studio</Link>
          <Link href="/studio/ad">Ad studio</Link>
        </nav>
      </div>
    </header>
  );
}
