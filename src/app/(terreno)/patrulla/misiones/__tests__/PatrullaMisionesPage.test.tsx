import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PatrullaMisionesPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as offlineQueue from '@/services/offlineQueue';
import * as misionesService from '@/services/misionesService';
import * as socketHook from '@/hooks/useMisionesSocket';

vi.mock('@/context/AuthContext');
vi.mock('@/services/offlineQueue');
vi.mock('@/services/misionesService');
vi.mock('@/hooks/useMisionesSocket');

describe('PatrullaMisionesPage — Modo Histórico Patrulla Desactivada (H85)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(offlineQueue.obtenerMisionesLocales).mockResolvedValue([]);
    vi.mocked(offlineQueue.guardarMisionesLocales).mockResolvedValue();
    vi.mocked(misionesService.sincronizarMisiones).mockResolvedValue([]);
    vi.mocked(socketHook.useMisionesSocket).mockReturnValue({
      conectado: false,
      ultimaMisionAsignada: null,
      descartarUltimaMision: vi.fn(),
    });
  });

  it('muestra el banner de advertencia y el título de historial cuando la patrulla está desactivada', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
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
        permisos: [],
        unidadNombre: 'Patrulla Móvil 02',
        unidadActiva: false,
      },
      token: 'mock-token',
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: false,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'DESACTIVADA',
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    render(<PatrullaMisionesPage />);

    expect(screen.getByText(/Patrulla Desactivada — Patrulla Móvil 02/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /^historial$/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(misionesService.sincronizarMisiones).toHaveBeenCalled();
      expect(screen.getByText(/No se encontraron misiones históricas para esta patrulla/i)).toBeInTheDocument();
    });
  });

  it('actualiza la lista automáticamente y muestra NuevaMisionBanner ante nueva asignación (H35)', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
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
        permisos: [],
        unidadId: 'pat-1',
        unidadNombre: 'Patrulla Móvil 01',
        unidadActiva: true,
      },
      token: 'mock-token',
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

    vi.mocked(misionesService.sincronizarMisiones).mockResolvedValue([
      {
        id: 'mis-101',
        incidenteId: 'inc-101',
        codigoIncidente: 'INC-2026-00101',
        tipologia: 'Anegamiento',
        direccion: 'Av. Ramón Picarte 500',
        prioridad: 'ALTA',
        estado: 'DESPACHADA',
        fechaDespacho: '2026-11-09T10:00:00Z',
        actualizadoEn: '2026-11-09T10:00:00Z',
      },
    ]);

    vi.mocked(socketHook.useMisionesSocket).mockReturnValue({
      conectado: true,
      ultimaMisionAsignada: {
        misionId: 'mis-101',
        codigo: 'INC-2026-00101',
        tipoMision: 'VERIFICACION',
        patrullaId: 'pat-1',
        asignadoEn: '2026-11-09T10:00:00Z',
      },
      descartarUltimaMision: vi.fn(),
    });

    render(<PatrullaMisionesPage />);

    expect(screen.getByText('Nueva Misión Despachada')).toBeInTheDocument();
    expect(screen.getByText('INC-2026-00101')).toBeInTheDocument();
  });
});
