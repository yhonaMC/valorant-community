import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { api, ApiRequestError } from '../../api/client';
import { setSession, useCatalog, useSession } from '../../api/queries';
import type { User } from '../../api/types';
import styles from './AccessPage.module.css';
import { safeReturn } from './safeReturn';
import { ErrorIcon } from '../../Icons';

type Mode = 'login' | 'register';

export function AccessPage() {
  const [params] = useSearchParams();
  const volver = safeReturn(params.get('volver'));
  const session = useSession();
  const catalog = useCatalog();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('login');
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const submit = useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<User>(mode === 'login' ? '/auth/login' : '/auth/register', 'POST', body),
    onSuccess: (user) => setSession(queryClient, user),
  });

  const error = submit.error instanceof ApiRequestError ? submit.error : null;
  const fields = error?.fields ?? {};
  // Mensaje general si ningún campo del formulario lo recoge (p. ej. 401 de login).
  const general = error && !fields.email && !fields.password ? error.message : null;

  // Tras un error, el foco va al primer campo inválido.
  useEffect(() => {
    if (fields.email) emailRef.current?.focus();
    else if (fields.password) passwordRef.current?.focus();
  }, [submit.error]);

  if (session.data) return <Navigate to={volver} replace />;

  const mapId = volver.match(/^\/mapas\/([^/?#]+)/)?.[1];
  const mapName = mapId && catalog.data?.maps.find((m) => m.id === mapId)?.name;
  const title = mapName
    ? `${mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'} para votar en ${mapName}`
    : mode === 'login'
      ? 'Iniciar sesión'
      : 'Crear cuenta';

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submit.isPending) return;
    const data = new FormData(e.currentTarget);
    submit.mutate({ email: String(data.get('email')), password: String(data.get('password')) });
  }

  function switchMode(next: Mode) {
    setMode(next);
    submit.reset();
  }

  const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

  return (
    <div className={`page ${styles.page}`}>
      <title>{`${title} · Valorant Community`}</title>
      <h1 className={styles.title}>{title}</h1>

      <div className={styles.modes} role="group" aria-label="Tipo de acceso">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={styles.mode}
            aria-pressed={mode === m}
            onClick={() => switchMode(m)}
          >
            {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        ))}
      </div>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            required
            aria-invalid={fields.email ? true : undefined}
            aria-describedby={describedBy(fields.email && 'email-error')}
          />
          {fields.email && <FieldError id="email-error">{fields.email}</FieldError>}
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Contraseña</label>
          <p className={styles.hint} id="password-hint">
            Entre 8 y 72 caracteres.
          </p>
          <input
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            aria-invalid={fields.password ? true : undefined}
            aria-describedby={describedBy('password-hint', fields.password && 'password-error')}
          />
          {fields.password && <FieldError id="password-error">{fields.password}</FieldError>}
        </div>

        {general && (
          <p className={styles.general} role="alert">
            <ErrorIcon className={styles.icon} />
            {general}
          </p>
        )}

        <button type="submit" className="button" aria-disabled={submit.isPending}>
          {submit.isPending
            ? mode === 'login'
              ? 'Entrando…'
              : 'Creando cuenta…'
            : mode === 'login'
              ? 'Iniciar sesión'
              : 'Crear cuenta'}
        </button>
      </form>
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p className={styles.fieldError} id={id}>
      <ErrorIcon className={styles.icon} />
      {children}
    </p>
  );
}
