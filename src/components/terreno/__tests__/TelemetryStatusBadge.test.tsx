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

  it('renderiza pill "GPS sin permiso" cuando estado es SIN_PERMISO', () => {
    render(<TelemetryStatusBadge estado="SIN_PERMISO" />);
    expect(screen.getByText('GPS sin permiso')).toBeDefined();
  });

  it('renderiza pill "Sin señal GPS" cuando estado es ERROR_GPS', () => {
    render(<TelemetryStatusBadge estado="ERROR_GPS" />);
    expect(screen.getByText('Sin señal GPS')).toBeDefined();
  });

  it('ejecuta callback onRetry al hacer click o presionar Enter en estados con falla', () => {
    const onRetryMock = vi.fn();
    render(<TelemetryStatusBadge estado="SIN_PERMISO" onRetry={onRetryMock} />);

    const badge = screen.getByRole('status');
    fireEvent.click(badge);
    expect(onRetryMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(badge, { key: 'Enter' });
    expect(onRetryMock).toHaveBeenCalledTimes(2);
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
