import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeccionDesplegable } from '../SeccionDesplegable';

describe('SeccionDesplegable', () => {
  it('renderiza el título y oculta el contenido cuando está cerrada por defecto', () => {
    const { container } = render(
      <SeccionDesplegable titulo="Categorización del incidente">
        <p>Contenido interno</p>
      </SeccionDesplegable>
    );

    expect(screen.getByText('Categorización del incidente')).toBeInTheDocument();
    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
  });

  it('se muestra abierta cuando abiertoPorDefecto es true', () => {
    const { container } = render(
      <SeccionDesplegable titulo="Sección abierta" abiertoPorDefecto>
        <p>Visible</p>
      </SeccionDesplegable>
    );

    expect(container.querySelector('details')?.open).toBe(true);
    expect(screen.getByText('Visible')).toBeVisible();
  });

  it('alterna su estado al activar el resumen', () => {
    const { container } = render(
      <SeccionDesplegable titulo="Alternable">
        <p>Contenido</p>
      </SeccionDesplegable>
    );

    const details = container.querySelector('details') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    expect(details.open).toBe(true);

    details.open = false;
    fireEvent(details, new Event('toggle'));
    expect(details.open).toBe(false);
  });

  it('muestra el indicador opcional en la fila de resumen', () => {
    render(
      <SeccionDesplegable titulo="Con indicador" indicador={<span>Pendiente</span>}>
        <p>Contenido</p>
      </SeccionDesplegable>
    );

    const summary = screen.getByText('Con indicador').closest('summary');
    expect(summary).not.toBeNull();
    expect(summary).toHaveTextContent('Pendiente');
  });

  it('opera en modo controlado respetando la prop abierto y disparando onToggle', () => {
    const onToggleMock = vi.fn();
    const { container, rerender } = render(
      <SeccionDesplegable titulo="Controlada" abierto={true} onToggle={onToggleMock}>
        <p>Visible controlada</p>
      </SeccionDesplegable>
    );

    const details = container.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);

    details.open = false;
    fireEvent(details, new Event('toggle'));
    expect(onToggleMock).toHaveBeenCalledWith(false);

    rerender(
      <SeccionDesplegable titulo="Controlada" abierto={false} onToggle={onToggleMock}>
        <p>Visible controlada</p>
      </SeccionDesplegable>
    );
    expect(details.open).toBe(false);
  });
});

