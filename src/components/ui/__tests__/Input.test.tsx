import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Input from '../Input';

describe('Componente Input', () => {
  it('renderiza etiqueta y campo de texto', () => {
    render(<Input label="Código de incidente" placeholder="INC-001" />);
    expect(screen.getByLabelText(/código de incidente/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('INC-001')).toBeInTheDocument();
  });

  it('muestra mensaje de error con accesibilidad aria-invalid', () => {
    render(<Input label="Justificación" error="Mínimo 5 caracteres" />);
    const input = screen.getByLabelText(/justificación/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Mínimo 5 caracteres');
  });

  it('permite escribir valores y dispara onChange', () => {
    const handleChange = vi.fn();
    render(<Input label="Nombre" onChange={handleChange} />);
    const input = screen.getByLabelText(/nombre/i);
    fireEvent.change(input, { target: { value: 'Patrulla Alpha' } });
    expect(handleChange).toHaveBeenCalled();
  });
});
