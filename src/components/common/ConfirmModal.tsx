import React, { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  alConfirmar: () => void;
  alCancelar: () => void;
}

export function ConfirmModal({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Aceptar',
  textoCancelar = 'Cancelar',
  alConfirmar,
  alCancelar,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!abierto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCancelar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abierto, alCancelar]);

  if (!abierto) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className={styles.modal}>
        <div className={styles.titleArea}>
          <AlertCircle size={22} color="var(--color-danger, #D32F2F)" aria-hidden="true" />
          <h2 id="confirm-modal-title" className={styles.title}>
            {titulo}
          </h2>
        </div>
        <p className={styles.message}>{mensaje}</p>
        <div className={styles.actionRow}>
          <Button variant="outline" size="md" onClick={alCancelar}>
            {textoCancelar}
          </Button>
          <Button variant="destructive" size="md" onClick={alConfirmar}>
            {textoConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
