import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ServiceWorkerRegister } from '../ServiceWorkerRegister';

describe('ServiceWorkerRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe invocar navigator.serviceWorker.register con scope /terreno cuando el soporte esté disponible', () => {
    const mockRegister = vi.fn().mockResolvedValue({ scope: '/terreno' });
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
      },
      configurable: true,
      writable: true,
    });

    render(<ServiceWorkerRegister />);

    expect(mockRegister).toHaveBeenCalledWith('/terreno/sw.js', { scope: '/terreno' });
  });

  it('no debe fallar si navigator.serviceWorker no está presente', () => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(() => render(<ServiceWorkerRegister />)).not.toThrow();
  });
});

