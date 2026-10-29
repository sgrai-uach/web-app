'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Compass, HardHat, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './TerrenoBottomNav.module.css';

export function TerrenoBottomNav() {
  const pathname = usePathname() || '/';
  const { esCuadrilla, unidadActiva, logout } = useAuth();

  const esRutaInicio = pathname === '/' || pathname === '/terreno';
  const esRutaMisiones =
    pathname.startsWith('/patrulla') || pathname.startsWith('/cuadrilla');

  const misionesHref = esCuadrilla ? '/cuadrilla/misiones' : '/patrulla/misiones';
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
            onClick={logout}
            title="Cerrar sesión"
          >
            <span className={styles.iconWrapper} aria-hidden="true">
              <LogOut size={20} />
            </span>
            <span className={styles.label}>Salir</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default TerrenoBottomNav;
