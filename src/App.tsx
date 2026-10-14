import { useEffect } from 'react';
import Experience from './components/Experience';
import Footer from './components/Footer';
import Header from './components/Header';
import { Contact, Process, Report, Services } from './components/Sections';
import { goTo, installAnchorNavigation } from './lib/navigate';

export default function App() {
  useEffect(() => installAnchorNavigation(), []);
  // a shared link to a section (#contacto, #informe…) lands there directly
  useEffect(() => {
    if (location.hash && location.hash !== '#inspeccion') requestAnimationFrame(() => goTo(location.hash, { instant: true }));
  }, []);
  return (
    <>
      <a className="skip-link" href="#servicios">Saltar al contenido</a>
      <Header />
      <main id="contenido">
        <Experience />
        <Services />
        <Process />
        <Report />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
