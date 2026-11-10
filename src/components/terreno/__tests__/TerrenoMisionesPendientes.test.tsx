import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TerrenoMisionesPendientes } from '../TerrenoMisionesPendientes';
import * as authContext from '@/context/AuthContext';
import * as misionesService from '@/services/misionesService';

vi.mock('@/context/AuthContext');
vi.mock('@/services/misionesService');

describe('TerrenoMisionesPendientes — Sección Destacada de Despachos Pendientes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra estado vacío cuando no existen despachos pendientes', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      usuario: {
        id: 'usr-1',
        rut: '12.345.678-9',
        nombre: 'Patrullero Uno',
        email: 'p1@valdivia.cl',
        rolId: 'rol-1',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-1',
        delegacionNombre: 'Central',
        permisos: [],
        unidadId: 'pat-1',
        unidadNombre: 'Móvil 01',
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

    vi.spyOn(misionesService, 'sincronizarMisiones').mockResolvedValue([]);

    render(<TerrenoMisionesPendientes />);

    expect(screen.getByText('Misiones pendientes')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText(/sin despachos pendientes por confirmar/i)
      ).toBeInTheDocument();
    });
  });

  it('renderiza despachos pendientes con código, prioridad, tipología y badge en cabecera sin chips redundantes', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      usuario: {
        id: 'usr-1',
        rut: '12.345.678-9',
        nombre: 'Patrullero Uno',
        email: 'p1@valdivia.cl',
        rolId: 'rol-1',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-1',
        delegacionNombre: 'Central',
        permisos: [],
        unidadId: 'pat-1',
        unidadNombre: 'Móvil 01',
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

    vi.spyOn(misionesService, 'sincronizarMisiones').mockResolvedValue([
      {
        id: 'mis-pend-1',
        incidenteId: 'inc-1',
        codigoIncidente: 'INC-2026-00450',
        tipologia: 'Anegamiento de paso bajo nivel',
        direccion: 'Picarte 2200',
        prioridad: 'CRITICA',
        estado: 'DESPACHADA',
        fechaDespacho: '2026-11-09T14:00:00Z',
        actualizadoEn: '2026-11-09T14:00:00Z',
      },
      {
        id: 'mis-en-curso-1',
        incidenteId: 'inc-2',
        codigoIncidente: 'INC-2026-00400',
        tipologia: 'Árbol caído en calzada',
        direccion: 'Alemania 500',
        prioridad: 'MEDIA',
        estado: 'EN_CURSO',
        fechaDespacho: '2026-11-09T13:00:00Z',
        actualizadoEn: '2026-11-09T13:30:00Z',
      },
    ]);

    render(<TerrenoMisionesPendientes />);

    await waitFor(() => {
      // Debe incluir la misión despachada (pendiente)
      expect(screen.getByText('INC-2026-00450')).toBeInTheDocument();
      expect(screen.getByText('Anegamiento de paso bajo nivel')).toBeInTheDocument();
      expect(screen.getByText('1 por confirmar')).toBeInTheDocument();

      // No debe incluir chips redundantes como Despachada o Por confirmar en la tarjeta
      expect(screen.queryByText(/^despachada$/i)).not.toBeInTheDocument();

      // No debe incluir la misión que ya está en curso
      expect(screen.queryByText('INC-2026-00400')).not.toBeInTheDocument();
    });
  });
});

