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
        codigoMision="INC-2026-0001"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza título por defecto, código de misión, área de texto y contador cuando está abierto (H69)', () => {
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

  it('mantiene deshabilitado el botón Confirmar Rechazo con menos de 5 caracteres útiles y personaliza etiqueta de cuadrilla (H41)', () => {
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

  it('ejecuta alConfirmar con el texto ingresado y coordenadas GPS cuando están disponibles', async () => {
    alConfirmarMock.mockResolvedValueOnce(undefined);

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
      expect(screen.getByRole('alert')).toHaveTextContent(
        'La misión ya fue rechazada previamente.'
      );
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

    const botonCancelar = screen.getByRole('button', { name: /cancelar/i });
    fireEvent.click(botonCancelar);
    expect(alCancelarMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(alCancelarMock).toHaveBeenCalledTimes(2);
  });

  it('bloquea el cierre con Escape mientras cargando es true y limpia estado GPS al cerrar antes de resolver (BUG-H41-PWA-04 / PWA-05)', async () => {
    let resolverEnvio!: () => void;
    alConfirmarMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolverEnvio = resolve;
        })
    );

    let callbackGps!: (pos: { coords: { latitude: number; longitude: number } }) => void;
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) => {
          callbackGps = success;
        }),
      },
      configurable: true,
    });

    const { rerender } = render(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    expect(screen.getByText(/Obteniendo coordenadas GPS/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Motivo del Rechazo/i), {
      target: { value: 'Falla hidráulica en ruta' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Rechazo/i }));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(alCancelarMock).not.toHaveBeenCalled();

    await waitFor(() => expect(typeof resolverEnvio).toBe('function'));
    resolverEnvio();

    rerender(
      <RechazoMisionModal
        abierto={false}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    // Callback tardío de GPS no debe contaminar reapertura posterior
    callbackGps({ coords: { latitude: -39.81, longitude: -73.24 } });

    rerender(
      <RechazoMisionModal
        abierto={true}
        codigoMision="INC-2026-0042"
        alConfirmar={alConfirmarMock}
        alCancelar={alCancelarMock}
      />
    );

    expect(screen.queryByText(/GPS registrado/i)).not.toBeInTheDocument();
  });
});
