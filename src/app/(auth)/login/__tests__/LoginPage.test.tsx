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

describe('Pantalla LoginPage (Inicio de Sesión alineado a Web)', () => {
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

  it('renderiza banner institucional, título, campos y botones oficiales', () => {
    renderComponent();

    // Banner institucional en tarjeta
    expect(screen.getByText('SGRAI')).toBeInTheDocument();
    expect(screen.getByText('DGRD VALDIVIA')).toBeInTheDocument();

    // Título y subtítulo
    expect(screen.getByRole('heading', { name: /inicio de sesión/i })).toBeInTheDocument();
    expect(screen.getByText(/ingrese sus credenciales para acceder a la plataforma/i)).toBeInTheDocument();

    // Campos
    expect(screen.getByLabelText(/identificador/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/correo o rut con dígito verificador/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña/i, { selector: 'input' })).toBeInTheDocument();

    // Botones
    expect(screen.getByRole('button', { name: /ingresar al sistema/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver al inicio de sgrai/i })).toBeInTheDocument();

    // Aviso de restricción en pie
    expect(screen.getByText(/acceso restringido a personal autorizado/i)).toBeInTheDocument();

    // NO deben existir leyendas obsoletas
    expect(screen.queryByText(/acceso exclusivo de emergencia/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/patrulla verificadora \/ delegado de cuadrilla/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar turno de terreno/i })).not.toBeInTheDocument();
  });

  it('permite escribir correos electrónicos sin filtrado destructivo de letras', () => {
    renderComponent();

    const inputIdentificador = screen.getByLabelText(/identificador/i);
    fireEvent.change(inputIdentificador, { target: { value: 'operador.terreno@valdivia.cl' } });

    expect(inputIdentificador).toHaveValue('operador.terreno@valdivia.cl');
  });

  it('permite alternar la visibilidad de la contraseña con el botón toggle', () => {
    renderComponent();

    const inputPassword = screen.getByLabelText(/^contraseña/i, { selector: 'input' });
    expect(inputPassword).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByRole('button', { name: /mostrar contraseña/i });
    fireEvent.click(toggleBtn);

    expect(inputPassword).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /ocultar contraseña/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ocultar contraseña/i }));
    expect(inputPassword).toHaveAttribute('type', 'password');
  });

  it('valida campos obligatorios antes de procesar el envío', async () => {
    renderComponent();

    const botonSubmit = screen.getByRole('button', { name: /ingresar al sistema/i });
    fireEvent.click(botonSubmit);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ingrese su RUT o correo electrónico.'
    );
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('llama a login con RUT formateado y redirige según rol', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 'p-1',
      nombre: 'Líder Patrulla',
      rolCodigo: 'PATRULLA_VERIFICADORA',
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText(/identificador/i), {
      target: { value: '111111111' },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña/i, { selector: 'input' }), {
      target: { value: 'Valdivia2026!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /ingresar al sistema/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        identificador: '11111111-1',
        password: 'Valdivia2026!',
      });
      expect(mockPush).toHaveBeenCalledWith('/patrulla');
    });
  });

  it('llama a login con correo electrónico sin alterarlo', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 'c-1',
      nombre: 'Delegado Cuadrilla',
      rolCodigo: 'DELEGADO_CUADRILLA',
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText(/identificador/i), {
      target: { value: 'cuadrilla@valdivia.cl' },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña/i, { selector: 'input' }), {
      target: { value: 'Valdivia2026!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /ingresar al sistema/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        identificador: 'cuadrilla@valdivia.cl',
        password: 'Valdivia2026!',
      });
      expect(mockPush).toHaveBeenCalledWith('/cuadrilla');
    });
  });

  it('permite volver al inicio al presionar el botón secundario', () => {
    renderComponent();

    const botonVolver = screen.getByRole('button', { name: /volver al inicio de sgrai/i });
    fireEvent.click(botonVolver);

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('muestra mensaje de alerta si el servicio rechaza las credenciales', async () => {
    mockLogin.mockRejectedValueOnce(
      new Error('Credenciales inválidas. Verifique su identificador o contraseña.')
    );

    renderComponent();

    fireEvent.change(screen.getByLabelText(/identificador/i), {
      target: { value: 'operador@valdivia.cl' },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña/i, { selector: 'input' }), {
      target: { value: 'erronea' },
    });

    fireEvent.click(screen.getByRole('button', { name: /ingresar al sistema/i }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some((el) => el.textContent?.includes('Credenciales inválidas'))).toBe(true);
    });
  });
});
