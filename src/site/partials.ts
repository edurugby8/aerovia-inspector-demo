// What every page shares, written into each page's HTML when Vite serves or builds it (see
// vite.config.ts): the head, the header with its menu, the footer, and the blocks of content
// that come from src/content/site.ts. Links are absolute under the site's base, so a page
// works the same opened directly, reloaded, or reached from any other page.
import { brand, contact, cta, footer, pages, process, report, services, type PageId } from '../content/site.ts';

/** Each page and its HTML file, in menu order, plus the 404 page GitHub Pages serves for unknown paths. */
export const PAGE_FILES: { id: PageId | 'error'; file: string }[] = [
  ...pages.map((p) => ({ id: p.id, file: `${p.path}index.html` })),
  { id: 'error', file: '404.html' },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LOGO = '/src/assets/brand/aerovia-logo.webp';

export interface PartialContext { base: string; siteUrl: string; file: string; ogImage: string }

/** Which page a served or built HTML file is (by its path relative to the project root). */
export function pageOf(file: string): PageId | 'error' {
  const rel = file.replace(/\\/g, '/').replace(/^\/+/, '');
  return PAGE_FILES.find((p) => p.file === rel)?.id ?? 'error';
}

function head(html: string, ctx: PartialContext, id: PageId | 'error') {
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? brand.name;
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  const page = pages.find((p) => p.id === id);
  const url = ctx.siteUrl && page ? `${ctx.siteUrl.replace(/\/$/, '')}/${page.path}` : '';
  return [
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
    '<meta name="theme-color" content="#071321" />',
    `<link rel="icon" type="image/png" href="${ctx.base}favicon.png" />`,
    `<link rel="apple-touch-icon" href="${ctx.base}apple-touch-icon.png" />`,
    '<link rel="stylesheet" href="/src/styles/site.css" />',
    '<script type="module" src="/src/site/main.ts"></script>',
    '<meta property="og:type" content="website" />',
    '<meta property="og:locale" content="es_ES" />',
    `<meta property="og:site_name" content="${esc(brand.name)}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${ctx.siteUrl ? ctx.siteUrl.replace(/\/$/, '') + '/' : ctx.base}${ctx.ogImage}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="Recreación 3D: dron de inspección junto a la pala de un aerogenerador, sobre fondo azul marino" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    ...(url ? [`<meta property="og:url" content="${url}" />`, `<link rel="canonical" href="${url}" />`] : []),
  ].join('\n    ');
}

function menuLinks(base: string, id: PageId | 'error') {
  return pages.map((p) => `<li><a href="${base}${p.path}"${p.id === id ? ' aria-current="page"' : ''}>${esc(p.label)}</a></li>`).join('');
}

function header(ctx: PartialContext, id: PageId | 'error') {
  const { base } = ctx;
  const quote = id === 'contacto' ? '' : `<a class="btn btn-solid btn-small header-cta" href="${base}${cta.primary.path}">${esc(cta.primary.label)}</a>`;
  return `<a class="skip-link" href="#contenido">Saltar al contenido</a>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand-plate" href="${base}"${id === 'inicio' ? ' aria-current="page"' : ''} aria-label="${esc(brand.name)}, inicio"><img src="${LOGO}" alt="${esc(brand.name)}" width="519" height="480" /></a>
        <nav class="nav" aria-label="Principal"><ul>${menuLinks(base, id)}</ul></nav>
        ${quote}
        <details class="nav-mobile">
          <summary><span class="nav-mobile__icon" aria-hidden="true"></span><span>Menú</span></summary>
          <nav class="nav-mobile__panel" aria-label="Principal">
            <ul>${menuLinks(base, id)}</ul>
            <a class="btn btn-solid" href="${base}${cta.primary.path}">${esc(cta.primary.label)}</a>
          </nav>
        </details>
      </div>
    </header>`;
}

function contactLine() {
  const parts = [contact.email && `<a href="mailto:${contact.email}">${contact.email}</a>`, contact.phone && `<a href="tel:${contact.phone.replace(/\s/g, '')}">${contact.phone}</a>`].filter(Boolean);
  return parts.length ? parts.join(' · ') : esc(contact.pendingNote);
}

function siteFooter(ctx: PartialContext) {
  const { base } = ctx;
  return `<footer class="site-footer">
      <div class="wrap site-footer__grid">
        <div>
          <p class="site-footer__title">${esc(brand.name)}</p>
          <p>${esc(brand.tagline)}.</p>
        </div>
        <nav aria-label="Pie de página"><ul>${pages.filter((p) => p.id !== 'inicio').map((p) => `<li><a href="${base}${p.path}">${esc(p.label)}</a></li>`).join('')}</ul></nav>
        <div>
          <p class="site-footer__title">Contacto</p>
          <p><a href="${base}${cta.primary.path}">${esc(cta.primary.label)}</a></p>
          <p class="site-footer__small">${contactLine()}</p>
        </div>
      </div>
      <div class="wrap site-footer__legal">
        <p>${esc(footer.demo)}</p>
        <p>${esc(footer.rights)}</p>
      </div>
    </footer>`;
}

function servicesBlock() {
  return `<ul class="service-list">${services.map((s, i) => `
          <li class="service">
            <p class="label">${String(i + 1).padStart(2, '0')}</p>
            <h2>${esc(s.title)}</h2>
            <p>${esc(s.text)}</p>
          </li>`).join('')}
        </ul>`;
}

function processBlock() {
  return `<ol class="steps">${process.map((s) => `
          <li class="step">
            <p class="step__n" aria-hidden="true">${s.step}</p>
            <div>
              <h2>${esc(s.title)}</h2>
              <p>${esc(s.text)}</p>
            </div>
          </li>`).join('')}
        </ol>`;
}

function reportFields() {
  return `<dl class="report__fields">${report.fields.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`;
}

function contactInclude() {
  return `<ul class="include">${contact.include.map((c) => `<li><b>${esc(c.title)}</b><span>${esc(c.text)}</span></li>`).join('')}</ul>`;
}

/** The request template on the contact page: the same points, ready to copy into a message. */
function contactTemplate() {
  return contact.include.map((c) => `${c.title}: `).join('\n');
}

/** Replaces every <!--site:...--> marker in a page with its HTML. */
export function renderPartials(html: string, ctx: PartialContext) {
  const id = pageOf(ctx.file);
  const blocks: Record<string, () => string> = {
    head: () => head(html, ctx, id),
    header: () => header(ctx, id),
    footer: () => siteFooter(ctx),
    services: servicesBlock,
    process: processBlock,
    'report-fields': reportFields,
    'report-badge': () => esc(report.badge),
    'report-note': () => esc(report.note),
    'contact-include': contactInclude,
    'contact-template': () => esc(contactTemplate()),
    'contact-line': contactLine,
    base: () => ctx.base,
  };
  return html.replace(/<!--site:([\w-]+)-->/g, (m, name: string) => {
    const make = blocks[name];
    if (!make) throw new Error(`Unknown site partial ${m} in ${ctx.file}`);
    return make();
  });
}
