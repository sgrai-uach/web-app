'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import {
  obtenerSocketTerreno,
  conectarSocketTerreno,
} from '@/lib/socket/terrenoSocket';
import type {
  TelemetriaEstado,
  TelemetriaPosicionPayload,
  UseTelemetryOptions,
  UseTelemetryResult,
} from '@/types/telemetria';

export type {
  TelemetriaEstado,
  TelemetriaPosicionPayload,
  UseTelemetryOptions,
  UseTelemetryResult,
};

const INTERVALO_DEFAULT_MS = 30000; // 30 segundos (eficiencia de batería y sondeo controlado HU-70)

/**
 * Hook para la captura y transmisión automática de telemetría GPS en segundo plano (HU-70).
 *
 * Actúa únicamente cuando la misión se encuentra en estado 'EN_CURSO' (activa === true)
 * y la unidad cuenta con asignación válida. Emite el evento Socket.io 'telemetria:posicion'
 * periódicamente hacia sgrai-api con las opciones óptimas de Geolocation API
 * (enableHighAccuracy: true, timeout: 10000, maximumAge: 30000).
 */
export function useTelemetry({
  unidadId,
  tipoUnidad,
  activa,
  intervaloMs = INTERVALO_DEFAULT_MS,
  socket: customSocket,
}: UseTelemetryOptions): UseTelemetryResult {
  const [estado, setEstado] = useState<TelemetriaEstado>('INACTIVO');
  const [ultimaPosicion, setUltimaPosicion] = useState<TelemetriaPosicionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ultimaPosicionRef = useRef<TelemetriaPosicionPayload | null>(null);

  useEffect(() => {
    ultimaPosicionRef.current = ultimaPosicion;
  }, [ultimaPosicion]);

  const auth = useAuth();
  const token = auth?.token ?? null;

  const resolveSocket = useCallback((): Socket | null => {
    if (customSocket) {
      return customSocket;
    }
    const existente = obtenerSocketTerreno();
    if (existente) {
      return existente;
    }
    if (token) {
      return conectarSocketTerreno(token);
    }
    return null;
  }, [customSocket, token]);

  const capturarYEmitir = useCallback(() => {
    if (!activa || !unidadId || !tipoUnidad) {
      setEstado('INACTIVO');
      return;
    }

    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      !navigator.geolocation ||
      typeof navigator.geolocation.getCurrentPosition !== 'function'
    ) {
      setEstado('ERROR_GPS');
      setError('Geolocalización no soportada en este dispositivo o navegador.');
      return;
    }

    const opcionesGeo: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    };

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, heading, accuracy, speed } = position.coords;

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            setEstado('ERROR_GPS');
            setError('Coordenadas GPS no válidas.');
            return;
          }

          const payload: TelemetriaPosicionPayload = {
            unidadId,
            tipoUnidad,
            lat: latitude,
            lng: longitude,
            timestamp: new Date().toISOString(),
            rumbo: typeof heading === 'number' && Number.isFinite(heading) ? heading : null,
            precision: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null,
            velocidad: typeof speed === 'number' && Number.isFinite(speed) ? speed : null,
          };

          ultimaPosicionRef.current = payload;
          setUltimaPosicion(payload);
          setEstado('TRANSMITIENDO');
          setError(null);

          const sock = resolveSocket();
          if (sock && sock.connected) {
            sock.emit('telemetria:posicion', payload);
          }
        },
        (geoError: GeolocationPositionError) => {
          if (geoError.code === geoError.PERMISSION_DENIED) {
            setEstado('SIN_PERMISO');
            setError('Permiso de geolocalización denegado en el dispositivo.');
          } else {
            setEstado('ERROR_GPS');
            setError(geoError.message || 'Error al obtener posición satelital GPS.');
          }
        },
        opcionesGeo
      );
    } catch (err) {
      setEstado('ERROR_GPS');
      setError(err instanceof Error ? err.message : 'Error inesperado al consultar GPS.');
    }
  }, [activa, unidadId, tipoUnidad, resolveSocket]);

  // Manejo de reconexión silenciosa del socket para retransmitir última posición
  useEffect(() => {
    if (!activa) return;
    const sock = resolveSocket();
    if (!sock) return;

    const handleConnect = () => {
      if (ultimaPosicionRef.current) {
        sock.emit('telemetria:posicion', ultimaPosicionRef.current);
      }
    };

    sock.on('connect', handleConnect);
    return () => {
      sock.off('connect', handleConnect);
    };
  }, [activa, resolveSocket]);

  // Monitoreo proactivo de cambios en permisos de geolocalización del navegador
  useEffect(() => {
    if (!activa) return;
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;

    let permissionStatus: PermissionStatus | null = null;

    const handleStatusChange = () => {
      if (permissionStatus?.state === 'denied') {
        setEstado('SIN_PERMISO');
        setError('Permiso de ubicación denegado en el navegador.');
      } else if (permissionStatus?.state === 'granted') {
        capturarYEmitir();
      }
    };

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        permissionStatus = status;
        if (status.state === 'denied') {
          setEstado('SIN_PERMISO');
          setError('Permiso de ubicación denegado en el navegador.');
        }
        status.addEventListener('change', handleStatusChange);
      })
      .catch(() => {
        // Ignorar si el navegador no soporta query de 'geolocation'
      });

    return () => {
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', handleStatusChange);
      }
    };
  }, [activa, capturarYEmitir]);

  // Temporizador de emisión periódica en segundo plano
  useEffect(() => {
    if (!activa || !unidadId || !tipoUnidad) {
      setEstado('INACTIVO');
      return;
    }

    // Primera captura inmediata al activarse la misión
    capturarYEmitir();

    const timerId = setInterval(() => {
      capturarYEmitir();
    }, intervaloMs);

    return () => {
      clearInterval(timerId);
      setEstado('INACTIVO');
    };
  }, [activa, unidadId, tipoUnidad, intervaloMs, capturarYEmitir]);

  const reintentar = useCallback(() => {
    capturarYEmitir();
  }, [capturarYEmitir]);

  return {
    estado,
    ultimaPosicion,
    error,
    transmitiendo: estado === 'TRANSMITIENDO',
    reintentar,
  };
}

export default useTelemetry;
