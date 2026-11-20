import { Link, useNavigate } from 'react-router';
import { ApiRequestError } from '../../api/client';
import type { Category, MapResults } from '../../api/types';
import { CheckIcon, ErrorIcon } from '../../Icons';
import styles from './CategoryPanel.module.css';
import { OptionPicker } from './OptionPicker';
import { Ranking } from './Ranking';
import type { Option, Vote } from './useVote';

export const LABELS: Record<Category, { title: string; pick: string; rest: (n: number) => string }> = {
  agent: { title: 'Agente', pick: 'Elige agente', rest: (n) => `Ver los ${n} restantes` },
  weapon: { title: 'Arma', pick: 'Elige arma', rest: (n) => `Ver las ${n} restantes` },
};

type Props = {
  category: Category;
  mapId: string;
  mapName: string;
  options: Option[];
  results: MapResults | undefined; // undefined = cargando
  vote: Vote;
  showMyVote: boolean; // en móvil lo sustituye el resumen fijo
  accessHref: string;
};

export function CategoryPanel({ category, mapId, mapName, options, results, vote, showMyVote, accessHref }: Props) {
  const navigate = useNavigate();
  const label = LABELS[category];
  const id = `${category}-${mapId}`;
  const nameOf = (optionId: string) => options.find((o) => o.id === optionId)?.name ?? 'Opción desconocida';

  const visitor = results?.myVotes === null;
  const confirmed = results?.myVotes?.[category] ?? null;
  const pending = vote.isPending ? vote.variables : null;

  function select(optionId: string) {
    if (!results || vote.isPending) return;
    if (visitor) navigate(accessHref);
    else vote.mutate(optionId);
  }

  return (
    <>
      {showMyVote &&
        (results ? (
          <MyVote
            category={category}
            option={confirmed ? (options.find((o) => o.id === confirmed) ?? unknownOption(confirmed)) : null}
            visitor={visitor}
            status={vote.isPending ? 'saving' : vote.isSuccess ? 'saved' : null}
            accessHref={accessHref}
          />
        ) : (
          <div className={`${styles.myVote} ${styles.skeleton}`} aria-hidden="true" />
        ))}

      {results ? (
        <Ranking
          results={results[category]}
          mine={confirmed}
          nameOf={nameOf}
          mapName={mapName}
          restLabel={label.rest}
          headingId={`${id}-ranking`}
        />
      ) : (
        <div className={styles.rankingSkeleton} aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      )}

      <div className={styles.picker}>
        <h3 className={styles.pickTitle} id={`${id}-pick`}>
          {label.pick}
        </h3>
        {vote.isError && (
          <VoteError
            error={vote.error}
            attempted={nameOf(vote.variables)}
            before={vote.context?.before ? nameOf(vote.context.before) : null}
            onRetry={() => vote.mutate(vote.variables)}
            accessHref={accessHref}
          />
        )}
        <OptionPicker
          labelledBy={`${id}-pick`}
          layout={category === 'agent' ? 'faces' : 'rows'}
          options={options}
          confirmed={confirmed}
          pending={pending ?? null}
          busy={vote.isPending}
          onSelect={select}
        />
      </div>
    </>
  );
}

export function unknownOption(id: string): Option {
  return { id, name: 'Opción desconocida', detail: '', icon: '' };
}

function MyVote({
  category,
  option,
  visitor,
  status,
  accessHref,
}: {
  category: Category;
  option: Option | null;
  visitor: boolean;
  status: 'saving' | 'saved' | null;
  accessHref: string;
}) {
  return (
    <div className={styles.myVote}>
      <p className={styles.myVoteHead}>
        <span>Tu voto</span>
        <SaveStatus status={status} />
      </p>
      {visitor ? (
        <Link to={accessHref} className={styles.login}>
          Inicia sesión para votar
        </Link>
      ) : !option ? (
        <p className={styles.none}>Todavía no has votado en este mapa.</p>
      ) : (
        <div className={category === 'agent' ? styles.card : styles.weaponCard}>
          {category === 'agent' ? (
            <div className={styles.bust}>
              {option.portrait && <img src={option.portrait} alt="" width={2048} height={1860} />}
            </div>
          ) : (
            option.icon && <img className={styles.silhouette} src={option.icon} alt="" width={120} height={32} />
          )}
          <div>
            <p className={styles.choice}>{option.name}</p>
            {option.detail && <p className={styles.detail}>{option.detail}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function SaveStatus({ status }: { status: 'saving' | 'saved' | null }) {
  if (status === 'saving') return <span className={styles.saving}>Guardando…</span>;
  if (status === 'saved')
    return (
      <span className={styles.saved}>
        <CheckIcon size={14} /> Guardado
      </span>
    );
  return null;
}

function VoteError({
  error,
  attempted,
  before,
  onRetry,
  accessHref,
}: {
  error: Error;
  attempted: string;
  before: string | null;
  onRetry: () => void;
  accessHref: string;
}) {
  const expired = error instanceof ApiRequestError && error.statusCode === 401;
  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorText}>
        <ErrorIcon className={styles.errorIcon} />
        <span>
          No se pudo guardar tu voto por {attempted}.{' '}
          <strong>
            {before ? `Tu voto registrado sigue siendo ${before}.` : 'Todavía no tienes voto registrado en esta categoría.'}
          </strong>
          {expired && ' Tu sesión ha caducado.'}
        </span>
      </p>
      {expired ? (
        <Link to={accessHref} className="button button-secondary">
          Iniciar sesión
        </Link>
      ) : (
        <button type="button" className="button button-secondary" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
