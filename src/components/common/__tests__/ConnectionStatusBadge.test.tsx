import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConnectionStatusBadge from '../ConnectionStatusBadge';

describe('Componente ConnectionStatusBadge', () => {
  it('muestra estado conectado por defecto', () => {
    render(<ConnectionStatusBadge connected={true} />);
    expect(screen.getByRole('status')).toHaveTextContent(/sincronizado/i);
  });

  it('muestra estado offline cuando connected es false', () => {
    render(<ConnectionStatusBadge connected={false} />);
    expect(screen.getByRole('status')).toHaveTextContent(/trabajando offline/i);
  });

  it('muestra contador de pendientes cuando está sincronizando o en cola', () => {
    render(<ConnectionStatusBadge connected={true} pendingCount={3} />);
    expect(screen.getByRole('status')).toHaveTextContent(/sincronizando \(3 pendientes\)/i);
  });

  it('muestra pendientes en modo offline', () => {
    render(<ConnectionStatusBadge connected={false} pendingCount={2} />);
    expect(screen.getByRole('status')).toHaveTextContent(/trabajando offline \(2 pendientes\)/i);
  });
});
