'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Compass, HardHat, RefreshCw, Home } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import styles from './TerrenoBottomNav.module.css';

export function TerrenoBottomNav() {
  const pathname = usePathname() || '/';
  const { esCuadrilla, unidadActiva } = useAuth();
  const { pendientes, sincronizar, status } = useConnectivity();

  const esRutaInicio = pathname === '/' || pathname === '/terreno';
  const esRutaMisiones =
    pathname.startsWith('/patrulla') || pathname.startsWith('/cuadrilla');

  const misionesHref = esCuadrilla ? '/cuadrilla/misiones' : '/patrulla/misiones';
  const portalPrincipalHref = '/';
  const misionesLabel = !unidadActiva
    ? 'Historial'
    : esCuadrilla
    ? 'Faenas'
    : 'Misiones';
  const MisionesIcon = esCuadrilla ? HardHat : Compass;

  return (
    <nav className={styles.bottomNav} aria-label="Navegación principal de terreno">
      <ul className={styles.navList}>
        <li className={styles.navItem}>
          <Link
            href="/"
            className={`${styles.navLink} ${esRutaInicio ? styles.navLinkActive : ''}`.trim()}
            aria-current={esRutaInicio ? 'page' : undefined}
          >
            <span className={styles.iconWrapper} aria-hidden="true">
              <LayoutGrid size={20} />
            </span>
            <span className={styles.label}>Inicio</span>
          </Link>
        </li>

        <li className={styles.navItem}>
          <Link
            href={misionesHref}
            className={`${styles.navLink} ${esRutaMisiones ? styles.navLinkActive : ''}`.trim()}
            aria-current={esRutaMisiones ? 'page' : undefined}
          >
            <span className={styles.iconWrapper} aria-hidden="true">
              <MisionesIcon size={20} />
            </span>
            <span className={styles.label}>{misionesLabel}</span>
          </Link>
        </li>

        <li className={styles.navItem}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => void sincronizar()}
            aria-label={
              pendientes > 0
                ? `Sincronizar cola local (${pendientes} pendientes)`
                : 'Sincronizar estado con servidor'
            }
            title={
              status === 'offline'
                ? 'Sin conexión a internet. Se sincronizará al recuperar red.'
                : 'Sincronizar operaciones pendientes'
            }
          >
            <span className={styles.iconWrapper} aria-hidden="true">
              <RefreshCw size={20} />
              {pendientes > 0 && (
                <span className={styles.badgeCount}>{pendientes}</span>
              )}
            </span>
            <span className={styles.label}>Sincronizar</span>
          </button>
        </li>

        <li className={styles.navItem}>
          <a href={portalPrincipalHref} className={styles.navLink}>
            <span className={styles.iconWrapper} aria-hidden="true">
              <Home size={20} />
            </span>
            <span className={styles.label}>Portal SGRAI</span>
          </a>
        </li>
      </ul>
    </nav>
  );
}

export default TerrenoBottomNav;
