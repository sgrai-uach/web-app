'use client';

import React from 'react';
import { UnidadEstadoBanner } from './UnidadEstadoBanner';

export interface SinUnidadBannerProps {
  tipoUnidad?: 'patrulla' | 'cuadrilla';
  nombreOperador?: string | null;
}

export const SinUnidadBanner: React.FC<SinUnidadBannerProps> = ({
  tipoUnidad = 'patrulla',
  nombreOperador,
}) => (
  <UnidadEstadoBanner
    variante="sin_asignacion"
    tipoUnidad={tipoUnidad}
    nombreOperador={nombreOperador}
  />
);

export default SinUnidadBanner;
