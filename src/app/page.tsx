'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Heading } from '@/components/ui/Heading';
import { UNIFIED_LOGIN_PATH } from '@/proxy';

export default function Home() {
  const router = useRouter();
  const { autenticado, usuario, cargando } = useAuth();

  useEffect(() => {
    if (cargando) return;

    if (autenticado && usuario) {
      if (usuario.rolCodigo === 'PATRULLA_VERIFICADORA') {
        router.push('/patrulla/misiones');
        return;
      }
      if (usuario.rolCodigo === 'DELEGADO_CUADRILLA') {
        router.push('/cuadrilla/misiones');
        return;
      }
    }

    const destino = `${UNIFIED_LOGIN_PATH}?returnUrl=${encodeURIComponent('/terreno')}`;
    try {
      if (typeof window !== 'undefined' && window.location) {
        window.location.assign(destino);
      }
    } catch {
      // Ignorado en pruebas unitarias
    }
  }, [autenticado, usuario, cargando, router]);

  return (
    <main
      style={{
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-light)',
      }}
    >
      <Heading variant="h1" align="center">
        SGRAI Terreno — Municipalidad de Valdivia
      </Heading>
    </main>
  );
}
