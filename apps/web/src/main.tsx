import '@fontsource/anton';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import './styles/tokens.css';
import './styles/base.css';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Pantalla provisional de H1: solo demuestra que web → nginx/Vite → API → BD están conectados.
// Se sustituye por el router en H4.
function Health() {
  const [status, setStatus] = useState('comprobando…');
  useEffect(() => {
    fetch('/api/health')
      .then((r) => setStatus(r.ok ? 'API: ok · BD: ok' : `API respondió ${r.status}`))
      .catch(() => setStatus('API no disponible'));
  }, []);
  return (
    <main style={{ padding: 'var(--gutter)' }}>
      <h1 style={{ fontSize: 'clamp(3rem, 10vw, 6rem)' }}>Valorant Community</h1>
      <p>{status}</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Health />
  </StrictMode>,
);
