import { useEffect, useState } from 'react';
import type { CategoryResults } from '../../api/types';
import styles from './Ranking.module.css';

type Props = {
  results: CategoryResults;
  mine: string | null;
  nameOf: (id: string) => string;
  mapName: string;
  restLabel: (n: number) => string; // «Ver los 9 restantes» / «Ver las 5 restantes»
  headingId: string;
};

const VISIBLE = 5;
const BAR_MS = 450;

const votes = (n: number) => `${n} ${n === 1 ? 'voto' : 'votos'}`;
const percent = (count: number, total: number) => (total ? Math.round((count / total) * 100) : 0);

// Clasificación con escala común: cada barra es count/total sobre una pista del 100 %.
// Animación 2 (§7): con resultados nuevos, las barras van al ancho nuevo en el orden
// anterior; al terminar (450 ms) cambian a la vez recuentos, porcentajes, total y orden.
export function Ranking({ results, mine: latestMine, nameOf, mapName, restLabel, headingId }: Props) {
  // La marca «tu voto» cambia junto con los recuentos, no antes: durante la transición
  // nunca se muestra (ni se anuncia) una combinación que no existió.
  const [view, setView] = useState({ results, mine: latestMine });
  const [expanded, setExpanded] = useState(false);
  const shown = view.results;
  const mine = view.mine;

  useEffect(() => {
    if (results === view.results && latestMine === view.mine) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setView({ results, mine: latestMine }), reduced || results === view.results ? 0 : BAR_MS);
    return () => clearTimeout(t);
  }, [results, latestMine, view]);

  const sorted = (r: CategoryResults) =>
    r.counts
      .map((c) => ({ ...c, name: nameOf(c.optionId), total: r.total }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));

  // Opciones que entran por primera vez se añaden al final durante la transición.
  const base = sorted(shown);
  const known = new Set(base.map((r) => r.optionId));
  const added = sorted(results).filter((r) => !known.has(r.optionId));
  const latest = new Map(results.counts.map((c) => [c.optionId, c.count]));
  const rows = [...base, ...added.map((r) => ({ ...r, isNew: true }))];
  // Tu fila se ve siempre: si queda por debajo del corte, se añade separada.
  const mineIndex = rows.findIndex((r) => r.optionId === mine);
  const hidden = rows.length - VISIBLE - (mineIndex >= VISIBLE ? 1 : 0);
  const visible = expanded
    ? rows
    : mineIndex >= VISIBLE
      ? [...rows.slice(0, VISIBLE), rows[mineIndex]]
      : rows.slice(0, VISIBLE);
  const total = added.length && !shown.total ? results.total : shown.total;

  return (
    <div className={styles.ranking}>
      <h3 className={styles.heading} id={headingId}>
        La comunidad · <span className={styles.num}>{votes(total)}</span>
      </h3>
      {rows.length === 0 ? (
        <p className={styles.empty}>Aún no hay votos en {mapName}. El primero puede ser el tuyo.</p>
      ) : (
        <>
          <ol className={styles.list} aria-labelledby={headingId}>
            {visible.map((r, i) => {
              const isMine = r.optionId === mine;
              const pct = percent(r.count, r.total);
              const scale = results.total ? (latest.get(r.optionId) ?? 0) / results.total : 0;
              const detached = !expanded && i === VISIBLE; // tu fila, separada del top 5
              return (
                <li
                  key={r.optionId}
                  className={detached ? `${styles.row} ${styles.detached}` : styles.row}
                  data-mine={isMine || undefined}
                >
                  <span className="visually-hidden">
                    {`${r.name}, ${votes(r.count)}, ${pct} por ciento${isMine ? ', tu voto' : ''}`}
                  </span>
                  <span className={styles.name} aria-hidden="true">
                    {isMine && <span className={styles.dot} />}
                    <span className={styles.label}>{r.name}</span>
                    {isMine && <span className={styles.tag}>tu voto</span>}
                  </span>
                  <span className={styles.track} aria-hidden="true">
                    <span
                      className={`${styles.bar} ${'isNew' in r ? styles.entering : ''}`}
                      style={{ transform: `scaleX(${scale})` }}
                    />
                  </span>
                  <span className={styles.num} aria-hidden="true">
                    {r.count} · {pct} %
                  </span>
                </li>
              );
            })}
          </ol>
          {(hidden > 0 || expanded) && (
            <button type="button" className={styles.more} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Ver menos' : restLabel(hidden)}
            </button>
          )}
        </>
      )}
    </div>
  );
}
