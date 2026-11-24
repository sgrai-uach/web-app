'use client';

import React, { Suspense } from 'react';
import { MisionesBandejaView } from '@/components/misiones/MisionesBandejaView';

export default function PatrullaMisionesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          Cargando misiones...
        </div>
      }
    >
      <MisionesBandejaView tipoUnidad="patrulla" />
    </Suspense>
  );
}
