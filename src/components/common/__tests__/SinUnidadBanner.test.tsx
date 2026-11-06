import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SinUnidadBanner } from '../SinUnidadBanner';

describe('SinUnidadBanner', () => {
  it('renderiza correctamente el mensaje de alerta para patrulla no asignada', () => {
    render(<SinUnidadBanner tipoUnidad="patrulla" nombreOperador="Juan Pérez" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Sin Patrulla Asignada — Juan Pérez/i)).toBeInTheDocument();
    expect(screen.getByText(/Actualmente no cuentas con una patrulla verificadora asignada/i)).toBeInTheDocument();
    expect(screen.getByText(/Centro de Mando o Supervisor/i)).toBeInTheDocument();
  });

  it('renderiza correctamente el mensaje de alerta para cuadrilla no asignada', () => {
    render(<SinUnidadBanner tipoUnidad="cuadrilla" nombreOperador="Pedro Gómez" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Sin Cuadrilla Asignada — Pedro Gómez/i)).toBeInTheDocument();
    expect(screen.getByText(/Actualmente no cuentas con una cuadrilla asignada/i)).toBeInTheDocument();
  });
});
