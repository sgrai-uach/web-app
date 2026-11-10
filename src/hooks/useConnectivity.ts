'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  contarAccionesPendientes,
  sincronizarColaOutbox,
  obtenerMisionLocalPorId,
  guardarMisionLocal,
} from '@/services/offlineQueue';
import { obtenerDetalleMision } from '@/services/misionesService';
import type { ConnectionStatus } from '@/components/common/ConnectionStatusBadge';
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

      await sincronizarColaOutbox(async (accion) => {
        const authHeaders: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {};

        const res = await fetch(`${apiUrl}${accion.url}`, {
          method: accion.metodo,
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify(accion.payload),
        });

        const esExito = res.ok;
        let esIdempotenteEnCurso = false;
        let esConflictoTerminal = false;

        if (res.status === 409) {
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
        }

        const esErrorIrrecuperable =
          res.status === 400 ||
          res.status === 403 ||
          res.status === 404 ||
          res.status === 422;

        const procesada =
          esExito || esIdempotenteEnCurso || esConflictoTerminal || esErrorIrrecuperable;

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
                  });
                }
                await obtenerDetalleMision(misionId);
              } catch {
                // Ignorar fallos al refrescar estado real
              }
            }
          }
        }

        return procesada;
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sgrai:outbox-synced'));
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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Revisar periódicamente el outbox y sincronizar si hay conexión activa y pendientes
    const interval = setInterval(() => {
      void verificarYSincronizar();
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
