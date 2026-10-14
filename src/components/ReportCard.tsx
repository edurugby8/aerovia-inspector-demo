// The captured frame filed into a (demonstration) report: asset, zone, image, observation, status.
import { report } from '../content/site';
import { STILL_SIZE, still } from '../lib/stills';

export default function ReportCard() {
  const image = still('capture');
  const field = (label: string) => report.fields.find((f) => f.label === label)?.value ?? '';
  return (
    <div className="act-card">
      <div className="act-card-head">
        <span className="label">Informe técnico · ejemplo</span>
        <span className="badge badge-sim">Simulación</span>
      </div>
      {image
        ? <img className="act-card-img" src={image} alt={report.imageAlt} width={STILL_SIZE.capture[0]} height={STILL_SIZE.capture[1]} loading="lazy" decoding="async" />
        : <div className="act-card-img" role="img" aria-label={report.imageAlt} />}
      <dl className="act-card-fields">
        <div><dt className="label">Activo</dt><dd>{field('Activo')}</dd></div>
        <div><dt className="label">Zona</dt><dd>{field('Componente')} · {field('Zona').toLowerCase()}</dd></div>
        <div><dt className="label">Observación</dt><dd>{field('Observación')}</dd></div>
        <div><dt className="label">Estado</dt><dd><span className="badge badge-pending">{field('Estado')}</span></dd></div>
      </dl>
      <a className="act-link" href="#informe">Ver el ejemplo completo <span aria-hidden="true">→</span></a>
    </div>
  );
}
