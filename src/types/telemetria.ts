/**
 * Tipos de Telemetría GPS en tiempo real para personal de terreno (HU-70).
 * Contrato de datos sincronizado con sgrai-api (evento Socket.io 'telemetria:posicion').
 */

import type { Socket } from 'socket.io-client';

export type TipoUnidadTelemetria = 'PATRULLA' | 'CUADRILLA';

export type TelemetriaEstado =
  | 'TRANSMITIENDO'
  | 'SIN_PERMISO'
  | 'ERROR_GPS'
  | 'INACTIVO';

/**
 * Payload emitido en el evento Socket.io 'telemetria:posicion' hacia sgrai-api.
 */
export interface TelemetriaPosicionPayload {
  /** UUID de la patrulla o cuadrilla activa */
  unidadId: string;
  /** Tipo canónico de unidad de terreno */
  tipoUnidad: TipoUnidadTelemetria;
  /** Latitud decimal WGS84 (-90 a 90) */
  lat: number;
  /** Longitud decimal WGS84 (-180 a 180) */
  lng: number;
  /** Marca de tiempo ISO 8601 */
  timestamp: string;
  /** Orientación geográfica en grados (0 a 360) o null */
  rumbo?: number | null;
  /** Radio de precisión en metros o null */
  precision?: number | null;
  /** Velocidad de desplazamiento en m/s o null */
  velocidad?: number | null;
}

export interface UseTelemetryOptions {
  /** Identificador de la unidad operativa (patrulla o cuadrilla) */
  unidadId: string | null;
  /** Tipo canónico de unidad operativa */
  tipoUnidad: TipoUnidadTelemetria | null;
  /** Indica si la misión se encuentra activa (estado === 'EN_CURSO') */
  activa: boolean;
  /** Frecuencia de muestreo y emisión en milisegundos (por defecto 30000 ms) */
  intervaloMs?: number;
  /** Instancia opcional de Socket.io (útil para inyección en pruebas) */
  socket?: Socket | null;
}

export interface UseTelemetryResult {
  /** Estado reactivo del subsistema de telemetría */
  estado: TelemetriaEstado;
  /** Última posición geográfica capturada y validada */
  ultimaPosicion: TelemetriaPosicionPayload | null;
  /** Mensaje de error no bloqueante o null si la operación es normal */
  error: string | null;
  /** Indicador booleano de si se está transmitiendo activamente */
  transmitiendo: boolean;
  /** Función para forzar reintento manual de captura y emisión */
  reintentar: () => void;
}
