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
  | 'REPORTAR_CIERRE_RECUPERACION'
  | 'ACK_NOTIFICACION';

export interface RecursoRecuperacionMisionItem {
  recursoId: string;
  nombre: string;
  cantidadAsignada: number;
}

export interface ReportePatrullaRecuperacionLocal {
  resumen: string;
  consumos: Array<{
    recursoId: string;
    cantidadConsumida: number;
  }>;
  reportadoEn: string;
  reportadoPor?: {
    id: string;
    nombre: string;
  } | null;
}

export interface RecuperacionMisionDetalleLocal {
  id: string;
  codigo: string;
  estado: string;
  sector: string;
  recursos: RecursoRecuperacionMisionItem[];
  reportePatrulla?: ReportePatrullaRecuperacionLocal | null;
}

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

export type TipoMisionOperativa = NonNullable<
  paths['/api/misiones']['get']['responses'][200]['content']['application/json']['data'][number]['tipoMision']
>;

export interface MisionLocal {
  id: string;
  incidenteId: string;
  codigoIncidente: string;
  tipoMision?: TipoMisionOperativa | string;
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
  fechaCierre?: string | null;
  sincronizacionPendiente?: boolean;
  datosAdicionales?: Record<string, unknown>;
  actualizadoEn: string;
}

export interface CatalogoLocal {
  clave: string; // ej: 'tipologias', 'prioridades'
  datos: unknown[];
  actualizadoEn: string;
}

export interface TipoIncidenteCatalogoItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface ReclasificarTipologiaPayload {
  tipoIncidenteId: string;
  justificacion: string;
  misionId?: string;
}

export type PrioridadIncidente = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type NivelCompromisoVivienda =
  | 'SIN_DANO'
  | 'LEVE'
  | 'MODERADO'
  | 'GRAVE_INHABITABLE';

export interface FamiliaAfectadaItem {
  id: string;
  referencia?: string; // Ej: "Familia Pérez", "Casa 2", "Depto 201"
  nucleoFamiliarTotal: number;
  cantidadNinos: number;
  cantidadAdultosMayores: number;
  personasDiscapacitadas: number;
  personasElectrodependientes: number;
  mascotasAfectadas: number;
  nivelCompromisoVivienda: NivelCompromisoVivienda;
}

export interface EvaluacionTerrenoPrioridadForm {
  familias: FamiliaAfectadaItem[];
  nucleoFamiliarTotal: number;
  cantidadNinos: number;
  cantidadAdultosMayores: number;
  personasDiscapacitadas: number;
  personasElectrodependientes: number;
  mascotasAfectadas: number;
  viviendasAfectadas: number;
  nivelCompromisoVivienda: NivelCompromisoVivienda;
  riesgoElectrico: boolean;
  riesgoEstructural: boolean;
  riesgoQuimicoSanitario: boolean;
  aislamientoVial: boolean;
  requiereEvacuacion: boolean;
  requiereApoyoAdicional: boolean;
  detallesAdicionales: string;
}

export interface EvaluadorReporteTerreno {
  id?: string;
  nombre: string;
  email?: string;
  rut?: string | null;
}

export interface ReportePrioridadTerrenoLocal {
  id?: string;
  versionReporte: number;
  evaluacion: EvaluacionTerrenoPrioridadForm;
  prioridadSugerida: PrioridadIncidente;
  prioridadAsignada: PrioridadIncidente;
  factoresGatillantes: string[];
  justificacionPrioridad: string;
  evaluador?: EvaluadorReporteTerreno;
  creadoEn: string;
  sincronizado: boolean;
}

export interface AsignarPrioridadPayload extends EvaluacionTerrenoPrioridadForm {
  prioridad: PrioridadIncidente;
  prioridadSugerida: PrioridadIncidente;
  justificacionPrioridad: string;
  factoresGatillantes: string[];
  misionId?: string;
  versionReporte: number;
}

export type DictamenAtencion = 'REQUIERE_CUADRILLA' | 'NO_ABORDABLE';

export type EstadoTerrenoVerificacion =
  | 'CRITICO'
  | 'ESTABLE'
  | 'INACCESIBLE'
  | 'CONTROLADO'
  | 'FINALIZADO';

export interface AdjuntoReportePreliminar {
  id?: string;
  nombreArchivo?: string;
  url?: string;
  tipoMime?: string;
  tamanoBytes?: number;
}

export interface ReporteVerificacionTerrenoForm {
  dictamen: DictamenAtencion;
  motivo_no_abordable: string;
  resumen_tecnico: string;
  estado_terreno?: EstadoTerrenoVerificacion;
  personas_afectadas: number;
  danos_estimados: string;
  observaciones: string;
  requiere_asistencia_social: boolean;
  adjuntoIds: string[];
  adjuntos: AdjuntoReportePreliminar[];
}

export interface ReporteVerificacionTerrenoLocal extends ReporteVerificacionTerrenoForm {
  id?: string;
  misionId: string;
  evaluador?: EvaluadorReporteTerreno;
  creadoEn: string;
  sincronizado: boolean;
}

export type CrearReporteVerificacionPayload = NonNullable<
  paths['/api/misiones/{id}/reporte']['post']['requestBody']
>['content']['application/json'];


