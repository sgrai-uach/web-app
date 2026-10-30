'use client';

import React, { useState, useEffect } from 'react';
import { CloudCheck, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useConnectivity } from '@/hooks/useConnectivity';
import { Button } from '@/components/ui/Button';
import styles from './TerrenoSyncCompactCard.module.css';

export function TerrenoSyncCompactCard() {
  const { status, pendientes, sincronizar } = useConnectivity();
  const [sincronizando, setSincronizando] = useState<boolean>(false);
  const [ultimoSyncMin, setUltimoSyncMin] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setUltimoSyncMin((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      await sincronizar();
      setUltimoSyncMin(0);
    } finally {
      setSincronizando(false);
    }
  };

  const esOffline = status === 'offline';
  const debeExpandirse = esOffline || pendientes > 0;

  const textoTiempo =
    ultimoSyncMin === 0 ? 'Sincronizado recién' : `Sincronizado · hace ${ultimoSyncMin} min`;

  return (
    <div className={`${styles.container} ${debeExpandirse ? styles.warningBorder : ''}`}>
      <div className={styles.compactRow}>
        <div className={styles.statusInfo}>
          {esOffline ? (
            <>
              <WifiOff size={18} color="var(--color-warning, #E65100)" aria-hidden="true" />
              <span>Sin conexión</span>
            </>
          ) : pendientes > 0 ? (
            <>
              <AlertTriangle size={18} color="var(--color-warning, #E65100)" aria-hidden="true" />
              <span>{pendientes} pendiente{pendientes > 1 ? 's' : ''} de envío</span>
            </>
          ) : (
            <>
              <CloudCheck size={18} color="var(--color-success, #2E7D32)" aria-hidden="true" />
              <span>{textoTiempo}</span>
            </>
          )}
        </div>

        <button
          type="button"
          className={styles.iconButton}
          onClick={handleSincronizar}
          disabled={sincronizando}
          title="Sincronizar ahora"
          aria-label="Sincronizar ahora"
        >
          <RefreshCw
            size={16}
            className={sincronizando ? styles.rotating : ''}
            aria-hidden="true"
          />
        </button>
      </div>

      {debeExpandirse && (
        <div className={styles.expandedArea}>
          {esOffline ? (
            <p style={{ margin: 0 }}>
              Operando en modo sin conexión. Sus acciones quedarán guardadas localmente y se enviarán automáticamente al recuperar señal celular.
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              Existen {pendientes} registro{pendientes > 1 ? 's' : ''} en cola local pendientes de confirmación en el servidor central.
            </p>
          )}
          <div style={{ alignSelf: 'flex-start', marginTop: 'var(--space-1)' }}>
            <Button
              variant="outline"
              size="sm"
              loading={sincronizando}
              onClick={handleSincronizar}
            >
              Forzar reintento
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
