// Guards for the brief: no claims the client has not confirmed, contact details never
// invented and no form without a destination, every simulated value labelled, a menu of
// real pages, and colour pairs that stay readable.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as site from '../src/content/site';
import { PAGE_FILES, pageOf, renderPartials } from '../src/site/partials';

const BASE = '/aerovia-inspector-demo/';
const files = PAGE_FILES.map((p) => p.file);
const raw = Object.fromEntries(files.map((f) => [f, readFileSync(f, 'utf8')]));
const built = Object.fromEntries(files.map((f) => [f, renderPartials(raw[f], { base: BASE, siteUrl: '', file: f, ogImage: 'og-image.jpg' })]));
const visible = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const everything = JSON.stringify(site) + Object.values(built).map(visible).join(' ');

describe('content', () => {
  it('makes none of the claims the brief rules out, on any page', () => {
    const banned = [
      /milim[eé]tric/i, /\bIA\b/, /inteligencia artificial/i, /\b24\s*h/i, /garantiz/i, /ahorro/i,
      /certificad/i, /homologad/i, /testimonio/i, /precisi[oó]n/i, /lidar/i, /termogr/i, /t[eé]rmic/i,
      /clientes? como/i, /\bl[ií]deres?\b/i, /\bn[uú]mero 1\b/i, /\ba[nñ]os de experiencia/i,
    ];
    for (const re of banned) expect(everything, String(re)).not.toMatch(re);
  });

  it('does not invent contact details, and shows no form without a destination', () => {
    expect(site.contact.email).toBeNull();
    expect(site.contact.phone).toBeNull();
    expect(everything).not.toMatch(/[\w.-]+@[\w-]+\.[a-z]{2,}/i);
    expect(everything).not.toMatch(/\+?\d[\d\s]{7,}\d/);
    for (const f of files) expect(built[f], f).not.toMatch(/<form\b|<input\b|<textarea\b/i);
    expect(visible(built['contacto/index.html'])).toContain(site.contact.pendingNote);
  });

  it('labels the recreation and the example data as such', () => {
    expect(site.report.badge).toMatch(/demostraci[oó]n/i);
    expect(site.report.note).toMatch(/demostraci[oó]n/i);
    expect(site.report.fields.find((f) => f.label === 'Activo')?.value).toMatch(/demostraci[oó]n/i);
    expect(site.report.fields.find((f) => f.label === 'Estado')?.value).toMatch(/pendiente/i);
    expect(site.footer.demo).toMatch(/recreaci[oó]n 3D/i);
    for (const f of ['inspeccion-eolica/index.html', 'informes/index.html']) expect(visible(built[f]), f).toMatch(/demostraci[oó]n/i);
    expect(visible(built['index.html'])).toMatch(/Recreación 3D/);
  });

  it('keeps the title, the calls to action and the four phases', () => {
    expect(site.hero.title).toBe('Inspección aérea. Criterio de ingeniería.');
    expect(site.cta.primary.label).toBe('Solicitar presupuesto');
    expect(site.process.map((s) => s.title)).toEqual(['Planificación', 'Captura', 'Revisión', 'Entrega']);
  });
});

describe('pages and navigation', () => {
  it('has the six pages, in this order, each a folder of its own', () => {
    expect(site.pages.map((p) => [p.label, p.path])).toEqual([
      ['Inicio', ''], ['Servicios', 'servicios/'], ['Inspección eólica', 'inspeccion-eolica/'],
      ['Cómo trabajamos', 'como-trabajamos/'], ['Informes', 'informes/'], ['Contacto', 'contacto/'],
    ]);
    for (const f of files) expect(existsSync(f), f).toBe(true);
  });

  it('fills in every shared part and leaves no marker behind', () => {
    for (const f of files) {
      expect(raw[f], f).toMatch(/<!--site:head-->[\s\S]*<!--site:header-->[\s\S]*<main id="contenido"[\s\S]*<!--site:footer-->/);
      expect(built[f], f).not.toMatch(/<!--site:/);
      expect(built[f], f).toMatch(/^<!doctype html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8" \/>/i);
    }
    expect(() => renderPartials('<!--site:nope-->', { base: BASE, siteUrl: '', file: 'index.html', ogImage: '' })).toThrow();
  });

  it('opens pages, not anchors, from the menu, and marks the current one', () => {
    for (const p of PAGE_FILES) {
      const html = built[p.file];
      const menu = html.match(/<nav class="nav" aria-label="Principal">([\s\S]*?)<\/nav>/)![1];
      const hrefs = [...menu.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      expect(hrefs).toEqual(site.pages.map((pg) => BASE + pg.path));
      const current = [...menu.matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]);
      expect(current, p.file).toEqual(p.id === 'error' ? [] : [BASE + site.pages.find((pg) => pg.id === p.id)!.path]);
    }
  });

  it('links every page with addresses that work from any depth', () => {
    for (const f of files) {
      for (const [, href] of built[f].matchAll(/<a [^>]*href="([^"]+)"/g)) {
        if (href.startsWith('#')) { expect(href).toBe('#contenido'); continue; }
        expect(href, `${f}: ${href}`).toMatch(new RegExp(`^${BASE}(${site.pages.filter((p) => p.path).map((p) => p.path).join('|')})?$`));
      }
    }
  });

  it('knows which page a file is', () => {
    expect(pageOf('index.html')).toBe('inicio');
    expect(pageOf('servicios/index.html')).toBe('servicios');
    expect(pageOf('/inspeccion-eolica/index.html')).toBe('inspeccion');
    expect(pageOf('404.html')).toBe('error');
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
  const bg = token('bg'), bg2 = token('bg-2'), surface = token('surface'), surface2 = token('surface-2'), footer = '#050f1b'; // .site-footer
  const grounds = { bg, bg2, surface, surface2, footer };
  it.each([
    ['text', token('text')],
    ['text-2', token('text-2')],
    ['accent-text', token('accent-text')],
  ])('%s reads at 4.5:1 or more on every background', (_, fg) => {
    for (const [name, ground] of Object.entries(grounds)) expect(ratio(fg, ground), name).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps button, badge and notice texts readable', () => {
    expect(ratio(bg, token('plate'))).toBeGreaterThanOrEqual(4.5); // .btn-solid
    expect(ratio(token('warn'), over(token('warn'), 0.1, bg))).toBeGreaterThanOrEqual(4.5); // .badge-demo on the page
    expect(ratio(token('warn'), over(token('warn'), 0.1, surface))).toBeGreaterThanOrEqual(4.5); // .badge-demo in a card
    expect(ratio('#f1dca9', over(token('warn'), 0.07, bg))).toBeGreaterThanOrEqual(4.5); // .notice
    expect(ratio(bg, token('text'))).toBeGreaterThanOrEqual(4.5); // .skip-link
  });

  it('draws focus rings at 3:1 or more', () => {
    for (const ground of [bg, bg2, surface, surface2]) expect(ratio(token('focus'), ground)).toBeGreaterThanOrEqual(3);
  });
});
