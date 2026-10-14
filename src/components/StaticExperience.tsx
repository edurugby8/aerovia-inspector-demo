// The same four acts as still images rendered from the 3D scene, for reduced motion, for
// browsers without WebGL and whenever the 3D view fails. All the content stays available.
import { acts, cta, hero, inspection, scaleNote } from '../content/site';
import { STILL_SIZE, still } from '../lib/stills';
import ReportCard from './ReportCard';

const ALT = [
  'Dron industrial en vuelo estacionario, en tres cuartos, con su gimbal y su cámara bajo el morro; al fondo, un parque eólico al anochecer',
  'Vista elevada del dron junto a un aerogenerador detenido: un dron de 0,9 m entre motores frente a un rotor de 120 m',
  'El dron recorre una pala detenida a distancia constante; la zona de captura está marcada sobre el borde de ataque',
  'Vista elevada del aerogenerador inspeccionado y del parque eólico al atardecer',
];
const REASON = {
  reduced: 'Movimiento reducido activado: el recorrido 3D se muestra como imágenes fijas de la misma escena.',
  nowebgl: 'Este navegador no puede mostrar la escena 3D: se muestran imágenes fijas de la misma escena.',
  error: 'La escena 3D no ha podido cargarse: se muestran imágenes fijas de la misma escena.',
  short: 'La ventana es demasiado baja para el recorrido 3D: se muestran imágenes fijas de la misma escena.',
};

export default function StaticExperience({ reason }: { reason: keyof typeof REASON }) {
  return (
    <section id="inspeccion" className="xp-static" aria-labelledby="hero-title" data-top="start">
      {acts.map((act, i) => {
        const wide = still(`act${i + 1}-wide`), tall = still(`act${i + 1}-tall`);
        return (
          <article key={act.id} className={`still still-${i + 1}`}>
            {wide && (
              <picture className="still-media">
                {tall && <source media="(max-aspect-ratio: 9/10)" srcSet={tall} width={STILL_SIZE.tall[0]} height={STILL_SIZE.tall[1]} />}
                <img src={wide} alt={ALT[i]} width={STILL_SIZE.wide[0]} height={STILL_SIZE.wide[1]} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
              </picture>
            )}
            <div className="still-copy wrap">
              <p className="label label-accent">{i === 0 ? hero.eyebrow : act.kicker}</p>
              {i === 0 ? <h1 className="h1" id="hero-title">{act.title}</h1> : <h2 className="h2">{act.title}</h2>}
              <p className="lead">{act.text}</p>
              {i === 0 && (
                <div className="act-actions">
                  <a className="btn btn-primary" href={cta.primary.href}>{cta.primary.label}</a>
                  <a className="btn btn-ghost" href={cta.secondary.href}>{cta.secondary.label}</a>
                </div>
              )}
              {i === 1 && <p className="act-note">{scaleNote.clearance}</p>}
              {i === 2 && <p className="act-note"><strong>{inspection.marker}.</strong> {inspection.observation}.</p>}
              {i === 3 && <ReportCard />}
              {i === 0 && <p className="xp-static-note">{REASON[reason]}</p>}
            </div>
          </article>
        );
      })}
    </section>
  );
}
