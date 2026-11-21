import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import PatrullaMisionDetailPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as ConnectivityHook from '@/hooks/useConnectivity';
import * as misionesService from '@/services/misionesService';

vi.mock('@/context/AuthContext');
vi.mock('@/hooks/useConnectivity');
vi.mock('@/services/misionesService');

const mockShowSuccess = vi.fn();

vi.mock('@/components/ui/Toast', () => ({
  useToastOptional: () => ({
    showSuccess: mockShowSuccess,
    showWarning: vi.fn(),
    showError: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('@/components/maps/MapaModal', () => ({
  MapaModal: () => null,
}));

const authPatrullaActiva = {
  usuario: {
    id: 'u-pat-1',
    rut: '12.345.678-5',
    nombre: 'Mario Patrullero',
    email: 'mpatrullero@valdivia.cl',
    rolId: 'r-pat-1',
    rolNombre: 'Patrulla Verificadora',
    rolCodigo: 'PATRULLA_VERIFICADORA',
    delegacionId: 'del-1',
    delegacionNombre: 'Valdivia Sur',
    permisos: ['misiones:terreno:verificar', 'reportes:crear'],
    unidadId: 'pat-01',
    unidadNombre: 'Patrulla Costa-1',
    unidadActiva: true,
  },
  token: 'mock-token',
  cargando: false,
  autenticado: true,
  esPatrulla: true,
  esCuadrilla: false,
  unidadActiva: true,
  tieneUnidadAsignada: true,
  estadoAsignacion: 'ACTIVA' as const,
  tienePermiso: vi.fn().mockReturnValue(true),
  tieneAlgunPermiso: vi.fn().mockReturnValue(true),
  login: vi.fn(),
  logout: vi.fn(),
  recargarSesion: vi.fn(),
};

describe('PatrullaMisionDetailPage — Misión de Recuperación (H75)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContextModule.useAuth).mockReturnValue(authPatrullaActiva);
    vi.mocked(ConnectivityHook.useConnectivity).mockReturnValue({
      online: true,
      sincronizando: false,
      status: 'connected',
      pendientes: 0,
      sincronizar: vi.fn(),
      actualizarPendientes: vi.fn(),
    });
  });

  it('muestra el estado de recuperación sin formularios de triage y transiciona a COMPLETADA al recibir sgrai:mision-sincronizada', async () => {
    vi.mocked(misionesService.obtenerDetalleMision)
      .mockResolvedValueOnce({
        id: 'mis-rec-1',
        incidenteId: '',
        codigoIncidente: 'MIS-REC-001',
        tipoMision: 'RECUPERACION',
        tipologia: 'Entrega de kits de emergencia',
        direccion: 'Sector Las Ánimas',
        prioridad: 'ALTA',
        estado: 'EN_CURSO',
        fechaDespacho: '2026-11-20T12:00:00Z',
        fechaInicio: '2026-11-20T12:10:00Z',
        actualizadoEn: '2026-11-20T12:10:00Z',
        datosAdicionales: {
          trabajo: 'Apoyo en entrega de ayudas.',
        },
      })
      .mockResolvedValueOnce({
        id: 'mis-rec-1',
        incidenteId: '',
        codigoIncidente: 'MIS-REC-001',
        tipoMision: 'RECUPERACION',
        tipologia: 'Entrega de kits de emergencia',
        direccion: 'Sector Las Ánimas',
        prioridad: 'ALTA',
        estado: 'COMPLETADA',
        fechaDespacho: '2026-11-20T12:00:00Z',
        fechaInicio: '2026-11-20T12:10:00Z',
        fechaCierre: '2026-11-20T16:00:00Z',
        actualizadoEn: '2026-11-20T16:00:00Z',
        datosAdicionales: {
          trabajo: 'Apoyo en entrega de ayudas.',
        },
      });

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage params={Promise.resolve({ id: 'mis-rec-1' })} />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('recuperacion-en-curso-resumen')).toBeInTheDocument();
      expect(
        screen.queryByTestId('formularios-reporte-tecnico')
      ).not.toBeInTheDocument();
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('sgrai:mision-sincronizada', {
          detail: { misionId: 'mis-rec-1', estado: 'COMPLETADA' },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('recuperacion-concluida-resumen')).toBeInTheDocument();
      expect(screen.getAllByText('Finalizada').length).toBeGreaterThanOrEqual(1);
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'El operativo de recuperación fue declarado concluido. La patrulla quedó disponible.',
        'Misión completada'
      );
    });
  });
});
