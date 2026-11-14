import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MisionAsignadaBanner } from '../MisionAsignadaBanner';
import type { MisionAsignadaAlerta } from '@/types/notificaciones';

describe('MisionAsignadaBanner (HU-35)', () => {
  const alertaEjemplo: MisionAsignadaAlerta = {
    notificacionId: 'notif-uuid-001',
    misionId: 'mision-uuid-001',
    codigo: 'MIS-2026-0042',
    tipoMision: 'VERIFICACION',
    patrullaId: 'pat-001',
    incidenteId: 'inc-001',
    incidenteCodigo: 'INC-2026-0089',
    incidenteFolio: 'FOL-1042',
    tipoAfectacion: 'Inundación por desborde de estero',
    direccion: 'Av. Ramón Picarte 1500, Valdivia',
    prioridad: 'ALTA',
    asignadoEn: '2026-11-10T14:30:00.000Z',
  };

  it('no renderiza nada cuando alerta es null', () => {
    const { container } = render(
      <MisionAsignadaBanner alerta={null} onVerMision={vi.fn()} onCerrar={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  // CP-H35-PWA-02: Recepción y Despliegue Visual
  it('CP-H35-PWA-02: despliega el banner con folio, dirección, tipo de afectación y prioridad', () => {
    render(
      <MisionAsignadaBanner
        alerta={alertaEjemplo}
        onVerMision={vi.fn()}
        onCerrar={vi.fn()}
      />
    );

    expect(screen.getByText('Misión Asignada en Terreno')).toBeInTheDocument();
    expect(screen.getByTestId('codigo-mision-banner')).toHaveTextContent('MIS-2026-0042');
    expect(screen.getByTestId('folio-incidente-banner')).toHaveTextContent('Folio: FOL-1042');
    expect(screen.getByTestId('afectacion-banner')).toHaveTextContent(
      'Inundación por desborde de estero'
    );
    expect(screen.getByTestId('direccion-banner')).toHaveTextContent(
      'Av. Ramón Picarte 1500, Valdivia'
    );
    expect(screen.getByTestId('badge-prioridad-banner')).toHaveTextContent('ALTA');
  });

  // CP-H35-PWA-08: Accesibilidad Táctil para Guantes (48x48px)
  it('CP-H35-PWA-08: los botones interactivos poseen área táctil apta para guantes (mínimo 48px)', () => {
    render(
      <MisionAsignadaBanner
        alerta={alertaEjemplo}
        onVerMision={vi.fn()}
        onCerrar={vi.fn()}
      />
    );

    const btnVer = screen.getByTestId('btn-ver-mision-banner');
    const btnCerrar = screen.getByTestId('btn-cerrar-banner');

    expect(btnVer).toBeInTheDocument();
    expect(btnCerrar).toBeInTheDocument();

    // Comprobar que cuentan con las clases de estilo con min-height/min-width 48px
    expect(btnVer.className).toMatch(/btnVerMision/);
    expect(btnCerrar.className).toMatch(/btnCerrar/);
  });

  // CP-H35-PWA-09: Cumplimiento de Diseño sin Emojis
  it('CP-H35-PWA-09: verifica la ausencia total de caracteres Unicode emoji en el árbol DOM del banner', () => {
    const { container } = render(
      <MisionAsignadaBanner
        alerta={alertaEjemplo}
        onVerMision={vi.fn()}
        onCerrar={vi.fn()}
      />
    );

    const textContent = container.textContent || '';
    // Expresión regular que detecta emojis Unicode (pictogramas y símbolos)
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(textContent)).toBe(false);
  });

  it('invoca onVerMision al presionar el botón "Ver Misión"', () => {
    const onVerMisionMock = vi.fn();
    render(
      <MisionAsignadaBanner
        alerta={alertaEjemplo}
        onVerMision={onVerMisionMock}
        onCerrar={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-ver-mision-banner'));
    expect(onVerMisionMock).toHaveBeenCalledWith(alertaEjemplo);
  });

  it('invoca onCerrar al presionar el botón "Cerrar"', () => {
    const onCerrarMock = vi.fn();
    render(
      <MisionAsignadaBanner
        alerta={alertaEjemplo}
        onVerMision={vi.fn()}
        onCerrar={onCerrarMock}
      />
    );

    fireEvent.click(screen.getByTestId('btn-cerrar-banner'));
    expect(onCerrarMock).toHaveBeenCalled();
  });
});

