# Recursos: origen, autoría y licencia

No se ha descargado ningún modelo, textura ni imagen de terceros. El único recurso visual de terceros es un HDRI CC0, y solo lo usan los renders de las propuestas: no forma parte de la web (detalle en «Propuestas de rediseño»). El resto de lo visual es trabajo propio de este repositorio o deriva del logo que entregó el cliente. Las demás piezas de terceros son tipografías y bibliotecas de código, todas con licencia compatible.

El repositorio no incluye un archivo LICENSE: los derechos sobre el código y los recursos propios los decide su titular.

## Modelos 3D (propios, generados por código)

| Recurso | Archivo | Cómo se hace | Escala |
| --- | --- | --- | --- |
| Dron multirrotor industrial genérico | [src/experience/models/drone.ts](src/experience/models/drone.ts) | Ver detalle debajo | 0,9 m entre motores en diagonal, hélices de 21″ (0,53 m) |
| Aerogenerador terrestre genérico | [src/experience/models/turbine.ts](src/experience/models/turbine.ts) | Ver detalle debajo | Buje a 100 m, rotor de 120 m |
| Terreno, plataforma, camino, crestas y parque eólico | [src/experience/models/landscape.ts](src/experience/models/landscape.ts) | Relieve por ruido determinista; 18 turbinas del parque con la misma geometría simplificada | Terreno de 12 × 12 km |

**Dron:**

- Fuselaje, brazos plegables con bisagras, motores con ranuras de ventilación y hélices con perfil aerodinámico.
- Gimbal de tres ejes con cámara de zoom y gran angular, pares estéreo de visión, antenas RTK, baterías, tren de aterrizaje y luces de navegación.
- No reproduce ningún modelo comercial ni lleva marca.

**Aerogenerador:**

- Palas con planta, torsión, espesor, curvatura previa y perfil reales de una pala de 58 m: perfil NACA con borde de salida romo y raíz circular.
- Góndola con intercambiador, mástil meteorológico, escotilla y luces de balizamiento.
- Torre troncocónica con puerta y cimentación.
- Rotor detenido con las palas en bandera.
- Es genérico y no reproduce ningún modelo comercial.

Estos modelos no son CAD de fabricante ni fotogrametría, y en la web no se presentan como fotorrealistas.

## Texturas y luz (propias, generadas en el navegador)

[src/experience/materials.ts](src/experience/materials.ts) dibuja en canvas al cargar la escena:

- tejido de carbono (color y relieve);
- grano del polímero;
- variación de pintura de las palas;
- disco de hélice en movimiento;
- la erosión de ejemplo del borde de ataque;
- las parcelas agrícolas del terreno.

El cielo de hora azul es un shader propio. El mapa de entorno se genera a partir de ese cielo en el navegador: no hay HDRI.

## Imágenes renderizadas desde la escena

Las genera [scripts/render-stills.mjs](scripts/render-stills.mjs) con la propia escena 3D, y se versionan con un hash de contenido en la build:

| Archivo | Uso |
| --- | --- |
| `src/assets/stills/act{1-4}-{wide,tall}.webp` | Póster mientras carga el 3D y versión estática (movimiento reducido, sin WebGL, errores, ventanas bajas) |
| `src/assets/stills/capture.webp` | «Captura» del ejemplo de informe: vista de la cámara del dron sobre la erosión simulada |
| `public/og-image.jpg` | Imagen para compartir en redes |

Las capturas de [docs/screenshots](docs/screenshots) las genera [e2e/doc-shots.mjs](e2e/doc-shots.mjs).

## Logo (del cliente)

| Archivo | Origen |
| --- | --- |
| `aerovia-logo-original.png` | Entregado por el cliente (1536 × 1024, fondo claro opaco) |
| `src/assets/brand/aerovia-logo.webp` | Recorte y escalado del original, sin redibujar, deformar ni invertir |
| `src/assets/brand/aerovia-symbol.webp` | Recorte del símbolo del original |
| `public/favicon.png`, `public/apple-touch-icon.png` | Símbolo recortado sobre el color de fondo del original |

Los derivados se generan con [scripts/brand-assets.mjs](scripts/brand-assets.mjs).

El logo se muestra sobre una placa clara del mismo tono que su fondo (#fbfaf8) para no recortarlo ni alterar sus colores sobre el azul oscuro.

**Falta una versión vectorial (SVG) o un PNG con fondo transparente.** Con ella el logo podría ir directamente sobre el fondo oscuro, en las variantes de color que defina la marca.

## Terceros

| Pieza | Autor | Licencia |
| --- | --- | --- |
| IBM Plex Sans, IBM Plex Mono (vía @fontsource) | IBM Corp. | SIL Open Font License 1.1 |
| three.js | three.js authors | MIT |
| React, React DOM | Meta Platforms | MIT |
| @react-three/fiber | Poimandres | MIT |
| GSAP y ScrollTrigger | GreenSock (Webflow) | GSAP Standard «no charge» License (https://gsap.com/standard-license) |
| three-mesh-bvh (solo en tests) | Garrett Johnson | MIT |
| Vite, Vitest, TypeScript, puppeteer-core (desarrollo) | Sus autores | MIT / Apache-2.0 |

Las versiones exactas están en `package.json` y `package-lock.json`.

## Propuestas de rediseño (`propuestas/`, fuera de la build)

| Recurso | Origen | Licencia |
| --- | --- | --- |
| Luz de estudio y fondo azul marino | Generados en código: [propuestas/studio.ts](propuestas/studio.ts) | Propio |
| Superficie de la pala, erosión de ejemplo y desenfoque de hélices | Generados en código: [propuestas/surfaces.ts](propuestas/surfaces.ts) | Propio |
| «Evening Road 01 (Pure Sky)», `evening_road_01_puresky_4k.hdr` (18 692 813 bytes, MD5 `3461499a68e8fe03ec42592f4bc2d5ef`) | Poly Haven; Sergej Majboroda (original) y Jarod Guest (retoque del cielo) | CC0: uso comercial y redistribución permitidos, sin atribución obligatoria (verificado en polyhaven.com/license el 15/10/2026) |

El HDRI se descargó con autorización el 16/10/2026 para los renders de la portada A revisada. No se sube al repositorio: lo descarga y verifica [scripts/descargar-hdri.mjs](scripts/descargar-hdri.mjs) en `propuestas/hdri/`. La dirección de estudio del rediseño multipágina no lo usa.

## Qué haría falta para el fotorrealismo

- **Dron:** un modelo glTF/GLB con licencia comercial y materiales PBR (texturas de 2–4 K), o el CAD del dron que use AEROVIA con permiso del fabricante.
- **Aerogenerador:** un modelo con licencia de un tipo concreto, o fotogrametría de un activo real con permiso del propietario.
- **Entorno:** un HDRI de atardecer con licencia (por ejemplo CC0) y terreno con ortofoto o texturas escaneadas.
- **Imágenes reales:** fotografías de inspecciones reales del cliente para el informe de ejemplo, con permiso del propietario del activo.

Hasta entonces, los modelos son prototipos honestos: correctos en escala, proporciones, eje del rotor y sentido de las palas, pero no realistas en detalle fino.
