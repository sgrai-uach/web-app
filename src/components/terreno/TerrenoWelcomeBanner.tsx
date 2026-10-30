'use client';

import React from 'react';
import { Compass, HardHat } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './TerrenoWelcomeBanner.module.css';

export function TerrenoWelcomeBanner() {
  const { usuario, esCuadrilla } = useAuth();

  const nombreOperador = usuario?.nombre || 'Operador de Terreno';
  const rolTexto =
    usuario?.rolNombre ||
    (esCuadrilla ? 'Delegado de Cuadrilla' : 'Patrulla Verificadora');
  const unidadNombre = usuario?.unidadNombre || (esCuadrilla ? 'Cuadrilla de Terreno' : 'Patrulla Verificadora');
  const UnidadIcon = esCuadrilla ? HardHat : Compass;

  return (
    <section className={styles.banner} aria-label="Bienvenida del operador de terreno">
      <div className={styles.content}>
        <div className={styles.greetingArea}>
          <h1 className={styles.heading}>Bienvenido/a, {nombreOperador}</h1>
        </div>

        <div className={styles.metaArea}>
          <div className={styles.roleBadge}>
            <UnidadIcon size={15} aria-hidden="true" />
            <span>{unidadNombre} · {rolTexto}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TerrenoWelcomeBanner;
