import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalConfirmacionTipologia } from '../ModalConfirmacionTipologia';

describe('ModalConfirmacionTipologia', () => {
  it('no renderiza nada cuando abierto es false', () => {
    const { container } = render(
      <ModalConfirmacionTipologia
        abierto={false}
        tipologiaOriginal="Caída de árbol"
        tipologiaNueva="Caída de árbol"
        esReclasificacion={false}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza resumen de ratificación presencial correctamente', () => {
    render(
      <ModalConfirmacionTipologia
        abierto={true}
        tipologiaOriginal="Caída de árbol"
        tipologiaNueva="Caída de árbol"
        esReclasificacion={false}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />
    );

    expect(screen.getByText('Confirmar Evaluación de Tipología')).toBeInTheDocument();
    expect(
      screen.getByText(/¿Desea ratificar la tipología del incidente constatada presencialmente/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Ratificación presencial')).toBeInTheDocument();
    expect(screen.getByText('Caída de árbol')).toBeInTheDocument();
  });

  it('renderiza resumen de reclasificación con chip original, chip nuevo y justificación', () => {
    render(
      <ModalConfirmacionTipologia
        abierto={true}
        tipologiaOriginal="Anegamiento"
        tipologiaNueva="Inundación"
        esReclasificacion={true}
        justificacion="Desborde significativo del río Calle-Calle que ingresa a predios particulares."
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />
    );

    expect(screen.getByText('Reclasificación en terreno')).toBeInTheDocument();
    expect(screen.getByText('Anegamiento')).toBeInTheDocument();
    expect(screen.getByText('Inundación')).toBeInTheDocument();
    expect(
      screen.getByText(/Desborde significativo del río Calle-Calle que ingresa a predios particulares/i)
    ).toBeInTheDocument();
  });

  it('llama a alCancelar al hacer clic en Cancelar o presionar Escape', () => {
    const onCancelar = vi.fn();
    render(
      <ModalConfirmacionTipologia
        abierto={true}
        tipologiaOriginal="Anegamiento"
        tipologiaNueva="Inundación"
        esReclasificacion={true}
        alConfirmar={vi.fn()}
        alCancelar={onCancelar}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelBtn);
    expect(onCancelar).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancelar).toHaveBeenCalledTimes(2);
  });

  it('llama a alConfirmar al hacer clic en Confirmar y Enviar', () => {
    const onConfirmar = vi.fn();
    render(
      <ModalConfirmacionTipologia
        abierto={true}
        tipologiaOriginal="Anegamiento"
        tipologiaNueva="Anegamiento"
        esReclasificacion={false}
        alConfirmar={onConfirmar}
        alCancelar={vi.fn()}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /Confirmar y Enviar/i });
    fireEvent.click(confirmBtn);
    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });

  it('muestra estado cargando y deshabilita botones', () => {
    const onCancelar = vi.fn();
    render(
      <ModalConfirmacionTipologia
        abierto={true}
        tipologiaOriginal="Anegamiento"
        tipologiaNueva="Anegamiento"
        esReclasificacion={false}
        cargando={true}
        alConfirmar={vi.fn()}
        alCancelar={onCancelar}
      />
    );

    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Guardando.../i })).toBeDisabled();

    // Escape no debe cancelar mientras carga
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancelar).not.toHaveBeenCalled();
  });
});

