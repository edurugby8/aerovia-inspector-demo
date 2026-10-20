// What a non-developer may want to edit and what every page shares: the brand, the pages and
// their order in the menu, the calls to action, the services, the process, the example report
// and the contact set-up. Nothing here is a claim the client has not confirmed: the services
// come from the client's current site (Inspector: "inspección aérea de infraestructuras,
// torres y más"; flight, review and report), and everything that comes from the 3D scene is
// labelled as a recreation or a demonstration. Page bodies live in the HTML of each page.

export type PageId = 'inicio' | 'servicios' | 'inspeccion' | 'proceso' | 'informes' | 'contacto';
export type Page = { id: PageId; label: string; path: string };

export const brand = {
  name: 'AEROVIA INSPECTOR',
  short: 'AEROVIA',
  tagline: 'Inspección técnica con drones',
};

/** The menu, in order. `path` is relative to the site's base (/aerovia-inspector-demo/ on GitHub Pages). */
export const pages: Page[] = [
  { id: 'inicio', label: 'Inicio', path: '' },
  { id: 'servicios', label: 'Servicios', path: 'servicios/' },
  { id: 'inspeccion', label: 'Inspección eólica', path: 'inspeccion-eolica/' },
  { id: 'proceso', label: 'Cómo trabajamos', path: 'como-trabajamos/' },
  { id: 'informes', label: 'Informes', path: 'informes/' },
  { id: 'contacto', label: 'Contacto', path: 'contacto/' },
];

export const cta = {
  primary: { label: 'Solicitar presupuesto', path: 'contacto/' },
  secondary: { label: 'Ver la inspección eólica', path: 'inspeccion-eolica/' },
};

export const hero = {
  eyebrow: 'Inspección técnica con drones',
  title: 'Inspección aérea. Criterio de ingeniería.',
  lead:
    'Inspección visual con drones de aerogeneradores, torres e infraestructuras, ' +
    'con un informe de fotografías localizadas para la revisión de su equipo de ingeniería.',
};

export const services = [
  {
    title: 'Aerogeneradores',
    text: 'Inspección visual de palas, buje, góndola y torre, con el aerogenerador detenido y el rotor bloqueado durante el vuelo cercano.',
  },
  {
    title: 'Torres e infraestructuras',
    text: 'Captura aérea de torres y estructuras de acceso difícil, para revisar desde cerca lo que desde el suelo no se ve.',
  },
  {
    title: 'Informe técnico',
    text: 'Fotografías localizadas por activo, componente y posición, con las observaciones ordenadas para su equipo.',
  },
];

export const process = [
  { step: '01', title: 'Planificación', text: 'Definimos con su equipo el activo, los componentes que se revisan, la ventana de vuelo y las condiciones de seguridad del emplazamiento.' },
  { step: '02', title: 'Captura', text: 'Vuelo sistemático alrededor del activo para cubrir cada superficie, con la cámara orientada al componente y no al paisaje.' },
  { step: '03', title: 'Revisión', text: 'Las imágenes se ordenan por componente y posición. Las posibles anomalías se marcan para que las evalúe un profesional.' },
  { step: '04', title: 'Entrega', text: 'Entregamos las fotografías localizadas y las observaciones en un informe técnico, como base para las decisiones de su equipo.' },
];

/** The three moments of the wind inspection page. */
export const moments = [
  { id: 'presentacion', kicker: '01 · Presentación', title: 'Junto a la pala', text: 'El dron se coloca frente al borde de ataque, con la cámara orientada a la superficie que se va a revisar.' },
  { id: 'recorrido', kicker: '02 · Recorrido', title: 'A lo largo de la superficie', text: 'El dron avanza a lo largo de la pala con una separación constante, y el gimbal mantiene la superficie en el encuadre.' },
  { id: 'detalle', kicker: '03 · Detalle', title: 'La zona que importa, de cerca', text: 'La cámara se acerca a la zona marcada. La captura queda localizada en la pala, lista para el informe.' },
];

/** The example report: every field is invented for the demo and labelled as such. */
export const report = {
  badge: 'Demostración · datos de ejemplo',
  title: 'Informe de ejemplo',
  intro: 'Así queda una observación dentro del informe. Los datos y las imágenes proceden de la recreación 3D de esta web.',
  fields: [
    { label: 'Activo', value: 'Aerogenerador AG-07 (activo de demostración)' },
    { label: 'Componente', value: 'Pala B' },
    { label: 'Zona', value: 'Borde de ataque, a unos 42 m de la raíz' },
    { label: 'Observación', value: 'Posible erosión del borde de ataque' },
    { label: 'Estado', value: 'Pendiente de revisión profesional' },
  ],
  imageAlt: 'Captura de la cámara del dron: tramo del borde de ataque de la pala con una zona de erosión',
  note: 'Informe de demostración. No contiene mediciones, diagnósticos ni recomendaciones reales.',
};

/**
 * Contact set-up. The contact page only offers a way to write once AEROVIA confirms an address;
 * until then it says the details are pending and never shows a form that pretends to send.
 */
export const contact = {
  title: 'Solicitar presupuesto',
  intro: 'Cuéntenos qué activo necesita revisar y dónde está. Le responderemos para planificar la inspección.',
  email: null as string | null,
  phone: null as string | null,
  pendingNote: 'Los datos de contacto de AEROVIA están pendientes de confirmar.',
  include: [
    { title: 'El activo', text: 'Aerogenerador, torre u otra infraestructura, y su modelo si lo conoce.' },
    { title: 'Dónde está', text: 'Ubicación del emplazamiento y condiciones de acceso.' },
    { title: 'Qué revisar', text: 'Componentes o zonas de interés, por ejemplo las palas o una parte concreta.' },
    { title: 'Cuándo', text: 'Fechas o ventana de trabajo preferidas.' },
    { title: 'Quién', text: 'Persona de contacto de su equipo.' },
  ],
};

export const footer = {
  line: 'AEROVIA INSPECTOR · Inspección técnica con drones',
  demo: 'Imágenes: recreación 3D. El informe de ejemplo contiene datos de demostración.',
  rights: '© 2026 AEROVIA',
};
