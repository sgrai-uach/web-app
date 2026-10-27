import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Heading from '../Heading';

describe('Componente Heading', () => {
  it('renderiza con etiqueta h1 semántica por defecto cuando variant es h1', () => {
    render(<Heading variant="h1">Misión Activa</Heading>);
    const heading = screen.getByRole('heading', { level: 1, name: /misión activa/i });
    expect(heading).toBeInTheDocument();
  });

  it('permite desacoplar etiqueta semántica (as) de variante visual (variant)', () => {
    render(
      <Heading as="h3" variant="display">
        Título Visual Display Semántica H3
      </Heading>
    );
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toBeInTheDocument();
    expect(heading.className).toContain('display');
  });

  it('aplica clases de color correctamente', () => {
    render(<Heading color="white">Texto Blanco</Heading>);
    const heading = screen.getByText(/texto blanco/i);
    expect(heading.className).toContain('colorWhite');
  });
});
