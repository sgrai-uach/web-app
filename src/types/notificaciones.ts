import type { paths } from '@/types/api-generated';
import type { RecursoPrevencionLocal } from '@/types/offline';

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

export interface PrevencionActualizadaPayload {
  id?: string;
  codigo?: string;
  nombre?: string;
  evento?: {
    id: string;
    codigo: string;
    nombre: string;
    descripcion?: string | null;
    sector?: string | null;
    direccionTexto?: string | null;
    estado?: string;
    prioridad?: string;
    latitud?: number | null;
    longitud?: number | null;
    delegacionNombre?: string | null;
  };
  mision?: {
    id: string;
    codigo: string;
    titulo: string;
    descripcion?: string | null;
    estado: string;
    tipoMision: string;
    prioridad?: string;
  };
  patrulla?: {
    id: string;
    nombre: string;
    estado: string;
  };
  recursos?: Array<{
    id?: string;
    recursoId: string;
    nombre: string;
    esIndividual?: boolean;
    cantidadAsignada: number;
    cantidadEnUso?: number;
    estadoRecurso?: string;
    unidad?: string | null;
    misionId?: string | null;
    creadoEn?: string;
  }>;
  asignadoEn?: string;
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
  eventoPrevencionId?: string | null;
  eventoPrevencionCodigo?: string | null;
  eventoPrevencionNombre?: string | null;
  recursosAsignados?: RecursoPrevencionLocal[];
  esEventoSinteticoPrevencion?: boolean;
}

export type ActualizarEstadoNotificacionInput = NonNullable<
  paths['/api/terreno/notificaciones/{id}/estado']['patch']['requestBody']
>['content']['application/json'];

export type MisionPendienteTerreno = NonNullable<
  paths['/api/terreno/misiones/pendientes']['get']['responses'][200]['content']['application/json']['data']
>[number];

