// The commercial page after the experience: services, process, the example report and contact.
import { useRef, useState, type FormEvent } from 'react';
import { contact, process, report, services } from '../content/site';
import { STILL_SIZE, still } from '../lib/stills';

export function Services() {
  return (
    <section id="servicios" className="section" aria-labelledby="servicios-title">
      <div className="wrap">
        <header className="section-head">
          <p className="label label-accent">Servicios</p>
          <h2 className="h2" id="servicios-title">Inspección visual con drones para activos en altura</h2>
          <p className="lead">Lo que hoy ofrece AEROVIA INSPECTOR, explicado sin promesas que no se puedan comprobar.</p>
        </header>
        <ol className="rows">
          {services.map((s, i) => (
            <li key={s.title} className="row">
              <span className="row-num label" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="h3">{s.title}</h3>
              <p className="muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Process() {
  return (
    <section id="proceso" className="section section-alt" aria-labelledby="proceso-title">
      <div className="wrap">
        <header className="section-head">
          <p className="label label-accent">Proceso</p>
          <h2 className="h2" id="proceso-title">De la planificación al informe</h2>
        </header>
        <ol className="steps">
          {process.map((s) => (
            <li key={s.step} className="step">
              <span className="step-num label">{s.step}</span>
              <h3 className="h3">{s.title}</h3>
              <p className="muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Report() {
  const image = still('capture');
  return (
    <section id="informe" className="section" aria-labelledby="informe-title">
      <div className="wrap report-layout">
        <header className="section-head">
          <p className="label label-accent">Ejemplo</p>
          <h2 className="h2" id="informe-title">{report.title}</h2>
          <p className="lead">{report.intro}</p>
        </header>
        <article className="sheet" aria-label="Informe técnico de demostración">
          <header className="sheet-head">
            <span className="label">Informe técnico · ficha de observación</span>
            <span className="badge badge-sim">{report.badge}</span>
          </header>
          <figure className="sheet-figure">
            {image
              ? <img src={image} alt={report.imageAlt} width={STILL_SIZE.capture[0]} height={STILL_SIZE.capture[1]} loading="lazy" decoding="async" />
              : <div className="sheet-placeholder" role="img" aria-label={report.imageAlt} />}
            <figcaption className="label">Captura simulada · cámara del dron, zoom</figcaption>
          </figure>
          <dl className="sheet-fields">
            {report.fields.map((f) => (
              <div key={f.label} className={f.label === 'Estado' ? 'field field-status' : 'field'}>
                <dt className="label">{f.label}</dt>
                <dd>{f.label === 'Estado' ? <span className="badge badge-pending">{f.value}</span> : f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="sheet-note">{report.note}</p>
        </article>
      </div>
    </section>
  );
}

export function Contact() {
  const [status, setStatus] = useState<'idle' | 'notSent'>('idle');
  const statusRef = useRef<HTMLParagraphElement>(null);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    // No destination configured: say so plainly, keep what was typed, never fake a success.
    setStatus('notSent');
    requestAnimationFrame(() => statusRef.current?.focus());
  };
  return (
    <section id="contacto" className="section section-alt" aria-labelledby="contacto-title">
      <div className="wrap contact-layout">
        <header className="section-head">
          <p className="label label-accent">Contacto</p>
          <h2 className="h2" id="contacto-title">{contact.title}</h2>
          <p className="lead">{contact.intro}</p>
          <p className="pending"><span className="badge badge-pending">Pendiente</span> {contact.pendingNote}</p>
        </header>
        <form className="form" onSubmit={submit} noValidate={false} aria-describedby="form-demo-note">
          <p id="form-demo-note" className="form-note">{contact.demoNote}</p>
          <div className="form-grid">
            <label className="fld"><span className="label">Nombre</span><input name="nombre" autoComplete="name" required /></label>
            <label className="fld"><span className="label">Empresa</span><input name="empresa" autoComplete="organization" /></label>
            <label className="fld"><span className="label">Correo electrónico</span><input name="correo" type="email" autoComplete="email" required /></label>
            <label className="fld">
              <span className="label">Tipo de activo</span>
              <select name="activo" defaultValue={contact.assetTypes[0]}>{contact.assetTypes.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className="fld fld-wide"><span className="label">Ubicación del activo</span><input name="ubicacion" autoComplete="address-level2" /></label>
            <label className="fld fld-wide"><span className="label">Qué necesita inspeccionar</span><textarea name="mensaje" rows={4} /></label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Preparar solicitud</button>
          </div>
          <p ref={statusRef} tabIndex={-1} className={`form-status${status === 'notSent' ? ' is-visible' : ''}`} role="status">
            {status === 'notSent' ? contact.notSent : ''}
          </p>
        </form>
      </div>
    </section>
  );
}
