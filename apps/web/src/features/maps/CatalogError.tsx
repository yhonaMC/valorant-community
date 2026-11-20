import { ErrorIcon } from '../../ErrorIcon';
import styles from './MapsPage.module.css';

// Mensaje de §3.6 cuando no hay catálogo. Lo usan la exploración y el detalle.
export function CatalogError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorText}>
        <ErrorIcon className={styles.errorIcon} size={20} />
        No pudimos cargar los mapas de VALORANT. El servicio de datos del juego no responde.
      </p>
      <button
        type="button"
        className="button button-secondary"
        onClick={() => !retrying && onRetry()}
        aria-disabled={retrying}
      >
        {retrying ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  );
}
