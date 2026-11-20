import { useMemo, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useCatalog, useResults } from '../../api/queries';
import type { Catalog, Category, MapInfo } from '../../api/types';
import { ErrorIcon } from '../../Icons';
import { CatalogError } from '../maps/CatalogError';
import { CategoryPanel, LABELS, SaveStatus, unknownOption } from './CategoryPanel';
import styles from './MapDetailPage.module.css';
import { useVote, type Option, type Vote } from './useVote';

const CATEGORIES: Category[] = ['agent', 'weapon'];
const WIDE = '(min-width: 960px)';

export function MapDetailPage() {
  const { mapId } = useParams();
  const catalog = useCatalog();
  const map = catalog.data?.maps.find((m) => m.id === mapId);

  if (catalog.isError) {
    return (
      <div className="page">
        <BackLink />
        <h1 className="page-title">Mapa</h1>
        <CatalogError onRetry={() => catalog.refetch()} retrying={catalog.isFetching} />
      </div>
    );
  }

  if (catalog.isPending) {
    return (
      <div className={styles.band} aria-busy="true">
        <p className="visually-hidden" role="status">
          Cargando mapa…
        </p>
      </div>
    );
  }

  if (!map) {
    return (
      <div className="page">
        <title>Mapa no encontrado · Valorant Community</title>
        <BackLink />
        <h1 className="page-title">Mapa no encontrado</h1>
        <p>Este mapa no existe o no forma parte de la rotación competitiva.</p>
      </div>
    );
  }

  // key: al cambiar de mapa se reinicia el estado de las mutaciones y de las pestañas.
  return <MapDetail key={map.id} map={map} catalog={catalog.data} />;
}

function MapDetail({ map, catalog }: { map: MapInfo; catalog: Catalog }) {
  const results = useResults(map.id);
  const wide = useMediaQuery(WIDE);
  const [tab, setTab] = useState<Category>('agent');
  const [announcement, setAnnouncement] = useState('');

  const options = useMemo<Record<Category, Option[]>>(
    () => ({
      agent: catalog.agents.map((a) => ({ id: a.id, name: a.name, detail: a.role, icon: a.icon, portrait: a.portrait })),
      weapon: catalog.weapons.map((w) => ({ id: w.id, name: w.name, detail: w.category, icon: w.icon })),
    }),
    [catalog],
  );
  const find = (c: Category, id: string) => options[c].find((o) => o.id === id) ?? unknownOption(id);

  // Región aria-live: «Voto guardado: Omen». El espacio final alterno hace que se
  // anuncie también al repetir el mismo voto.
  const announce = (c: Category) => (id: string) =>
    setAnnouncement((prev) => `Voto guardado: ${find(c, id).name}${prev.endsWith(' ') ? '' : ' '}`);
  const votes: Record<Category, Vote> = {
    agent: useVote(map.id, 'agent', announce('agent')),
    weapon: useVote(map.id, 'weapon', announce('weapon')),
  };

  const accessHref = `/acceso?volver=${encodeURIComponent(`/mapas/${map.id}`)}`;

  function onTabKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = tab === 'agent' ? 'weapon' : 'agent';
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  return (
    <>
      <title>{`${map.name} · Valorant Community`}</title>
      <section className={styles.band} aria-labelledby="mapa-titulo">
        <img className={styles.image} src={map.image} width={1920} height={1080} alt="" fetchPriority="high" />
        <div className={styles.label}>
          <BackLink />
          <h1 className={styles.name} id="mapa-titulo">
            {map.name}
          </h1>
          <p className={styles.meta}>
            {map.sites} · {map.coordinates}
          </p>
        </div>
      </section>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      {results.isError ? (
        <div className={styles.content}>
          <div className={styles.loadError} role="alert">
            <p>
              <ErrorIcon className={styles.loadErrorIcon} size={20} />
              No pudimos cargar los votos de {map.name}.
            </p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => !results.isFetching && results.refetch()}
              aria-disabled={results.isFetching}
            >
              {results.isFetching ? 'Reintentando…' : 'Reintentar'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {!wide && (
            <div className={styles.summary}>
              <p className={styles.summaryTitle}>Tu voto</p>
              {results.data?.myVotes === null ? (
                <Link to={accessHref} className={styles.summaryLogin}>
                  Inicia sesión para votar
                </Link>
              ) : (
                <div className={styles.summaryItems}>
                  {CATEGORIES.map((c) => {
                    const id = results.data?.myVotes?.[c];
                    const o = id ? find(c, id) : null;
                    const status = votes[c].isPending ? 'saving' : votes[c].isSuccess ? 'saved' : null;
                    return (
                      <div key={c} className={styles.summaryItem}>
                        {o?.icon ? (
                          <img
                            className={c === 'agent' ? styles.summaryFace : styles.summaryWeapon}
                            src={o.icon}
                            alt=""
                            width={c === 'agent' ? 40 : 64}
                            height={c === 'agent' ? 40 : 18}
                          />
                        ) : null}
                        <span className={styles.summaryText}>
                          <span className="visually-hidden">{LABELS[c].title}: </span>
                          <span className={styles.summaryName}>{o ? o.name : results.data ? 'Sin voto' : '…'}</span>
                          <SaveStatus status={status} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className={styles.content}>
            {!wide && (
              <div className={styles.tabs} role="tablist" aria-label="Categoría" onKeyDown={onTabKey}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    id={`tab-${c}`}
                    type="button"
                    role="tab"
                    className={styles.tab}
                    aria-selected={tab === c}
                    aria-controls={`panel-${c}`}
                    tabIndex={tab === c ? 0 : -1}
                    onClick={() => setTab(c)}
                  >
                    {LABELS[c].title}
                  </button>
                ))}
              </div>
            )}

            <div className={styles.columns}>
              {CATEGORIES.map((c) => (
                <section
                  key={c}
                  id={`panel-${c}`}
                  className={styles.panel}
                  role={wide ? undefined : 'tabpanel'}
                  aria-labelledby={wide ? `title-${c}` : `tab-${c}`}
                  hidden={!wide && tab !== c}
                  aria-busy={results.isPending || undefined}
                >
                  <h2 className={wide ? styles.panelTitle : 'visually-hidden'} id={`title-${c}`}>
                    {LABELS[c].title}
                  </h2>
                  <CategoryPanel
                    category={c}
                    mapId={map.id}
                    mapName={map.name}
                    options={options[c]}
                    results={results.data}
                    vote={votes[c]}
                    showMyVote={wide}
                    accessHref={accessHref}
                  />
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const m = matchMedia(query);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    () => matchMedia(query).matches,
  );
}

function BackLink() {
  return (
    <Link to="/" className={styles.back}>
      ← Mapas
    </Link>
  );
}
