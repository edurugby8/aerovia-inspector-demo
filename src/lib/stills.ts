// Stills rendered from the 3D scene by scripts/render-stills.mjs (hashed by the build, so
// a new render is never served from cache). Missing files simply mean "not rendered yet".
const files = import.meta.glob('../assets/stills/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

export function still(name: string): string | null {
  return files[`../assets/stills/${name}.webp`] ?? null;
}

/** Pixel size of the rendered stills, reserved in the layout before they load. */
export const STILL_SIZE = { wide: [1920, 1080], tall: [1080, 2340], capture: [1600, 1000] } as const;
