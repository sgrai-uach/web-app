'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  contarAccionesPendientes,
  sincronizarColaOutbox,
  obtenerMisionLocalPorId,
  obtenerMisionesLocales,
  guardarMisionLocal,
  reemplazarAdjuntoLocalEnMision,
  marcarErrorAdjuntoLocalEnMision,
  eliminarAccionOutbox,
} from '@/services/offlineQueue';
import {
  construirFormDataEvidencia,
  extraerMensajeErrorHttp,
  parsearAdjuntoDesdeRespuesta,
} from '@/services/evidenciaService';
import { dataUrlToBlob } from '@/lib/utils/mediaUtils';
import { obtenerDetalleMision } from '@/services/misionesService';
import type { ConnectionStatus } from '@/components/common/ConnectionStatusBadge';
import type { AdjuntoLocal, EvidenciaOutboxPayload } from '@/types/offline';
import { getAuthCookie } from '@/lib/utils/cookieUtils';
import {
  extractUserIdFromJwt,
  handleUnauthorizedSession,
} from '@/lib/api/client';

export function useConnectivity() {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });
  const [sincronizando, setSincronizando] = useState<boolean>(false);
  const [pendientes, setPendientes] = useState<number>(0);
  const sincronizandoRef = useRef<boolean>(false);
  const sesionExpiradaRef = useRef<boolean>(false);

  const actualizarPendientes = useCallback(async (): Promise<number> => {
    try {
      const total = await contarAccionesPendientes();
      setPendientes(total);
      return total;
    } catch {
      return 0;
    }
  }, []);

  const sincronizar = useCallback(async () => {
    if (
      sesionExpiradaRef.current ||
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      sincronizandoRef.current
    ) {
      return;
    }

    sincronizandoRef.current = true;
    setSincronizando(true);
    try {
      const token = getAuthCookie();
      const apiUrl =
        typeof window !== 'undefined' && process.env.NODE_ENV !== 'test'
          ? ''
          : process.env.NEXT_PUBLIC_API_URL || '';
      const mapaAdjuntosResueltos = new Map<string, AdjuntoLocal>();

      await sincronizarColaOutbox(async (accion) => {
        const authHeaders: Record<string, string> = {};
        if (token) {
          authHeaders['Authorization'] = `Bearer ${token}`;
          const userId = extractUserIdFromJwt(token);
          if (userId) {
            authHeaders['x-user-id'] = userId;
          }
        }

        let res: Response;
        if (accion.tipo === 'SUBIR_EVIDENCIA') {
          const evPayload = accion.payload as EvidenciaOutboxPayload;
          const blob = dataUrlToBlob(evPayload.dataUrl);
          const formData = construirFormDataEvidencia(
            blob,
            evPayload.nombreArchivo,
            evPayload.incidente_id,
            evPayload.reporte_terreno_id
          );
          res = await fetch(`${apiUrl}${accion.url}`, {
            method: accion.metodo,
            headers: authHeaders,
            body: formData,
          });
        } else {
          let payloadAEnviar: Record<string, unknown> = accion.payload;
          if (accion.tipo === 'ENVIAR_REPORTE') {
            const clon: Record<string, unknown> = { ...accion.payload };
            const idsPendientes = Array.isArray(clon.__adjuntosLocalesPendientes)
              ? (clon.__adjuntosLocalesPendientes as unknown[]).filter(
                  (id): id is string => typeof id === 'string' && id.length > 0
                )
              : [];
            delete clon.__adjuntosLocalesPendientes;

            const idsOrig = Array.isArray(clon.adjuntoIds)
              ? (clon.adjuntoIds as unknown[]).filter(
                  (id): id is string => typeof id === 'string' && id.length > 0
                )
              : [];
            const adjsOrig = Array.isArray(clon.adjuntos)
              ? (clon.adjuntos as Array<Record<string, unknown>>)
              : [];

            const idsResueltos: string[] = [];
            const adjsResueltos: Array<Record<string, unknown>> = [];

            for (const id of idsOrig) {
              const resuelto = mapaAdjuntosResueltos.get(id);
              if (resuelto) {
                if (!idsResueltos.includes(resuelto.id)) {
                  idsResueltos.push(resuelto.id);
                }
                adjsResueltos.push({
                  id: resuelto.id,
                  nombreArchivo: resuelto.nombreArchivo,
                  url: resuelto.url,
                  tipoMime: resuelto.tipoMime,
                  tamanoBytes: resuelto.tamanoBytes,
                });
              } else if (!id.startsWith('local-') && !idsResueltos.includes(id)) {
                idsResueltos.push(id);
              }
            }

            for (const localId of idsPendientes) {
              const resuelto = mapaAdjuntosResueltos.get(localId);
              if (resuelto) {
                if (!idsResueltos.includes(resuelto.id)) {
                  idsResueltos.push(resuelto.id);
                }
                adjsResueltos.push({
                  id: resuelto.id,
                  nombreArchivo: resuelto.nombreArchivo,
                  url: resuelto.url,
                  tipoMime: resuelto.tipoMime,
                  tamanoBytes: resuelto.tamanoBytes,
                });
              }
            }

            for (const adj of adjsOrig) {
              const adjId = typeof adj.id === 'string' ? adj.id : undefined;
              const adjUrl = typeof adj.url === 'string' ? adj.url : '';
              if (adjId && mapaAdjuntosResueltos.has(adjId)) {
                const resuelto = mapaAdjuntosResueltos.get(adjId)!;
                if (!adjsResueltos.some((item) => item.id === resuelto.id)) {
                  adjsResueltos.push({
                    id: resuelto.id,
                    nombreArchivo: resuelto.nombreArchivo,
                    url: resuelto.url,
                    tipoMime: resuelto.tipoMime,
                    tamanoBytes: resuelto.tamanoBytes,
                  });
                }
              } else if (
                adjId &&
                !adjId.startsWith('local-') &&
                !adjUrl.startsWith('data:') &&
                !adjUrl.startsWith('blob:') &&
                !adjsResueltos.some((item) => item.id === adjId)
              ) {
                adjsResueltos.push(adj);
              }
            }

            clon.adjuntoIds = idsResueltos;
            clon.adjuntos = adjsResueltos;
            payloadAEnviar = clon;
          }

          res = await fetch(`${apiUrl}${accion.url}`, {
            method: accion.metodo,
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            body: JSON.stringify(payloadAEnviar),
          });
        }

        if (res.status === 401) {
          sesionExpiradaRef.current = true;
          handleUnauthorizedSession();
          return false;
        }

        const esExito = res.ok;
        let esIdempotenteEnCurso = false;
        let esConflictoTerminal = false;

        if (res.status === 409) {
          if (accion.tipo === 'ACEPTAR_MISION') {
            try {
              const errJson = await res.clone().json();
              const msg = typeof errJson?.message === 'string' ? errJson.message : '';
              if (/EN_CURSO/i.test(msg)) {
                esIdempotenteEnCurso = true;
              } else {
                esConflictoTerminal = true;
              }
            } catch {
              esConflictoTerminal = true;
            }
          } else if (accion.tipo !== 'ACTUALIZAR_TIPOLOGIA') {
            esConflictoTerminal = true;
          }
        }

        const esErrorIrrecuperable =
          res.status === 400 ||
          res.status === 403 ||
          res.status === 404 ||
          res.status === 413 ||
          res.status === 415 ||
          res.status === 422;

        const procesada =
          esExito || esIdempotenteEnCurso || esConflictoTerminal || esErrorIrrecuperable;

        if (accion.tipo === 'ACTUALIZAR_TIPOLOGIA') {
          const match = accion.url.match(/\/api\/incidentes\/([^/]+)\/tipologia/);
          const incidenteId = match?.[1];
          const misionId =
            typeof accion.payload?.misionId === 'string' && accion.payload.misionId
              ? accion.payload.misionId
              : undefined;

          if (esExito) {
            try {
              let local = misionId ? await obtenerMisionLocalPorId(misionId) : undefined;
              if (!local && incidenteId) {
                const todas = (await obtenerMisionesLocales()) || [];
                local = todas.find((m) => m.incidenteId === incidenteId);
              }
              if (local) {
                await guardarMisionLocal({
                  ...local,
                  sincronizacionPendiente: false,
                  actualizadoEn: new Date().toISOString(),
                });
              }
            } catch {
              // Ignorar fallos de persistencia secundaria
            }
          } else if (esConflictoTerminal || esErrorIrrecuperable) {
            try {
              let local = misionId ? await obtenerMisionLocalPorId(misionId) : undefined;
              if (!local && incidenteId) {
                const todas = (await obtenerMisionesLocales()) || [];
                local = todas.find((m) => m.incidenteId === incidenteId);
              }
              const targetMisionId = local?.id || misionId;
              if (local) {
                const datosRestaurados = { ...(local.datosAdicionales || {}) };
                delete datosRestaurados.tipologiaEvaluada;
                delete datosRestaurados.tipoIncidenteId;
                delete datosRestaurados.justificacionTipologia;
                delete datosRestaurados.fechaEvaluacionTipologia;
                delete datosRestaurados.esReclasificacion;

                await guardarMisionLocal({
                  ...local,
                  sincronizacionPendiente: false,
                  datosAdicionales: datosRestaurados,
                  actualizadoEn: new Date().toISOString(),
                });
              }
              if (typeof eliminarAccionOutbox === 'function') {
                await eliminarAccionOutbox(accion.id);
              }
              if (targetMisionId) {
                await obtenerDetalleMision(targetMisionId);
              }
            } catch {
              // Ignorar fallos al refrescar estado real
            }
          }
        }

        if (accion.tipo === 'AJUSTAR_PRIORIDAD') {
          const match = accion.url.match(/\/api\/incidentes\/([^/]+)\/prioridad/);
          const incidenteId = match?.[1];
          const misionId = accion.payload?.misionId as string | undefined;
          if (esExito || esConflictoTerminal || esErrorIrrecuperable) {
            try {
              let local = misionId ? await obtenerMisionLocalPorId(misionId) : undefined;
              if (!local && incidenteId) {
                const todas = await obtenerMisionesLocales();
                local = todas.find((m) => m.incidenteId === incidenteId);
              }
              if (local) {
                let prioridadServidor = local.prioridad;
                if (esExito) {
                  try {
                    const bodyJson = await res.clone().json();
                    if (bodyJson?.data?.incidente?.prioridad) {
                      prioridadServidor = bodyJson.data.incidente.prioridad;
                    }
                  } catch {
                    // Ignorar si no hay JSON
                  }
                }
                const reportesPrevios = Array.isArray(local.datosAdicionales?.reportesPrioridad)
                  ? (local.datosAdicionales.reportesPrioridad as Array<Record<string, unknown>>).map(
                      (rep) => ({
                        ...rep,
                        sincronizado: esExito ? true : rep.sincronizado,
                      })
                    )
                  : local.datosAdicionales?.reportesPrioridad;

                await guardarMisionLocal({
                  ...local,
                  prioridad: prioridadServidor,
                  sincronizacionPendiente: false,
                  actualizadoEn: new Date().toISOString(),
                  datosAdicionales: {
                    ...local.datosAdicionales,
                    ...(reportesPrevios !== undefined
                      ? { reportesPrioridad: reportesPrevios }
                      : {}),
                  },
                });
              }
            } catch {
              // Ignorar fallos de persistencia secundaria
            }
          }
        }

        if (accion.tipo === 'ACEPTAR_MISION') {
          const match = accion.url.match(/\/api\/misiones\/([^/]+)\/aceptar/);
          const misionId = match?.[1];
          if (misionId) {
            if (esExito || esIdempotenteEnCurso) {
              try {
                const local = await obtenerMisionLocalPorId(misionId);
                if (local) {
                  let fechaInicioServidor =
                    local.fechaInicio || new Date().toISOString();
                  if (esExito) {
                    try {
                      const bodyJson = await res.clone().json();
                      if (bodyJson?.data?.mision?.fechaInicio) {
                        fechaInicioServidor = bodyJson.data.mision.fechaInicio;
                      }
                    } catch {
                      // Ignorar si la respuesta no contiene JSON
                    }
                  }
                  await guardarMisionLocal({
                    ...local,
                    estado: 'EN_CURSO',
                    fechaInicio: fechaInicioServidor,
                    sincronizacionPendiente: false,
                    actualizadoEn: new Date().toISOString(),
                  });
                }
              } catch {
                // Ignorar fallos de lectura/escritura secundaria en IndexedDB
              }
            } else if (esConflictoTerminal || esErrorIrrecuperable) {
              try {
                const local = await obtenerMisionLocalPorId(misionId);
                if (local) {
                  await guardarMisionLocal({
                    ...local,
                    sincronizacionPendiente: false,
                    actualizadoEn: new Date().toISOString(),
                  });
                }
                if (typeof eliminarAccionOutbox === 'function') {
                  await eliminarAccionOutbox(accion.id);
                }
                await obtenerDetalleMision(misionId);
              } catch {
                // Ignorar fallos al refrescar estado real
              }
            }
          }
        }
        if (accion.tipo === 'SUBIR_EVIDENCIA') {
          const evPayload = accion.payload as EvidenciaOutboxPayload;
          if (esExito) {
            try {
              const bodyJson = await res.clone().json();
              const adjuntoDefinitivo = parsearAdjuntoDesdeRespuesta(bodyJson, {
                id: evPayload.adjuntoLocalId,
                nombreArchivo: evPayload.nombreArchivo,
                url: '',
                tipoMime: evPayload.tipoMime,
                tamanoBytes: evPayload.tamanoBytes,
                creadoEn: new Date().toISOString(),
                sincronizacionPendiente: false,
              });
              mapaAdjuntosResueltos.set(evPayload.adjuntoLocalId, adjuntoDefinitivo);
              await reemplazarAdjuntoLocalEnMision(
                evPayload.misionId,
                evPayload.adjuntoLocalId,
                adjuntoDefinitivo
              );
            } catch {
              // Ignorar fallos secundarios al actualizar caché de misión
            }
          } else if (esErrorIrrecuperable || esConflictoTerminal) {
            let serverMsg: string | undefined;
            try {
              const bodyErr = (await res.clone().json()) as {
                message?: unknown;
                error?: unknown;
              } | null;
              if (typeof bodyErr?.message === 'string' && bodyErr.message.trim()) {
                serverMsg = bodyErr.message.trim();
              } else if (typeof bodyErr?.error === 'string' && bodyErr.error.trim()) {
                serverMsg = bodyErr.error.trim();
              }
            } catch {
              // Sin cuerpo JSON legible
            }
            await marcarErrorAdjuntoLocalEnMision(
              evPayload.misionId,
              evPayload.adjuntoLocalId,
              extraerMensajeErrorHttp(res.status, serverMsg)
            );
          }
        }
        if (procesada && accion.tipo === 'ENVIAR_REPORTE') {
          const match = accion.url.match(/\/api\/misiones\/([^/]+)\/reporte/);
          const misionId = match?.[1];
          if (misionId) {
            if (esExito) {
              try {
                const local = await obtenerMisionLocalPorId(misionId);
                if (local) {
                  const reportePrevio = local.datosAdicionales?.reporteVerificacion as
                    | Record<string, unknown>
                    | undefined;
                  await guardarMisionLocal({
                    ...local,
                    estado: 'COMPLETADA',
                    sincronizacionPendiente: false,
                    actualizadoEn: new Date().toISOString(),
                    datosAdicionales: {
                      ...local.datosAdicionales,
                      ...(reportePrevio
                        ? {
                            reporteVerificacion: {
                              ...reportePrevio,
                              sincronizado: true,
                            },
                          }
                        : {}),
                    },
                  });
                }
                if (typeof eliminarAccionOutbox === 'function') {
                  await eliminarAccionOutbox(accion.id);
                }
                await obtenerDetalleMision(misionId);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('sgrai:mision-sincronizada', {
                      detail: { misionId },
                    })
                  );
                }
              } catch {
                // Ignorar fallos de persistencia secundaria
              }
            } else if (esConflictoTerminal || esErrorIrrecuperable) {
              try {
                const local = await obtenerMisionLocalPorId(misionId);
                if (local) {
                  const datosRestaurados = { ...(local.datosAdicionales || {}) };
                  delete datosRestaurados.reporteVerificacionEnviado;
                  delete datosRestaurados.reporteVerificacionEnviadoEn;
                  delete datosRestaurados.dictamenVerificacion;
                  delete datosRestaurados.reporteVerificacion;
                  if (Array.isArray(datosRestaurados.reportesTerreno)) {
                    datosRestaurados.reportesTerreno = (
                      datosRestaurados.reportesTerreno as Array<Record<string, unknown>>
                    ).filter((r) => r.tipoReporte !== 'VERIFICACION_CIERRE');
                  }
                  await guardarMisionLocal({
                    ...local,
                    estado: 'EN_CURSO',
                    sincronizacionPendiente: false,
                    datosAdicionales: datosRestaurados,
                    actualizadoEn: new Date().toISOString(),
                  });
                }
                if (typeof window !== 'undefined' && window.localStorage) {
                  try {
                    const rawCache = window.localStorage.getItem('sgrai_evaluaciones_mision_v1');
                    if (rawCache) {
                      const parsedCache = JSON.parse(rawCache) as Record<
                        string,
                        Record<string, unknown>
                      >;
                      if (parsedCache[misionId]) {
                        delete parsedCache[misionId].reporteVerificacionEnviado;
                        delete parsedCache[misionId].reporteVerificacion;
                        delete parsedCache[misionId].dictamenVerificacion;
                        window.localStorage.setItem(
                          'sgrai_evaluaciones_mision_v1',
                          JSON.stringify(parsedCache)
                        );
                      }
                    }
                  } catch {
                    // Ignorar errores de localStorage
                  }
                }
                if (typeof eliminarAccionOutbox === 'function') {
                  await eliminarAccionOutbox(accion.id);
                }
                await obtenerDetalleMision(misionId);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('sgrai:sync-error', {
                      detail: {
                        tipo: accion.tipo,
                        misionId,
                        status: res.status,
                      },
                    })
                  );
                }
              } catch {
                // Ignorar fallos al refrescar estado real
              }
            }
          }
        }

        if (accion.tipo === 'RECHAZAR_MISION') {
          const match = accion.url.match(/\/api\/misiones\/([^/]+)\/rechazar/);
          const misionId = match?.[1];
          if (misionId) {
            if (esExito) {
              try {
                const local = await obtenerMisionLocalPorId(misionId);
                if (local) {
                  let actualizadoServidor = local.actualizadoEn || new Date().toISOString();
                  try {
                    const bodyJson = await res.clone().json();
                    if (bodyJson?.data?.mision?.actualizadoEn) {
                      actualizadoServidor = bodyJson.data.mision.actualizadoEn;
                    }
                  } catch {
                    // Ignorar si la respuesta no contiene JSON
                  }
                  await guardarMisionLocal({
                    ...local,
                    estado: 'RECHAZADA',
                    sincronizacionPendiente: false,
                    actualizadoEn: actualizadoServidor,
                  });
                }
              } catch {
                // Ignorar fallos de lectura/escritura secundaria en IndexedDB
              }
            } else if (esConflictoTerminal || esErrorIrrecuperable) {
              try {
                const local = await obtenerMisionLocalPorId(misionId);
                if (local) {
                  const datosRestaurados = { ...(local.datosAdicionales || {}) };
                  delete datosRestaurados.justificacionRechazo;
                  await guardarMisionLocal({
                    ...local,
                    estado: local.estado === 'RECHAZADA' ? 'DESPACHADA' : local.estado,
                    sincronizacionPendiente: false,
                    datosAdicionales: datosRestaurados,
                    actualizadoEn: new Date().toISOString(),
                  });
                }
                if (typeof eliminarAccionOutbox === 'function') {
                  await eliminarAccionOutbox(accion.id);
                }
                await obtenerDetalleMision(misionId);
              } catch {
                // Ignorar fallos al refrescar estado real tras rollback local
              }
            }
          }
        }
        return procesada;
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sgrai:outbox-synced'));
        window.dispatchEvent(new CustomEvent('sgrai:mision_actualizada'));
      }
    } catch (err) {
      console.warn('[OfflineQueue] Error durante la sincronización:', err);
    } finally {
      await actualizarPendientes();
      sincronizandoRef.current = false;
      setSincronizando(false);
    }
  }, [actualizarPendientes]);

  useEffect(() => {
    const verificarYSincronizar = async () => {
      if (sesionExpiradaRef.current) return;
      const total = await actualizarPendientes();
      if (
        !sesionExpiradaRef.current &&
        typeof navigator !== 'undefined' &&
        navigator.onLine &&
        total > 0 &&
        !sincronizandoRef.current
      ) {
        await sincronizar();
      }
    };

    void verificarYSincronizar();

    const handleOnline = () => {
      setOnline(true);
      void sincronizar();
    };

    const handleOffline = () => {
      setOnline(false);
      void actualizarPendientes();
    };

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data && (event.data as { type?: string }).type === 'PROCESS_OFFLINE_QUEUE') {
        void sincronizar();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof navigator.serviceWorker?.addEventListener === 'function'
    ) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    // Revisar periódicamente el outbox y sincronizar si hay conexión activa y pendientes
    const interval = setInterval(() => {
      void verificarYSincronizar();
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (
        typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator &&
        typeof navigator.serviceWorker?.removeEventListener === 'function'
      ) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
      clearInterval(interval);
    };
  }, [sincronizar, actualizarPendientes]);

  let status: ConnectionStatus = 'connected';
  if (sincronizando) {
    status = 'syncing';
  } else if (!online) {
    status = 'offline';
  } else if (pendientes > 0) {
    status = 'syncing';
  }

  return {
    online,
    sincronizando,
    pendientes,
    status,
    sincronizar,
    actualizarPendientes,
  };
}
