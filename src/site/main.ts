// The little the pages need from JavaScript: the menu closes itself, the inspection page turns
// its moments into a scroll player, and the contact page can copy its request template. Every
// page reads and navigates the same without it.
import { initPlayer } from './player';

document.documentElement.classList.add('js');

// the narrow-screen menu: close it on Escape, on choosing a page, on a click outside, and when
// the window grows wide enough for the full menu
const menu = document.querySelector<HTMLDetailsElement>('.nav-mobile');
if (menu) {
  const close = () => { menu.open = false; };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.open) { close(); menu.querySelector('summary')?.focus(); }
  });
  document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target as Node)) close(); });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  matchMedia('(min-width: 1101px)').addEventListener('change', (m) => { if (m.matches) close(); });
  addEventListener('pagehide', close);
}

const player = document.querySelector<HTMLElement>('[data-player]');
if (player) initPlayer(player);

// contact: copy the request template (it only copies text; nothing is sent anywhere)
const copy = document.querySelector<HTMLButtonElement>('[data-copy]');
const template = document.querySelector<HTMLElement>('[data-template]');
if (copy && template && navigator.clipboard) {
  const status = document.querySelector<HTMLElement>('[data-copy-status]');
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(template.textContent ?? '');
      if (status) status.textContent = 'Plantilla copiada. Péguela en su mensaje y complete cada punto.';
    } catch {
      if (status) status.textContent = 'No se ha podido copiar: seleccione el texto y cópielo.';
    }
  });
}
