import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnidadInactivaBanner } from '../UnidadInactivaBanner';

describe('UnidadInactivaBanner (H82 / H85)', () => {
  it('renderiza banner de advertencia para cuadrilla desactivada', () => {
    render(
      <UnidadInactivaBanner tipoUnidad="cuadrilla" nombreUnidad="Cuadrilla Isla Teja" />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Cuadrilla Desactivada — Cuadrilla Isla Teja/i)).toBeInTheDocument();
    expect(screen.getByText(/modo histórico de solo lectura/i)).toBeInTheDocument();
  });

  it('renderiza banner de advertencia para patrulla desactivada', () => {
    render(
      <UnidadInactivaBanner tipoUnidad="patrulla" nombreUnidad="Patrulla Valdivia Centro" />
    );

    expect(screen.getByText(/Patrulla Desactivada — Patrulla Valdivia Centro/i)).toBeInTheDocument();
    expect(screen.getByText(/No es posible recibir nuevos despachos/i)).toBeInTheDocument();
  });
});
