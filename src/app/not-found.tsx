'use client';

import React from 'react';
import { FileQuestion, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrapper} aria-hidden="true">
          <FileQuestion size={32} />
        </div>

        <span className={styles.codeBadge}>ERROR 404</span>

        <h1 className={styles.title}>Página no encontrada</h1>

        <p className={styles.description}>
          La dirección a la que intenta acceder no existe, fue trasladada o no se encuentra disponible.
        </p>

        <div className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            href="/"
            fullWidth
            icon={<Home size={18} />}
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    </main>
  );
}
