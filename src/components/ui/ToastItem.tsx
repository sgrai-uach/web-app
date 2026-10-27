'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import Button from './Button';
import type { ToastMessage } from './Toast';

interface ToastItemProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const TYPE_BORDER_MAP: Record<string, string> = {
  success: 'var(--color-accent-mint, #4FAE9B)',
  error: 'var(--color-danger, #D32F2F)',
  warning: 'var(--color-warning, #E65100)',
  info: 'var(--color-primary-teal, #1B6F7D)',
};

export default function ToastItem({ toast, onRemove }: ToastItemProps) {
  const borderColor = TYPE_BORDER_MAP[toast.type] || 'var(--color-primary-teal, #1B6F7D)';

  const renderIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={20} color="var(--color-accent-mint, #4FAE9B)" />;
      case 'error':
        return <AlertCircle size={20} color="var(--color-danger, #D32F2F)" />;
      case 'warning':
        return <AlertTriangle size={20} color="var(--color-warning, #E65100)" />;
      case 'info':
      default:
        return <Info size={20} color="var(--color-primary-teal, #1B6F7D)" />;
    }
  };

  return (
    <div
      role="alert"
      style={{
        pointerEvents: 'auto',
        backgroundColor: 'var(--color-white, #FFFFFF)',
        color: 'var(--color-text-dark, #2B2B2B)',
        borderLeft: `6px solid ${borderColor}`,
        borderTop: '1px solid var(--border-color-neutral, #DFE3E8)',
        borderRight: '1px solid var(--border-color-neutral, #DFE3E8)',
        borderBottom: '1px solid var(--border-color-neutral, #DFE3E8)',
        borderRadius: 0,
        padding: '0.875rem 1rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>
        {renderIcon()}
      </div>
      <div style={{ flex: 1 }}>
        {toast.title && (
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: borderColor, marginBottom: '0.2rem' }}>
            {toast.title}
          </div>
        )}
        <div style={{ fontSize: '0.8125rem', lineHeight: '1.4', color: 'var(--color-text-dark, #2B2B2B)' }}>
          {toast.message}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onRemove(toast.id)}
        aria-label="Cerrar notificación"
        style={{
          color: 'var(--color-charcoal, #3B3F45)',
          minHeight: 'auto',
          padding: '4px',
        }}
      >
        <X size={18} />
      </Button>
    </div>
  );
}
