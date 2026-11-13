'use client';

import React, { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import styles from './ConfirmModal.module.css';

export type ConfirmModalVariante = 'danger' | 'teal';
export type ConfirmModalTamano = 'sm' | 'md';

export interface ConfirmModalProps {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCargando?: string;
  textoCancelar?: string;
  variante?: ConfirmModalVariante;
  tamano?: ConfirmModalTamano;
  icono?: React.ReactNode;
  variantConfirmar?: ButtonVariant;
  iconoConfirmar?: React.ReactNode;
  cargando?: boolean;
  titleId?: string;
  children?: React.ReactNode;
  alConfirmar: () => void;
  alCancelar: () => void;
}

/**
 * Modal de confirmación plano institucional compartido en SGRAI-PWA.
 * Soporta variantes de alerta destructiva (`danger`) y flujo operativo (`teal`).
 */
export function ConfirmModal({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Aceptar',
  textoCargando,
  textoCancelar = 'Cancelar',
  variante = 'danger',
  tamano = 'sm',
  icono,
  variantConfirmar,
  iconoConfirmar,
  cargando = false,
  titleId = 'confirm-modal-title',
  children,
  alConfirmar,
  alCancelar,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!abierto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cargando) {
        alCancelar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abierto, cargando, alCancelar]);

  if (!abierto) return null;

  const esTeal = variante === 'teal';
  const botonConfirmarVariante: ButtonVariant =
    variantConfirmar ?? (esTeal ? 'primary' : 'destructive');
  const iconoRenderizado = icono ?? (
    <AlertCircle size={22} aria-hidden="true" />
  );

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`${styles.modal} ${
          tamano === 'md' ? styles.tamanoMd : styles.tamanoSm
        } ${esTeal ? styles.varianteTeal : styles.varianteDanger}`}
      >
        <div className={styles.headerRow}>
          <div
            className={`${styles.iconContainer} ${
              esTeal ? styles.iconTeal : styles.iconDanger
            }`}
            aria-hidden="true"
          >
            {iconoRenderizado}
          </div>
          <h2
            id={titleId}
            className={`${styles.title} ${
              esTeal ? styles.titleTeal : styles.titleDanger
            }`}
          >
            {titulo}
          </h2>
        </div>

        <div className={styles.body}>
          <p className={styles.message}>{mensaje}</p>
          {children}
        </div>

        <div className={styles.actionRow}>
          <Button
            type="button"
            variant="outline"
            size="md"
            fullWidth
            onClick={alCancelar}
            disabled={cargando}
          >
            {textoCancelar}
          </Button>
          <Button
            type="button"
            variant={botonConfirmarVariante}
            size="md"
            fullWidth
            onClick={alConfirmar}
            loading={cargando}
            icon={iconoConfirmar}
          >
            {cargando ? (textoCargando ?? textoConfirmar) : textoConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
