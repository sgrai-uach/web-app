'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UNIFIED_LOGIN_PATH } from '@/proxy';
import { TerrenoWelcomeBanner } from '@/components/terreno/TerrenoWelcomeBanner';
import { TerrenoSyncCompactCard } from '@/components/terreno/TerrenoSyncCompactCard';
import { TerrenoResumenOperativo } from '@/components/terreno/TerrenoResumenOperativo';
import { TerrenoSiguienteMision } from '@/components/terreno/TerrenoSiguienteMision';
import { PWAInstallBanner } from '@/components/pwa/PWAInstallBanner';
import { NuevaMisionBanner } from '@/components/misiones/NuevaMisionBanner';
import { useMisionesSocket } from '@/hooks/useMisionesSocket';

export default function TerrenoHomePage() {
  const { autenticado, cargando, esPatrulla } = useAuth();
  const { ultimaMisionAsignada, descartarUltimaMision } = useMisionesSocket({
    habilitado: autenticado,
  });

  useEffect(() => {
    if (cargando) return;

    if (!autenticado) {
      const destino = `${UNIFIED_LOGIN_PATH}?returnUrl=${encodeURIComponent('/terreno')}`;
      try {
        if (typeof window !== 'undefined' && window.location) {
          window.location.assign(destino);
        }
      } catch {
        // Ignorado en pruebas unitarias
      }
    }
  }, [autenticado, cargando]);

  if (cargando) {
    return (
      <div
        style={{
          padding: 'var(--space-6, 24px)',
          textAlign: 'center',
          color: 'var(--color-text-muted, #5F676E)',
        }}
      >
        Cargando plataforma operativa de terreno...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5, 20px)',
        width: '100%',
      }}
    >
      {ultimaMisionAsignada && (
        <NuevaMisionBanner
          codigoMision={ultimaMisionAsignada.codigo}
          misionId={ultimaMisionAsignada.misionId}
          urlDetalle={
            esPatrulla
              ? `/terreno/patrulla/misiones/${ultimaMisionAsignada.misionId}`
              : `/terreno/cuadrilla/misiones/${ultimaMisionAsignada.misionId}`
          }
          alCerrar={descartarUltimaMision}
        />
      )}
      <TerrenoWelcomeBanner />
      <TerrenoSyncCompactCard />
      <PWAInstallBanner />
      <TerrenoResumenOperativo />
      <TerrenoSiguienteMision />
    </div>
  );
}
