export interface ApiFieldError {
  campo?: string;
  field?: string;
  mensaje: string;
}

export interface ApiErrorResponse {
  message: string;
  error?: string;
  statusCode?: number;
  status?: number;
  errors?: ApiFieldError[];
  detalles?: ApiFieldError[];
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  };
}
