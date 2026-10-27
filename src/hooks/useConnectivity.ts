'use client';

import { useState, useEffect, useCallback } from 'react';
import { contarAccionesPendientes, sincronizarColaOutbox } from '@/services/offlineQueue';
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

      await sincronizarColaOutbox(async (accion) => {
        const res = await fetch(`${apiUrl}${accion.url}`, {
          method: accion.metodo,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(accion.payload),
        });

        // Códigos 2xx o 4xx que indiquen que el recurso ya fue procesado / idempotente
        return res.ok || res.status === 409 || res.status === 422;
      });
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
