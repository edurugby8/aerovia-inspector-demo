# Storyboard y decisiones de recursos

Una sola escena 3D continua, en metros y a escala real, recorrida con una única progresión de scroll `p ∈ [0, 1]` sobre unas 5 alturas de pantalla. Los textos son HTML encima del lienzo. Después de la secuencia sigue la web normal: servicios, proceso, ejemplo de informe y contacto. Un enlace «Saltar la experiencia» y el botón «Solicitar inspección» llevan al contenido sin recorrerla.

## Escala de referencia

| Elemento | Valor del modelo | Nota |
| --- | --- | --- |
| Dron | 0,9 m entre motores en diagonal, hélices de 0,53 m | Multirrotor industrial genérico, sin marca |
| Aerogenerador | Buje a 100 m, rotor de 120 m (palas de 58 m) | Genérico terrestre; inclinación del eje 5°, conicidad 2,5° |
| Rotor | Bloqueado: pala B horizontal hacia la izquierda vista de frente | Giro horario visto desde barlovento: el borde de ataque de la pala B queda arriba |
| Separación de demostración | 5 m entre la envolvente completa del dron (hélices incluidas) y cualquier superficie | Parámetro de la demo, no una distancia reglamentaria |

## Actos

| Acto | Progreso | Cámara | Dron | HTML |
| --- | --- | --- | --- | --- |
| 1 · Presentación | 0–0,18 | A 2–3 m del dron, tres cuartos, ligeramente elevada; horizonte estable | En vuelo estacionario; hélices en movimiento ambiental | Titular «Inspección aérea. Criterio de ingeniería.», CTA «Solicitar inspección» y «Ver el proceso», a la izquierda en escritorio y abajo en móvil |
| 2 · Aproximación | 0,18–0,48 | Se aleja y se eleva con suavidad (giro total < 90°, sin vueltas) hasta un tres cuartos elevado que muestra dron y aerogenerador | Vuela hacia la punta de la pala B por una curva amplia, con inclinación coherente con la aceleración | Rótulo de escala del modelo |
| 3 · Inspección | 0,48–0,78 | Seguimiento elevado por detrás y por encima del dron, siempre a barlovento del rotor | Recorre la pala B de la punta hacia la raíz a distancia constante; el gimbal apunta a la superficie | Zona de captura en la pala; marcador «Simulación de inspección» en un defecto de ejemplo |
| 4 · Resultado | 0,78–1 | Se eleva y se abre al parque eólico | Se mantiene junto a la pala | La captura pasa a una ficha de informe de demostración, «pendiente de revisión profesional» |

Formatos: encuadres propios para pantallas anchas y verticales (posiciones, objetivo y campo de visión), no un recorte del mismo plano.

## Decisiones de recursos

- **Modelos 3D:** no hay a mano un dron industrial ni un aerogenerador en glTF con licencia compatible que se puedan obtener sin cuentas ni compras, y descargar recursos de terceros requiere la aprobación del cliente. Se modelan **por código** (TypeScript + three.js), a escala real y con materiales PBR y texturas procedurales. Son trabajo propio de este repositorio. No son fotogrametría ni CAD del fabricante, y así se indica en ASSETS.md.
- **Iluminación:** cielo procedural de hora azul y mapa de entorno generado en el navegador (sin HDRI externo), luz lateral fría y relleno suave, sombras reales. Sin desenfoque ni posprocesado que finja realismo.
- **Tipografía:** IBM Plex Sans e IBM Plex Mono, autoalojadas (OFL 1.1).
- **Logo:** el PNG original, sin redibujar ni invertir, sobre una placa clara del mismo tono que su fondo. Falta una versión vectorial o transparente.
- **Imágenes de respaldo** (movimiento reducido, sin WebGL): fotogramas renderizados de la propia escena, versionados en la compilación.

## Lo que no se muestra como real

- Cifras, testimonios ni certificaciones del cliente.
- Termografía, LiDAR o detección automática.
- La distancia de seguridad: es un parámetro de la demo.
- El informe y el defecto: son simulaciones, rotuladas como tales.
- El formulario: no envía nada mientras no haya un destino configurado.
