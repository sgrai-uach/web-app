import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalConfirmacionPrioridad } from '../ModalConfirmacionPrioridad';

describe('ModalConfirmacionPrioridad (H38)', () => {
  it('no renderiza nada cuando abierto es false', () => {
    const { container } = render(
      <ModalConfirmacionPrioridad
        abierto={false}
        versionReporte={1}
        prioridadSugerida="ALTA"
        prioridadSeleccionada="ALTA"
        esModificacionPrioridad={false}
        nucleoFamiliarTotal={3}
        viviendasAfectadas={1}
        peligrosActivosCount={1}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza el resumen de ratificación de prioridad sugerida para Reporte #1', () => {
    render(
      <ModalConfirmacionPrioridad
        abierto={true}
        versionReporte={1}
        prioridadSugerida="ALTA"
        prioridadSeleccionada="ALTA"
        esModificacionPrioridad={false}
        nucleoFamiliarTotal={4}
        viviendasAfectadas={1}
        peligrosActivosCount={2}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />
    );

    expect(
      screen.getByText('Confirmar Evaluación y Prioridad')
    ).toBeInTheDocument();
    expect(screen.getByText('Reporte inicial (Reporte #1)')).toBeInTheDocument();
    expect(
      screen.getByText('Prioridad sugerida ratificada')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/4 personas · 1 viviendas · 2 alertas activas/i)
    ).toBeInTheDocument();
  });

  it('renderiza comparativa de modificación de prioridad, justificación y versión cuando versionReporte > 1', () => {
    render(
      <ModalConfirmacionPrioridad
        abierto={true}
        versionReporte={2}
        prioridadSugerida="MEDIA"
        prioridadSeleccionada="CRITICA"
        esModificacionPrioridad={true}
        justificacionPrioridad="Se detecta socavón activo bajo los cimientos de la vivienda principal."
        nucleoFamiliarTotal={5}
        viviendasAfectadas={2}
        peligrosActivosCount={1}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />
    );

    expect(
      screen.getByText('Actualización (Reporte #2)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Prioridad modificada por patrulla')
    ).toBeInTheDocument();
    expect(screen.getByText(/Sugerida: Media/i)).toBeInTheDocument();
    expect(screen.getByText(/Final: Crítica/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Se detecta socavón activo bajo los cimientos de la vivienda principal/i
      )
    ).toBeInTheDocument();
  });

  it('ejecuta alCancelar con botón Cancelar o tecla Escape y alConfirmar al confirmar', () => {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();

    render(
      <ModalConfirmacionPrioridad
        abierto={true}
        versionReporte={1}
        prioridadSugerida="MEDIA"
        prioridadSeleccionada="MEDIA"
        esModificacionPrioridad={false}
        nucleoFamiliarTotal={2}
        viviendasAfectadas={1}
        peligrosActivosCount={0}
        alConfirmar={onConfirmar}
        alCancelar={onCancelar}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCancelar).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancelar).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: /Confirmar y Enviar/i }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });
});

