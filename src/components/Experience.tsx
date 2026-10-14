// The scroll experience: a sticky stage over a 5-viewport track. The canvas is loaded on
// demand; the texts are HTML from the first paint. Reduced motion, a missing WebGL, a
// lost context or a scene error all fall back to the static version with the same content.
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { acts, cta, hero, inspection, scaleNote } from '../content/site';
import { TRACK_VH } from '../experience/config';
import { remap, smoothstep } from '../experience/math';
import { annotations, progress } from '../experience/store';
import type { Stage } from '../experience/Scene';
import { hasWebGL, pickQuality, usePrefersReducedMotion, useShortViewport } from '../lib/capabilities';
import { scrollToY } from '../lib/navigate';
import { still } from '../lib/stills';
import { scrollYForProgress, useScrollProgress } from '../lib/useScrollProgress';
import ReportCard from './ReportCard';
import StaticExperience from './StaticExperience';

const Scene = lazy(() => import('../experience/Scene'));

class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** [fade-in start, fully in, start fading out, fully out] on the progress. */
const WINDOWS: [number, number, number, number][] = [
  [-1, 0, 0.13, 0.19],
  [0.22, 0.27, 0.42, 0.47],
  [0.51, 0.55, 0.72, 0.77],
  [0.82, 0.87, 2, 3],
];
const actOpacity = (p: number, [a, b, c, d]: [number, number, number, number]) => smoothstep(remap(p, a, b)) * (1 - smoothstep(remap(p, c, d)));

export default function Experience() {
  const reduced = usePrefersReducedMotion();
  const short = useShortViewport();
  const [webgl] = useState(hasWebGL);
  const [broken, setBroken] = useState(false);
  const reason = reduced ? 'reduced' : !webgl ? 'nowebgl' : broken ? 'error' : short ? 'short' : null;
  if (reason) return <StaticExperience reason={reason} />;
  return <ScrollExperience onBroken={() => setBroken(true)} />;
}

function ScrollExperience({ onBroken }: { onBroken: () => void }) {
  const track = useRef<HTMLElement>(null);
  const actRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [stage, setStage] = useState<0 | Stage>(0);
  const [running, setRunning] = useState(true);
  const quality = useMemo(pickQuality, []);
  // build-time hooks for the stills script: ?still (no ambient motion), ?p=0.63 (fixed progress)
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const motion = !params.has('still');
  const fixedP = params.get('p');
  useScrollProgress(track, fixedP === null);
  useEffect(() => { if (fixedP !== null) progress.set(Math.min(1, Math.max(0, Number(fixedP)))); }, [fixedP]);

  // pause the frame loop when the stage is off screen or the tab is hidden
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    let onScreen = true, visible = !document.hidden;
    const apply = () => setRunning(onScreen && visible);
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; apply(); });
    io.observe(el);
    const vis = () => { visible = !document.hidden; apply(); };
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);

  // act texts follow the same progress as the scene
  useEffect(() => {
    const apply = () => {
      const p = progress.get();
      actRefs.current.forEach((el, i) => {
        if (!el) return;
        const o = actOpacity(p, WINDOWS[i]);
        el.style.opacity = o.toFixed(3);
        el.style.transform = `translate3d(0, ${((1 - o) * 14).toFixed(1)}px, 0)`;
        el.dataset.active = o > 0.5 ? 'true' : 'false';
      });
    };
    apply();
    return progress.subscribe(apply);
  }, []);

  /** A keyboard user who tabs into an act brings it into view. */
  const reveal = (i: number) => () => {
    if (!track.current) return;
    const [, b, c] = WINDOWS[i];
    const p = progress.get();
    if (p < b || p > c) scrollToY(scrollYForProgress(track.current, Math.max(0, (b + Math.min(c, 1)) / 2)), { instant: true });
  };

  const onStage = useCallback((s: Stage) => setStage((cur) => (s > cur ? s : cur)), []);
  const poster = useMemo(() => ({ wide: still('act1-wide'), tall: still('act1-tall') }), []);

  return (
    <section id="inspeccion" className="xp" ref={track} aria-labelledby="hero-title" data-top="start" style={{ '--track': TRACK_VH } as CSSProperties}>
      <div className="xp-stage">
        {poster.wide && (
          <picture className={`xp-poster${stage === 3 ? ' is-hidden' : ''}`} aria-hidden="true">
            {poster.tall && <source media="(max-aspect-ratio: 9/10)" srcSet={poster.tall} />}
            <img src={poster.wide} alt="" fetchPriority="high" decoding="async" />
          </picture>
        )}
        <div className="xp-canvas" aria-hidden="true">
          <Boundary onError={onBroken}>
            <Suspense fallback={null}>
              <Scene motion={motion} quality={quality} running={running} onStage={onStage} onLost={onBroken} />
            </Suspense>
          </Boundary>
        </div>
        <div className="xp-shade" aria-hidden="true" />

        {acts.map((act, i) => (
          <div key={act.id} className={`act act-${i + 1}`} ref={(el) => { actRefs.current[i] = el; }} onFocus={reveal(i)}>
            <div className="act-text">
              <p className="label label-accent">{i === 0 ? hero.eyebrow : act.kicker}</p>
              {i === 0
                ? <h1 className="h1" id="hero-title">{act.title}</h1>
                : <h2 className="h2">{act.title}</h2>}
              <p className="lead">{act.text}</p>
              {i === 0 && (
                <div className="act-actions">
                  <a className="btn btn-primary" href={cta.primary.href}>{cta.primary.label}</a>
                  <a className="btn btn-ghost" href={cta.secondary.href}>{cta.secondary.label}</a>
                </div>
              )}
              {i === 1 && <p className="act-note">{scaleNote.clearance}</p>}
            </div>
            {i === 3 && <ReportCard />}
          </div>
        ))}

        <Annotations />
        <LoadStatus stage={stage} />
        <a className="xp-skip label" href={cta.skip.href}>{cta.skip.label} <span aria-hidden="true">↓</span></a>
      </div>
    </section>
  );
}

/** Scale labels and the inspection marker, pinned to points of the 3D scene. */
function Annotations() {
  const drone = useRef<HTMLDivElement>(null), hub = useRef<HTMLDivElement>(null), marker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const EDGE = 12; // px kept free at the screen edges
    const widths = new Map<HTMLElement, number>();
    const forget = () => widths.clear();
    // `gap` is the label's distance from its pin (CSS left/right of .pin-label)
    const place = (el: HTMLElement | null, pt: { x: number; y: number; visible: boolean }, opacity: number, gap: number) => {
      if (!el) return;
      const o = pt.visible ? opacity : 0;
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
      el.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`;
      if (o <= 0.01) return;
      // the label goes on the side with room; if neither has enough, it slides back inside
      const label = el.lastElementChild as HTMLElement;
      const w = widths.get(label) ?? label.offsetWidth;
      widths.set(label, w);
      const right = window.innerWidth - EDGE - pt.x - gap, left = pt.x - gap - EDGE;
      const flip = right < w && left > right;
      const room = flip ? left : right;
      const shift = room >= w ? 0 : flip ? w - room : room - w;
      el.classList.toggle('pin-flip', flip);
      label.style.translate = shift ? `${shift.toFixed(1)}px 0` : '';
    };
    const off = annotations.subscribe(() => {
      const a = annotations.get();
      place(drone.current, a.drone, a.opacity.scale, 34);
      // the drone's outline on screen, for the browser checks that keep texts off it
      const { l, t, r, b } = a.droneRect;
      if (drone.current) drone.current.dataset.box = `${l.toFixed(0)},${t.toFixed(0)},${r.toFixed(0)},${b.toFixed(0)}`;
      place(hub.current, a.hub, a.opacity.scale, 14);
      place(marker.current, a.defect, a.opacity.marker, 26);
    });
    window.addEventListener('resize', forget);
    document.fonts?.ready.then(forget);
    return () => { off(); window.removeEventListener('resize', forget); };
  }, []);
  return (
    <div className="annotations" aria-hidden="true">
      <div className="pin pin-drone" ref={drone}><span className="pin-ring" /><span className="pin-label">{scaleNote.drone}<small>{scaleNote.caption}</small></span></div>
      <div className="pin pin-hub" ref={hub}><span className="pin-dot" /><span className="pin-label">{scaleNote.rotor}</span></div>
      <div className="pin pin-defect" ref={marker}>
        <span className="pin-ring pin-ring-defect" />
        <span className="pin-label pin-label-defect"><strong>{inspection.marker}</strong>{inspection.observation.replace('Observación de ejemplo: ', '')}</span>
      </div>
    </div>
  );
}

const STEPS = ['Descargando el visor 3D', 'Construyendo la escena', 'Dibujando el primer fotograma'];
/** Real progress: each step is reported when it has actually finished. */
function LoadStatus({ stage }: { stage: 0 | Stage }) {
  if (stage === 3) return null;
  return (
    <div className="load" role="status" aria-live="polite">
      <span className="label">{STEPS[stage] ?? STEPS[2]} · {stage + 1}/3</span>
      <span className="load-bar"><span style={{ transform: `scaleX(${(stage + 1) / 3})` }} /></span>
    </div>
  );
}
