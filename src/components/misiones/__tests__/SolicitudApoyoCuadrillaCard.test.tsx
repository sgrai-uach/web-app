import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SolicitudApoyoCuadrillaCard } from '../SolicitudApoyoCuadrillaCard';
import { ToastProvider } from '@/components/ui/Toast';
import * as solicitudApoyoService from '@/services/solicitudApoyoService';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/services/solicitudApoyoService', async (importOriginal) => {
  const actual = await importOriginal<typeof solicitudApoyoService>();
  return {
    ...actual,
    solicitarApoyoAdicional: vi.fn(),
  };
});

const misionEnCurso: MisionLocal = {
  id: '70000000-0000-4000-8000-000000000044',
  incidenteId: '30000000-0000-4000-8000-000000000044',
  codigoIncidente: 'INC-2026-0044',
  tipologia: 'Caída de árbol sobre calzada',
  direccion: 'Av. Ramón Picarte 1100, Valdivia',
  prioridad: 'ALTA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-23T18:00:00.000Z',
  actualizadoEn: '2026-11-23T18:10:00.000Z',
};

describe('SolicitudApoyoCuadrillaCard (HU-44)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra la casilla "Requiere apoyo adicional" desmarcada inicialmente y oculta "Detalle de apoyo requerido"', () => {
    render(
      <ToastProvider>
        <SolicitudApoyoCuadrillaCard misionActual={misionEnCurso} />
      </ToastProvider>
    );

    const checkbox = screen.getByRole('checkbox', {
      name: /Requiere apoyo adicional/i,
    });
    expect(checkbox).not.toBeChecked();
    expect(
      screen.queryByLabelText(/Detalle de apoyo requerido/i)
    ).not.toBeInTheDocument();
  });

  it('despliega el campo obligatorio "Detalle de apoyo requerido" al marcar la casilla y bloquea envío con menos de 5 caracteres', async () => {
    render(
      <ToastProvider>
        <SolicitudApoyoCuadrillaCard misionActual={misionEnCurso} />
      </ToastProvider>
    );

    const checkbox = screen.getByRole('checkbox', {
      name: /Requiere apoyo adicional/i,
    });
    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    const textareaDetalle = screen.getByLabelText(/Detalle de apoyo requerido/i);
    expect(textareaDetalle).toBeInTheDocument();
    expect(textareaDetalle).toHaveAttribute('aria-required', 'true');

    fireEvent.change(textareaDetalle, { target: { value: 'abc' } });
    fireEvent.click(
      screen.getByRole('button', { name: /Enviar Solicitud de Apoyo/i })
    );

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent(/al menos 5 caracteres/i);
    expect(
      solicitudApoyoService.solicitarApoyoAdicional
    ).not.toHaveBeenCalled();
  });

  it('envía la solicitud con detalle válido (>= 5 caracteres) y confirma que la central fue alertada', async () => {
    const onApoyoSolicitado = vi.fn();
    vi.mocked(
      solicitudApoyoService.solicitarApoyoAdicional
    ).mockResolvedValueOnce({
      solicitud: {
        id: 'rep-apoyo-1',
        misionId: misionEnCurso.id,
        requiereApoyoAdicional: true,
        requiereCuadrillaAdicional: true,
        detalleApoyoRequerido:
          'Se solicita motoniveladora y cuadrilla adicional de despeje',
        resumenTecnico: 'Calzada obstruida',
        observaciones: '',
        creadoEn: '2026-11-23T18:30:00.000Z',
        sincronizado: true,
      },
      mision: {
        ...misionEnCurso,
        datosAdicionales: {
          solicitudesApoyoLocales: [
            {
              id: 'rep-apoyo-1',
              misionId: misionEnCurso.id,
              requiereApoyoAdicional: true,
              requiereCuadrillaAdicional: true,
              detalleApoyoRequerido:
                'Se solicita motoniveladora y cuadrilla adicional de despeje',
              resumenTecnico: 'Calzada obstruida',
              observaciones: '',
              creadoEn: '2026-11-23T18:30:00.000Z',
              sincronizado: true,
            },
          ],
        },
      },
      enColaOffline: false,
      mensaje:
        'Solicitud de apoyo enviada. La central logística y de operaciones ha sido alertada.',
    });

    render(
      <ToastProvider>
        <SolicitudApoyoCuadrillaCard
          misionActual={misionEnCurso}
          onApoyoSolicitado={onApoyoSolicitado}
        />
      </ToastProvider>
    );

    fireEvent.click(
      screen.getByRole('checkbox', { name: /Requiere apoyo adicional/i })
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Requiere cuadrilla adicional/i })
    );

    fireEvent.change(screen.getByLabelText(/Detalle de apoyo requerido/i), {
      target: {
        value: 'Se solicita motoniveladora y cuadrilla adicional de despeje',
      },
    });
    fireEvent.change(screen.getByLabelText(/Contexto breve de la faena/i), {
      target: { value: 'Calzada obstruida' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Enviar Solicitud de Apoyo/i })
    );

    await waitFor(() => {
      expect(
        solicitudApoyoService.solicitarApoyoAdicional
      ).toHaveBeenCalledWith(
        misionEnCurso.id,
        {
          requiereApoyoAdicional: true,
          requiereCuadrillaAdicional: true,
          detalleApoyoRequerido:
            'Se solicita motoniveladora y cuadrilla adicional de despeje',
          resumenTecnico: 'Calzada obstruida',
          observaciones: '',
        },
        { misionActual: misionEnCurso }
      );
    });

    const alertasConfirmacion = await screen.findAllByText(
      /Solicitud de apoyo enviada\. La central logística y de operaciones ha sido alertada\./i
    );
    expect(alertasConfirmacion.length).toBeGreaterThanOrEqual(1);
    expect(onApoyoSolicitado).toHaveBeenCalledTimes(1);
  });

  it('muestra historial previo de solicitudes y oculta el formulario en modo deshabilitado', () => {
    const misionConHistorial: MisionLocal = {
      ...misionEnCurso,
      estado: 'COMPLETADA',
      datosAdicionales: {
        reportesTerreno: [
          {
            id: 'rep-apoyo-hist-1',
            requiereApoyoAdicional: true,
            requiereCuadrillaAdicional: true,
            detalleApoyoRequerido: 'Camión aljibe 10.000 L',
            creadoEn: '2026-11-23T18:20:00.000Z',
            evaluador: {
              nombre: 'Carlos Delegado',
              email: 'carlos@valdivia.cl',
            },
          },
        ],
      },
    };

    render(
      <ToastProvider>
        <SolicitudApoyoCuadrillaCard
          misionActual={misionConHistorial}
          deshabilitado
        />
      </ToastProvider>
    );

    expect(
      screen.queryByRole('checkbox', { name: /Requiere apoyo adicional/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Solicitud de Apoyo #1')).toBeInTheDocument();
    expect(screen.getByText('Camión aljibe 10.000 L')).toBeInTheDocument();
    expect(screen.getByText('Apoyo Solicitado')).toBeInTheDocument();
    expect(screen.getByText('Cuadrilla adicional solicitada')).toBeInTheDocument();
  });

  it('limpia requiereCuadrillaAdicional al desmarcar "Requiere apoyo adicional"', () => {
    render(
      <ToastProvider>
        <SolicitudApoyoCuadrillaCard misionActual={misionEnCurso} />
      </ToastProvider>
    );

    const checkApoyo = screen.getByRole('checkbox', {
      name: /Requiere apoyo adicional/i,
    });
    fireEvent.click(checkApoyo);

    const checkCuadrilla = screen.getByRole('checkbox', {
      name: /Requiere cuadrilla adicional/i,
    });
    fireEvent.click(checkCuadrilla);
    expect(checkCuadrilla).toBeChecked();

    // Desmarcar y volver a marcar "Requiere apoyo adicional" -> "Requiere cuadrilla adicional" debe haberse limpiado
    fireEvent.click(checkApoyo);
    fireEvent.click(checkApoyo);
    expect(
      screen.getByRole('checkbox', { name: /Requiere cuadrilla adicional/i })
    ).not.toBeChecked();
  });
});
