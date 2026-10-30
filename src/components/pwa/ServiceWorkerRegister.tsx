'use client';

import { useEffect } from 'react';

/**
 * Componente cliente encargado de registrar el Service Worker oficial
 * de la aplicación de terreno (PWA) de la Municipalidad de Valdivia.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.serviceWorker?.register === 'function'
    ) {
      const registrar = () => {
        navigator.serviceWorker
          .register('/terreno/sw.js', { scope: '/terreno' })
          .then((registration) => {
            if (process.env.NODE_ENV !== 'production') {
              console.log('[PWA] Service Worker registrado exitosamente. Alcance:', registration.scope);
            }
          })
          .catch((error) => {
            console.warn('[PWA] No se pudo registrar el Service Worker:', error);
          });
      };

      if (document.readyState === 'complete') {
        registrar();
      } else {
        window.addEventListener('load', registrar, { once: true });
      }
    }
  }, []);

  return null;
}

export default ServiceWorkerRegister;
