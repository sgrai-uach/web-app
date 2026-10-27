'use client';

import React from 'react';
import { Shield, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { ConnectionStatusBadge } from '@/components/common/ConnectionStatusBadge';
import styles from './layout.module.css';

export default function TerrenoLayout({ children }: { children: React.ReactNode }) {
  const { usuario, logout } = useAuth();
  const { status, pendientes, sincronizar } = useConnectivity();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.logoArea}>
            <Shield size={22} color="var(--color-accent-mint)" aria-hidden="true" />
            <div>
              <div className={styles.title}>SGRAI Terreno</div>
              <div className={styles.subtitle}>Municipalidad de Valdivia</div>
            </div>
          </div>

          <div className={styles.userArea}>
            {usuario && (
              <span className={styles.userName}>{usuario.nombre.split(' ')[0]}</span>
            )}
            <button
              type="button"
              className={styles.logoutButton}
              onClick={logout}
              title="Cerrar sesión"
            >
              <LogOut size={16} aria-hidden="true" />
              <span>Salir</span>
            </button>
          </div>
        </div>

        <div className={styles.headerBottom}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>
            {usuario?.rolNombre || 'Operador Terreno'}
          </span>
          <ConnectionStatusBadge
            status={status}
            pendingCount={pendientes}
            onRetry={sincronizar}
          />
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
