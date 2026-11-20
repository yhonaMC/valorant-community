import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { api } from './api/client';
import { setSession, useSession } from './api/queries';
import styles from './Layout.module.css';

export function Layout() {
  const session = useSession();
  const queryClient = useQueryClient();
  const location = useLocation();
  const logout = useMutation({
    mutationFn: () => api<void>('/auth/logout', 'POST'),
    onSuccess: () => setSession(queryClient, null),
  });

  const here = location.pathname + location.search;
  const loginHref =
    location.pathname === '/acceso' ? '/acceso' : `/acceso?volver=${encodeURIComponent(here)}`;

  return (
    <>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Principal">
          <Link to="/" className={styles.brand}>
            Valorant Community
          </Link>
          <div className={styles.account}>
            {session.data ? (
              <>
                <span className={styles.email}>{session.data.email}</span>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => !logout.isPending && logout.mutate()}
                  aria-disabled={logout.isPending}
                >
                  {logout.isPending ? 'Saliendo…' : 'Salir'}
                </button>
              </>
            ) : session.data === null && location.pathname !== '/acceso' ? (
              <Link to={loginHref} className={styles.action}>
                Iniciar sesión
              </Link>
            ) : null}
          </div>
        </nav>
      </header>
      <main className={styles.main}>
        {/* La clave reinicia la animación de entrada en cada cambio de pantalla (login, mapa, volver). */}
        <div key={location.pathname} className={styles.screen}>
          <Outlet />
        </div>
      </main>
      <ScrollRestoration />
    </>
  );
}
