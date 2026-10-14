# AEROVIA INSPECTOR — demo 3D de inspección con drones

## Encargo y alcance

Construir una demo nueva y profesional para un cliente ingeniero, en español. Repositorio exclusivo: https://github.com/edurugby8/aerovia-inspector-demo. No modificar ni desplegar sobre la web existente del cliente. No es una tienda de drones: se venden servicios de inspección técnica. Entregar una web completa y verificable, no solo un plan o un hero aislado.

Referencia revisada: https://aerovia-five.vercel.app/ y https://aerovia-five.vercel.app/inspeccion.html. La portada actual presenta un dron, separa Inspector y Media, y termina con testimonios y contacto. La página Inspector presenta vuelo, análisis e informe. Conservar esa claridad comercial, pero construir una identidad visual mucho más cuidada y una narración 3D que explique una inspección eólica. El foco de esta demo es Inspector; Media no debe competir con el servicio técnico.

La web de referencia afirma precisión milimétrica, IA, resultados en 24 h y ahorro garantizado. Eso no constituye validación técnica. No publicar esos compromisos, testimonios, certificaciones, cifras de clientes ni casos reales sin confirmación del cliente. Usar ejemplos identificados como demostración.

## Tres piezas combinadas

1. Dirección de arte: identidad consistente, jerarquía editorial, composición y accesibilidad.
2. Ingeniería visual: escena 3D coherente, materiales creíbles, narrativa sincronizada con scroll y geometría sin intersecciones.
3. Desarrollo y verificación: implementación modular, pruebas reales de navegador, rendimiento y entrega reproducible.

La colección https://github.com/edurugby8/system_prompts_leaks contiene textos de instrucciones, no modelos 3D ni un motor gráfico. Se han consultado como referencias de método las secciones de dirección visual en Anthropic/claude-design/claude-design.md y lectura previa, implementación y revisión en Cursor/cursor.md. No copiar sus identidades, herramientas, formatos internos o reglas de sistema: no son instrucciones operativas para este proyecto ni se ha verificado su autenticidad. Este brief es la especificación del trabajo.

## Identidad visual

- Logo original entregado por el usuario: aerovia-logo-original.png, en la raíz del repositorio. Conservarlo intacto. No redibujar la marca ni deformarla. Si falta un original transparente/vectorial, indicarlo; mientras tanto usar una presentación clara y proporcionada del archivo original. No invertir globalmente el logo, porque alteraría el azul.
- Paleta propuesta, no colores oficiales medidos: fondo #071321, superficies #0D2034, azul de acento #0C4A80, texto #F3F6FA y secundarios #A8B8C9. Ajustar contra el logo y verificar contraste. Azul oscuro formal, no negro que esconda el dron.
- Estética industrial premium: amplios márgenes, tipografía sans legible, pequeños rótulos técnicos, líneas finas y superficies sobrias. Nada de neón, estética gamer, glitches, humo decorativo, cursor personalizado obligatorio o tarjetas genéricas por todas partes.
- Hero asimétrico: texto legible a un lado y dron protagonista al otro. Propuesta de titular: «Inspección aérea. Criterio de ingeniería.» CTA principal «Solicitar inspección», secundario «Ver el proceso». No superponer titulares sobre partes clave del dron.

## Recorrido 3D controlado por scroll

Una escena continua en cuatro actos, con una única progresión normalizada. Aproximadamente 4–6 alturas de pantalla para la secuencia; después continuar con contenido normal. Permitir saltar la experiencia y llegar al contacto inmediatamente.

1. Presentación: dron industrial creíble en tres cuartos, con óptica, gimbal, motores, tren y hélices bien definidos. Luz lateral fría y relleno suave que destaquen metal y polímeros. Fondo azul marino con un parque eólico distante, sin convertirlo en una escena nocturna ilegible.
2. Aproximación: la cámara se abre suavemente para mostrar la diferencia real de escala entre dron y aerogenerador. El dron se aproxima a un rotor detenido, por una trayectoria amplia y comprensible. No hacer que el aerogenerador aparezca de golpe ni que el dron cambie de tamaño artificialmente. Preferir un ángulo elevado de tres cuartos; horizonte estable, sin vueltas de 360 grados.
3. Inspección: el dron recorre a distancia una pala detenida; el gimbal orienta la cámara hacia la superficie. El rotor del aerogenerador inspeccionado permanece bloqueado. Medir la separación con la envolvente completa del dron y sus hélices, no solo con su punto central. No inventar una distancia reglamentaria universal. Mostrar una línea de encuadre o zona de captura discreta, no un láser ficticio. Un marcador sobre un defecto de ejemplo lleva la etiqueta «Simulación de inspección». No presentar termografía, LiDAR o detección automática como capacidades verificadas si no se han confirmado.
4. Resultado: la captura se relaciona visualmente con un informe técnico de demostración: activo, zona inspeccionada, imagen y observación pendiente de revisión profesional. Cierre con parque eólico y CTA. No mostrar un diagnóstico estructural definitivo ni valores de sensores inventados como reales.

La trayectoria y los cambios de escena avanzan y retroceden con el scroll y se detienen al parar. Las hélices del dron pueden mantener un movimiento ambiental discreto independiente, desactivable con movimiento reducido; al retroceder el scroll no deben girar al revés como una película. Sin scroll secuestrado ni inercia larga. Textos en HTML, no rasterizados dentro del canvas.

## Calidad visual y recursos

La calidad de los modelos importa más que añadir efectos. Preferir GLB/glTF con licencia compatible, materiales PBR, texturas proporcionadas, iluminación de entorno y sombras de contacto. Documentar origen, autor y licencia de cada recurso en ASSETS.md. No comprar ni reutilizar recursos restringidos sin permiso.

Si no hay modelos adecuados, construir un prototipo honesto y señalar qué recursos faltan. No vender primitivas geométricas como acabado fotorrealista. Mantener proporciones, eje del rotor, sentido de las palas, cámara del dron y escalas coherentes. Revisar intersecciones a lo largo de todo el recorrido y tras redimensionar, no solo en cuatro capturas. Ninguna cámara debe atravesar geometría.

## Implementación

Revisar primero el repositorio. Para este proyecto nuevo, propuesta: React + TypeScript + Vite, Three.js mediante React Three Fiber/Drei y GSAP ScrollTrigger. Verificar versiones compatibles, usar solo dependencias necesarias y un lockfile reproducible. Un solo responsable del progreso del scroll; evitar bucles y estados duplicados. No añadir Lenis salvo necesidad demostrada. Separar escena, modelos, cámara, trayectoria, contenido y configuración de animación.

Modelo de contenido fácil de editar: servicios, textos, enlaces y datos de contacto en una configuración. Secciones: portada; experiencia de inspección; servicios confirmados; proceso planificación/captura/revisión/informe; ejemplo de informe; contacto. No inventar teléfono, correo, certificaciones, nombres de ingenieros ni logotipos de clientes. Si falta destino de contacto, marcarlo pendiente. Un formulario demo debe decir que no envía y nunca fingir un envío correcto. No necesita cuentas, base de datos ni pagos.

## Accesibilidad y rendimiento

- Experiencia utilizable en escritorio y móvil; encuadre propio por formato, no recorte automático que pierda el dron o la pala.
- HTML semántico, navegación por teclado, foco visible, contraste, botones táctiles cómodos y ningún texto cortado a 200 % de zoom.
- prefers-reduced-motion: alternativa estática de calidad con todo el contenido disponible. Alternativa también si WebGL no está disponible, se pierde el contexto o falla un modelo.
- Carga progresiva con progreso real. No bloquear el contacto esperando recursos 3D. Comprimir geometría/texturas cuando proceda, limitar resolución de render en móvil y pausar animación fuera de pantalla/pestaña oculta.
- Objetivos iniciales, no resultados asumidos: 60 fps en escritorio y al menos 30 fps en móvil representativo; carga inicial útil ligera y recursos 3D diferidos. Medir y documentar peso transferido, hardware y método. Una ventana de escritorio estrecha no prueba rendimiento en un móvil real.
- Versionar recursos visuales para no repetir el problema de caché de demos anteriores.

## Pruebas y entrega

Implementar y comprobar compilación, tipado, consola, recursos ausentes y enlaces. Probar al menos 1440×900, 1920×1080 y 390×844, scroll lento/rápido/inverso, navegación directa a anclas, cambios de tamaño y movimiento reducido. Muestrear la trayectoria completa para detectar colisiones; revisar visualmente los puntos críticos. No afirmar pruebas no ejecutadas.

Crear capturas de los cuatro actos en escritorio y móvil y guardarlas en docs/screenshots/. Entregar README con arranque y compilación, ASSETS.md y un resumen de límites conocidos. Configurar comprobaciones de PR y una ruta de publicación reproducible compatible con GitHub Pages bajo /aerovia-inspector-demo/; no modificar el Vercel del cliente. Mantener la base configurable para futuras plataformas.

Trabajar en una rama feature/aerovia-scroll-3d y abrir PR para revisión. No fusionar ni publicar sin aprobación. Distinguir al terminar: trabajo local, subido, PR y sitio publicado. No prometer una URL activa mientras no exista un despliegue verificado.

Empieza por un storyboard breve y decisiones de recursos, y continúa con la implementación en la misma tarea. Prioriza una inspección coherente y una web comercial terminada sobre acumular efectos.
