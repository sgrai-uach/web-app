import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalConfirmacionReporteCierre } from '../ModalConfirmacionReporteCierre';

describe('ModalConfirmacionReporteCierre (H39)', () => {
  it('renderiza el resumen para dictamen REQUIERE_CUADRILLA y dispara alConfirmar', () => {
    const alConfirmar = vi.fn();
    const alCancelar = vi.fn();

    render(
      <ModalConfirmacionReporteCierre
        abierto={true}
        dictamen="REQUIERE_CUADRILLA"
        resumenTecnico="Obstrucción total de sumidero principal."
        estadoTerreno="CRITICO"
        personasAfectadas={4}
        requiereAsistenciaSocial={true}
        alConfirmar={alConfirmar}
        alCancelar={alCancelar}
      />
    );

    expect(
      screen.getByText('Confirmar Informe Técnico y Cierre')
    ).toBeInTheDocument();
    expect(screen.getByText('Requiere cuadrilla')).toBeInTheDocument();
    expect(screen.getByText('Crítico')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Solicitada')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar y Cerrar Misión/i })
    );
    expect(alConfirmar).toHaveBeenCalledTimes(1);
  });

  it('renderiza la advertencia y motivo cuando el dictamen es NO_ABORDABLE', () => {
    render(
      <ModalConfirmacionReporteCierre
        abierto={true}
        dictamen="NO_ABORDABLE"
        motivoNoAbordable="Emergencia en predio privado cercado sin acceso autorizado."
        resumenTecnico="Inspección perimetral confirma ámbito privado."
        estadoTerreno="INACCESIBLE"
        personasAfectadas={0}
        requiereAsistenciaSocial={false}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />
    );

    expect(
      screen.getByText('Confirmar Cierre como No Abordable')
    ).toBeInTheDocument();
    expect(screen.getByText('No abordable')).toBeInTheDocument();
    expect(screen.getByText('Motivo de No Abordabilidad')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Emergencia en predio privado cercado sin acceso autorizado/i
      )
    ).toBeInTheDocument();
  });
});
