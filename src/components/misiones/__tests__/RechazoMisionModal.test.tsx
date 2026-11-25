import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RechazoMisionModal } from '../RechazoMisionModal';

describe('RechazoMisionModal (H41, H69 — Rechazo Motivado de Misión)', () => {
  const alConfirmarMock = vi.fn();
  const alCancelarMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza nada cuando abierto es false', () => {
    const { container } = render(
      <RechazoMisionModal
        abierto={false}
        codigoMision="INC-2026-0001"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('mantiene deshabilitado el botón Confirmar Rechazo con menos de 5 caracteres útiles (personalizado para cuadrilla)', () => {
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

    expect(screen.getByText('Rechazar Asignación de Cuadrilla')).toBeInTheDocument();
    expect(screen.getByText(/liberar la cuadrilla/i)).toBeInTheDocument();

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

  it('renderiza título, código de misión, área de texto y contador cuando está abierto', () => {
    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /rechazar misión de verificación/i })
    ).toBeInTheDocument();
    expect(screen.getByText('INC-2026-0042')).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 5 caracteres mín/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /confirmar rechazo/i })
    ).toBeDisabled();
  });

  it('mantiene el botón deshabilitado cuando se ingresan menos de 5 caracteres tras trim', () => {
    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    const textarea = screen.getByLabelText(/motivo del rechazo/i);
    const botonConfirmar = screen.getByRole('button', { name: /confirmar rechazo/i });

    fireEvent.change(textarea, { target: { value: '   abc  ' } }); // 3 caracteres tras trim
    expect(screen.getByText(/3 \/ 5 caracteres mín/i)).toBeInTheDocument();
    expect(botonConfirmar).toBeDisabled();
  });

  it('habilita el botón de confirmación cuando se alcanzan 5 caracteres o más', () => {
    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    const textarea = screen.getByLabelText(/motivo del rechazo/i);
    const botonConfirmar = screen.getByRole('button', { name: /confirmar rechazo/i });

    fireEvent.change(textarea, { target: { value: 'Falla' } });
    expect(screen.getByText(/5 \/ 5 caracteres mín/i)).toBeInTheDocument();
    expect(botonConfirmar).not.toBeDisabled();
  });

  it('muestra mensaje de advertencia si el usuario pierde el foco habiendo ingresado menos de 5 caracteres', () => {
    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    const textarea = screen.getByLabelText(/motivo del rechazo/i);
    fireEvent.change(textarea, { target: { value: 'No' } });
    fireEvent.blur(textarea);

    expect(
      screen.getByText(/la justificación debe contener al menos 5 caracteres/i)
    ).toBeInTheDocument();
  });

  it('ejecuta alConfirmar con el texto ingresado y coordenadas al enviar formulario', async () => {
    alConfirmarMock.mockResolvedValueOnce(undefined);

    // Mock geolocation
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) =>
        success({
          coords: {
            latitude: -39.8142,
            longitude: -73.2458,
          },
        })
      ),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
    });

    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    const textarea = screen.getByLabelText(/motivo del rechazo/i);
    fireEvent.change(textarea, { target: { value: 'Desperfecto mecánico en vehículo' } });

    const botonConfirmar = screen.getByRole('button', { name: /confirmar rechazo/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(alConfirmarMock).toHaveBeenCalledWith('Desperfecto mecánico en vehículo', {
        lat: -39.8142,
        lng: -73.2458,
      });
    });
  });

  it('despliega error retornado por la API si la promesa de alConfirmar falla', async () => {
    alConfirmarMock.mockRejectedValueOnce(new Error('La misión ya se encuentra en curso.'));

    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    const textarea = screen.getByLabelText(/motivo del rechazo/i);
    fireEvent.change(textarea, { target: { value: 'Corte total de ruta de acceso' } });

    const botonConfirmar = screen.getByRole('button', { name: /confirmar rechazo/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'La misión ya se encuentra en curso.'
      );
    });
  });

  it('ejecuta alCancelar al presionar el botón Cancelar', () => {
    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    const botonCancelar = screen.getByRole('button', { name: /cancelar/i });
    fireEvent.click(botonCancelar);

    expect(alCancelarMock).toHaveBeenCalled();
  });

  it('ejecuta alCancelar al presionar la tecla Escape', () => {
    render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(alCancelarMock).toHaveBeenCalled();
  });
});
