# Recursos: origen, autoría y licencia

No se ha descargado ningún modelo, textura ni imagen de terceros. El único recurso visual de terceros es un HDRI CC0, y solo lo usaron los renders de una propuesta anterior: no forma parte de la web (detalle en «Propuestas de rediseño»). El resto de lo visual es trabajo propio de este repositorio o deriva del logo que entregó el cliente. Las demás piezas de terceros son tipografías y bibliotecas de código, todas con licencia compatible.

El repositorio no incluye un archivo LICENSE: los derechos sobre el código y los recursos propios los decide su titular.

## Modelos 3D (propios, generados por código)

| Recurso | Archivo | Cómo se hace | Escala |
| --- | --- | --- | --- |
| Dron multirrotor industrial genérico (provisional) | [src/experience/models/drone.ts](src/experience/models/drone.ts) | Ver detalle debajo | 0,9 m entre motores en diagonal, hélices de 21″ (0,53 m) |
| Aerogenerador terrestre genérico | [src/experience/models/turbine.ts](src/experience/models/turbine.ts) | Ver detalle debajo | Buje a 100 m, rotor de 120 m |
| Terreno, plataforma, camino, crestas y parque eólico | [src/experience/models/landscape.ts](src/experience/models/landscape.ts) | Relieve por ruido determinista; 18 turbinas del parque con la misma geometría simplificada | Terreno de 12 × 12 km |

**Dron:**

- Fuselaje, brazos plegables con bisagras, motores con ranuras de ventilación y hélices con perfil aerodinámico.
- Gimbal de tres ejes con cámara de zoom y gran angular, pares estéreo de visión, antenas RTK en cúpula sobre mástiles plegables, bahía con dos baterías (asa, cierre e indicador de carga), tren de aterrizaje con sus casquillos y luces de navegación.
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

[propuestas/surfaces.ts](propuestas/surfaces.ts) genera, para los renders de estudio, la pintura de la pala en medidas reales (cinta de protección, suciedad, picado), la erosión de ejemplo del detalle (recubrimiento, masilla y laminado, picaduras y surcos) y el desenfoque de las hélices. La luz de estudio y el fondo azul marino salen de [propuestas/studio.ts](propuestas/studio.ts): no hay HDRI.

## Imágenes de la web (renderizadas desde la escena)

Son renders con trazado de rayos de la escena de estudio ([propuestas/scene.ts](propuestas/scene.ts), [propuestas/studio.ts](propuestas/studio.ts), [propuestas/surfaces.ts](propuestas/surfaces.ts)), hechos con [scripts/render-propuestas.mjs](scripts/render-propuestas.mjs). Los originales y sus parámetros (`*.json`) están en [docs/rediseno-web/render](docs/rediseno-web/render). [scripts/site-images.mjs](scripts/site-images.mjs) (`npm run images`) los copia a `src/assets/site/`, con versiones reducidas, y la build les añade un hash de contenido.

| Archivo | Uso |
| --- | --- |
| `inicio-escritorio`, `inicio-movil` | Portada de Inicio (escritorio y móvil) |
| `dron` | Momento 1 de la inspección, Servicios y acceso de Inicio |
| `momento-2` | Momento 2 de la inspección, acceso destacado de Inicio y Cómo trabajamos |
| `detalle` | Momento 3 de la inspección |
| `captura` | La captura de la cámara del dron: final de la inspección e informe de ejemplo |
| `public/og-image.jpg` | Imagen para compartir en redes, recortada de la portada |

Todas son recreaciones 3D y así se indica en la web. Las capturas de [docs/screenshots](docs/screenshots) las genera `node e2e/run.mjs --shots=docs/screenshots`.

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
| three.js (modelos y renders; no va en la web) | three.js authors | MIT |
| three-gpu-pathtracer (renders; no va en la web) | Garrett Johnson | MIT |
| three-mesh-bvh (renders y tests) | Garrett Johnson | MIT |
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
- **Imágenes reales:** fotografías de inspecciones reales del cliente para el informe de ejemplo, con permiso del propietario del activo.

Hasta entonces, los modelos son prototipos honestos: correctos en escala, proporciones, eje del rotor y sentido de las palas. El dron es el recurso provisional que más se nota; en la web todo se presenta como recreación 3D.
