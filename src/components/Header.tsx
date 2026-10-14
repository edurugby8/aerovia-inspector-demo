import { useEffect, useRef, useState } from 'react';
import { brand, cta, nav } from '../content/site';
import { SymbolPlate } from './Brand';

// Transparent over the experience, solid once the page content starts. The mobile menu
// is removed from the tab order and the accessibility tree while closed.
export default function Header() {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const xp = document.getElementById('inspeccion');
      const end = xp ? xp.offsetTop + xp.offsetHeight - window.innerHeight * 0.9 : 0;
      setSolid(window.scrollY > Math.max(40, end));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggle.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <header ref={root} className={`site-header${solid || open ? ' is-solid' : ''}${open ? ' is-open' : ''}`}>
      <a className="brand-link" href="#inspeccion" onClick={close} aria-label={`${brand.name}, inicio`}>
        <SymbolPlate />
        <span className="brand-name" aria-hidden="true">{brand.tagline}</span>
      </a>
      <nav id="menu" className="menu" aria-label="Principal">
        {nav.map((l) => <a key={l.href} href={l.href} onClick={close}>{l.label}</a>)}
        <a className="btn btn-primary btn-small menu-cta" href={cta.primary.href} onClick={close}>{cta.primary.label}</a>
      </nav>
      <button ref={toggle} type="button" className="menu-toggle" aria-expanded={open} aria-controls="menu" onClick={() => setOpen((o) => !o)}>
        <span className="visually-hidden">{open ? 'Cerrar menú' : 'Abrir menú'}</span>
        <span className={open ? 'icon-close' : 'icon-menu'} aria-hidden="true" />
      </button>
    </header>
  );
}
