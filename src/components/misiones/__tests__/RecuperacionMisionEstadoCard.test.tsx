import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecuperacionMisionEstadoCard } from '../RecuperacionMisionEstadoCard';
import type { MisionLocal } from '@/types/offline';

const baseMision: MisionLocal = {
  id: 'mis-rec-1',
  incidenteId: '',
  codigoIncidente: 'MIS-REC-101',
  tipoMision: 'RECUPERACION',
  tipologia: 'Rehabilitación sector Collico',
  direccion: 'Sector Collico',
  prioridad: 'MEDIA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-20T10:00:00Z',
  fechaInicio: '2026-11-20T10:15:00Z',
  actualizadoEn: '2026-11-20T10:15:00Z',
};

describe('RecuperacionMisionEstadoCard (H75)', () => {
  it('renderiza estado EN_CURSO mostrando el formulario de reporte de cierre en terreno para la patrulla', () => {
    render(<RecuperacionMisionEstadoCard mision={baseMision} />);

    expect(screen.getByTestId('recuperacion-reporte-cierre-card')).toBeInTheDocument();
    expect(screen.getByText('Cierre de Operativo en Terreno')).toBeInTheDocument();
    expect(screen.getByText('En ejecución')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Enviar Reporte de Cierre/i })
    ).toBeInTheDocument();
  });

  it('renderiza estado COMPLETADA mostrando disponibilidad de la patrulla y fecha de cierre', () => {
    render(
      <RecuperacionMisionEstadoCard
        mision={{
          ...baseMision,
          estado: 'COMPLETADA',
          fechaCierre: '2026-11-20T16:30:00Z',
          actualizadoEn: '2026-11-20T16:30:00Z',
        }}
      />
    );

    expect(screen.getByTestId('recuperacion-concluida-resumen')).toBeInTheDocument();
    expect(screen.getByText('Operativo de recuperación concluido')).toBeInTheDocument();
    expect(screen.getByText('Finalizada')).toBeInTheDocument();
    expect(screen.getByText('Disponible para nueva asignación')).toBeInTheDocument();
    expect(
      screen.getByText(/El operativo de recuperación fue declarado concluido\. La patrulla se encuentra nuevamente disponible\./i)
    ).toBeInTheDocument();
  });
});
