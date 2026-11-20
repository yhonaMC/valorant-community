import '@fontsource/anton';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import './styles/tokens.css';
import './styles/base.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Link, RouterProvider } from 'react-router';
import { Layout } from './Layout';
import { AccessPage } from './features/auth/AccessPage';
import { MapDetailPage } from './features/map-detail/MapDetailPage';
import { MapsPage } from './features/maps/MapsPage';

function NotFoundPage() {
  return (
    <div className="page">
      <title>Página no encontrada · Valorant Community</title>
      <h1 className="page-title">Página no encontrada</h1>
      <p>
        Esta dirección no existe. <Link to="/">Volver a los mapas</Link>
      </p>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <MapsPage /> },
      { path: '/mapas/:mapId', element: <MapDetailPage /> },
      { path: '/acceso', element: <AccessPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
