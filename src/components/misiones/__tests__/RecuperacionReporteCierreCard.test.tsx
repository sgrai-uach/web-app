import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecuperacionReporteCierreCard } from '../RecuperacionReporteCierreCard';
import * as reporteRecuperacionService from '@/services/reporteRecuperacionService';
import type { MisionLocal } from '@/types/offline';

const mockShowSuccess = vi.fn();
const mockShowWarning = vi.fn();
const mockShowError = vi.fn();

vi.mock('@/components/ui/Toast', () => ({
  useToastOptional: () => ({
    showSuccess: mockShowSuccess,
    showWarning: mockShowWarning,
    showError: mockShowError,
    showInfo: vi.fn(),
    showToast: vi.fn(),
    removeToast: vi.fn(),
  }),
}));

const misionRecuperacionBase: MisionLocal = {
  id: 'mis-rec-100',
  incidenteId: '',
  codigoIncidente: 'REC-2026-0010',
  tipoMision: 'RECUPERACION',
  tipologia: 'Entrega de kits en Collico',
  direccion: 'Collico 123',
  prioridad: 'ALTA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-21T00:00:00.000Z',
  actualizadoEn: '2026-11-21T00:05:00.000Z',
  datosAdicionales: {
    recuperacion: {
      id: 'rec-op-100',
      codigo: 'REC-2026-0010',
      estado: 'EN_EJECUCION',
      sector: 'Collico',
      recursos: [
        {
          recursoId: '11111111-1111-4111-8111-111111111111',
          nombre: 'Frazadas Térmicas',
          cantidadAsignada: 10,
        },
      ],
      reportePatrulla: null,
    },
  },
};

describe('RecuperacionReporteCierreCard (Patrulla -> Centro de Mando)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('valida resumen mínimo de 10 caracteres, abre modal de confirmación (H39) y emite Toast al enviar', async () => {
    const misionConReporte: MisionLocal = {
      ...misionRecuperacionBase,
      datosAdicionales: {
        recuperacion: {
          id: 'rec-op-100',
          codigo: 'REC-2026-0010',
          estado: 'EN_EJECUCION',
          sector: 'Collico',
          recursos: [
            {
              recursoId: '11111111-1111-4111-8111-111111111111',
              nombre: 'Frazadas Térmicas',
              cantidadAsignada: 10,
            },
          ],
          reportePatrulla: {
            resumen: 'Se entregaron 7 frazadas a 3 familias en Collico.',
            consumos: [
              {
                recursoId: '11111111-1111-4111-8111-111111111111',
                cantidadConsumida: 7,
              },
            ],
            reportadoEn: '2026-11-21T00:30:00.000Z',
            reportadoPor: { id: 'u1', nombre: 'Patrullero Uno' },
          },
        },
      },
    };

    const enviarSpy = vi
      .spyOn(reporteRecuperacionService, 'reportarCierreRecuperacionTerreno')
      .mockResolvedValueOnce({
        mision: misionConReporte,
        enColaOffline: false,
        mensaje: 'Reporte de cierre enviado al Centro de Mando.',
      });

    const onReporteEnviado = vi.fn();

    render(
      <RecuperacionReporteCierreCard
        misionActual={misionRecuperacionBase}
        onReporteEnviado={onReporteEnviado}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Enviar Reporte de Cierre/i }));
    expect(
      await screen.findByText(/El resumen de cierre debe tener al menos 10 caracteres/i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Resumen de cierre en terreno'), {
      target: { value: 'Se entregaron 7 frazadas a 3 familias en Collico.' },
    });
    fireEvent.change(screen.getByLabelText('Consumido de Frazadas Térmicas'), {
      target: { value: '7' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Enviar Reporte de Cierre/i }));

    expect(
      await screen.findByText(/Confirmar envío de reporte de cierre/i)
    ).toBeInTheDocument();

    const botonesEnviar = screen.getAllByRole('button', {
      name: /Enviar Reporte de Cierre/i,
    });
    fireEvent.click(botonesEnviar[botonesEnviar.length - 1]);

    await waitFor(() => {
      expect(enviarSpy).toHaveBeenCalledWith('mis-rec-100', {
        resumenCierre: 'Se entregaron 7 frazadas a 3 familias en Collico.',
        consumos: [
          {
            recursoId: '11111111-1111-4111-8111-111111111111',
            cantidadConsumida: 7,
          },
        ],
        misionActual: misionRecuperacionBase,
      });
    });

    expect(mockShowSuccess).toHaveBeenCalled();
    expect(onReporteEnviado).toHaveBeenCalledWith(misionConReporte);
  });

  it('muestra la tarjeta de resumen pendiente de confirmación cuando ya existe reportePatrulla', () => {
    const misionYaReportada: MisionLocal = {
      ...misionRecuperacionBase,
      datosAdicionales: {
        recuperacion: {
          id: 'rec-op-100',
          codigo: 'REC-2026-0010',
          estado: 'EN_EJECUCION',
          sector: 'Collico',
          recursos: [
            {
              recursoId: '11111111-1111-4111-8111-111111111111',
              nombre: 'Frazadas Térmicas',
              cantidadAsignada: 10,
            },
          ],
          reportePatrulla: {
            resumen: 'Entrega completa en sector Collico.',
            consumos: [
              {
                recursoId: '11111111-1111-4111-8111-111111111111',
                cantidadConsumida: 8,
              },
            ],
            reportadoEn: '2026-11-21T00:30:00.000Z',
            reportadoPor: { id: 'u1', nombre: 'Patrullero Uno' },
          },
        },
      },
    };

    render(<RecuperacionReporteCierreCard misionActual={misionYaReportada} />);

    expect(screen.getByText(/Pendiente de confirmación/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Entrega completa en sector Collico/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Consumido: 8 \/ 10 un\. \(Devolver: 2 un\.\)/i)
    ).toBeInTheDocument();
  });
});
