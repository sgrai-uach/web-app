import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import PatrullaMisionDetailPage from '../page';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import * as misionesService from '@/services/misionesService';
import * as tipologiaService from '@/services/tipologiaService';
import * as prioridadService from '@/services/prioridadService';
import * as reporteService from '@/services/reporteVerificacionService';
import { VALORES_INICIALES_EVALUACION_PRIORIDAD } from '@/lib/validations/prioridad';
import type { MisionLocal } from '@/types/offline';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useConnectivity', () => ({
  useConnectivity: vi.fn(),
}));

vi.mock('@/services/misionesService', () => ({
  obtenerDetalleMision: vi.fn(),
  aceptarMisionPatrulla: vi.fn(),
  obtenerCoordenadasOpcionales: vi.fn(),
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

vi.mock('@/services/reporteVerificacionService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/reporteVerificacionService')>();
  return {
    ...actual,
    enviarReporteVerificacionTerreno: vi.fn(),
  };
});

vi.mock('@/components/maps/MapaModal', () => ({
  MapaModal: () => null,
}));

const misionListaParaCierreMock: MisionLocal = {
  id: '60000000-0000-4000-8000-000000000001',
  incidenteId: '50000000-0000-4000-8000-000000000001',
  codigoIncidente: 'INC-2026-0001',
  tipologia: 'Inundación',
  direccion: 'Av. Alemania 600, Valdivia',
  coordenadas: { lat: -39.8142, lng: -73.2459 },
  prioridad: 'ALTA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-10T01:00:00.000Z',
  fechaInicio: '2026-11-10T01:05:00.000Z',
  sincronizacionPendiente: false,
  datosAdicionales: {
    tipologiaEvaluada: true,
    prioridadEvaluada: true,
    versionReportePrioridad: 1,
    personasAfectadasPrevias: 4,
    reportesTerreno: [
      {
        id: 'rep-prio-1',
        tipoReporte: 'EVALUACION_PRIORIDAD',
        versionReporte: 1,
        personasAfectadas: 4,
        detallesEvaluacion: {
          ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
          nucleoFamiliarTotal: 4,
        },
        evaluador: {
          id: 'usr-p1',
          nombre: 'Personal 1',
          email: 'p1@valdivia.cl',
        },
        creadoEn: '2026-11-16T00:30:00Z',
      },
    ],
  },
  actualizadoEn: '2026-11-10T01:05:00.000Z',
};

describe('PatrullaMisionDetailPage — Informe Técnico de Verificación y Cierre (H39)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: 'usr-p2',
        rut: '15.555.555-5',
        nombre: 'Personal 2',
        email: 'p2@valdivia.cl',
        rolId: 'rol-patrulla',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-01',
        delegacionNombre: 'Centro',
        unidadId: 'f1000000-0000-4000-8000-000000000001',
        unidadNombre: 'Patrulla 1',
        unidadActiva: true,
        permisos: ['misiones:terreno:verificar', 'reportes:crear'],
      },
      token: 'jwt-valido',
      autenticado: true,
      cargando: false,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      actualizarUnidadAsignada: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
      tienePermiso: (p: string) =>
        p === 'misiones:terreno:verificar' || p === 'reportes:crear',
      tieneAlgunPermiso: () => true,
    });

    vi.mocked(useConnectivity).mockReturnValue({
      status: 'connected',
      online: true,
      pendientes: 0,
      sincronizando: false,
      sincronizar: vi.fn(),
      actualizarPendientes: vi.fn().mockResolvedValue(undefined),
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

  it('abre automáticamente el Paso 3 cuando Tipología y Prioridad están completados, envía el reporte y redirige a /patrulla/misiones', async () => {
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(
      misionListaParaCierreMock
    );

    vi.mocked(reporteService.enviarReporteVerificacionTerreno).mockResolvedValue({
      ok: true,
      offline: false,
      mensaje: 'Informe técnico enviado y misión cerrada exitosamente.',
      reporte: {
        id: 'rep-cierre-1',
        misionId: misionListaParaCierreMock.id,
        dictamen: 'REQUIERE_CUADRILLA',
        motivo_no_abordable: '',
        resumen_tecnico: 'Se constata anegamiento severo con 4 damnificados.',
        estado_terreno: 'CRITICO',
        personas_afectadas: 4,
        danos_estimados: '',
        observaciones: '',
        requiere_asistencia_social: true,
        adjuntoIds: [],
        adjuntos: [],
        evaluador: { id: 'usr-p2', nombre: 'Personal 2' },
        creadoEn: '2026-11-16T01:00:00Z',
        sincronizado: true,
      },
      mision: {
        ...misionListaParaCierreMock,
        estado: 'COMPLETADA',
      },
    });

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage
            params={Promise.resolve({ id: misionListaParaCierreMock.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText('Informe técnico de verificación y cierre')
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Personas damnificadas \/ afectadas/i)
      ).toHaveValue(4);
    });

    fireEvent.change(
      screen.getByLabelText(/Resumen técnico del siniestro/i),
      {
        target: {
          value: 'Se constata anegamiento severo con 4 damnificados.',
        },
      }
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Enviar Reporte y Cerrar Tarea/i })
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar y Cerrar Misión/i })
    );

    await waitFor(() => {
      expect(reporteService.enviarReporteVerificacionTerreno).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith('/patrulla/misiones');
    });
  });

  it('sincroniza en vivo mediante evento sgrai:mision-sincronizada cuando otro integrante de la patrulla sube un reporte', async () => {
    const misionInicialSinCierre: MisionLocal = {
      ...misionListaParaCierreMock,
    };
    const misionActualizadaPorCompanero: MisionLocal = {
      ...misionListaParaCierreMock,
      estado: 'COMPLETADA',
      datosAdicionales: {
        ...misionListaParaCierreMock.datosAdicionales,
        reporteVerificacionEnviado: true,
        dictamenVerificacion: 'REQUIERE_CUADRILLA',
        reportesTerreno: [
          ...(misionListaParaCierreMock.datosAdicionales
            ?.reportesTerreno as Record<string, unknown>[]),
          {
            id: 'rep-cierre-comp',
            tipoReporte: 'VERIFICACION_CIERRE',
            dictamen: 'REQUIERE_CUADRILLA',
            resumenTecnico: 'Cerrado por Personal 1 desde terreno.',
            estadoTerreno: 'ESTABLE',
            personasAfectadas: 4,
            requiereAsistenciaSocial: false,
            evaluador: {
              id: 'usr-p1',
              nombre: 'Personal 1',
              email: 'p1@valdivia.cl',
            },
            adjuntos: [],
            creadoEn: '2026-11-16T01:05:00Z',
          },
        ],
      },
    };

    vi.mocked(misionesService.obtenerDetalleMision)
      .mockResolvedValueOnce(misionInicialSinCierre)
      .mockResolvedValueOnce(misionActualizadaPorCompanero);

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage
            params={Promise.resolve({ id: misionListaParaCierreMock.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Enviar Reporte y Cerrar Tarea/i })
      ).toBeInTheDocument();
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('sgrai:mision-sincronizada'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('resumen-reporte-cierre')).toBeInTheDocument();
      expect(screen.queryByTestId('aviso-autor-cierre')).not.toBeInTheDocument();
      expect(screen.getByText(/^Registrado por$/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Personal 1 \(p1@valdivia\.cl\) ·/i)).toHaveLength(1);
    });
  });
});
