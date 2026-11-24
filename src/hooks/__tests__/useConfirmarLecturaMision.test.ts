import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useConfirmarLecturaMision } from '../useConfirmarLecturaMision';
import * as AuthContextModule from '@/context/AuthContext';
import * as NotificacionesContextModule from '@/context/NotificacionesTerrenoContext';
import * as notificacionesService from '@/services/notificacionesService';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/context/AuthContext');
vi.mock('@/context/NotificacionesTerrenoContext');
vi.mock('@/services/notificacionesService', () => ({
  confirmarLecturaMisionAbierta: vi.fn(),
}));

describe('useConfirmarLecturaMision (HU-35)', () => {
  const misionBase: MisionLocal = {
    id: '60000000-0000-4000-8000-000000000001',
    incidenteId: '30000000-0000-4000-8000-000000000001',
    codigoIncidente: 'INC-2026-0001',
    tipologia: 'Anegamiento',
    direccion: 'Av. Picarte 100',
    prioridad: 'ALTA',
    estado: 'DESPACHADA',
    fechaDespacho: '2026-11-24T12:00:00Z',
    notificacionId: '80000000-0000-4000-8000-000000000001',
    trazabilidadNotificacion: 'ENVIADA',
    actualizadoEn: '2026-11-24T12:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificacionesService.confirmarLecturaMisionAbierta).mockResolvedValue(true);
  });

  it('dispara confirmarLecturaMisionAbierta automáticamente para cuadrilla al abrir detalle', async () => {
    const marcarMock = vi.fn();
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-1',
        rut: '11.111.111-1',
        nombre: 'Delegado',
        email: 'delegado@valdivia.cl',
        rolId: 'r-1',
        rolNombre: 'Delegado de Cuadrilla',
        rolCodigo: 'DELEGADO_CUADRILLA',
        delegacionId: 'd-1',
        delegacionNombre: 'Sur',
        permisos: ['misiones:terreno:ejecutar'],
        unidadId: 'cuad-001',
        unidadNombre: 'Cuadrilla 1',
        unidadActiva: true,
      },
      token: 'jwt',
      cargando: false,
      autenticado: true,
      esPatrulla: false,
      esCuadrilla: true,
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });
    vi.mocked(NotificacionesContextModule.useNotificacionesTerrenoOptional).mockReturnValue({
      alertaActiva: null,
      descartarAlerta: vi.fn(),
      marcarAlertaLeidaPorMision: marcarMock,
      verMision: vi.fn(),
      reconciliarMisiones: vi.fn(),
      historialAlertas: [],
    });

    const { rerender } = renderHook(
      ({ mision }) =>
        useConfirmarLecturaMision({
          misionId: misionBase.id,
          mision,
          enabled: true,
        }),
      { initialProps: { mision: misionBase } }
    );

    await waitFor(() => {
      expect(notificacionesService.confirmarLecturaMisionAbierta).toHaveBeenCalledWith({
        misionId: misionBase.id,
        notificacionId: '80000000-0000-4000-8000-000000000001',
        unidadId: 'cuad-001',
        esCuadrilla: true,
        trazabilidadNotificacion: 'ENVIADA',
      });
    });
    expect(marcarMock).toHaveBeenCalledWith(misionBase.id);

    // Rerender con misma clave no debe volver a emitir
    rerender({ mision: { ...misionBase } });
    expect(notificacionesService.confirmarLecturaMisionAbierta).toHaveBeenCalledTimes(1);
  });

  it('no dispara lectura si enabled es false o la misión aún no carga', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-2',
        rut: '22.222.222-2',
        nombre: 'Patrullero',
        email: 'patrulla@valdivia.cl',
        rolId: 'r-2',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'd-1',
        delegacionNombre: 'Costa',
        permisos: ['misiones:terreno:verificar'],
        unidadId: 'pat-001',
        unidadNombre: 'Patrulla 1',
        unidadActiva: true,
      },
      token: 'jwt',
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });
    vi.mocked(NotificacionesContextModule.useNotificacionesTerrenoOptional).mockReturnValue(null);

    renderHook(() =>
      useConfirmarLecturaMision({
        misionId: misionBase.id,
        mision: null,
        enabled: false,
      })
    );

    expect(notificacionesService.confirmarLecturaMisionAbierta).not.toHaveBeenCalled();
  });
});
