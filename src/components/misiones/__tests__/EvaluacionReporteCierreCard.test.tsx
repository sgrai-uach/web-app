import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvaluacionReporteCierreCard } from '../EvaluacionReporteCierreCard';
import { VALORES_INICIALES_EVALUACION_PRIORIDAD } from '@/lib/validations/prioridad';
import * as reporteService from '@/services/reporteVerificacionService';
import type { MisionLocal } from '@/types/offline';

describe('EvaluacionReporteCierreCard (H39)', () => {
  const misionConPrioridadMock: MisionLocal = {
    id: '60000000-0000-4000-8000-000000000001',
    incidenteId: '50000000-0000-4000-8000-000000000001',
    codigoIncidente: 'INC-2026-001',
    tipologia: 'Inundación',
    direccion: 'Av. Alemania 600, Valdivia',
    prioridad: 'ALTA',
    estado: 'EN_CURSO',
    fechaDespacho: '2026-11-10T00:00:00Z',
    actualizadoEn: '2026-11-10T00:00:00Z',
    datosAdicionales: {
      prioridadEvaluada: true,
      reportesTerreno: [
        {
          id: 'rep-prio-1',
          tipoReporte: 'EVALUACION_PRIORIDAD',
          versionReporte: 1,
          personasAfectadas: 6,
          detallesEvaluacion: {
            ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
            nucleoFamiliarTotal: 6,
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
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('precarga personas_afectadas desde HU-38, muestra la nota informativa y permite modificar el valor', () => {
    render(<EvaluacionReporteCierreCard misionActual={misionConPrioridadMock} />);

    const inputPersonas = screen.getByLabelText(/Personas damnificadas \/ afectadas/i);
    expect(inputPersonas).toHaveValue(6);

    expect(screen.getByTestId('nota-personas-previas')).toHaveTextContent(
      /Rescatado de la evaluación de prioridad previa; puede modificarlo si constató un número distinto/i
    );
    expect(screen.getByTestId('nota-personas-previas')).toHaveTextContent(
      /Personal 1/i
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Aumentar personas damnificadas/i })
    );
    expect(inputPersonas).toHaveValue(7);
  });

  it('despliega el campo obligatorio motivo_no_abordable solo al seleccionar NO_ABORDABLE', () => {
    render(<EvaluacionReporteCierreCard misionActual={misionConPrioridadMock} />);

    expect(
      screen.queryByLabelText(/Motivo de No Abordabilidad/i)
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /No abordable/i }));

    expect(
      screen.getByLabelText(/Motivo de No Abordabilidad/i)
    ).toBeInTheDocument();
  });

  it('incluye el switch de Ficha FIBE y el módulo funcional de carga de evidencia multimedia', () => {
    render(<EvaluacionReporteCierreCard misionActual={misionConPrioridadMock} />);

    const switchFibe = screen.getByRole('switch', {
      name: /Requiere Asistencia Social \(Levantamiento Ficha FIBE\)/i,
    });
    expect(switchFibe).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(switchFibe);
    expect(switchFibe).toHaveAttribute('aria-checked', 'true');

    expect(screen.queryByText(/Próximamente/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Evidencia Multimedia/i)).toBeInTheDocument();
  });

  it('envía el reporte de cierre tras confirmar en modal y dispara onReporteEnviado', async () => {
    const onReporteEnviado = vi.fn();
    vi.spyOn(reporteService, 'enviarReporteVerificacionTerreno').mockResolvedValue({
      ok: true,
      offline: false,
      mensaje: 'Informe técnico enviado y misión cerrada exitosamente.',
      reporte: {
        id: 'rep-cierre-1',
        misionId: misionConPrioridadMock.id,
        dictamen: 'REQUIERE_CUADRILLA',
        motivo_no_abordable: '',
        resumen_tecnico: 'Se constata anegamiento mayor que requiere motobomba.',
        estado_terreno: 'CRITICO',
        personas_afectadas: 6,
        danos_estimados: 'Daño en primer piso.',
        observaciones: 'Acceso despejado.',
        requiere_asistencia_social: true,
        adjuntoIds: [],
        adjuntos: [],
        evaluador: { id: 'usr-p2', nombre: 'Personal 2' },
        creadoEn: '2026-11-16T01:00:00Z',
        sincronizado: true,
      },
      mision: {
        ...misionConPrioridadMock,
        estado: 'COMPLETADA',
      },
    });

    render(
      <EvaluacionReporteCierreCard
        misionActual={misionConPrioridadMock}
        usuarioActualId="usr-p2"
        onReporteEnviado={onReporteEnviado}
      />
    );

    fireEvent.change(
      screen.getByLabelText(/Resumen técnico del siniestro/i),
      {
        target: {
          value: 'Se constata anegamiento mayor que requiere motobomba.',
        },
      }
    );

    fireEvent.click(
      screen.getByRole('switch', {
        name: /Requiere Asistencia Social \(Levantamiento Ficha FIBE\)/i,
      })
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Enviar Reporte y Cerrar Tarea/i })
    );

    expect(
      screen.getByText('Confirmar Informe Técnico y Cierre')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar y Cerrar Misión/i })
    );

    await waitFor(() => {
      expect(reporteService.enviarReporteVerificacionTerreno).toHaveBeenCalledWith(
        misionConPrioridadMock.id,
        expect.objectContaining({
          dictamen: 'REQUIERE_CUADRILLA',
          personas_afectadas: 6,
          requiere_asistencia_social: true,
          adjuntoIds: [],
          adjuntos: [],
        }),
        expect.anything()
      );
      expect(onReporteEnviado).toHaveBeenCalledTimes(1);
    });
  });

  it('muestra la vista resumen indicando quién subió el informe cuando otro integrante de la patrulla ya cerró la verificación', () => {
    const misionCerradaPorCompanero: MisionLocal = {
      ...misionConPrioridadMock,
      estado: 'COMPLETADA',
      datosAdicionales: {
        reporteVerificacionEnviado: true,
        dictamenVerificacion: 'REQUIERE_CUADRILLA',
        reportesTerreno: [
          {
            id: 'rep-cierre-1',
            tipoReporte: 'VERIFICACION_CIERRE',
            dictamen: 'REQUIERE_CUADRILLA',
            resumenTecnico: 'Árbol caído bloqueando media calzada.',
            estadoTerreno: 'CRITICO',
            personasAfectadas: 2,
            requiereAsistenciaSocial: false,
            evaluador: {
              id: 'usr-p1',
              nombre: 'Personal 1',
              email: 'p1@valdivia.cl',
            },
            adjuntos: [],
            creadoEn: '2026-11-16T01:00:00Z',
          },
        ],
      },
    };

    render(
      <EvaluacionReporteCierreCard
        misionActual={misionCerradaPorCompanero}
        usuarioActualId="usr-p2"
        deshabilitado={true}
      />
    );

    expect(screen.getByTestId('resumen-reporte-cierre')).toBeInTheDocument();
    expect(screen.queryByTestId('aviso-autor-cierre')).not.toBeInTheDocument();
    expect(screen.getByText(/^Registrado por$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Personal 1 \(p1@valdivia\.cl\) ·/i)).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: /Enviar Reporte y Cerrar Tarea/i })
    ).not.toBeInTheDocument();
  });

  it('muestra mensaje de validación claro al intentar enviar con resumen técnico menor a 10 caracteres', () => {
    render(<EvaluacionReporteCierreCard misionActual={misionConPrioridadMock} />);

    fireEvent.change(screen.getByLabelText(/Resumen técnico del siniestro/i), {
      target: { value: 'mimi mi' },
    });

    const btnEnviar = screen.getByRole('button', {
      name: /Enviar Reporte y Cerrar Tarea/i,
    });
    expect(btnEnviar).not.toBeDisabled();

    fireEvent.click(btnEnviar);

    expect(screen.getAllByRole('alert')[0]).toHaveTextContent(
      /al menos 10 caracteres \(actual: 7\)/i
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('BUG-H43-PWA-04/05: actualiza lista de evidencias cuando cambia misionActual, excluye local-* del envío Zod y muestra visor multimedia en yaEnviado', async () => {
    const enviandoSpy = vi
      .spyOn(reporteService, 'enviarReporteVerificacionTerreno')
      .mockResolvedValue({
        ok: true,
        offline: true,
        mensaje: 'Guardado offline',
        reporte: {
          id: 'rep-cierre-offline',
          misionId: misionConPrioridadMock.id,
          dictamen: 'REQUIERE_CUADRILLA',
          motivo_no_abordable: '',
          resumen_tecnico: 'Evaluación técnica completa en terreno.',
          estado_terreno: 'ESTABLE',
          personas_afectadas: 6,
          danos_estimados: '',
          observaciones: '',
          requiere_asistencia_social: false,
          adjuntoIds: [],
          adjuntos: [],
          creadoEn: '2026-11-20T11:00:00.000Z',
          sincronizado: false,
        },
      });

    const misionConAdjuntoOffline: MisionLocal = {
      ...misionConPrioridadMock,
      datosAdicionales: {
        ...misionConPrioridadMock.datosAdicionales,
        adjuntos: [
          {
            id: 'local-offline-img-1',
            nombreArchivo: 'offline-foto.jpg',
            url: 'data:image/jpeg;base64,AAA',
            tipoMime: 'image/jpeg',
            tamanoBytes: 1200,
            creadoEn: '2026-11-20T10:55:00.000Z',
            sincronizacionPendiente: true,
          },
        ],
      },
    };

    const { rerender } = render(
      <EvaluacionReporteCierreCard misionActual={misionConPrioridadMock} />
    );

    rerender(
      <EvaluacionReporteCierreCard misionActual={misionConAdjuntoOffline} />
    );

    expect(screen.getByText('offline-foto.jpg')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Resumen técnico del siniestro/i), {
      target: { value: 'Evaluación técnica completa en terreno.' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Enviar Reporte y Cerrar Tarea/i })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Confirmar y Cerrar Misión/i })
    );

    await waitFor(() => {
      expect(enviandoSpy).toHaveBeenCalled();
    });
    expect(enviandoSpy.mock.calls[0]?.[1].adjuntoIds).toEqual([]);

    const misionYaEnviada: MisionLocal = {
      ...misionConPrioridadMock,
      estado: 'COMPLETADA',
      datosAdicionales: {
        reporteVerificacionEnviado: true,
        dictamenVerificacion: 'REQUIERE_CUADRILLA',
        reportesTerreno: [
          {
            id: 'rep-cierre-view',
            tipoReporte: 'VERIFICACION_CIERRE',
            dictamen: 'REQUIERE_CUADRILLA',
            resumenTecnico: 'Árbol caído verificado.',
            estadoTerreno: 'ESTABLE',
            personasAfectadas: 1,
            requiereAsistenciaSocial: false,
            adjuntos: [
              {
                id: '88888888-8888-4888-8888-888888888888',
                nombreArchivo: 'miniatura-cierre.jpg',
                url: '/uploads/evidencia/miniatura-cierre.jpg',
                tipoMime: 'image/jpeg',
                tamanoBytes: 2048,
                creadoEn: '2026-11-20T11:05:00.000Z',
              },
            ],
            creadoEn: '2026-11-20T11:05:00.000Z',
          },
        ],
      },
    };

    rerender(<EvaluacionReporteCierreCard misionActual={misionYaEnviada} />);
    expect(screen.getByAltText('Miniatura de miniatura-cierre.jpg')).toBeInTheDocument();
  });
});
