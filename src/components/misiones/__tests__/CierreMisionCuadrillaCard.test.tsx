import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CierreMisionCuadrillaCard } from '../CierreMisionCuadrillaCard';
import {
  cerrarMisionCuadrilla,
  obtenerRecursosDisponiblesCuadrilla,
  obtenerReporteCierreCuadrillaMision,
} from '@/services/cierreCuadrillaService';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/services/cierreCuadrillaService', () => ({
  cerrarMisionCuadrilla: vi.fn(),
  obtenerRecursosDisponiblesCuadrilla: vi.fn(),
  obtenerReporteCierreCuadrillaMision: vi.fn(),
}));

const misionActiva: MisionLocal = {
  id: 'd1000000-0000-4000-8000-000000000002',
  incidenteId: 'a1000000-0000-4000-8000-000000000004',
  codigoIncidente: 'INC-2026-0004',
  tipologia: 'Anegamiento de calzada',
  direccion: 'Av. Alemania 780, Valdivia',
  prioridad: 'ALTA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-18T10:00:00.000Z',
  actualizadoEn: '2026-11-18T10:30:00.000Z',
};

describe('CierreMisionCuadrillaCard (H68)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(obtenerReporteCierreCuadrillaMision).mockReturnValue(null);
    vi.mocked(obtenerRecursosDisponiblesCuadrilla).mockResolvedValue([
      {
        id: 'e1000000-0000-4000-8000-000000000004',
        nombre: 'Sacos de Arena de Contención Fluvial',
        tipo: 'GRUPAL',
        unidad: 'sacos',
        cantidadDisponible: 50,
        cantidadAsignada: 50,
        esIndividual: false,
        asignadoACuadrilla: true,
      },
      {
        id: 'e1000000-0000-4000-8000-000000000001',
        nombre: 'Motobomba Caudal 4"',
        tipo: 'INDIVIDUAL',
        unidad: null,
        cantidadDisponible: 1,
        cantidadAsignada: 1,
        esIndividual: true,
        asignadoACuadrilla: true,
      },
    ]);
  });

  it('renderiza los 4 bloques del formulario (sin Ficha FIBE), integra evidencia en bloque 4, valida resumen >= 15 caracteres y permite agregar materiales', async () => {
    const onCierreEnviado = vi.fn();

    render(
      <CierreMisionCuadrillaCard
        misionActual={misionActiva}
        puedeAdjuntarEvidencia={true}
        onCierreEnviado={onCierreEnviado}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/1\. Resumen de Faenas Ejecutadas/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/4\. Observaciones, Daños y Evidencia Multimedia/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Evidencia Multimedia')).toBeInTheDocument();
    expect(screen.queryByText(/5\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FIBE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Asistencia Social/i)).not.toBeInTheDocument();

    // Intento con resumen vacío
    fireEvent.click(
      screen.getByRole('button', {
        name: /Finalizar Misión e Informe Técnico/i,
      })
    );

    expect(
      screen.getByText(/El resumen de faenas ejecutadas es obligatorio/i)
    ).toBeInTheDocument();

    // Completar resumen válido
    fireEvent.change(
      screen.getByLabelText(/Detalle Técnico de Trabajos Realizados/i),
      {
        target: {
          value:
            'Desobstrucción de sumideros y extracción de aguas lluvias con motobomba.',
        },
      }
    );

    // Agregar material consumido
    fireEvent.click(
      screen.getByRole('button', { name: /Agregar material consumido/i })
    );
    expect(screen.getByTestId('fila-material-0')).toBeInTheDocument();

    // Seleccionar atajo 4 h
    fireEvent.click(screen.getByRole('button', { name: '4 h' }));

    // Abrir modal de confirmación
    fireEvent.click(
      screen.getByRole('button', {
        name: /Finalizar Misión e Informe Técnico/i,
      })
    );

    expect(
      screen.getByText('Confirmar Cierre de Misión e Informe Técnico')
    ).toBeInTheDocument();

    vi.mocked(cerrarMisionCuadrilla).mockResolvedValueOnce({
      ok: true,
      offline: false,
      mensaje: 'Informe técnico final registrado.',
      reporte: {
        misionId: misionActiva.id,
        resumen_faenas:
          'Desobstrucción de sumideros y extracción de aguas lluvias con motobomba.',
        horas_hombre: 4,
        estado_terreno: 'FINALIZADO',
        materiales_consumidos: [],
        danos_estimados: '',
        observaciones: '',
        requiere_apoyo_adicional: false,
        adjunto_ids: [],
        adjuntos: [],
        creadoEn: '2026-11-18T12:00:00.000Z',
        sincronizado: true,
      },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar y Finalizar Misión/i })
    );

    await waitFor(() => {
      expect(cerrarMisionCuadrilla).toHaveBeenCalledTimes(1);
      expect(onCierreEnviado).toHaveBeenCalledTimes(1);
    });
  });

  it('renderiza la tarjeta de resumen en modo solo lectura cuando la misión ya fue completada', async () => {
    vi.mocked(obtenerReporteCierreCuadrillaMision).mockReturnValue({
      id: 'rep-cierre-1',
      misionId: misionActiva.id,
      resumen_faenas: 'Limpieza integral de colectores y retiro de ramas.',
      horas_hombre: 8,
      estado_terreno: 'FINALIZADO',
      materiales_consumidos: [
        {
          recurso_id: 'e1000000-0000-4000-8000-000000000004',
          nombre: 'Sacos de Arena',
          cantidad: 30,
          unidad: 'sacos',
        },
      ],
      danos_estimados: '',
      observaciones: 'Vía habilitada al tránsito.',
      requiere_apoyo_adicional: false,
      adjunto_ids: [],
      adjuntos: [],
      evaluador: {
        nombre: 'Carlos Delegado',
        email: 'delegado@valdivia.cl',
      },
      creadoEn: '2026-11-18T13:00:00.000Z',
      sincronizado: true,
    });

    render(
      <CierreMisionCuadrillaCard
        misionActual={{ ...misionActiva, estado: 'COMPLETADA' }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('resumen-cierre-cuadrilla')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Limpieza integral de colectores y retiro de ramas.')
    ).toBeInTheDocument();
    expect(screen.getByText('8 h')).toBeInTheDocument();
    expect(screen.queryByText(/FIBE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Asistencia Social/i)).not.toBeInTheDocument();
  });
});
