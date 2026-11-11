'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './SeccionDesplegable.module.css';

export interface SeccionDesplegableProps {
  /** Título visible en la fila de resumen. */
  titulo: string;
  /** Icono opcional (lucide-react) mostrado antes del título. */
  icono?: React.ReactNode;
  /** Indica si la sección se muestra expandida al montarse (modo no controlado). */
  abiertoPorDefecto?: boolean;
  /** Control explícito del estado de apertura (modo controlado). */
  abierto?: boolean;
  /** Notificación de cambio de apertura al interactuar con el elemento. */
  onToggle?: (abierto: boolean) => void;
  /** Indicador opcional alineado a la derecha (ej. estado de sincronización o completado). */
  indicador?: React.ReactNode;
  /** Identificador opcional para pruebas o anclas. */
  id?: string;
  children: React.ReactNode;
}

/**
 * Sección desplegable de ancho completo basada en `<details>/<summary>` nativo.
 * Accesible por teclado, funcional sin JavaScript y con objetivo táctil mínimo de 48px.
 */
export function SeccionDesplegable({
  titulo,
  icono,
  abiertoPorDefecto = false,
  abierto: abiertoProp,
  onToggle,
  indicador,
  id,
  children,
}: SeccionDesplegableProps) {
  const [localAbierto, setLocalAbierto] = useState<boolean>(abiertoPorDefecto);

  useEffect(() => {
    if (abiertoProp !== undefined) {
      setLocalAbierto(abiertoProp);
    }
  }, [abiertoProp]);

  const estadoAbierto = abiertoProp !== undefined ? abiertoProp : localAbierto;

  const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const nuevoEstado = (e.currentTarget as HTMLDetailsElement).open;
    if (abiertoProp === undefined) {
      setLocalAbierto(nuevoEstado);
    }
    onToggle?.(nuevoEstado);
  };

  return (
    <details
      id={id}
      className={styles.seccion}
      open={estadoAbierto}
      onToggle={handleToggle}
    >
      <summary className={styles.resumen}>
        <span className={styles.tituloGrupo}>
          {icono && (
            <span className={styles.icono} aria-hidden="true">
              {icono}
            </span>
          )}
          <span className={styles.titulo}>{titulo}</span>
        </span>
        <span className={styles.ladoDerecho}>
          {indicador}
          <ChevronDown
            size={20}
            aria-hidden="true"
            className={`${styles.chevron} ${estadoAbierto ? styles.chevronAbierto : ''}`.trim()}
          />
        </span>
      </summary>
      <div className={styles.contenido}>{children}</div>
    </details>
  );
}

export default SeccionDesplegable;

