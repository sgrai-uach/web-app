'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './SeccionDesplegable.module.css';

export interface SeccionDesplegableProps {
  /** Título visible en la fila de resumen. */
  titulo: string;
  /** Icono opcional (lucide-react) mostrado antes del título. */
  icono?: React.ReactNode;
  /** Indica si la sección se muestra expandida al montarse. */
  abiertoPorDefecto?: boolean;
  /** Indicador opcional alineado a la derecha (ej. estado de sincronización). */
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
  indicador,
  id,
  children,
}: SeccionDesplegableProps) {
  const [abierto, setAbierto] = useState<boolean>(abiertoPorDefecto);

  return (
    <details
      id={id}
      className={styles.seccion}
      open={abierto}
      onToggle={(e) => setAbierto((e.currentTarget as HTMLDetailsElement).open)}
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
            className={`${styles.chevron} ${abierto ? styles.chevronAbierto : ''}`.trim()}
          />
        </span>
      </summary>
      <div className={styles.contenido}>{children}</div>
    </details>
  );
}

export default SeccionDesplegable;

