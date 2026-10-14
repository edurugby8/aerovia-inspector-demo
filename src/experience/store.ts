// Two tiny stores outside React: the scroll progress (written only by the scroll owner)
// and the screen positions of the in-scene annotations (written by the 3D frame loop).
// Readers subscribe and touch the DOM directly, so nothing re-renders 60 times a second.

type Listener = () => void;
function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set(next: T) { value = next; listeners.forEach((l) => l()); },
    subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

/** Normalised progress through the experience, 0…1. Owned by ScrollTrigger in useScrollProgress. */
export const progress = createStore(0);

export type ScreenPoint = { x: number; y: number; visible: boolean };
export type Annotations = {
  drone: ScreenPoint;
  /** The drone's outline on screen (px), propellers included. */
  droneRect: { l: number; t: number; r: number; b: number };
  hub: ScreenPoint;
  defect: ScreenPoint;
  opacity: { scale: number; capture: number; marker: number };
};
const hidden: ScreenPoint = { x: 0, y: 0, visible: false };
export const annotations = createStore<Annotations>({ drone: hidden, droneRect: { l: 0, t: 0, r: 0, b: 0 }, hub: hidden, defect: hidden, opacity: { scale: 0, capture: 0, marker: 0 } });
