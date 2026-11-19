'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import ToastItem from './ToastItem';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  durationMs?: number;
  dedupKey?: string;
}

export interface ToastMessage extends ToastOptions {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  showSuccess: (message: string, title?: string, options?: ToastOptions) => void;
  showError: (message: string, title?: string, options?: ToastOptions) => void;
  showWarning: (message: string, title?: string, options?: ToastOptions) => void;
  showInfo: (message: string, title?: string, options?: ToastOptions) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser usado dentro de un ToastProvider');
  }
  return context;
}

export function useToastOptional(): ToastContextValue | null {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const recentToastsRef = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, durationMs = 5000, dedupKey }: Omit<ToastMessage, 'id'>) => {
      const fingerprint = dedupKey || `${type}|${title || ''}|${message}`;
      const ahora = Date.now();
      const ultimaVez = recentToastsRef.current.get(fingerprint);
      if (ultimaVez && ahora - ultimaVez < 3000) {
        return;
      }
      recentToastsRef.current.set(fingerprint, ahora);

      const id = `${ahora}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastMessage = { id, type, title, message, durationMs, dedupKey };
      setToasts((prev) => {
        const yaVisible = prev.some(
          (t) => (t.dedupKey || `${t.type}|${t.title || ''}|${t.message}`) === fingerprint
        );
        return yaVisible ? prev : [...prev, newToast];
      });
      if (durationMs > 0) setTimeout(() => removeToast(id), durationMs);
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (m: string, t = 'Operación exitosa', opts?: ToastOptions) =>
      showToast({ type: 'success', title: t, message: m, ...opts }),
    [showToast]
  );
  const showError = useCallback(
    (m: string, t = 'Error', opts?: ToastOptions) =>
      showToast({ type: 'error', title: t, message: m, durationMs: 7000, ...opts }),
    [showToast]
  );
  const showWarning = useCallback(
    (m: string, t = 'Atención', opts?: ToastOptions) =>
      showToast({ type: 'warning', title: t, message: m, durationMs: 6000, ...opts }),
    [showToast]
  );
  const showInfo = useCallback(
    (m: string, t = 'Información', opts?: ToastOptions) =>
      showToast({ type: 'info', title: t, message: m, ...opts }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo, removeToast }}>
      {children}
      <div
        id="toast-container"
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxWidth: '420px',
          width: 'calc(100vw - 2rem)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export default ToastProvider;
