// Everything a non-developer may want to edit: texts, services, process, the example
// report and the contact set-up. Nothing here is a claim the client has not confirmed:
// services come from the client's current site (Inspector: "inspección aérea de
// infraestructuras, torres y más"; flight, review and report), and every number that
// belongs to the 3D scene is labelled as a model value or a simulation.

export type Link = { label: string; href: string };

export const brand = {
  name: 'AEROVIA INSPECTOR',
  short: 'AEROVIA',
  tagline: 'Inspección técnica con drones',
};

export const nav: Link[] = [
  { label: 'Inspección', href: '#inspeccion' },
  { label: 'Servicios', href: '#servicios' },
  { label: 'Proceso', href: '#proceso' },
  { label: 'Informe', href: '#informe' },
  { label: 'Contacto', href: '#contacto' },
];

export const cta = {
  primary: { label: 'Solicitar inspección', href: '#contacto' },
  secondary: { label: 'Ver el proceso', href: '#proceso' },
  skip: { label: 'Saltar la experiencia', href: '#servicios' },
};

export const hero = {
  eyebrow: 'AEROVIA INSPECTOR · Inspección técnica con drones',
  title: 'Inspección aérea. Criterio de ingeniería.',
  lead:
    'Inspección visual con drones de aerogeneradores, torres e infraestructuras, ' +
    'con un informe de fotografías localizadas para la revisión de su equipo de ingeniería.',
};

/** The four acts of the scroll experience; `at` is where each text is fully visible. */
export const acts = [
  {
    id: 'presentacion',
    kicker: '01 · Presentación',
    title: hero.title,
    text: hero.lead,
  },
  {
    id: 'aproximacion',
    kicker: '02 · Aproximación',
    title: 'La escala real, antes de volar',
    text:
      'Un dron de 0,9 m entre motores frente a un rotor de 120 m: la escala del modelo 3D. En esta ' +
      'simulación el aerogenerador está detenido y el rotor bloqueado; el dron llega por una trayectoria amplia y visible.',
  },
  {
    id: 'inspeccion',
    kicker: '03 · Inspección',
    title: 'La cámara mira la pala',
    text:
      'El dron recorre la pala a distancia constante y el gimbal mantiene la superficie en el encuadre. ' +
      'La zona marcada es la que se está capturando.',
  },
  {
    id: 'resultado',
    kicker: '04 · Resultado',
    title: 'Cada imagen, con su sitio en el informe',
    text:
      'La captura queda asociada al activo, a la pala y a su posición. La observación espera la revisión de un profesional.',
  },
] as const;

/** Values that belong to the 3D model, shown so the scale reads true. Not equipment specs. */
export const scaleNote = {
  drone: 'Dron · 0,9 m',
  rotor: 'Rotor · 120 m',
  caption: 'Entre motores',
  clearance: 'Separación de la simulación: 5 m con la pala. No es una distancia reglamentaria.',
};

export const inspection = {
  marker: 'Simulación de inspección',
  observation: 'Observación de ejemplo: posible erosión del borde de ataque',
  capture: 'Zona de captura',
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
  { step: '04', title: 'Informe', text: 'Entregamos las fotografías localizadas y las observaciones en un informe técnico, como base para las decisiones de su equipo.' },
];

/** The example report: every field is invented for the demo and labelled as such. */
export const report = {
  badge: 'Simulación · datos de ejemplo',
  title: 'Ejemplo de informe',
  intro: 'Así queda una observación dentro del informe. Los datos y la imagen proceden de la escena 3D de esta demo.',
  fields: [
    { label: 'Activo', value: 'Aerogenerador AG-07 (activo de demostración)' },
    { label: 'Componente', value: 'Pala B' },
    { label: 'Zona', value: 'Borde de ataque, a unos 42 m de la raíz' },
    { label: 'Observación', value: 'Posible erosión del borde de ataque' },
    { label: 'Estado', value: 'Pendiente de revisión profesional' },
  ],
  imageAlt: 'Captura simulada desde la cámara del dron: tramo de pala con una zona de erosión marcada en el borde de ataque',
  note: 'Informe de demostración. No contiene mediciones, diagnósticos ni recomendaciones reales.',
};

/**
 * Contact set-up. While `endpoint` is null the form says it does not send anything and never
 * pretends to. Email and phone stay null until AEROVIA confirms them.
 */
export const contact = {
  title: 'Solicitar inspección',
  intro: 'Cuéntenos qué activo necesita revisar y dónde está. Le responderemos para planificar la inspección.',
  endpoint: null as string | null,
  email: null as string | null,
  phone: null as string | null,
  pendingNote: 'Datos de contacto pendientes de confirmar por AEROVIA.',
  demoNote: 'Formulario de demostración: todavía no tiene un destino configurado y no envía mensajes.',
  notSent: 'No se ha enviado nada. Este formulario es una demostración sin destino configurado; sus datos no salen de este navegador.',
  assetTypes: ['Aerogenerador', 'Torre', 'Otra infraestructura'],
};

export const footer = {
  line: 'AEROVIA INSPECTOR · Inspección técnica con drones',
  demo: 'Demo: la escena 3D, el defecto y el informe son simulaciones con datos de ejemplo.',
  rights: '© 2026 AEROVIA',
};
