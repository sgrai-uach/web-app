import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CuadrillaMisionDetailPage from '../page';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { obtenerDetalleMision } from '@/services/misionesService';
import {
  cerrarMisionCuadrilla,
  obtenerRecursosDisponiblesCuadrilla,
  obtenerReporteCierreCuadrillaMision,
} from '@/services/cierreCuadrillaService';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useConnectivity', () => ({
  useConnectivity: vi.fn(),
}));

vi.mock('@/services/misionesService', () => ({
  obtenerDetalleMision: vi.fn(),
  aceptarMision: vi.fn(),
  rechazarMision: vi.fn(),
}));

vi.mock('@/services/cierreCuadrillaService', () => ({
  cerrarMisionCuadrilla: vi.fn(),
  obtenerRecursosDisponiblesCuadrilla: vi.fn(),
  obtenerReporteCierreCuadrillaMision: vi.fn(),
}));

vi.mock('@/components/maps/MapaModal', () => ({
  MapaModal: () => null,
}));

const misionEnCurso = {
  id: 'd1000000-0000-4000-8000-000000000002',
  incidenteId: 'a1000000-0000-4000-8000-000000000004',
  codigoIncidente: 'INC-2026-0004',
  tipologia: 'Anegamiento de calzada',
  direccion: 'Av. Alemania 780, Valdivia',
  coordenadas: { lat: -39.817, lng: -73.242 },
  prioridad: 'ALTA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-18T10:00:00.000Z',
  actualizadoEn: '2026-11-18T10:30:00.000Z',
};

describe('CuadrillaMisionDetailPage — Cierre de Misión e Informe Técnico (H68)', () => {
  const actualizarPendientesMock = vi.fn().mockResolvedValue(0);

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useConnectivity).mockReturnValue({
      status: 'connected',
      pendientes: 0,
      sincronizar: vi.fn(),
      actualizarPendientes: actualizarPendientesMock,
    } as never);

    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: '00000000-0000-4000-8000-000000000005',
        nombre: 'Carlos Delegado',
        unidadId: 'c1000000-0000-4000-8000-000000000001',
        unidadNombre: 'Cuadrilla Aguas Lluvias Alfa',
      },
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      esCuadrilla: true,
      esPatrulla: false,
      tienePermiso: (p: string) =>
        p === 'misiones:terreno:ejecutar' || p === 'reportes:crear',
    } as never);

    vi.mocked(obtenerDetalleMision).mockResolvedValue(misionEnCurso);
    vi.mocked(obtenerReporteCierreCuadrillaMision).mockReturnValue(null);
    vi.mocked(obtenerRecursosDisponiblesCuadrilla).mockResolvedValue([]);
  });

  it('despliega la sección Gestión Técnica de Faena en misiones EN_CURSO y redirige a la bandeja al finalizar', async () => {
    render(
      <CuadrillaMisionDetailPage
        params={{ id: misionEnCurso.id } as unknown as Promise<{ id: string }>}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Gestión Técnica de Faena')).toBeInTheDocument();
    });

    expect(
      screen.getByTestId('formularios-reporte-tecnico')
    ).toBeInTheDocument();
    expect(screen.getByText('Faena en Curso')).toBeInTheDocument();
    expect(screen.getByText('Misión activa')).toBeInTheDocument();
    expect(screen.getByText('En misión')).toBeInTheDocument();
    expect(screen.getByText('En atención')).toBeInTheDocument();
    expect(screen.queryByText(/FIBE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Asistencia Social/i)).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(/Detalle Técnico de Trabajos Realizados/i),
      {
        target: {
          value:
            'Desagüe completo de sumideros en Av. Alemania con motobomba de 4 pulgadas.',
        },
      }
    );

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
      mensaje: 'Misión completada exitosamente.',
      reporte: {
        misionId: misionEnCurso.id,
        resumen_faenas:
          'Desagüe completo de sumideros en Av. Alemania con motobomba de 4 pulgadas.',
        horas_hombre: 1,
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
      mision: {
        ...misionEnCurso,
        estado: 'COMPLETADA',
      },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar y Finalizar Misión/i })
    );

    await waitFor(() => {
      expect(cerrarMisionCuadrilla).toHaveBeenCalledTimes(1);
      expect(actualizarPendientesMock).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/cuadrilla/misiones');
    });
  });

  it('oculta la sección de cierre cuando el usuario no posee el permiso misiones:terreno:ejecutar', async () => {
    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: '00000000-0000-4000-8000-000000000005',
        nombre: 'Carlos Delegado',
      },
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      esCuadrilla: true,
      esPatrulla: false,
      tienePermiso: () => false,
    } as never);

    render(
      <CuadrillaMisionDetailPage
        params={{ id: misionEnCurso.id } as unknown as Promise<{ id: string }>}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0004')).toBeInTheDocument();
    });

    expect(
      screen.queryByText('Gestión Técnica de Faena')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Evidencia Multimedia')).not.toBeInTheDocument();
  });

  it('mantiene accesible Evidencia Multimedia como respaldo RBAC cuando solo posee reportes:crear sin permiso de cierre', async () => {
    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: '00000000-0000-4000-8000-000000000005',
        nombre: 'Operador Terreno',
        unidadId: 'c1000000-0000-4000-8000-000000000001',
        unidadNombre: 'Cuadrilla Aguas Lluvias Alfa',
      },
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      esCuadrilla: true,
      esPatrulla: false,
      tienePermiso: (p: string) => p === 'reportes:crear',
    } as never);

    render(
      <CuadrillaMisionDetailPage
        params={{ id: misionEnCurso.id } as unknown as Promise<{ id: string }>}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Evidencia Multimedia')).toBeInTheDocument();
    });

    expect(
      screen.queryByText('Gestión Técnica de Faena')
    ).not.toBeInTheDocument();
  });
});
