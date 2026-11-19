import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '../ConfirmModal';
import {
  ConfirmacionResumen,
  ConfirmacionResumenFila,
  ConfirmacionResumenJustificacion,
} from '../ConfirmacionResumen';

describe('ConfirmModal', () => {
  it('no renderiza nada cuando abierto es false', () => {
    const { container } = render(
      <ConfirmModal
        abierto={false}
        titulo="Confirmar acción"
        mensaje="¿Desea continuar?"
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza título, mensaje, children y ejecuta callbacks en variante danger por defecto', () => {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();

    render(
      <ConfirmModal
        abierto={true}
        titulo="Cerrar sesión"
        mensaje="Se perderán los cambios no guardados."
        textoConfirmar="Salir"
        alConfirmar={onConfirmar}
        alCancelar={onCancelar}
      >
        <ConfirmacionResumen>
          <ConfirmacionResumenFila etiqueta="Estado">Pendiente</ConfirmacionResumenFila>
          <ConfirmacionResumenJustificacion contenido="Detalle técnico de prueba" />
        </ConfirmacionResumen>
      </ConfirmModal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
    expect(screen.getByText('Se perderán los cambios no guardados.')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Justificación técnica')).toBeInTheDocument();
    expect(screen.getByText('Detalle técnico de prueba')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });

  it('bloquea cierre con Escape y deshabilita botones cuando cargando es true', () => {
    const onCancelar = vi.fn();

    render(
      <ConfirmModal
        abierto={true}
        variante="teal"
        tamano="md"
        titulo="Confirmar envío"
        mensaje="Enviando reporte."
        textoConfirmar="Enviar"
        textoCargando="Enviando..."
        cargando={true}
        alConfirmar={vi.fn()}
        alCancelar={onCancelar}
      />
    );

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enviando...' })).toBeDisabled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancelar).not.toHaveBeenCalled();
  });
});

