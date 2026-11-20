import { Link, useParams } from 'react-router';
import { useCatalog } from '../../api/queries';
import { CatalogError } from '../maps/CatalogError';
import styles from './MapDetailPage.module.css';

// H4: solo la banda del mapa. Votación y resultados llegan en H5.
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
    </>
  );
}

function BackLink() {
  return (
    <Link to="/" className={styles.back}>
      ← Mapas
    </Link>
  );
}
