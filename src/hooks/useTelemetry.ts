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
const INTERVALO_MIN_MS = 1000;

function esCoordenadaWGS84Valida(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function sanitizarRumbo(heading: number | null): number | null {
  if (typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 && heading <= 360) {
    return heading;
  }
  return null;
}

function sanitizarNoNegativo(valor: number | null): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor) && valor >= 0) {
    return valor;
  }
  return null;
}

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

  const unidadIdLimpia = unidadId?.trim() || null;
  const habilitada = Boolean(activa && unidadIdLimpia && tipoUnidad);
  const intervaloSeguroMs =
    typeof intervaloMs === 'number' &&
    Number.isFinite(intervaloMs) &&
    intervaloMs >= INTERVALO_MIN_MS
      ? intervaloMs
      : INTERVALO_DEFAULT_MS;

  const ultimaPosicionRef = useRef<TelemetriaPosicionPayload | null>(null);
  const activoRef = useRef<boolean>(false);
  const solicitudSeqRef = useRef<number>(0);

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
    if (!habilitada || !unidadIdLimpia || !tipoUnidad) {
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

    const seqActual = ++solicitudSeqRef.current;

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!activoRef.current || seqActual !== solicitudSeqRef.current) {
            return;
          }

          const { latitude, longitude, heading, accuracy, speed } = position.coords;

          if (!esCoordenadaWGS84Valida(latitude, longitude)) {
            setEstado('ERROR_GPS');
            setError('Coordenadas GPS fuera de rango WGS84.');
            return;
          }

          const payload: TelemetriaPosicionPayload = {
            unidadId: unidadIdLimpia,
            tipoUnidad,
            lat: latitude,
            lng: longitude,
            timestamp: new Date().toISOString(),
            rumbo: sanitizarRumbo(heading),
            precision: sanitizarNoNegativo(accuracy),
            velocidad: sanitizarNoNegativo(speed),
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
          if (!activoRef.current || seqActual !== solicitudSeqRef.current) {
            return;
          }

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
      if (!activoRef.current || seqActual !== solicitudSeqRef.current) {
        return;
      }
      setEstado('ERROR_GPS');
      setError(err instanceof Error ? err.message : 'Error inesperado al consultar GPS.');
    }
  }, [habilitada, unidadIdLimpia, tipoUnidad, resolveSocket]);

  // Manejo de reconexión silenciosa del socket para retransmitir última posición
  useEffect(() => {
    if (!habilitada) return;
    const sock = resolveSocket();
    if (!sock) return;

    const handleConnect = () => {
      if (activoRef.current && ultimaPosicionRef.current) {
        sock.emit('telemetria:posicion', ultimaPosicionRef.current);
      }
    };

    sock.on('connect', handleConnect);
    return () => {
      sock.off('connect', handleConnect);
    };
  }, [habilitada, resolveSocket]);

  // Monitoreo proactivo de cambios en permisos de geolocalización del navegador
  useEffect(() => {
    if (!habilitada) return;
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;

    let cancelado = false;
    let permissionStatus: PermissionStatus | null = null;

    const handleStatusChange = () => {
      if (cancelado || !activoRef.current) return;
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
        if (cancelado) return;
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
      cancelado = true;
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', handleStatusChange);
      }
    };
  }, [habilitada, capturarYEmitir]);

  // Temporizador de emisión periódica en segundo plano
  useEffect(() => {
    if (!habilitada) {
      activoRef.current = false;
      solicitudSeqRef.current += 1;
      ultimaPosicionRef.current = null;
      setEstado('INACTIVO');
      setError(null);
      return;
    }

    activoRef.current = true;

    // Primera captura inmediata al activarse la misión
    capturarYEmitir();

    const timerId = setInterval(() => {
      capturarYEmitir();
    }, intervaloSeguroMs);

    return () => {
      activoRef.current = false;
      solicitudSeqRef.current += 1;
      clearInterval(timerId);
      ultimaPosicionRef.current = null;
      setEstado('INACTIVO');
    };
  }, [habilitada, intervaloSeguroMs, capturarYEmitir]);

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
