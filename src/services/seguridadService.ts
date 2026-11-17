import apiClient from '@/lib/api/client';
import { formatApiError } from '@/lib/utils/errorUtils';
import type {
  LoginRequest,
  LoginResponseData,
  UsuarioActivoDetalle,
} from '@/types/seguridad';
import type { ApiErrorResponse } from '@/types/common';

export class SeguridadServiceError extends Error {
  public apiError: ApiErrorResponse;
  public status: number;

  constructor(status: number, message: string, apiError?: ApiErrorResponse) {
    super(message);
    this.name = 'SeguridadServiceError';
    this.status = status;
    this.apiError = apiError || { message, statusCode: status };
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

export async function loginUsuario(
  credenciales: LoginRequest
): Promise<LoginResponseData> {
  const { data, error, response } = await apiClient.POST('/api/seguridad/login', {
    body: credenciales,
  });

  if (error || !data || !('data' in data) || !data.data) {
    let mensaje = 'Error al procesar el inicio de sesión.';
    const errObj = error as unknown as { error?: string; message?: string } | null;

    if (response?.status === 401) {
      mensaje = 'Credenciales inválidas. Verifique su identificador o contraseña.';
    } else if (response?.status === 403) {
      const apiMsg = (errObj?.error || errObj?.message || '').toLowerCase();
      if (apiMsg.includes('inactiv') || apiMsg.includes('deshabilitad')) {
        mensaje = 'El usuario se encuentra inactivo en el sistema. Contacte al Administrador.';
      } else {
        mensaje =
          'Cuenta bloqueada temporalmente por seguridad debido a múltiples intentos fallidos. Intente más tarde.';
      }
    } else if (response?.status === 400) {
      mensaje = errObj?.error || 'Datos de entrada inválidos. Complete todos los campos.';
    } else if (response && response.status >= 500) {
      mensaje = 'Error interno del servidor al procesar el inicio de sesión.';
    }

    const formatted = formatApiError({
      ...(typeof error === 'object' && error !== null ? error : {}),
      status: response?.status || 500,
      message: mensaje,
    });
    throw new SeguridadServiceError(response?.status || 500, formatted.message, formatted);
  }

  return data.data;
}

export async function obtenerUsuarioActivo(): Promise<UsuarioActivoDetalle> {
  const { data, error, response } = await apiClient.GET('/api/seguridad/usuario-activo', {
    params: {
      header: {
        'x-user-id': '',
      },
    },
  });

  if (error || !data || !('data' in data) || !data.data) {
    let mensaje = 'Error al consultar la sesión y permisos del usuario activo';
    if (response?.status === 401) {
      mensaje = 'Sesión no válida o usuario no autenticado.';
    } else if (response?.status === 403) {
      mensaje = 'Acceso denegado al perfil de usuario.';
    }

    const formatted = formatApiError({
      ...(typeof error === 'object' && error !== null ? error : {}),
      status: response?.status || 500,
      message: mensaje,
    });
    throw new SeguridadServiceError(response?.status || 500, formatted.message, formatted);
  }

  return data.data;
}
