'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/Button';
import styles from './PWAInstallBanner.module.css';

export function PWAInstallBanner() {
  const { puedeInstalar, instalarPWA } = usePWAInstall();

  if (!puedeInstalar) {
    return null;
  }

  return (
    <aside className={styles.banner} aria-label="Instalación de aplicación PWA">
      <div className={styles.content}>
        <div className={styles.iconBox} aria-hidden="true">
          <Download size={22} />
        </div>
        <div className={styles.textGroup}>
          <h2 className={styles.title}>Instalar SGRAI en el Dispositivo</h2>
          <p className={styles.description}>
            Agregue la aplicación a la pantalla de inicio para acceso directo y mejor rendimiento en terreno.
          </p>
        </div>
      </div>
      <div className={styles.actionWrapper}>
        <Button
          variant="primary"
          size="md"
          icon={<Download size={18} />}
          onClick={instalarPWA}
        >
          Instalar Aplicación
        </Button>
      </div>
    </aside>
  );
}

export default PWAInstallBanner;
