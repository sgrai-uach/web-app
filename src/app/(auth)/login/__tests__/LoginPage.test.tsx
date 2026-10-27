import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../page';
import { ToastProvider } from '@/components/ui/Toast';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockLogin = vi.fn();
let mockAutenticado = false;
let mockUsuario: unknown = null;

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    cargando: false,
    autenticado: mockAutenticado,
    usuario: mockUsuario,
  }),
}));

describe('Pantalla LoginPage (Inicio de Sesión en Terreno)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAutenticado = false;
    mockUsuario = null;
  });

  const renderComponent = () =>
    render(
      <ToastProvider>
        <LoginPage />
      </ToastProvider>
    );

  it('renderiza encabezados institucionales y campos de formulario', () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: /acceso a operaciones/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/rut o correo institucional/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /iniciar turno de terreno/i })
    ).toBeInTheDocument();
  });

  it('valida campos obligatorios antes de procesar el envío', async () => {
    renderComponent();

    const botonSubmit = screen.getByRole('button', { name: /iniciar turno de terreno/i });
    fireEvent.click(botonSubmit);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ingrese su RUT institucional o correo electrónico.'
    );
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('llama a login con datos formateados y redirige según rol', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 'p-1',
      nombre: 'Líder Patrulla',
      rolCodigo: 'PATRULLA_VERIFICADORA',
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText(/rut o correo institucional/i), {
      target: { value: '111111111' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'Valdivia2026!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /iniciar turno de terreno/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        identificador: '11111111-1',
        password: 'Valdivia2026!',
      });
      expect(mockPush).toHaveBeenCalledWith('/patrulla');
    });
  });

  it('muestra mensaje de alerta si el servicio rechaza las credenciales', async () => {
    mockLogin.mockRejectedValueOnce(
      new Error('Credenciales inválidas. Verifique su identificador o contraseña.')
    );

    renderComponent();

    fireEvent.change(screen.getByLabelText(/rut o correo institucional/i), {
      target: { value: 'operador@valdivia.cl' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'erronea' },
    });

    fireEvent.click(screen.getByRole('button', { name: /iniciar turno de terreno/i }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some((el) => el.textContent?.includes('Credenciales inválidas'))).toBe(true);
    });
  });
});
