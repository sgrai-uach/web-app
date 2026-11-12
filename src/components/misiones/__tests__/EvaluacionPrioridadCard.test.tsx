import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvaluacionPrioridadCard } from '../EvaluacionPrioridadCard';
import { VALORES_INICIALES_EVALUACION_PRIORIDAD } from '@/lib/validations/prioridad';
import * as prioridadService from '@/services/prioridadService';
import type { MisionLocal } from '@/types/offline';

describe('EvaluacionPrioridadCard (H38)', () => {
  const misionMock: MisionLocal = {
    id: '60000000-0000-4000-8000-000000000001',
    incidenteId: '50000000-0000-4000-8000-000000000001',
    codigoIncidente: 'INC-2026-001',
    tipologia: 'Inundación',
    direccion: 'Av. Alemania 600, Valdivia',
    prioridad: 'MEDIA',
    estado: 'EN_CURSO',
    fechaDespacho: '2026-11-10T00:00:00Z',
    actualizadoEn: '2026-11-10T00:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prioridadService, 'solicitarCalculoPrioridad').mockImplementation(
      async (_id, evalForm) => {
        const { calcularPrioridadSugerida } = await import(
          '@/lib/validations/prioridad'
        );
        return calcularPrioridadSugerida(evalForm);
      }
    );
  });

  it('renderiza los contadores táctiles, switches de peligro y muestra la prioridad sugerida inicial BAJA', async () => {
    render(
      <EvaluacionPrioridadCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
      />
    );

    expect(
      screen.getByRole('group', { name: /Evaluación en terreno y prioridad/i })
    ).toBeInTheDocument();

    const badgeSugerida = screen.getByTestId('badge-prioridad-sugerida');
    expect(badgeSugerida).toHaveTextContent('Baja');

    // Incrementar contador de personas electrodependientes eleva la sugerencia a CRITICA
    const btnMasElectro = screen.getByRole('button', {
      name: /Aumentar Personas electrodependientes/i,
    });
    fireEvent.click(btnMasElectro);

    await waitFor(() => {
      expect(
        screen.getByTestId('valor-personasElectrodependientes')
      ).toHaveTextContent('1');
      expect(screen.getByTestId('badge-prioridad-sugerida')).toHaveTextContent(
        'Crítica'
      );
    });
  });

  it('despliega el campo obligatorio de justificación cuando se selecciona una prioridad distinta a la sugerida', async () => {
    render(
      <EvaluacionPrioridadCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
      />
    );

    // Por defecto coincide con la sugerida (BAJA) y no pide justificación
    expect(
      screen.queryByLabelText(/Justificación técnica del cambio de prioridad/i)
    ).not.toBeInTheDocument();

    // Seleccionar prioridad ALTA manualmente
    const radioAlta = screen.getByRole('radio', { name: /Alta/i });
    fireEvent.click(radioAlta);

    const textareaJustificacion = screen.getByLabelText(
      /Justificación técnica del cambio de prioridad/i
    );
    expect(textareaJustificacion).toBeInTheDocument();

    // Con menos de 5 caracteres el botón de envío permanece deshabilitado
    fireEvent.change(textareaJustificacion, { target: { value: 'abc' } });
    const submitBtn = screen.getByRole('button', {
      name: /Confirmar prioridad y enviar reporte/i,
    });
    expect(submitBtn).toBeDisabled();

    // Al ingresar >= 5 caracteres se habilita el botón
    fireEvent.change(textareaJustificacion, {
      target: {
        value: 'Crecida rápida del caudal amenaza directamente dos viviendas.',
      },
    });
    expect(submitBtn).not.toBeDisabled();
  });

  it('envía el reporte de prioridad tras confirmar en el modal y dispara onPrioridadActualizada', async () => {
    const onActualizada = vi.fn();
    vi.spyOn(prioridadService, 'asignarPrioridadEnTerreno').mockResolvedValue({
      ok: true,
      offline: false,
      versionReporte: 1,
      mensaje:
        'Evaluación de terreno enviada al Centro de Mando y prioridad actualizada exitosamente.',
      reporte: {
        id: 'rep-1',
        versionReporte: 1,
        evaluacion: {
          ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
          riesgoElectrico: true,
        },
        prioridadSugerida: 'CRITICA',
        prioridadAsignada: 'CRITICA',
        factoresGatillantes: ['Peligro eléctrico activo en terreno'],
        justificacionPrioridad: 'Prioridad ratificada',
        creadoEn: '2026-11-11T12:00:00Z',
        sincronizado: true,
      },
      mision: {
        ...misionMock,
        prioridad: 'CRITICA',
        datosAdicionales: {
          prioridadEvaluada: true,
          versionReportePrioridad: 1,
        },
      },
    });

    render(
      <EvaluacionPrioridadCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
        onPrioridadActualizada={onActualizada}
      />
    );

    // Activar switch de riesgo eléctrico
    const switchElectrico = screen.getByRole('switch', {
      name: /Riesgo eléctrico activo/i,
    });
    fireEvent.click(switchElectrico);

    await waitFor(() => {
      expect(screen.getByTestId('badge-prioridad-sugerida')).toHaveTextContent(
        'Crítica'
      );
    });

    const submitBtn = screen.getByRole('button', {
      name: /Confirmar prioridad y enviar reporte/i,
    });
    fireEvent.click(submitBtn);

    // Se abre el modal de confirmación
    expect(
      screen.getByText('Confirmar Evaluación y Prioridad')
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', {
      name: /Confirmar y Enviar/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(prioridadService.asignarPrioridadEnTerreno).toHaveBeenCalledWith(
        misionMock.incidenteId,
        expect.objectContaining({
          prioridad: 'CRITICA',
          prioridadSugerida: 'CRITICA',
          riesgoElectrico: true,
          versionReporte: 1,
        }),
        expect.anything()
      );
      expect(onActualizada).toHaveBeenCalledTimes(1);
    });
  });

  it('muestra el resumen cuando ya tiene un reporte previo y al editar despliega "Enviando actualización (Reporte #2)"', async () => {
    const misionConReporte: MisionLocal = {
      ...misionMock,
      prioridad: 'ALTA',
      datosAdicionales: {
        prioridadEvaluada: true,
        versionReportePrioridad: 1,
        reportesPrioridad: [
          {
            id: 'rep-1',
            versionReporte: 1,
            evaluacion: {
              ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
              nucleoFamiliarTotal: 4,
              cantidadAdultosMayores: 2,
              viviendasAfectadas: 1,
              nivelCompromisoVivienda: 'MODERADO',
              detallesAdicionales: 'Adultos mayores requieren traslado preventivo.',
            },
            prioridadSugerida: 'ALTA',
            prioridadAsignada: 'ALTA',
            factoresGatillantes: ['Adultos mayores afectados (2)'],
            justificacionPrioridad: 'Prioridad ratificada en terreno.',
            creadoEn: '2026-11-11T10:00:00Z',
            sincronizado: true,
          },
        ],
      },
    };

    render(
      <EvaluacionPrioridadCard
        incidenteId={misionConReporte.incidenteId}
        misionActual={misionConReporte}
      />
    );

    // Debe mostrar la tarjeta de resumen con Reporte #1
    expect(screen.getByTestId('resumen-prioridad')).toBeInTheDocument();
    expect(
      screen.getByText(/Adultos mayores requieren traslado preventivo/i)
    ).toBeInTheDocument();

    // Clic en "Modificar y reenviar reporte"
    const editBtn = screen.getByRole('button', {
      name: /Modificar y reenviar reporte/i,
    });
    fireEvent.click(editBtn);

    // Debe mostrar el aviso de Reporte #2 y precargar los contadores
    expect(
      screen.getByText(/Enviando actualización \(Reporte #2\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('valor-nucleoFamiliarTotal')
    ).toHaveTextContent('4');
    expect(
      screen.getByTestId('valor-cantidadAdultosMayores')
    ).toHaveTextContent('2');
    expect(
      screen.getByRole('button', {
        name: /Enviar actualización \(Reporte #2\)/i,
      })
    ).toBeInTheDocument();
  });
});

