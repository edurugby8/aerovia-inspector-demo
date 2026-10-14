// Guards for the brief: no claims the client has not confirmed, contact details never
// invented, every simulated value labelled, and colour pairs that stay readable.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as site from '../src/content/site';

const text = JSON.stringify(site);

describe('content', () => {
  it('makes none of the claims the brief rules out', () => {
    const banned = [
      /milim[eé]tric/i, /\bIA\b/, /inteligencia artificial/i, /\b24\s*h/i, /garantiz/i, /ahorro/i,
      /certificad/i, /homologad/i, /testimonio/i, /precisi[oó]n/i, /lidar/i, /termogr/i, /t[eé]rmic/i,
    ];
    for (const re of banned) expect(text, String(re)).not.toMatch(re);
  });

  it('does not invent contact details or a destination for the form', () => {
    expect(site.contact.endpoint).toBeNull();
    expect(site.contact.email).toBeNull();
    expect(site.contact.phone).toBeNull();
    expect(text).not.toMatch(/[\w.-]+@[\w-]+\.[a-z]{2,}/i);
    expect(text).not.toMatch(/\+?\d[\d\s]{7,}\d/);
    expect(site.contact.demoNote).toMatch(/no env[ií]a/i);
    expect(site.contact.notSent).toMatch(/no se ha enviado/i);
  });

  it('labels the simulation and the example data as such', () => {
    expect(site.inspection.marker).toMatch(/simulaci[oó]n/i);
    expect(site.report.badge).toMatch(/simulaci[oó]n/i);
    expect(site.report.note).toMatch(/demostraci[oó]n/i);
    expect(site.report.fields.find((f) => f.label === 'Activo')?.value).toMatch(/demostraci[oó]n/i);
    expect(site.report.fields.find((f) => f.label === 'Estado')?.value).toMatch(/pendiente/i);
    expect(site.scaleNote.clearance).toMatch(/no es una distancia reglamentaria/i);
    expect(site.footer.demo).toMatch(/simulaci/i);
  });

  it('keeps the CTAs and section anchors the brief asks for', () => {
    expect(site.cta.primary.label).toBe('Solicitar inspección');
    expect(site.cta.secondary.label).toBe('Ver el proceso');
    expect(site.hero.title).toBe('Inspección aérea. Criterio de ingeniería.');
    expect(site.process.map((s) => s.title)).toEqual(['Planificación', 'Captura', 'Revisión', 'Informe']);
    const ids = ['#inspeccion', '#servicios', '#proceso', '#informe', '#contacto'];
    expect(site.nav.map((l) => l.href)).toEqual(ids);
  });
});

// ------------------------------------------------------------------ contrast (WCAG 2.x)
const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
const token = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** A translucent colour laid over an opaque one. */
const over = (fg: string, alpha: number, bg: string) =>
  '#' + rgb(fg).map((c, i) => Math.round(c * alpha + rgb(bg)[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('');

describe('contrast', () => {
  const bg = token('bg'), bg2 = token('bg-2'), surface = token('surface'), footer = '#050f1b'; // .site-footer
  const grounds = { bg, bg2, surface, footer };
  it.each([
    ['text', token('text')],
    ['text-2', token('text-2')],
    ['accent-text', token('accent-text')],
  ])('%s reads at 4.5:1 or more on every background', (_, fg) => {
    for (const [name, ground] of Object.entries(grounds)) expect(ratio(fg, ground), name).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps button, badge and notice texts readable', () => {
    expect(ratio('#ffffff', token('accent'))).toBeGreaterThanOrEqual(4.5); // .btn-primary
    expect(ratio('#ffffff', token('accent-hover'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token('warn'), surface)).toBeGreaterThanOrEqual(4.5); // .badge-sim
    expect(ratio('#f1dca9', over(token('warn'), 0.12, surface))).toBeGreaterThanOrEqual(4.5); // .badge-pending
    expect(ratio('#f1dca9', over(token('warn'), 0.08, surface))).toBeGreaterThanOrEqual(4.5); // .form-status
    expect(ratio(bg, token('text'))).toBeGreaterThanOrEqual(4.5); // .skip-link
  });

  it('draws focus rings and field borders at 3:1 or more', () => {
    for (const ground of [bg, bg2, surface]) expect(ratio(token('focus'), ground)).toBeGreaterThanOrEqual(3);
    for (const ground of [bg, surface]) expect(ratio(token('field-line'), ground)).toBeGreaterThanOrEqual(3);
  });
});
