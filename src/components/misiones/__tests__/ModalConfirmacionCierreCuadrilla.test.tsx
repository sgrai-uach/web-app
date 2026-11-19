import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalConfirmacionCierreCuadrilla } from '../ModalConfirmacionCierreCuadrilla';

describe('ModalConfirmacionCierreCuadrilla (H68)', () => {
  it('renderiza el resumen de estado, horas hombre, materiales, evidencias y aviso H86', () => {
    const alConfirmar = vi.fn();
    const alCancelar = vi.fn();

    render(
      <ModalConfirmacionCierreCuadrilla
        abierto={true}
        resumenFaenas="Succión de aguas lluvias con motobomba y limpieza de rejillas."
        horasHombre={6.5}
        estadoTerreno="FINALIZADO"
        materialesConsumidos={[
          {
            recurso_id: 'e1000000-0000-4000-8000-000000000004',
            nombre: 'Sacos de Arena',
            cantidad: 15,
            unidad: 'sacos',
          },
        ]}
        requiereApoyoAdicional={true}
        totalAdjuntosSincronizados={2}
        totalAdjuntosPendientes={1}
        alConfirmar={alConfirmar}
        alCancelar={alCancelar}
      />
    );

    expect(
      screen.getByText('Confirmar Cierre de Misión e Informe Técnico')
    ).toBeInTheDocument();
    expect(screen.getByText('Finalizado')).toBeInTheDocument();
    expect(screen.getByText('6.5 h')).toBeInTheDocument();
    expect(screen.getByText('Apoyo Adicional')).toBeInTheDocument();
    expect(screen.getByText('Solicitado')).toBeInTheDocument();
    expect(screen.queryByText(/FIBE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Asistencia Social/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Sacos de Arena: 15 sacos/i)).toBeInTheDocument();
    expect(
      screen.getByText(/3 archivo\(s\) \(2 sincronizado\(s\), 1 en cola offline\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/El incidente permanecerá en evaluación del Centro de Mando/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar y Finalizar Misión/i })
    );
    expect(alConfirmar).toHaveBeenCalledTimes(1);
  });
});
