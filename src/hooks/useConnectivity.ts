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

      const adjuntosSincronizadosMap = new Map<string, AdjuntoLocal>();

      await sincronizarColaOutbox(async (accion) => {
        const authHeaders: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {};

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
        } else if (accion.tipo === 'CERRAR_FAENA') {
          const rawPayload = { ...(accion.payload || {}) } as Record<string, unknown>;
          const pendientesLocalIds = Array.isArray(
            rawPayload._adjuntosPendientesLocalIds
          )
            ? (rawPayload._adjuntosPendientesLocalIds as string[])
            : [];
          delete rawPayload._adjuntosPendientesLocalIds;

          const adjuntoIdsActuales = Array.isArray(rawPayload.adjunto_ids)
            ? [...(rawPayload.adjunto_ids as string[])]
            : [];
          const adjuntosActuales = Array.isArray(rawPayload.adjuntos)
            ? [...(rawPayload.adjuntos as Array<Record<string, unknown>>)]
            : [];

          for (const localId of pendientesLocalIds) {
            const resuelto = adjuntosSincronizadosMap.get(localId);
            if (resuelto?.id && !adjuntoIdsActuales.includes(resuelto.id)) {
              adjuntoIdsActuales.push(resuelto.id);
              const idxLocal = adjuntosActuales.findIndex((a) => a?.id === localId);
              const itemSincronizado = {
                id: resuelto.id,
                nombreArchivo: resuelto.nombreArchivo,
                url: resuelto.url,
                tipoMime: resuelto.tipoMime,
                tamanoBytes: resuelto.tamanoBytes,
              };
              if (idxLocal >= 0) {
                adjuntosActuales[idxLocal] = itemSincronizado;
              } else {
                adjuntosActuales.push(itemSincronizado);
              }
            }
          }

          const adjuntosFiltrados = adjuntosActuales.filter(
            (a) => typeof a?.id !== 'string' || !a.id.startsWith('local-')
          );

          const bodyCerrar: Record<string, unknown> = {
            ...rawPayload,
            ...(adjuntoIdsActuales.length > 0
              ? { adjunto_ids: adjuntoIdsActuales }
              : {}),
            ...(adjuntosFiltrados.length > 0 ? { adjuntos: adjuntosFiltrados } : {}),
          };
          if (adjuntoIdsActuales.length === 0) {
            delete bodyCerrar.adjunto_ids;
          }
          if (adjuntosFiltrados.length === 0) {
            delete bodyCerrar.adjuntos;
          }

          res = await fetch(`${apiUrl}${accion.url}`, {
            method: accion.metodo,
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            body: JSON.stringify(bodyCerrar),
          });
        } else if (accion.tipo === 'SOLICITAR_APOYO') {
          const rawPayload = { ...(accion.payload || {}) } as Record<string, unknown>;
          delete rawPayload._localId;

          res = await fetch(`${apiUrl}${accion.url}`, {
            method: accion.metodo,
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            body: JSON.stringify(rawPayload),
          });
        } else {
          res = await fetch(`${apiUrl}${accion.url}`, {
            method: accion.metodo,
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            body: JSON.stringify(accion.payload),
          });
        }

        const esExito = res.ok;
        let esIdempotenteEnCurso = false;
        let esConflictoTerminal = false;

        if (res.status === 409) {
          try {
            const errJson = await res.clone().json();
            const msg = typeof errJson?.message === 'string' ? errJson.message : '';
            if (/EN_CURSO|llegada.*ya fue reportada/i.test(msg)) {
              esIdempotenteEnCurso = true;
            } else {
              esConflictoTerminal = true;
            }
          } catch {
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

        if (procesada && accion.tipo === 'ACTUALIZAR_TIPOLOGIA') {
          const match = accion.url.match(/\/api\/incidentes\/([^/]+)\/tipologia/);
          const incidenteId = match?.[1];
          const misionId = accion.payload?.misionId as string | undefined;
          try {
            let local = misionId ? await obtenerMisionLocalPorId(misionId) : undefined;
            if (!local && incidenteId) {
              const todas = await obtenerMisionesLocales();
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
                  let estadoCuadrillaServidor: string | undefined;
                  let estadoPatrullaServidor: string | undefined;
                  let estadoIncidenteServidor: string | undefined;
                  let hitoAceptacionServidor: string | undefined;
                  if (esExito) {
                    try {
                      const bodyJson = await res.clone().json();
                      if (bodyJson?.data?.mision?.fechaInicio) {
                        fechaInicioServidor = bodyJson.data.mision.fechaInicio;
                      }
                      if (typeof bodyJson?.data?.cuadrilla?.estado === 'string') {
                        estadoCuadrillaServidor = bodyJson.data.cuadrilla.estado;
                      }
                      if (typeof bodyJson?.data?.patrulla?.estado === 'string') {
                        estadoPatrullaServidor = bodyJson.data.patrulla.estado;
                      }
                      if (typeof bodyJson?.data?.incidente?.estado === 'string') {
                        estadoIncidenteServidor = bodyJson.data.incidente.estado;
                      }
                      if (typeof bodyJson?.data?.hito?.descripcion === 'string') {
                        hitoAceptacionServidor = bodyJson.data.hito.descripcion;
                      }
                    } catch {
                      // Ignorar si la respuesta no contiene JSON
                    }
                  }
                  const datosActualizados = {
                    ...(local.datosAdicionales || {}),
                    ...(estadoCuadrillaServidor
                      ? { estadoCuadrilla: estadoCuadrillaServidor }
                      : {}),
                    ...(estadoPatrullaServidor
                      ? { estadoPatrulla: estadoPatrullaServidor }
                      : {}),
                    ...(estadoIncidenteServidor
                      ? { estadoIncidente: estadoIncidenteServidor }
                      : {}),
                    ...(hitoAceptacionServidor
                      ? { hitoAceptacion: hitoAceptacionServidor }
                      : {}),
                  };
                  await guardarMisionLocal({
                    ...local,
                    estado: 'EN_CURSO',
                    fechaInicio: fechaInicioServidor,
                    sincronizacionPendiente: false,
                    ...(Object.keys(datosActualizados).length > 0
                      ? { datosAdicionales: datosActualizados }
                      : {}),
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
                await obtenerDetalleMision(misionId);
              } catch {
                // Ignorar fallos al refrescar estado real
              }
            }
          }
        } else if (accion.tipo === 'RECHAZAR_MISION') {
          const match = accion.url.match(/\/api\/misiones\/([^/]+)\/rechazar/);
          const misionId = match?.[1];
          if (misionId && (esExito || esConflictoTerminal || esErrorIrrecuperable)) {
            try {
              const local = await obtenerMisionLocalPorId(misionId);
              if (local) {
                let actualizadoServidor = local.actualizadoEn || new Date().toISOString();
                if (esExito) {
                  try {
                    const bodyJson = await res.clone().json();
                    if (bodyJson?.data?.mision?.actualizadoEn) {
                      actualizadoServidor = bodyJson.data.mision.actualizadoEn;
                    }
                  } catch {
                    // Ignorar si la respuesta no contiene JSON
                  }
                }
                await guardarMisionLocal({
                  ...local,
                  estado: esExito ? 'RECHAZADA' : local.estado,
                  sincronizacionPendiente: false,
                  actualizadoEn: actualizadoServidor,
                });
              }
              if (!esExito) {
                await obtenerDetalleMision(misionId);
              }
            } catch {
              // Ignorar fallos de lectura/escritura secundaria en IndexedDB
            }
          }
        } else if (accion.tipo === 'SUBIR_EVIDENCIA') {
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
              adjuntosSincronizadosMap.set(
                evPayload.adjuntoLocalId,
                adjuntoDefinitivo
              );
              await reemplazarAdjuntoLocalEnMision(
                evPayload.misionId,
                evPayload.adjuntoLocalId,
                adjuntoDefinitivo
              );
            } catch {
              // Ignorar fallos secundarios al actualizar caché de misión
            }
          } else if (esErrorIrrecuperable || esConflictoTerminal) {
            await marcarErrorAdjuntoLocalEnMision(
              evPayload.misionId,
              evPayload.adjuntoLocalId,
              extraerMensajeErrorHttp(res.status)
            );
          }
        }
        if (procesada && accion.tipo === 'AJUSTAR_PRIORIDAD') {
          const misionId = accion.payload?.misionId as string | undefined;
          const match = accion.url.match(/\/api\/incidentes\/([^/]+)\/prioridad/);
          const incidenteId = match?.[1];
          try {
            let local = misionId ? await obtenerMisionLocalPorId(misionId) : undefined;
            if (!local && incidenteId) {
              const todas = await obtenerMisionesLocales();
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
        }
        if (procesada && accion.tipo === 'ENVIAR_REPORTE') {
          const match = accion.url.match(/\/api\/misiones\/([^/]+)\/reporte/);
          const misionId = match?.[1];
          if (misionId) {
            try {
              const local = await obtenerMisionLocalPorId(misionId);
              if (local) {
                await guardarMisionLocal({
                  ...local,
                  ...(res.ok ? { estado: 'COMPLETADA' } : {}),
                  sincronizacionPendiente: false,
                  actualizadoEn: new Date().toISOString(),
                });
              }
            } catch {
              // Ignorar fallos de persistencia secundaria
            }
          }
        }
        if (procesada && accion.tipo === 'CERRAR_FAENA') {
          const match = accion.url.match(/\/api\/misiones\/([^/]+)\/cerrar/);
          const misionId = match?.[1];
          if (misionId) {
            if (esExito) {
              try {
                const local = await obtenerMisionLocalPorId(misionId);
                if (local) {
                  let fechaCierreServidor =
                    (local.datosAdicionales?.fechaCierre as string | undefined) ||
                    new Date().toISOString();
                  let reporteTerrenoIdServidor =
                    local.datosAdicionales?.reporteTerrenoId;
                  try {
                    const bodyJson = await res.clone().json();
                    if (bodyJson?.data?.mision?.fechaCierre) {
                      fechaCierreServidor = bodyJson.data.mision.fechaCierre;
                    }
                    if (bodyJson?.data?.reporteTerreno?.id) {
                      reporteTerrenoIdServidor = bodyJson.data.reporteTerreno.id;
                    }
                  } catch {
                    // Ignorar si la respuesta no contiene JSON
                  }
                  const reporteCuadrillaPrevio = local.datosAdicionales
                    ?.reporteCuadrilla as Record<string, unknown> | undefined;
                  await guardarMisionLocal({
                    ...local,
                    estado: 'COMPLETADA',
                    sincronizacionPendiente: false,
                    actualizadoEn: fechaCierreServidor,
                    datosAdicionales: {
                      ...local.datosAdicionales,
                      estadoCuadrilla: 'DISPONIBLE',
                      fechaCierre: fechaCierreServidor,
                      reporteCuadrillaEnviado: true,
                      ...(reporteTerrenoIdServidor
                        ? { reporteTerrenoId: reporteTerrenoIdServidor }
                        : {}),
                      ...(reporteCuadrillaPrevio
                        ? {
                            reporteCuadrilla: {
                              ...reporteCuadrillaPrevio,
                              ...(typeof reporteTerrenoIdServidor === 'string'
                                ? { id: reporteTerrenoIdServidor }
                                : {}),
                              sincronizado: true,
                            },
                          }
                        : {}),
                    },
                  });
                }
              } catch {
                // Ignorar fallos de persistencia secundaria
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
                await obtenerDetalleMision(misionId);
              } catch {
                // Ignorar fallos al reconciliar con el servidor
              }
            }
          }
        }

        if (procesada && accion.tipo === 'SOLICITAR_APOYO') {
          const match = accion.url.match(/\/api\/misiones\/([^/]+)\/apoyo/);
          const misionId = match?.[1];
          const localIdAccion =
            typeof accion.payload?._localId === 'string'
              ? accion.payload._localId
              : undefined;
          if (misionId) {
            if (esExito) {
              try {
                const local = await obtenerMisionLocalPorId(misionId);
                if (local) {
                  let idServidor: string | undefined;
                  try {
                    const bodyJson = await res.clone().json();
                    const rep =
                      bodyJson?.data?.reporteTerreno ?? bodyJson?.data?.reporte;
                    const idExtraido = bodyJson?.data?.reporteId ?? rep?.id;
                    if (typeof idExtraido === 'string' && idExtraido.trim()) {
                      idServidor = idExtraido;
                    }
                  } catch {
                    // Ignorar si no hay JSON
                  }
                  const listaActual = Array.isArray(
                    local.datosAdicionales?.solicitudesApoyoLocales
                  )
                    ? (local.datosAdicionales.solicitudesApoyoLocales as Array<
                        Record<string, unknown>
                      >)
                    : [];
                  const listaActualizada = listaActual.map((item) => {
                    const coincide = localIdAccion
                      ? item.localId === localIdAccion
                      : item.sincronizado === false;
                    if (!coincide) return item;
                    return {
                      ...item,
                      ...(idServidor ? { id: idServidor } : {}),
                      sincronizado: true,
                    };
                  });
                  const quedanPendientes = listaActualizada.some(
                    (item) => item.sincronizado === false
                  );
                  await guardarMisionLocal({
                    ...local,
                    sincronizacionPendiente: quedanPendientes,
                    actualizadoEn: new Date().toISOString(),
                    datosAdicionales: {
                      ...(local.datosAdicionales || {}),
                      requiereApoyoAdicional: true,
                      solicitudesApoyoLocales: listaActualizada,
                    },
                  });
                }
              } catch {
                // Ignorar fallos de persistencia secundaria
              }
            } else if (esConflictoTerminal || esErrorIrrecuperable) {
              try {
                const local = await obtenerMisionLocalPorId(misionId);
                if (local) {
                  const listaActual = Array.isArray(
                    local.datosAdicionales?.solicitudesApoyoLocales
                  )
                    ? (local.datosAdicionales.solicitudesApoyoLocales as Array<
                        Record<string, unknown>
                      >)
                    : [];
                  const listaFiltrada = localIdAccion
                    ? listaActual.filter((item) => item.localId !== localIdAccion)
                    : listaActual.filter((item) => item.sincronizado !== false);
                  const quedanPendientes = listaFiltrada.some(
                    (item) => item.sincronizado === false
                  );
                  await guardarMisionLocal({
                    ...local,
                    sincronizacionPendiente: quedanPendientes,
                    actualizadoEn: new Date().toISOString(),
                    datosAdicionales: {
                      ...(local.datosAdicionales || {}),
                      solicitudesApoyoLocales: listaFiltrada,
                    },
                  });
                }
                await obtenerDetalleMision(misionId);
              } catch {
                // Ignorar fallos al reconciliar con el servidor
              }
            }
          }
        }

        if (accion.tipo === 'REPORTAR_LLEGADA') {
          const match = accion.url.match(/\/api\/misiones\/([^/]+)\/llegada/);
          const misionId = match?.[1];
          if (misionId) {
            if (esExito || esIdempotenteEnCurso) {
              try {
                const local = await obtenerMisionLocalPorId(misionId);
                if (local) {
                  let fechaRegistro =
                    local.fechaLlegada || local.fechaInicio || new Date().toISOString();
                  if (esExito) {
                    try {
                      const bodyJson = await res.clone().json();
                      if (bodyJson?.data?.registradoEn) {
                        fechaRegistro = bodyJson.data.registradoEn;
                      }
                    } catch {
                      // Ignorar si no contiene JSON parseable
                    }
                  }
                  await guardarMisionLocal({
                    ...local,
                    estado: 'EN_CURSO',
                    fechaLlegada: fechaRegistro,
                    fechaInicio: local.fechaInicio || fechaRegistro,
                    sincronizacionPendiente: false,
                    actualizadoEn: new Date().toISOString(),
                  });
                }
              } catch {
                // Ignorar fallo secundario de actualización IndexedDB
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
                await obtenerDetalleMision(misionId);
              } catch {
                // Ignorar fallos al refrescar estado real
              }
            }
          }
        }

        if (procesada && accion.tipo === 'RECHAZAR_MISION') {
          const match = accion.url.match(/\/api\/misiones\/([^/]+)\/rechazar/);
          const misionId = match?.[1];
          if (misionId) {
            try {
              const local = await obtenerMisionLocalPorId(misionId);
              if (local) {
                let actualizadoServidor = local.actualizadoEn || new Date().toISOString();
                if (res.ok) {
                  try {
                    const bodyJson = await res.clone().json();
                    if (bodyJson?.data?.mision?.actualizadoEn) {
                      actualizadoServidor = bodyJson.data.mision.actualizadoEn;
                    }
                  } catch {
                    // Ignorar si la respuesta no contiene JSON
                  }
                }
                await guardarMisionLocal({
                  ...local,
                  estado: res.status === 422 ? local.estado : 'RECHAZADA',
                  sincronizacionPendiente: false,
                  actualizadoEn: actualizadoServidor,
                });
              }
            } catch {
              // Ignorar fallos de lectura/escritura secundaria en IndexedDB
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
      const total = await actualizarPendientes();
      if (
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
