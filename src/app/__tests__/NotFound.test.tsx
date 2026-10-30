import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotFound from '../not-found';

describe('NotFound (Pantalla 404)', () => {
  it('renderiza código 404, mensaje en español natural y botón de retorno al inicio', () => {
    render(<NotFound />);

    expect(screen.getByText('ERROR 404')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /página no encontrada/i })).toBeInTheDocument();
    expect(
      screen.getByText(/la dirección a la que intenta acceder no existe/i)
    ).toBeInTheDocument();

    const botonInicio = screen.getByRole('link', { name: /volver al inicio/i });
    expect(botonInicio).toBeInTheDocument();
    expect(botonInicio).toHaveAttribute('href', '/');
  });
});
