import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import PatrullaMisionDetailPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as misionesService from '@/services/misionesService';
import * as tipologiaService from '@/services/tipologiaService';
import * as useConnectivityModule from '@/hooks/useConnectivity';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/context/AuthContext');
vi.mock('@/services/misionesService');
vi.mock('@/services/tipologiaService');
vi.mock('@/hooks/useConnectivity');

const misionEnCursoMock: MisionLocal = {
  id: '60000000-0000-4000-8000-000000000001',
  incidenteId: '50000000-0000-4000-8000-000000000001',
  codigoIncidente: 'INC-2026-0001',
  tipologia: 'Caída de árbol',
  direccion: 'Av. Ramón Picarte 1200, Valdivia',
  coordenadas: { lat: -39.819588, lng: -73.245209 },
  prioridad: 'ALTA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-01T20:30:00.000Z',
  fechaInicio: '2026-11-01T20:35:00.000Z',
  actualizadoEn: '2026-11-01T20:35:00.000Z',
};

const misionDespachadaMock: MisionLocal = {
  ...misionEnCursoMock,
  estado: 'DESPACHADA',
  fechaInicio: null,
};

const catalogoOficialMock = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    nombre: 'Inundación',
    descripcion: 'Acumulación desmedida de agua por crecida de ríos',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    nombre: 'Caída de árbol',
    descripcion: 'Obstrucción de vías o afectación a viviendas',
    activo: true,
  },
];

function configurarAuth(unidadActiva = true, permisoVerificar = true) {
  vi.mocked(AuthContextModule.useAuth).mockReturnValue({
    usuario: {
      id: '00000000-0000-4000-8000-000000000004',
      rut: '12.345.678-5',
      nombre: 'Patrullero Terreno',
      email: 'patrulla@valdivia.cl',
      rolId: 'rol-patrulla',
      rolNombre: 'Patrulla Verificadora',
      rolCodigo: 'PATRULLA_VERIFICADORA',
      delegacionId: 'del-1',
      delegacionNombre: 'Valdivia Norte',
      permisos: permisoVerificar ? ['misiones:terreno:verificar'] : [],
      unidadNombre: 'Patrulla Alpha',
      unidadActiva,
    },
    token: 'jwt-mock-token',
    cargando: false,
    autenticado: true,
    esPatrulla: true,
    esCuadrilla: false,
    unidadActiva,
    tieneUnidadAsignada: true,
    estadoAsignacion: unidadActiva ? 'ACTIVA' : 'DESACTIVADA',
    actualizarUnidadAsignada: vi.fn(),
    tienePermiso: vi
      .fn()
      .mockImplementation((p: string) => permisoVerificar && p === 'misiones:terreno:verificar'),
    tieneAlgunPermiso: vi.fn().mockReturnValue(permisoVerificar),
    login: vi.fn(),
    logout: vi.fn(),
    recargarSesion: vi.fn(),
  });
}

describe('PatrullaMisionDetailPage — Categorización de Tipología en Terreno (H37)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConnectivityModule.useConnectivity).mockReturnValue({
      online: true,
      sincronizando: false,
      pendientes: 0,
      status: 'connected',
      sincronizar: vi.fn(),
      actualizarPendientes: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(tipologiaService.obtenerCatalogoTiposIncidente).mockResolvedValue(catalogoOficialMock);
  });

  it('no muestra los formularios técnicos ni categorización si la misión no ha sido aceptada (DESPACHADA)', async () => {
    configurarAuth(true, true);
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(misionDespachadaMock);

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage
            params={Promise.resolve({ id: misionDespachadaMock.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Aceptar Misión')).toBeInTheDocument();
    });

    // La sección de categorización debe estar oculta hasta que la patrulla acepte la misión
    expect(screen.queryByText('Categorización del incidente')).not.toBeInTheDocument();
  });

  it('muestra la sección de categorización cuando la misión está en curso (aceptada)', async () => {
    configurarAuth(true, true);
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(misionEnCursoMock);

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage
            params={Promise.resolve({ id: misionEnCursoMock.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Categorización del incidente')).toBeInTheDocument();
    });

    expect(screen.getByText('Misión activa')).toBeInTheDocument();
  });

  it('permite reclasificar la tipología fundadamente actualizando el encabezado y emitiendo feedback', async () => {
    configurarAuth(true, true);
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(misionEnCursoMock);
    vi.mocked(tipologiaService.reclasificarTipologiaEnTerreno).mockResolvedValue({
      ok: true,
      offline: false,
      mensaje: 'Tipología del incidente reclasificada exitosamente en terreno.',
      mision: {
        ...misionEnCursoMock,
        tipologia: 'Inundación',
        actualizadoEn: '2026-11-10T02:00:00.000Z',
      },
    });

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage
            params={Promise.resolve({ id: misionEnCursoMock.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '40000000-0000-4000-8000-000000000001' } });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, {
      target: {
        value: 'Evaluación presencial constata desborde de río con afectación a viviendas.',
      },
    });

    const submitBtn = screen.getByRole('button', { name: /Confirmar Tipología/i });
    fireEvent.click(submitBtn);

    // Modal de confirmación previa
    await waitFor(() => {
      expect(screen.getByText('Confirmar Evaluación de Tipología')).toBeInTheDocument();
    });

    const confirmModalBtn = screen.getByRole('button', { name: /Confirmar y Enviar/i });
    fireEvent.click(confirmModalBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Tipología del incidente reclasificada exitosamente en terreno/i)
      ).toBeInTheDocument();
    });

    expect(tipologiaService.reclasificarTipologiaEnTerreno).toHaveBeenCalledWith(
      misionEnCursoMock.incidenteId,
      expect.objectContaining({
        tipoIncidenteId: '40000000-0000-4000-8000-000000000001',
        justificacion: 'Evaluación presencial constata desborde de río con afectación a viviendas.',
      }),
      expect.anything()
    );
  });

  it('permite ratificar la tipología en terreno sin ingresar descripción y marcando completado', async () => {
    configurarAuth(true, true);
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(misionEnCursoMock);
    vi.mocked(tipologiaService.reclasificarTipologiaEnTerreno).mockResolvedValue({
      ok: true,
      offline: false,
      mensaje: 'Tipología del incidente ratificada exitosamente.',
      mision: {
        ...misionEnCursoMock,
        datosAdicionales: {
          tipologiaEvaluada: true,
          esReclasificacion: false,
        },
      },
    });

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage
            params={Promise.resolve({ id: misionEnCursoMock.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Tipología original constatada. No se requiere justificación adicional para ratificar/i)
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Confirmar Tipología/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Confirmar Evaluación de Tipología')).toBeInTheDocument();
    });

    const confirmModalBtn = screen.getByRole('button', { name: /Confirmar y Enviar/i });
    fireEvent.click(confirmModalBtn);

    await waitFor(() => {
      expect(screen.getByText('Completado')).toBeInTheDocument();
    });
  });
});

