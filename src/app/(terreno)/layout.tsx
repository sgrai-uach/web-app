'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { TerrenoBottomNav } from '@/components/terreno/TerrenoBottomNav';
import { useTerrenoSocket } from '@/hooks/useTerrenoSocket';
import styles from './layout.module.css';

/**
 * Rutas que se presentan a ancho completo del dispositivo (sin padding lateral del layout).
 */
const RUTAS_ANCHO_COMPLETO = [/^\/patrulla\/misiones\/[^/]+\/?$/];

export default function TerrenoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const esAnchoCompleto = RUTAS_ANCHO_COMPLETO.some((patron) => patron.test(pathname));
  useTerrenoSocket();

  return (
    <div className={styles.container}>
      <main
        className={`${styles.main} ${esAnchoCompleto ? styles.mainAnchoCompleto : ''}`.trim()}
      >
        {children}
      </main>
      <TerrenoBottomNav />
    </div>
  );
}
