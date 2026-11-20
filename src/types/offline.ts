import type { paths } from '@/types/api-generated';

/**
 * Tipos para persistencia local e IndexedDB (Offline-First)
 */

export type AccionOutboxTipo =
  | 'ACEPTAR_MISION'
  | 'RECHAZAR_MISION'
  | 'REPORTAR_LLEGADA'
  | 'ACTUALIZAR_TIPOLOGIA'
  | 'AJUSTAR_PRIORIDAD'
  | 'ENVIAR_REPORTE'
  | 'SUBIR_EVIDENCIA'
  | 'SOLICITAR_APOYO'
  | 'CERRAR_FAENA'
  | 'ACK_NOTIFICACION';

/**
 * Payload validado contra el contrato OpenAPI generado antes de encolarse en IndexedDB (GEMINI.md §5.3).
 */
export type AceptarMisionPayload = NonNullable<
  paths['/api/misiones/{id}/aceptar']['post']['requestBody']
>['content']['application/json'];

export interface AccionOutbox {
  id: string;
  tipo: AccionOutboxTipo;
  url: string;
  metodo: 'POST' | 'PATCH' | 'PUT';
  payload: Record<string, unknown>;
  timestamp: string;
  intentos: number;
  errorUltimoIntento?: string;
}

export interface MisionLocal {
  id: string;
  incidenteId: string;
  codigoIncidente: string;
  tipologia: string;
  direccion: string;
  coordenadas?: {
    lat: number;
    lng: number;
  };
  prioridad: string;
  estado: string;
  fechaDespacho: string;
  fechaInicio?: string | null;
  sincronizacionPendiente?: boolean;
  datosAdicionales?: Record<string, unknown>;
  actualizadoEn: string;
}

export interface CatalogoLocal {
  clave: string; // ej: 'tipologias', 'prioridades'
  datos: unknown[];
  actualizadoEn: string;
}
