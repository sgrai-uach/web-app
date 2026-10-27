'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import ToastItem from './ToastItem';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, durationMs = 5000 }: Omit<ToastMessage, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastMessage = { id, type, title, message, durationMs };
      setToasts((prev) => [...prev, newToast]);
      if (durationMs > 0) setTimeout(() => removeToast(id), durationMs);
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (m: string, t = 'Operación exitosa') => showToast({ type: 'success', title: t, message: m }),
    [showToast]
  );
  const showError = useCallback(
    (m: string, t = 'Error') => showToast({ type: 'error', title: t, message: m, durationMs: 7000 }),
    [showToast]
  );
  const showWarning = useCallback(
    (m: string, t = 'Atención') => showToast({ type: 'warning', title: t, message: m, durationMs: 6000 }),
    [showToast]
  );
  const showInfo = useCallback(
    (m: string, t = 'Información') => showToast({ type: 'info', title: t, message: m }),
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
