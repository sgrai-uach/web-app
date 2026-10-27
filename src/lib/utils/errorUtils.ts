import type { ApiErrorResponse, ApiFieldError } from '@/types/common';

export function getErrorMessage(
  err: unknown,
  defaultMessage = 'Ha ocurrido un error inesperado.'
): string {
  if (typeof err === 'string') {
    return err;
  }
  if (err instanceof Error) {
    return err.message;
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return defaultMessage;
}

export function formatApiError(err: unknown): ApiErrorResponse;
export function formatApiError(errorData: unknown, fallbackMessage: string): string;
export function formatApiError(
  err: unknown,
  fallbackMessage?: string
): ApiErrorResponse | string {
  if (typeof fallbackMessage === 'string') {
    if (typeof err === 'object' && err !== null) {
      const candidate = err as Record<string, unknown>;
      const detalles = candidate.detalles || candidate.errors || candidate.issues;
      if (Array.isArray(detalles) && detalles.length > 0) {
        const lista = detalles
          .map((item) => {
            const campo =
              (item as { campo?: string }).campo ||
              (item as { field?: string }).field ||
              '';
            const mensaje =
              (item as { mensaje?: string }).mensaje ||
              (item as { message?: string }).message ||
              '';
            return campo ? `${campo}: ${mensaje}` : mensaje;
          })
          .filter(Boolean)
          .join(' | ');
        return `Error en los datos ingresados: ${lista}`;
      }
      if (typeof candidate.error === 'string' && candidate.error) {
        return candidate.error;
      }
      if (typeof candidate.message === 'string' && candidate.message) {
        return candidate.message;
      }
    }
    return fallbackMessage;
  }

  if (typeof err === 'object' && err !== null) {
    const candidate = err as Record<string, unknown>;

    const message =
      typeof candidate.message === 'string'
        ? candidate.message
        : typeof candidate.error === 'string'
        ? candidate.error
        : getErrorMessage(err);

    let errors: ApiFieldError[] | undefined;
    const rawErrors = candidate.errors || candidate.detalles || candidate.issues;
    if (Array.isArray(rawErrors)) {
      errors = rawErrors
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({
          campo: typeof item.campo === 'string' ? item.campo : undefined,
          mensaje: typeof item.mensaje === 'string' ? item.mensaje : '',
        }))
        .filter((item) => item.mensaje.length > 0 || !!item.campo);
    }

    const statusCode =
      typeof candidate.status === 'number'
        ? candidate.status
        : typeof candidate.statusCode === 'number'
        ? candidate.statusCode
        : undefined;

    return {
      message,
      error: typeof candidate.error === 'string' ? candidate.error : message,
      errors,
      detalles: errors,
      statusCode,
    };
  }

  const msg = getErrorMessage(err);
  return {
    message: msg,
    error: msg,
  };
}
