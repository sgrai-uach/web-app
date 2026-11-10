import type { paths } from '@/types/api-generated';

export type EstadoNotificacion = 'PENDIENTE_ENVIO' | 'ENVIADA' | 'RECIBIDA' | 'LEIDA';

export interface MisionAsignadaPayload {
  notificacionId?: string;
  misionId: string;
  codigo: string;
  tipoMision: string;
  patrullaId?: string | null;
  cuadrillaId?: string | null;
  incidenteId?: string | null;
  incidenteCodigo?: string | null;
  incidenteFolio?: string | null;
  tipoAfectacion?: string | null;
  direccion?: string | null;
  prioridad?: string;
  asignadoEn: string;
}

export interface MisionAsignadaAlerta {
  notificacionId: string;
  misionId: string;
  codigo: string;
  tipoMision: string;
  patrullaId: string;
  incidenteId?: string | null;
  incidenteCodigo?: string | null;
  incidenteFolio?: string | null;
  tipoAfectacion?: string | null;
  direccion?: string | null;
  prioridad: string;
  asignadoEn: string;
}

export type ActualizarEstadoNotificacionInput = NonNullable<
  paths['/api/terreno/notificaciones/{id}/estado']['patch']['requestBody']
>['content']['application/json'];

export type MisionPendienteTerreno = NonNullable<
  paths['/api/terreno/misiones/pendientes']['get']['responses'][200]['content']['application/json']['data']
>[number];
