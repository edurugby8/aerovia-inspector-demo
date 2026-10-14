// The single owner of the experience's progress: one ScrollTrigger over the track, no
// smoothing and no inertia, so the scene follows the scroll exactly and stops with it.
import { useEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { progress } from '../experience/store';

gsap.registerPlugin(ScrollTrigger);

export function useScrollProgress(track: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = track.current;
    if (!enabled || !el) return undefined;
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => progress.set(self.progress),
      onRefresh: (self) => progress.set(self.progress),
    });
    progress.set(st.progress);
    return () => st.kill();
  }, [track, enabled]);
}

/** Page offset of a given progress inside the track (to bring an act into view). */
export function scrollYForProgress(track: HTMLElement, p: number) {
  const top = track.getBoundingClientRect().top + window.scrollY;
  return top + p * Math.max(0, track.offsetHeight - window.innerHeight);
}
