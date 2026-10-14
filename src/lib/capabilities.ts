import { useEffect, useState } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';
/**
 * Too low a window for the pinned stage to show its texts beside the scene: a phone held
 * sideways, or a laptop at 200 % zoom. Those get the static version, which reflows.
 */
const SHORT = '(max-height: 539px), (max-aspect-ratio: 9/10) and (max-height: 599px)';

function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export const usePrefersReducedMotion = () => useMedia(REDUCED);
export const useShortViewport = () => useMedia(SHORT);

/** Can this browser draw the scene at all? (A context that can be created, not a benchmark.) */
export function hasWebGL() {
  try {
    if (new URLSearchParams(location.search).has('nowebgl')) return false;
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    const ok = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

/** Lighter geometry, shadows and resolution on phones and modest machines. */
export function pickQuality(): 'high' | 'low' {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  return small || weak ? 'low' : 'high';
}
