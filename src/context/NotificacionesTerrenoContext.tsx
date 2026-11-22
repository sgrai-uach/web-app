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
  unirseASalaCuadrilla,
  salirDeSalaCuadrilla,
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
  const { usuario, token, esPatrulla, esCuadrilla } = useAuth();
  const [alertaActiva, setAlertaActiva] = useState<MisionAsignadaAlerta | null>(null);
  const [historialAlertas, setHistorialAlertas] = useState<MisionAsignadaAlerta[]>([]);

  const reconciliandoRef = useRef(false);

  /**
   * Reconcilia las órdenes de misión pendientes cuando se recupera conectividad
   * o tras eventos de reconexión WebSocket (HU-35 §3.5).
   */
  const reconciliarMisiones = useCallback(async () => {
    if (!esPatrulla || reconciliandoRef.current) return;
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
          cuadrillaId: null,
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
  }, [esPatrulla, usuario?.unidadId]);

  /**
   * Manejador de evento WebSocket `mision:asignada` (HU-35 / H40).
   */
  const handleMisionAsignada = useCallback(
    async (payload: MisionAsignadaPayload) => {
      const notificacionId =
        payload.notificacionId ||
        `notif-${payload.misionId}-${Date.now()}`;

      const esAsignacionCuadrilla =
        esCuadrilla ||
        payload.tipoMision === 'ATENCION_CUADRILLA' ||
        Boolean(payload.cuadrillaId);

      const alerta: MisionAsignadaAlerta = {
        notificacionId,
        misionId: payload.misionId,
        codigo: payload.codigo,
        tipoMision: payload.tipoMision,
        patrullaId:
          payload.patrullaId ?? (!esAsignacionCuadrilla ? usuario?.unidadId || '' : null),
        cuadrillaId:
          payload.cuadrillaId ?? (esAsignacionCuadrilla ? usuario?.unidadId || '' : null),
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
    [esCuadrilla, usuario?.unidadId]
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
   * 2. Navega a la vista de detalle de la misión según el rol/tipo.
   * 3. Cierra el banner emergente (HU-35 §3.4 / H40).
   */
  const verMision = useCallback(
    async (alerta: MisionAsignadaAlerta) => {
      setAlertaActiva(null);
      void emitirAckLectura(alerta.notificacionId, alerta.misionId);
      const esDestinoCuadrilla =
        esCuadrilla || alerta.tipoMision === 'ATENCION_CUADRILLA';
      const rutaDestino = esDestinoCuadrilla
        ? `/cuadrilla/misiones/${alerta.misionId}`
        : `/patrulla/misiones/${alerta.misionId}`;
      router.push(rutaDestino);
    },
    [esCuadrilla, router]
  );

  // Efecto principal para suscripción y eventos de red / socket
  useEffect(() => {
    if ((!esPatrulla && !esCuadrilla) || !usuario?.unidadId) {
      return;
    }

    const unidadId = usuario.unidadId;
    conectarSocket(token || undefined);
    if (esCuadrilla) {
      unirseASalaCuadrilla(unidadId);
    } else {
      unirseASalaPatrulla(unidadId);
    }

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

    // Listener para simulación de eventos en entorno de desarrollo / pruebas
    const handleSimularMision = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<MisionAsignadaPayload>>;
      const payload: MisionAsignadaPayload = {
        notificacionId: crypto.randomUUID(),
        misionId: '60000000-0000-4000-8000-000000000001',
        codigo: 'MIS-2026-0042',
        tipoMision: esCuadrilla ? 'ATENCION_CUADRILLA' : 'VERIFICACION',
        patrullaId: esCuadrilla ? null : usuario?.unidadId || 'patrulla-demo-01',
        cuadrillaId: esCuadrilla ? usuario?.unidadId || 'cuadrilla-demo-01' : null,
        incidenteId: 'a0000000-0000-4000-8000-000000000001',
        incidenteCodigo: 'INC-2026-0089',
        incidenteFolio: 'FOL-1042',
        tipoAfectacion: 'Inundación por desborde de estero',
        direccion: 'Av. Costanera Arturo Prat 1200, Valdivia',
        prioridad: 'ALTA',
        asignadoEn: new Date().toISOString(),
        ...(customEvent.detail || {}),
      };
      void handleMisionAsignada(payload);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('sgrai:simular-mision', handleSimularMision);
      (
        window as unknown as {
          __SGRAI_SIMULAR_MISION_ASIGNADA__?: (
            datos?: Partial<MisionAsignadaPayload>
          ) => void;
        }
      ).__SGRAI_SIMULAR_MISION_ASIGNADA__ = (datos) => {
        window.dispatchEvent(
          new CustomEvent('sgrai:simular-mision', { detail: datos })
        );
      };
    }

    return () => {
      unsuscribeMision();
      unsubscribeConnect();
      window.removeEventListener('online', handleOnline);
      if (typeof window !== 'undefined') {
        window.removeEventListener('sgrai:simular-mision', handleSimularMision);
      }
      if (esCuadrilla) {
        salirDeSalaCuadrilla(unidadId);
      } else {
        salirDeSalaPatrulla(unidadId);
      }
    };
  }, [
    esPatrulla,
    esCuadrilla,
    usuario?.unidadId,
    token,
    handleMisionAsignada,
    reconciliarMisiones,
  ]);

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

