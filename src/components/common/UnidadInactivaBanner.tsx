'use client';

import React from 'react';
import { UnidadEstadoBanner } from './UnidadEstadoBanner';

export interface UnidadInactivaBannerProps {
  tipoUnidad: 'cuadrilla' | 'patrulla';
  nombreUnidad?: string | null;
}

export const UnidadInactivaBanner: React.FC<UnidadInactivaBannerProps> = ({
  tipoUnidad,
  nombreUnidad,
}) => (
  <UnidadEstadoBanner
    variante="desactivada"
    tipoUnidad={tipoUnidad}
    nombreUnidad={nombreUnidad}
  />
);

export default UnidadInactivaBanner;
