'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  contarAccionesPendientes,
  sincronizarColaOutbox,
  obtenerMisionLocalPorId,
  guardarMisionLocal,
} from '@/services/offlineQueue';
import type { ConnectionStatus } from '@/components/common/ConnectionStatusBadge';
import { getAuthCookie } from '@/lib/utils/cookieUtils';
import { DEV_PATRULLA_TOKEN, DEV_PATRULLA_USER_ID } from '@/lib/api/client';

export function useConnectivity() {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });
  const [sincronizando, setSincronizando] = useState<boolean>(false);
  const [pendientes, setPendientes] = useState<number>(0);

  const actualizarPendientes = useCallback(async () => {
    try {
      const total = await contarAccionesPendientes();
      setPendientes(total);
    } catch {
      // Ignorar si IndexedDB no está disponible en este momento
    }
  }, []);

  const sincronizar = useCallback(async () => {
    if (!navigator.onLine || sincronizando) return;

    setSincronizando(true);
    try {
      const token = getAuthCookie();
      const apiUrl =
        typeof window !== 'undefined' && process.env.NODE_ENV !== 'test'
          ? ''
          : process.env.NEXT_PUBLIC_API_URL || '';

      await sincronizarColaOutbox(async (accion) => {
        const authHeaders: Record<string, string> =
          token === DEV_PATRULLA_TOKEN
            ? { 'x-user-id': DEV_PATRULLA_USER_ID }
            : token
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

        // Códigos 2xx o 409/422 que indiquen que el recurso ya fue procesado / idempotente
        const procesada = res.ok || res.status === 409 || res.status === 422;

        if (procesada && accion.tipo === 'ACEPTAR_MISION') {
          const match = accion.url.match(/\/api\/misiones\/([^/]+)\/aceptar/);
          const misionId = match?.[1];
          if (misionId) {
            try {
              const local = await obtenerMisionLocalPorId(misionId);
              if (local) {
                if (res.ok) {
                  let fechaInicioServidor = local.fechaInicio || new Date().toISOString();
                  try {
                    const bodyJson = await res.clone().json();
                    if (bodyJson?.data?.mision?.fechaInicio) {
                      fechaInicioServidor = bodyJson.data.mision.fechaInicio;
                    }
                  } catch {
                    // Ignorar si la respuesta no contiene JSON
                  }
                  await guardarMisionLocal({
                    ...local,
                    estado: 'EN_CURSO',
                    fechaInicio: fechaInicioServidor,
                    sincronizacionPendiente: false,
                    actualizadoEn: new Date().toISOString(),
                  });
                } else {
                  // Conflicto o rechazo por backend (409/422, patrulla desactivada o misión reasignada).
                  // Se limpia sincronizacionPendiente para no trabar la cola, pero no se promueve falsamente a EN_CURSO.
                  await guardarMisionLocal({
                    ...local,
                    sincronizacionPendiente: false,
                    actualizadoEn: new Date().toISOString(),
                  });
                }
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
      }
    } catch (err) {
      console.warn('[OfflineQueue] Error durante la sincronización:', err);
    } finally {
      await actualizarPendientes();
      setSincronizando(false);
    }
  }, [sincronizando, actualizarPendientes]);

  useEffect(() => {
    actualizarPendientes();

    const handleOnline = () => {
      setOnline(true);
      sincronizar();
    };

    const handleOffline = () => {
      setOnline(false);
      actualizarPendientes();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Revisar periódicamente el outbox si hay mutaciones
    const interval = setInterval(() => {
      actualizarPendientes();
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
