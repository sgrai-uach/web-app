import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../Button';

describe('Componente Button', () => {
  it('renderiza texto y maneja clics correctamente', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Aceptar Misión</Button>);

    const button = screen.getByRole('button', { name: /aceptar misión/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('soporta estado de carga (loading) y deshabilita clics', () => {
    const handleClick = vi.fn();
    render(
      <Button loading onClick={handleClick}>
        Procesando
      </Button>
    );

    const button = screen.getByRole('button', { name: /procesando/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renderiza como enlace cuando se especifica href', () => {
    render(<Button href="/login">Ir a Login</Button>);
    const link = screen.getByRole('link', { name: /ir a login/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('renderiza con variante destructiva', () => {
    render(<Button variant="destructive">Rechazar Misión</Button>);
    const button = screen.getByRole('button', { name: /rechazar misión/i });
    expect(button.className).toContain('destructive');
  });
});
