'use client';

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [puedeInstalar, setPuedeInstalar] = useState<boolean>(false);
  const [estaInstalada, setEstaInstalada] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detectar si la aplicación ya se ejecuta en modo standalone (instalada)
    const esStandalone =
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches) ||
      (window.navigator as unknown as { standalone?: boolean })?.standalone === true;

    if (esStandalone) {
      setEstaInstalada(true);
      setPuedeInstalar(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevenir el infobar automático por defecto para controlar la experiencia
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPuedeInstalar(true);
    };

    const handleAppInstalled = () => {
      setEstaInstalada(true);
      setPuedeInstalar(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const instalarPWA = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setEstaInstalada(true);
        setPuedeInstalar(false);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PWA] Error al disparar el instalador:', err);
      return false;
    }
  }, [deferredPrompt]);

  return {
    puedeInstalar,
    estaInstalada,
    instalarPWA,
  };
}

export default usePWAInstall;
