'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Compass, HardHat, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './TerrenoBottomNav.module.css';

export function TerrenoBottomNav() {
  const pathname = usePathname() || '/';
  const { esCuadrilla, unidadActiva } = useAuth();

  const esRutaInicio = pathname === '/' || pathname === '/terreno';
  const esRutaMisiones =
    pathname.startsWith('/patrulla') || pathname.startsWith('/cuadrilla');
  const esRutaPerfil = pathname.startsWith('/perfil');

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
          <Link
            href="/perfil"
            className={`${styles.navLink} ${esRutaPerfil ? styles.navLinkActive : ''}`.trim()}
            aria-current={esRutaPerfil ? 'page' : undefined}
          >
            <span className={styles.iconWrapper} aria-hidden="true">
              <User size={20} />
            </span>
            <span className={styles.label}>Perfil</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export default TerrenoBottomNav;
