import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LoginRedirectPage from '../page';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

let mockAutenticado = false;
let mockCargando = false;
let mockUsuario: unknown = null;

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    cargando: mockCargando,
    autenticado: mockAutenticado,
    usuario: mockUsuario,
  }),
}));

describe('Pantalla LoginRedirectPage (Redirección a Login Unificado /login)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAutenticado = false;
    mockCargando = false;
    mockUsuario = null;
  });

  it('muestra estado de redirección y envía al portal de login unificado (/login?returnUrl=%2Fterreno) cuando no hay sesión', async () => {
    render(<LoginRedirectPage />);

    expect(screen.getByText('SGRAI')).toBeInTheDocument();
    expect(screen.getByText('DGRD VALDIVIA')).toBeInTheDocument();
    expect(
      screen.getByRole('status')
    ).toHaveTextContent(/redirigiendo al portal de autenticación institucional/i);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?returnUrl=%2Fterreno');
    });
  });

  it('redirige a /patrulla/misiones si el usuario ya está autenticado como PATRULLA_VERIFICADORA', async () => {
    mockAutenticado = true;
    mockUsuario = {
      id: 'p-1',
      nombre: 'Líder Patrulla',
      rolCodigo: 'PATRULLA_VERIFICADORA',
    };

    render(<LoginRedirectPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/patrulla/misiones');
    });
  });

  it('redirige a /cuadrilla/misiones si el usuario ya está autenticado como DELEGADO_CUADRILLA', async () => {
    mockAutenticado = true;
    mockUsuario = {
      id: 'c-1',
      nombre: 'Delegado Cuadrilla',
      rolCodigo: 'DELEGADO_CUADRILLA',
    };

    render(<LoginRedirectPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/cuadrilla/misiones');
    });
  });
});
