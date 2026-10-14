// In-page navigation: links to a section land right below the fixed header, at once when
// the target is far (no crawling through the 3D experience), gliding when it is close.
// Focus moves to the section so keyboard and screen-reader users arrive there too.

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const headerHeight = () => document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0;

export function setLocation(hash: string) {
  if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search);
}

export function scrollToY(top: number, { instant = false } = {}) {
  const far = Math.abs(top - window.scrollY) > window.innerHeight * 1.2;
  window.scrollTo({ top, behavior: instant || far || reduced() ? 'auto' : 'smooth' });
}

export function goTo(hash: string, { instant = false } = {}) {
  const id = hash.startsWith('#') ? decodeURIComponent(hash.slice(1)) : '';
  const el = id ? document.getElementById(id) : null;
  if (!el) return false;
  const top = el.dataset.top === 'start' ? 0 : Math.max(0, el.getBoundingClientRect().top + window.scrollY - headerHeight());
  scrollToY(top, { instant });
  setLocation(hash);
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  return true;
}

/** One delegated listener for every same-page link. */
export function installAnchorNavigation() {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a || a.hasAttribute('download')) return;
    const hash = a.getAttribute('href') ?? '';
    if (hash.length > 1 && goTo(hash)) e.preventDefault();
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
