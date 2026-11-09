import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NuevaMisionBanner } from '../NuevaMisionBanner';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('NuevaMisionBanner (H35 — Alerta Visual de Asignación)', () => {
  it('renderiza título, código de misión y botón de acción', () => {
    const alCerrar = vi.fn();
    render(
      <NuevaMisionBanner
        codigoMision="INC-2026-0042"
        misionId="mis-42"
        alCerrar={alCerrar}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Nueva Misión Despachada')).toBeInTheDocument();
    expect(screen.getByText('INC-2026-0042')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver misión asignada/i })).toBeInTheDocument();
  });

  it('navega a la misión y cierra la alerta al pulsar ver misión', () => {
    const alCerrar = vi.fn();
    render(
      <NuevaMisionBanner
        codigoMision="INC-2026-0042"
        misionId="mis-42"
        urlDetalle="/terreno/patrulla/misiones/mis-42"
        alCerrar={alCerrar}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /ver misión asignada/i }));

    expect(mockPush).toHaveBeenCalledWith('/terreno/patrulla/misiones/mis-42');
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it('cierra la alerta al pulsar el botón de cerrar', () => {
    const alCerrar = vi.fn();
    render(
      <NuevaMisionBanner
        codigoMision="INC-2026-0042"
        alCerrar={alCerrar}
      />
    );

    fireEvent.click(screen.getByLabelText(/cerrar notificación/i));
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});
