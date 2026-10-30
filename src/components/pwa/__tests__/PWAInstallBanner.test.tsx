import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PWAInstallBanner } from '../PWAInstallBanner';
import * as usePWAInstallModule from '@/hooks/usePWAInstall';

describe('PWAInstallBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no debe renderizar nada si puedeInstalar es false', () => {
    vi.spyOn(usePWAInstallModule, 'usePWAInstall').mockReturnValue({
      puedeInstalar: false,
      estaInstalada: false,
      instalarPWA: vi.fn(),
    });

    const { container } = render(<PWAInstallBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('debe renderizar el banner y disparar instalarPWA al presionar el botón', () => {
    const mockInstalar = vi.fn().mockResolvedValue(true);
    vi.spyOn(usePWAInstallModule, 'usePWAInstall').mockReturnValue({
      puedeInstalar: true,
      estaInstalada: false,
      instalarPWA: mockInstalar,
    });

    render(<PWAInstallBanner />);

    expect(screen.getByText('Instalar SGRAI en el Dispositivo')).toBeDefined();
    const btn = screen.getByRole('button', { name: /Instalar Aplicación/i });
    expect(btn).toBeDefined();

    fireEvent.click(btn);
    expect(mockInstalar).toHaveBeenCalledTimes(1);
  });
});

