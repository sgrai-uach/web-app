import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RechazoMisionModal } from '../RechazoMisionModal';

describe('RechazoMisionModal (H41, H69)', () => {
  const alConfirmarMock = vi.fn();
  const alCancelarMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza nada cuando abierto es false', () => {
    const { container } = render(
      <RechazoMisionModal
        abierto={false}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza título, código de misión, área de texto y contador cuando está abierto', () => {
    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0001"
        titulo="Rechazar Asignación de Cuadrilla"
        unidadEtiqueta="cuadrilla"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Rechazar Asignación de Cuadrilla')).toBeInTheDocument();
    expect(screen.getByText(/liberar la cuadrilla/i)).toBeInTheDocument();
    expect(screen.getByText('INC-2026-0001')).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 5 caracteres mín/i)).toBeInTheDocument();
  });

  it('mantiene deshabilitado el botón Confirmar Rechazo con menos de 5 caracteres útiles', () => {
    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0001"
        titulo="Rechazar Asignación de Cuadrilla"
        unidadEtiqueta="cuadrilla"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar Rechazo/i });
    expect(btnConfirmar).toBeDisabled();

    const textarea = screen.getByLabelText(/Motivo del Rechazo/i);
    fireEvent.change(textarea, { target: { value: '  abc  ' } });
    expect(btnConfirmar).toBeDisabled();
    expect(screen.getByText('3 / 5 caracteres mín.')).toBeInTheDocument();

    fireEvent.blur(textarea);
    expect(
      screen.getByText('La justificación debe contener al menos 5 caracteres.')
    ).toBeInTheDocument();
  });

  it('habilita el botón al ingresar 5 o más caracteres y llama a alConfirmar con texto recortado', async () => {
    alConfirmarMock.mockResolvedValueOnce(undefined);

    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0001"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    const textarea = screen.getByLabelText(/Motivo del Rechazo/i);
    fireEvent.change(textarea, {
      target: { value: '  Camión tolva presenta falla hidráulica  ' },
    });

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar Rechazo/i });
    expect(btnConfirmar).not.toBeDisabled();

    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(alConfirmarMock).toHaveBeenCalledWith(
        'Camión tolva presenta falla hidráulica',
        undefined
      );
    });
  });

  it('muestra el mensaje de error si alConfirmar rechaza la promesa', async () => {
    alConfirmarMock.mockRejectedValueOnce(
      new Error('La misión ya fue rechazada previamente.')
    );

    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0001"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    const textarea = screen.getByLabelText(/Motivo del Rechazo/i);
    fireEvent.change(textarea, {
      target: { value: 'Falla mecánica grave en ruta' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Rechazo/i }));

    await waitFor(() => {
      expect(
        screen.getByText('La misión ya fue rechazada previamente.')
      ).toBeInTheDocument();
    });
  });

  it('ejecuta alCancelar al presionar el botón Cancelar y la tecla Escape', () => {
    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(alCancelarMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(alCancelarMock).toHaveBeenCalledTimes(2);
  });
});
