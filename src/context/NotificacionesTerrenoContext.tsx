'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  conectarSocket,
  unirseASalaPatrulla,
  salirDeSalaPatrulla,
  onMisionAsignada,
  onSocketConnect,
} from '@/lib/socket/socketClient';
import {
  procesarMisionAsignada,
  emitirAckLectura,
  consultarMisionesPendientes,
} from '@/services/notificacionesService';
import { activarAlertaSensorialMision } from '@/lib/utils/alertaSonora';
import { MisionAsignadaBanner } from '@/components/misiones/MisionAsignadaBanner';
import type {
  MisionAsignadaAlerta,
  MisionAsignadaPayload,
} from '@/types/notificaciones';

export interface NotificacionesTerrenoContextValue {
  alertaActiva: MisionAsignadaAlerta | null;
  descartarAlerta: () => void;
  verMision: (alerta: MisionAsignadaAlerta) => Promise<void>;
  reconciliarMisiones: () => Promise<void>;
  historialAlertas: MisionAsignadaAlerta[];
}

const NotificacionesTerrenoContext =
  createContext<NotificacionesTerrenoContextValue | null>(null);

export function useNotificacionesTerreno(): NotificacionesTerrenoContextValue {
  const ctx = useContext(NotificacionesTerrenoContext);
  if (!ctx) {
    throw new Error(
      'useNotificacionesTerreno debe utilizarse dentro de un NotificacionesTerrenoProvider'
    );
  }
  return ctx;
}

export function NotificacionesTerrenoProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { usuario, token, esPatrulla } = useAuth();
  const [alertaActiva, setAlertaActiva] = useState<MisionAsignadaAlerta | null>(null);
  const [historialAlertas, setHistorialAlertas] = useState<MisionAsignadaAlerta[]>([]);

  const reconciliandoRef = useRef(false);

  /**
   * Reconcilia las órdenes de misión pendientes cuando se recupera conectividad
   * o tras eventos de reconexión WebSocket (HU-35 §3.5).
   */
  const reconciliarMisiones = useCallback(async () => {
    if (reconciliandoRef.current) return;
    reconciliandoRef.current = true;

    try {
      const patrullaId = usuario?.unidadId || undefined;
      const pendientes = await consultarMisionesPendientes(patrullaId);

      for (const item of pendientes) {
        const alerta: MisionAsignadaAlerta = {
          notificacionId: item.notificacionId,
          misionId: item.misionId,
          codigo: item.codigoMision,
          tipoMision: item.tipoMision,
          patrullaId: item.patrullaId,
          incidenteId: item.incidenteId,
          incidenteCodigo: item.incidenteCodigo,
          incidenteFolio: item.incidenteFolio,
          tipoAfectacion: item.tipoAfectacion || item.titulo,
          direccion: item.direccion,
          prioridad: item.prioridad,
          asignadoEn: item.enviadaAt || item.creadaAt,
        };

        const { esDuplicado } = await procesarMisionAsignada(alerta);
        if (!esDuplicado) {
          activarAlertaSensorialMision();
          setAlertaActiva(alerta);
          setHistorialAlertas((prev) => [alerta, ...prev]);
        }
      }
    } finally {
      reconciliandoRef.current = false;
    }
  }, [usuario?.unidadId]);

  /**
   * Manejador de evento WebSocket `mision:asignada` (HU-35 §3.1, §3.2, §3.3).
   */
  const handleMisionAsignada = useCallback(
    async (payload: MisionAsignadaPayload) => {
      const notificacionId =
        payload.notificacionId ||
        `notif-${payload.misionId}-${Date.now()}`;

      const alerta: MisionAsignadaAlerta = {
        notificacionId,
        misionId: payload.misionId,
        codigo: payload.codigo,
        tipoMision: payload.tipoMision,
        patrullaId: payload.patrullaId || usuario?.unidadId || '',
        incidenteId: payload.incidenteId,
        incidenteCodigo: payload.incidenteCodigo,
        incidenteFolio: payload.incidenteFolio,
        tipoAfectacion: payload.tipoAfectacion,
        direccion: payload.direccion,
        prioridad: payload.prioridad || 'ALTA',
        asignadoEn: payload.asignadoEn || new Date().toISOString(),
      };

      const { esDuplicado } = await procesarMisionAsignada(alerta);

      if (!esDuplicado) {
        activarAlertaSensorialMision();
        setAlertaActiva(alerta);
        setHistorialAlertas((prev) => [alerta, ...prev]);
      }
    },
    [usuario?.unidadId]
  );

  /**
   * Descartar o cerrar el banner emergente.
   */
  const descartarAlerta = useCallback(() => {
    setAlertaActiva(null);
  }, []);

  /**
   * Acción del operador al pulsar "Ver Misión":
   * 1. Emite ACK LEIDA.
   * 2. Navega a la vista de detalle de la misión.
   * 3. Cierra el banner emergente (HU-35 §3.4).
   */
  const verMision = useCallback(
    async (alerta: MisionAsignadaAlerta) => {
      setAlertaActiva(null);
      void emitirAckLectura(alerta.notificacionId, alerta.misionId);
      router.push(`/patrulla/misiones/${alerta.misionId}`);
    },
    [router]
  );

  // Efecto principal para suscripción y eventos de red / socket
  useEffect(() => {
    if (!esPatrulla || !usuario?.unidadId) {
      return;
    }

    const patrullaId = usuario.unidadId;
    conectarSocket(token || undefined);
    unirseASalaPatrulla(patrullaId);

    // Escucha de misiones asignadas
    const unsuscribeMision = onMisionAsignada(handleMisionAsignada);

    // Reconciliar al conectar o reconectar el WebSocket
    const unsubscribeConnect = onSocketConnect(() => {
      void reconciliarMisiones();
    });

    // Reconciliar al volver a tener conexión de red (evento 'online' del navegador)
    const handleOnline = () => {
      void reconciliarMisiones();
    };
    window.addEventListener('online', handleOnline);

    // Reconciliación inicial al montar
    void reconciliarMisiones();

    return () => {
      unsuscribeMision();
      unsubscribeConnect();
      window.removeEventListener('online', handleOnline);
      salirDeSalaPatrulla(patrullaId);
    };
  }, [esPatrulla, usuario?.unidadId, token, handleMisionAsignada, reconciliarMisiones]);

  return (
    <NotificacionesTerrenoContext.Provider
      value={{
        alertaActiva,
        descartarAlerta,
        verMision,
        reconciliarMisiones,
        historialAlertas,
      }}
    >
      {children}
      <MisionAsignadaBanner
        alerta={alertaActiva}
        onVerMision={verMision}
        onCerrar={descartarAlerta}
      />
    </NotificacionesTerrenoContext.Provider>
  );
}

