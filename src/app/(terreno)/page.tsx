'use client';

import React from 'react';
import { Users, ShieldCheck, LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { UNIFIED_LOGIN_PATH } from '@/proxy';
import { setAuthCookie } from '@/lib/utils/cookieUtils';
import { Button } from '@/components/ui/Button';
import { TerrenoWelcomeBanner } from '@/components/terreno/TerrenoWelcomeBanner';
import { TerrenoSyncCompactCard } from '@/components/terreno/TerrenoSyncCompactCard';
import { TerrenoResumenOperativo } from '@/components/terreno/TerrenoResumenOperativo';
import { TerrenoSiguienteMision } from '@/components/terreno/TerrenoSiguienteMision';
import { PWAInstallBanner } from '@/components/pwa/PWAInstallBanner';

export default function TerrenoHomePage() {
  const { autenticado, cargando, recargarSesion } = useAuth();

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

  if (!autenticado) {
    let loginHost = '';
    if (typeof window !== 'undefined' && window.location.port === '3002') {
      loginHost = `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    const destinoLogin = `${loginHost}${UNIFIED_LOGIN_PATH}?returnUrl=${encodeURIComponent('/terreno')}`;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4, 16px)',
          width: '100%',
          maxWidth: '520px',
          margin: '0 auto',
          padding: 'var(--space-4, 16px)',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-white)',
            border: '1px solid var(--color-border)',
            borderTop: '4px solid var(--color-primary-teal)',
            padding: 'var(--space-5, 20px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4, 16px)',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--color-primary-teal)',
                margin: '0 0 var(--space-2, 8px) 0',
              }}
            >
              SGRAI Terreno | Acceso Operativo
            </h1>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              Seleccione su rol de terreno para ingresar a la plataforma operativa:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon={<Users size={20} />}
              onClick={async () => {
                setAuthCookie('dev-cuadrilla-token');
                await recargarSesion();
              }}
            >
              Ingresar como Delegado de Cuadrilla
            </Button>

            <Button
              variant="teal"
              size="lg"
              fullWidth
              icon={<ShieldCheck size={20} />}
              onClick={async () => {
                setAuthCookie('dev-patrulla-token');
                await recargarSesion();
              }}
            >
              Ingresar como Patrulla Verificadora
            </Button>

            <Button
              variant="outline"
              size="md"
              fullWidth
              icon={<LogIn size={18} />}
              href={destinoLogin}
            >
              Iniciar sesión institucional (Web / Puerto 3000)
            </Button>
          </div>
        </div>
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
      <TerrenoSyncCompactCard />
      <PWAInstallBanner />
      <TerrenoResumenOperativo />
      <TerrenoSiguienteMision />
    </div>
  );
}
