import type { CSSProperties, PointerEvent } from 'react';
import { Link } from 'react-router';
import { useCatalog } from '../../api/queries';
import { CatalogError } from './CatalogError';
import styles from './MapsPage.module.css';

// Los primeros bloques suelen verse sin hacer scroll: se cargan sin lazy.
const EAGER = 3;

export function MapsPage() {
  const catalog = useCatalog();
  const maps = catalog.data ? [...catalog.data.maps].sort((a, b) => a.name.localeCompare(b.name, 'es')) : [];

  // La rejilla del fondo se ilumina alrededor del cursor (solo ratón).
  function trackPointer(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return;
    const box = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - box.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - box.top}px`);
  }

  // «Glitch» breve del título al entrar con el ratón; no se dispara con movimiento reducido.
  function glitch(e: PointerEvent<HTMLSpanElement>) {
    if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = e.currentTarget;
    el.classList.remove(styles.glitch);
    void el.offsetWidth; // reinicia la animación
    el.classList.add(styles.glitch);
    setTimeout(() => el.classList.remove(styles.glitch), 400);
  }

  return (
    <div className={styles.page}>
      <title>Mapas · Valorant Community</title>
      <div
        className={styles.intro}
        onPointerMove={trackPointer}
        onPointerLeave={(e) => e.currentTarget.style.removeProperty('--mx')}
      >
        {/* Fondo: bloques inclinados que derivan despacio (decorativo). */}
        <div className={styles.fx} aria-hidden="true">
          <span className={styles.dots} />
          <span className={styles.dotsLit} />
          <span className={styles.shardA} />
          <span className={styles.shardB} />
          <span className={styles.shardC} />
        </div>
        <div>
          <h1 className={styles.title} id="mapas-titulo">
            <span className={styles.wipe} onPointerEnter={glitch}>
              <span data-text="Mapas">Mapas</span>
            </span>
          </h1>
          <p className={styles.lede}>Elige un mapa para votar tu mejor agente y tu mejor arma, y ver qué prefiere la comunidad.</p>
        </div>
        {/* Qué hay para votar, con las cifras reales del catálogo. Mientras carga, guiones (sin salto de diseño). */}
        {!catalog.isError && (
          <ul className={styles.stats} aria-label="Qué puedes votar">
            {(['maps', 'agents', 'weapons'] as const).map((key, i) => (
              <li key={key} className={styles.stat}>
                <strong className={`${styles.statNum} ${styles.wipe}`} style={{ '--i': i + 1 } as CSSProperties}>
                  <span>{catalog.data ? catalog.data[key].length : '–'}</span>
                </strong>
                {{ maps: 'mapas', agents: 'agentes', weapons: 'armas' }[key]}
              </li>
            ))}
          </ul>
        )}
      </div>

      {catalog.isError ? (
        <CatalogError onRetry={() => catalog.refetch()} retrying={catalog.isFetching} />
      ) : catalog.isPending ? (
        <>
          <p className="visually-hidden" role="status">
            Cargando mapas…
          </p>
          <ul className={styles.grid} aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className={styles.item}>
                <div className={styles.frame} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul className={styles.grid} aria-labelledby="mapas-titulo">
          {maps.map((map, i) => (
            <li key={map.id} className={styles.item}>
              <Link to={`/mapas/${map.id}`} className={styles.link}>
                <div className={styles.frame}>
                  {/* Móvil: franja ligera (≈65 KB). Escritorio: arte completo 1920×1080. */}
                  <picture>
                    <source media="(min-width: 720px)" srcSet={map.image} width={1920} height={1080} />
                    <img
                      className={styles.image}
                      src={map.thumb}
                      width={456}
                      height={100}
                      alt=""
                      loading={i < EAGER ? 'eager' : 'lazy'}
                      fetchPriority={i === 0 ? 'high' : undefined}
                      decoding="async"
                    />
                  </picture>
                </div>
                {/* Esquinas tipo mira que se cierran sobre el mapa al pasar el ratón o enfocar. */}
                <span className={styles.corners} aria-hidden="true">
                  <i /><i /><i /><i />
                </span>
                <span className={styles.label}>
                  <span className={styles.name}>{map.name}</span>
                  <span className={styles.enter} aria-hidden="true">
                    Entrar →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
