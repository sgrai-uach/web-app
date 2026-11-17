import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tag } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import {
  AlertaFeedbackReporte,
  BloqueFormularioReporte,
  CampoResumenReporte,
  ResumenReporteTerreno,
  formatearAutorReporte,
} from '../ReporteTerrenoBase';

describe('ReporteTerrenoBase (componentes estandarizados)', () => {
  it('formatearAutorReporte unifica nombre, correo y fecha 24h en una sola cadena', () => {
    expect(
      formatearAutorReporte(
        {
          id: 'usr-1',
          nombre: 'Cristóbal Veas',
          email: 'patrulla@valdivia.cl',
        },
        '2026-11-16T21:31:00Z'
      )
    ).toMatch(/^Cristóbal Veas \(patrulla@valdivia\.cl\) · \d{2}-\d{2}-2026 \d{2}:\d{2}$/);

    expect(
      formatearAutorReporte(undefined, '2026-11-16T21:31:00Z', 'Operador de Patrulla')
    ).toMatch(/^Operador de Patrulla · \d{2}-\d{2}-2026 \d{2}:\d{2}$/);

    expect(formatearAutorReporte(null, null)).toBeNull();
  });

  it('AlertaFeedbackReporte renderiza mensajes de éxito, offline y error de validación', () => {
    render(
      <AlertaFeedbackReporte
        feedback={{ tipo: 'offline', texto: 'Guardado sin conexión.' }}
        errorValidacion="Campo obligatorio faltante."
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Guardado sin conexión.');
    expect(screen.getByRole('alert')).toHaveTextContent('Campo obligatorio faltante.');
  });

  it('BloqueFormularioReporte renderiza encabezado y chip opcional', () => {
    render(
      <BloqueFormularioReporte
        icono={<Tag size={16} />}
        titulo="1. Clasificación en Terreno"
        chipDerecha={<Chip size="sm">Requerido</Chip>}
      >
        <div>Contenido del bloque</div>
      </BloqueFormularioReporte>
    );

    expect(screen.getByText('1. Clasificación en Terreno')).toBeInTheDocument();
    expect(screen.getByText('Requerido')).toBeInTheDocument();
    expect(screen.getByText('Contenido del bloque')).toBeInTheDocument();
  });

  it('ResumenReporteTerreno muestra "Registrado por" una única vez y dispara onModificar', () => {
    const onModificar = vi.fn();
    render(
      <ResumenReporteTerreno
        testId="resumen-test"
        titulo="Resumen de Evaluación"
        chip={<Chip variant="teal" size="sm">Reclasificada</Chip>}
        registradoPor="Patrullero 1 (patrulla@valdivia.cl) · 16-11-2026 18:31"
        textoModificar="Modificar reporte"
        onModificar={onModificar}
      >
        <CampoResumenReporte label="Tipología" valor="Inundación" />
        <CampoResumenReporte label="Justificación" valor="Desborde constatado." esBloqueTexto />
      </ResumenReporteTerreno>
    );

    expect(screen.getByTestId('resumen-test')).toBeInTheDocument();
    expect(screen.getAllByText(/^Registrado por$/i)).toHaveLength(1);
    expect(
      screen.getAllByText(/Patrullero 1 \(patrulla@valdivia\.cl\) · 16-11-2026 18:31/)
    ).toHaveLength(1);
    expect(screen.getByText('Reclasificada')).toBeInTheDocument();
    expect(screen.getByText('Inundación')).toBeInTheDocument();
    expect(screen.getByText('Desborde constatado.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Modificar reporte/i }));
    expect(onModificar).toHaveBeenCalledTimes(1);
  });
});
