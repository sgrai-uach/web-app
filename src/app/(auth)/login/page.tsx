'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { UNIFIED_LOGIN_PATH } from '@/proxy';
import styles from './LoginPage.module.css';

export default function LoginRedirectPage() {
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

    let loginHost = '';
    if (typeof window !== 'undefined' && window.location.port === '3002') {
      loginHost = `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    const destino = `${loginHost}${UNIFIED_LOGIN_PATH}?returnUrl=${encodeURIComponent('/terreno')}`;
    router.push(destino);
    try {
      if (typeof window !== 'undefined' && window.location) {
        window.location.assign(destino);
      }
    } catch {
      // Ignorado en pruebas unitarias
    }
  }, [autenticado, usuario, cargando, router]);

  return (
    <div className={styles.container}>
      <main className={styles.mainContent}>
        <div className={styles.card}>
          <div className={styles.cardHeaderBanner}>
            <span className={styles.brandTitle}>SGRAI</span>
            <span className={styles.brandDivider}>|</span>
            <span className={styles.brandSubtitle}>DGRD VALDIVIA</span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.subtitle} role="status">
              Redirigiendo al portal de autenticación institucional...
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
