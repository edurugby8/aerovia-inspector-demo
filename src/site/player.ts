/**
 * The inspection page's scroll player. Without it (no JavaScript, or reduced motion) each
 * moment is a picture beside its text. With it, the pictures move to one stage that stays in
 * view while the texts scroll past, and cross-fade from one moment to the next as a function of
 * the scroll position alone: forwards, backwards or stopped, the same position always shows the
 * same frame. The stage shows keyframes; a rendered frame sequence can take their place later
 * behind the same `show(position)`.
 */
const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

/** How much of the scroll between two moments the cross-fade takes, centred on their boundary. */
const FADE = 0.35;
/** How far each picture closes in while its moment is read. */
const ZOOM = 0.045;

export function initPlayer(root: HTMLElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layout = root.querySelector<HTMLElement>('.player-layout');
  const moments = [...root.querySelectorAll<HTMLElement>('.moment')];
  const figures = moments.map((m) => m.querySelector<HTMLElement>('[data-frame]'));
  if (!layout || moments.length < 2 || figures.some((f) => !f)) return;

  // the stage comes after the texts in the document (they are read first) and beside or above
  // them on screen; the pictures keep their descriptions
  const stage = document.createElement('div');
  stage.className = 'player-stage';
  const frames = (figures as HTMLElement[]).map((f) => {
    f.classList.add('player-stage__frame');
    const img = f.querySelector('img')!;
    img.loading = 'eager';
    stage.append(f);
    return { el: f, img };
  });
  const progress = document.createElement('div');
  progress.className = 'player-progress';
  progress.setAttribute('aria-hidden', 'true');
  const bars = moments.map(() => { const s = document.createElement('span'), i = document.createElement('i'); s.append(i); progress.append(s); return i; });
  stage.append(progress);
  layout.append(stage);
  root.classList.add('is-player');

  /** Shows the stage at a position along the moments: i + t is t of the way through moment i. */
  function show(x: number) {
    frames.forEach((f, k) => {
      const opacity = k === 0 ? 1 : smooth((x - k + FADE / 2) / FADE);
      f.el.style.opacity = String(opacity);
      f.el.style.visibility = opacity > 0 ? 'visible' : 'hidden';
      f.img.style.transform = `scale(${1 + ZOOM * smooth((x - k + 0.5) / 1.5)})`;
    });
    bars.forEach((b, i) => { b.style.transform = `scaleX(${Math.min(1, Math.max(0, x - i))})`; });
    const active = Math.min(moments.length - 1, Math.max(0, Math.floor(x)));
    moments.forEach((m, i) => m.classList.toggle('is-active', i === active));
  }

  /** Where the reader is: the line halfway down the part of the window the stage leaves free. */
  function position() {
    const vh = innerHeight, s = stage.getBoundingClientRect();
    const stacked = s.width > layout!.getBoundingClientRect().width * 0.8;
    const line = stacked ? (s.bottom + vh) / 2 : vh / 2;
    const first = moments[0].getBoundingClientRect();
    if (line < first.top) return 0;
    for (let i = 0; i < moments.length; i++) {
      const r = moments[i].getBoundingClientRect();
      if (line < r.bottom) return i + Math.max(0, (line - r.top) / r.height);
    }
    return moments.length - 0.001;
  }

  let queued = 0;
  const update = () => { queued = 0; show(position()); };
  const request = () => { if (!queued) queued = requestAnimationFrame(update); };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request);
  addEventListener('pageshow', request); // back/forward restores the scroll position
  update();
}
