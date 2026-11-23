'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './NuevaMisionBanner.module.css';

export interface NuevaMisionBannerProps {
  codigoMision?: string;
  tipoMision?: string;
  misionId?: string;
  urlDetalle?: string;
  alCerrar: () => void;
}

export const NuevaMisionBanner: React.FC<NuevaMisionBannerProps> = ({
  codigoMision,
  misionId,
  urlDetalle,
  alCerrar,
}) => {
  const router = useRouter();

  const destino =
    urlDetalle || (misionId ? `/patrulla/misiones/${misionId}` : undefined);

  const handleVerMision = () => {
    if (destino) {
      router.push(destino);
    }
    alCerrar();
  };

  return (
    <div
      className={styles.banner}
      role="alert"
      aria-live="assertive"
      aria-label="Nueva asignación de misión recibida"
    >
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Bell className={styles.bellIcon} size={18} aria-hidden="true" />
          <h2 className={styles.title}>Nueva Misión Despachada</h2>
        </div>
        <button
          type="button"
          onClick={alCerrar}
          className={styles.closeButton}
          aria-label="Cerrar notificación de nueva misión"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <p className={styles.bodyText}>
        El Centro de Mando ha asignado una nueva misión a su unidad:{' '}
        <span className={styles.codeHighlight}>{codigoMision || 'Nueva Misión'}</span>. La
        información ha sido sincronizada automáticamente.
      </p>

      {destino && (
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleVerMision}
            icon={<ArrowRight size={18} aria-hidden="true" />}
            className={styles.actionButton}
          >
            Ver Misión Asignada
          </Button>
        </div>
      )}
    </div>
  );
};

export default NuevaMisionBanner;
