import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapaModal } from '../MapaModal';

// Mock de dynamic import para MapaLeafletView
vi.mock('next/dynamic', () => ({
  default: () => {
    return function MockDynamicMap() {
      return <div data-testid="mock-leaflet-map">Mapa Renderizado</div>;
    };
  },
}));

describe('MapaModal — Visor cartográfico de emergencia', () => {
  it('no renderiza nada cuando abierto es false', () => {
    const { container } = render(
      <MapaModal abierto={false} alCerrar={vi.fn()} latitud={-39.81} longitud={-73.24} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza título, dirección y mapa cuando abierto es true', () => {
    const cerrarMock = vi.fn();
    render(
      <MapaModal
        abierto={true}
        alCerrar={cerrarMock}
        latitud={-39.8142}
        longitud={-73.2459}
        titulo="Emergencia Caída de árbol"
        direccion="Av. Alemania 600, Valdivia"
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Emergencia Caída de árbol')).toBeInTheDocument();
    expect(screen.getByText('Av. Alemania 600, Valdivia')).toBeInTheDocument();
    expect(screen.getByTestId('mock-leaflet-map')).toBeInTheDocument();
  });

  it('llama a alCerrar al hacer clic en el botón de cerrar', () => {
    const cerrarMock = vi.fn();
    render(
      <MapaModal
        abierto={true}
        alCerrar={cerrarMock}
        latitud={-39.8142}
        longitud={-73.2459}
      />
    );

    const botonCerrar = screen.getByRole('button', { name: /cerrar visor de mapa/i });
    fireEvent.click(botonCerrar);
    expect(cerrarMock).toHaveBeenCalledTimes(1);
  });
});
