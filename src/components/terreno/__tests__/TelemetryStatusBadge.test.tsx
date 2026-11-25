import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  TelemetryStatusBadge,
  TelemetryWarningBanner,
} from '../TelemetryStatusBadge';

describe('TelemetryStatusBadge (HU-70)', () => {
  it('no renderiza nada cuando estado es INACTIVO y mostrarInactivo es false', () => {
    const { container } = render(<TelemetryStatusBadge estado="INACTIVO" />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza etiqueta GPS inactivo cuando mostrarInactivo es true', () => {
    render(<TelemetryStatusBadge estado="INACTIVO" mostrarInactivo />);
    expect(screen.queryByText('GPS activo')).toBeNull();
    expect(screen.getByText('GPS inactivo')).toBeDefined();
  });

  it('renderiza pill "GPS activo" con pulso cuando estado es TRANSMITIENDO', () => {
    render(<TelemetryStatusBadge estado="TRANSMITIENDO" />);
    const badge = screen.getByRole('status');
    expect(badge).toBeDefined();
    expect(screen.getByText('GPS activo')).toBeDefined();
  });

  it('renderiza pill "GPS sin permiso" cuando estado es SIN_PERMISO sin onRetry', () => {
    render(<TelemetryStatusBadge estado="SIN_PERMISO" />);
    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('GPS sin permiso')).toBeDefined();
  });

  it('renderiza pill "Sin señal GPS" cuando estado es ERROR_GPS', () => {
    render(<TelemetryStatusBadge estado="ERROR_GPS" />);
    expect(screen.getByText('Sin señal GPS')).toBeDefined();
  });

  it('renderiza botón accesible nativo y ejecuta callback onRetry en estados con falla', () => {
    const onRetryMock = vi.fn();
    render(<TelemetryStatusBadge estado="SIN_PERMISO" onRetry={onRetryMock} />);

    const boton = screen.getByRole('button', { name: /GPS sin permiso/i });
    expect(boton.tagName).toBe('BUTTON');
    fireEvent.click(boton);
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });
});

describe('TelemetryWarningBanner (HU-70)', () => {
  it('no renderiza nada si el estado no es SIN_PERMISO', () => {
    const { container } = render(
      <TelemetryWarningBanner estado="TRANSMITIENDO" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza aviso informativo no bloqueante cuando el estado es SIN_PERMISO', () => {
    const onRetry = vi.fn();
    render(<TelemetryWarningBanner estado="SIN_PERMISO" onRetry={onRetry} />);

    expect(screen.getByText('Ubicación GPS no autorizada')).toBeDefined();
    expect(
      screen.getByText(/Para que el Centro de Mando visualice la unidad/)
    ).toBeDefined();

    const botonReintentar = screen.getByRole('button', { name: /Reintentar/i });
    fireEvent.click(botonReintentar);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
