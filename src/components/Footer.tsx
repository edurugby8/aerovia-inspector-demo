import { footer, nav } from '../content/site';
import { LogoPlate } from './Brand';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <LogoPlate className="footer-logo" />
        <div className="footer-copy">
          <p>{footer.line}</p>
          <p className="muted">{footer.demo}</p>
        </div>
        <nav className="footer-nav" aria-label="Pie de página">
          {nav.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <p className="footer-rights label">{footer.rights}</p>
      </div>
    </footer>
  );
}
