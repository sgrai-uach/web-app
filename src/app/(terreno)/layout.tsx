'use client';

import React from 'react';
import { TerrenoBottomNav } from '@/components/terreno/TerrenoBottomNav';
import styles from './layout.module.css';

export default function TerrenoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.container}>
      <main className={styles.main}>{children}</main>
      <TerrenoBottomNav />
    </div>
  );
}
