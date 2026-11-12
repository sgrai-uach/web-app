import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import PatrullaMisionDetailPage from '../page';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import * as misionesService from '@/services/misionesService';
import * as tipologiaService from '@/services/tipologiaService';
import * as prioridadService from '@/services/prioridadService';
import { VALORES_INICIALES_EVALUACION_PRIORIDAD } from '@/lib/validations/prioridad';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useConnectivity', () => ({
  useConnectivity: vi.fn(),
}));

vi.mock('@/services/misionesService', () => ({
  obtenerDetalleMision: vi.fn(),
  aceptarMisionPatrulla: vi.fn(),
}));

vi.mock('@/services/tipologiaService', () => ({
  obtenerCatalogoTiposIncidente: vi.fn(),
  reclasificarTipologiaEnTerreno: vi.fn(),
}));

vi.mock('@/services/prioridadService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/prioridadService')>();
  return {
    ...actual,
    solicitarCalculoPrioridad: vi.fn(),
    asignarPrioridadEnTerreno: vi.fn(),
  };
});

vi.mock('@/components/maps/MapaModal', () => ({
  MapaModal: () => null,
}));

const misionTipologiaCompletadaMock: MisionLocal = {
  id: '60000000-0000-4000-8000-000000000001',
  incidenteId: '50000000-0000-4000-8000-000000000001',
  codigoIncidente: 'INC-2026-0001',
  tipologia: 'Inundación',
  direccion: 'Av. Alemania 600, Valdivia',
  coordenadas: { lat: -39.8142, lng: -73.2459 },
  prioridad: 'MEDIA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-10T01:00:00.000Z',
  fechaInicio: '2026-11-10T01:05:00.000Z',
  sincronizacionPendiente: false,
  datosAdicionales: {
    tipologiaEvaluada: true,
    esReclasificacion: false,
  },
  actualizadoEn: '2026-11-10T01:05:00.000Z',
};

describe('PatrullaMisionDetailPage — Evaluación en Terreno y Prioridad (H38)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: '00000000-0000-4000-8000-000000000004',
        rut: '15.555.555-5',
        nombre: 'Cabo Patrulla',
        email: 'patrulla@valdivia.cl',
        rolId: 'rol-patrulla',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-01',
        delegacionNombre: 'Centro',
        unidadId: 'f1000000-0000-4000-8000-000000000001',
        unidadNombre: 'Patrulla 1',
        unidadActiva: true,
        permisos: ['misiones:terreno:verificar'],
      },
      token: 'jwt-valido',
      autenticado: true,
      cargando: false,
      unidadActiva: true,
      tieneUnidadAsignada: true,
      iniciarSesion: vi.fn(),
      cerrarSesion: vi.fn(),
      refrescarPerfil: vi.fn(),
      tienePermiso: (p: string) => p === 'misiones:terreno:verificar',
    });

    vi.mocked(useConnectivity).mockReturnValue({
      status: 'connected',
      isOnline: true,
      pendientes: 0,
      sincronizando: false,
      sincronizar: vi.fn(),
      actualizarPendientes: vi.fn(),
    });

    vi.mocked(tipologiaService.obtenerCatalogoTiposIncidente).mockResolvedValue([
      {
        id: '40000000-0000-4000-8000-000000000001',
        nombre: 'Inundación',
        descripcion: 'Acumulación de agua',
        activo: true,
      },
    ]);

    vi.mocked(prioridadService.solicitarCalculoPrioridad).mockImplementation(
      async (_id, evalForm) => {
        const { calcularPrioridadSugerida } = await import(
          '@/lib/validations/prioridad'
        );
        return calcularPrioridadSugerida(evalForm);
      }
    );
  });

  it('despliega la sección "Evaluación en terreno y prioridad" dentro de Formularios de Reporte Técnico y actualiza el badge de la misión', async () => {
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(
      misionTipologiaCompletadaMock
    );

    vi.mocked(prioridadService.asignarPrioridadEnTerreno).mockResolvedValue({
      ok: true,
      offline: false,
      versionReporte: 1,
      mensaje:
        'Evaluación de terreno enviada al Centro de Mando y prioridad actualizada exitosamente.',
      reporte: {
        id: 'rep-prio-1',
        versionReporte: 1,
        evaluacion: {
          ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
          riesgoEstructural: true,
        },
        prioridadSugerida: 'CRITICA',
        prioridadAsignada: 'CRITICA',
        factoresGatillantes: ['Riesgo de colapso estructural o remoción'],
        justificacionPrioridad: 'Prioridad ratificada',
        creadoEn: '2026-11-11T12:00:00Z',
        sincronizado: true,
      },
      mision: {
        ...misionTipologiaCompletadaMock,
        prioridad: 'CRITICA',
        datosAdicionales: {
          ...misionTipologiaCompletadaMock.datosAdicionales,
          prioridadEvaluada: true,
          versionReportePrioridad: 1,
        },
      },
    });

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage
            params={Promise.resolve({ id: misionTipologiaCompletadaMock.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText('Evaluación en terreno y prioridad')
      ).toBeInTheDocument();
    });

    // Activar riesgo estructural -> sugiere CRITICA
    const switchEstructural = screen.getByRole('switch', {
      name: /Riesgo estructural \/ derrumbe/i,
    });
    fireEvent.click(switchEstructural);

    await waitFor(() => {
      expect(screen.getByTestId('badge-prioridad-sugerida')).toHaveTextContent(
        'Crítica'
      );
    });

    const submitBtn = screen.getByRole('button', {
      name: /Confirmar prioridad y enviar reporte/i,
    });
    fireEvent.click(submitBtn);

    const confirmBtn = screen.getByRole('button', {
      name: /Confirmar y Enviar/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Completado (#1)')).toBeInTheDocument();
    });
  });
});

