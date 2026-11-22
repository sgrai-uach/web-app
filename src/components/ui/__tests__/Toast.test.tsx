import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast, useToastOptional } from '../Toast';

function TestConsumer() {
  const { showSuccess, showWarning } = useToast();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          showSuccess('Misión aceptada exitosamente.', 'Asignación aceptada', {
            dedupKey: 'aceptar-mis-1',
          })
        }
      >
        Emitir Éxito
      </button>
      <button
        type="button"
        onClick={() =>
          showWarning('Guardado en cola offline.', 'Guardado sin conexión')
        }
      >
        Emitir Aviso
      </button>
    </div>
  );
}

function OptionalConsumer() {
  const toast = useToastOptional();
  return <span data-testid="toast-optional">{toast ? 'presente' : 'nulo'}</span>;
}

describe('ToastProvider deduplication (sgrai-pwa)', () => {
  it('evita apilar toasts duplicados por dedupKey o huella en ventana de 3 segundos', () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    const btnExito = screen.getByRole('button', { name: 'Emitir Éxito' });
    const btnAviso = screen.getByRole('button', { name: 'Emitir Aviso' });

    act(() => {
      btnExito.click();
      btnExito.click();
      btnExito.click();
      btnAviso.click();
      btnAviso.click();
    });

    expect(screen.getAllByText('Misión aceptada exitosamente.')).toHaveLength(1);
    expect(screen.getAllByText('Guardado en cola offline.')).toHaveLength(1);

    vi.useRealTimers();
  });

  it('useToastOptional retorna null fuera de ToastProvider sin lanzar error', () => {
    render(<OptionalConsumer />);
    expect(screen.getByTestId('toast-optional')).toHaveTextContent('nulo');
  });
});
