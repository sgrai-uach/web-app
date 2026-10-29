'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UNIFIED_LOGIN_PATH } from '@/proxy';
import { TerrenoWelcomeBanner } from '@/components/terreno/TerrenoWelcomeBanner';
import { TerrenoResumenOperativo } from '@/components/terreno/TerrenoResumenOperativo';
import { TerrenoModulosGrid } from '@/components/terreno/TerrenoModulosGrid';

export default function TerrenoHomePage() {
  const { autenticado, cargando } = useAuth();

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
      <TerrenoWelcomeBanner />
      <TerrenoResumenOperativo />
      <TerrenoModulosGrid />
    </div>
  );
}
