'use client';

import React from 'react';
import { Compass, HardHat } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatRolLabel } from '@/lib/utils/labels';
import styles from './TerrenoWelcomeBanner.module.css';

export function TerrenoWelcomeBanner() {
  const { usuario, esCuadrilla } = useAuth();

  const nombreOperador = usuario?.nombre || 'Operador de Terreno';
  const rolTexto = formatRolLabel(
    usuario?.rolCodigo ||
    usuario?.rolNombre ||
    (esCuadrilla ? 'DELEGADO_CUADRILLA' : 'PATRULLA_VERIFICADORA')
  );

  // Si existe unidad asignada diferente al rol (ej: "Patrulla Móvil Alfa 01"), se muestra con separador.
  // Si no hay unidad asignada o es idéntica al rol, se muestra únicamente el rol para evitar duplicación.
  const tieneUnidadEspecifica =
    usuario?.unidadNombre &&
    usuario.unidadNombre.trim().toLowerCase() !== rolTexto.trim().toLowerCase();

  const textoBadge = tieneUnidadEspecifica
    ? `${usuario?.unidadNombre} · ${rolTexto}`
    : rolTexto;

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
            <span>{textoBadge}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TerrenoWelcomeBanner;
