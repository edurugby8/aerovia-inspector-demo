// Animation and safety configuration of the scroll experience, in one place.

/** The four acts on the single normalised progress p ∈ [0, 1]. */
export const ACTS = [
  { id: 'presentacion', from: 0, to: 0.18 },
  { id: 'aproximacion', from: 0.18, to: 0.48 },
  { id: 'inspeccion', from: 0.48, to: 0.78 },
  { id: 'resultado', from: 0.78, to: 1 },
] as const;
export type ActId = (typeof ACTS)[number]['id'];

/** Where each act's still is taken (fallback images, screenshots). */
export const ACT_STILLS: Record<ActId, number> = { presentacion: 0.04, aproximacion: 0.42, inspeccion: 0.63, resultado: 0.97 };

/**
 * Minimum distance, in metres, between the drone's whole envelope (propeller discs
 * included) and any surface of the turbine. A parameter of this simulation, not a
 * regulatory distance.
 */
export const CLEARANCE = 5;

/** Drone centre relative to blade B's pitch axis during the pass (world metres). */
export const STANDOFF = { up: 4.2, upwind: 6.5 };

/** Length of the experience in viewport heights. */
export const TRACK_VH = 5;

/**
 * Seconds an unhurried read of the whole experience takes. Only used to give the drone a
 * physically plausible tilt for the path's accelerations; nothing runs on a clock.
 */
export const NOMINAL_SCROLL_S = 40;
