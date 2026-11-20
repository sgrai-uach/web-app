import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrevencionMisionCard } from '../PrevencionMisionCard';
import type { MisionLocal } from '@/types/offline';

describe('PrevencionMisionCard (HU-33)', () => {
  const misionPrevencionCompleta: MisionLocal = {
    id: 'mis-prev-1',
    incidenteId: '',
    codigoIncidente: 'MIS-PREV-001',
    tipoMision: 'PREVENCION',
    tipologia: 'Reforzamiento de ribera preventiva',
    prioridad: 'ALTA',
    estado: 'DESPACHADA',
    direccion: 'Av. Picarte 2340',
    coordenadas: { lat: -39.8142, lng: -73.2459 },
    fechaDespacho: '2026-11-19T14:00:00Z',
    actualizadoEn: '2026-11-19T14:00:00Z',
    sincronizacionPendiente: false,
    datosAdicionales: {
      eventoPrevencion: {
        id: 'ev-1',
        codigo: 'EVP-2026-10',
        nombre: 'Operativo Preventivo Invierno Sector Barrios Bajos',
        estado: 'EN_EJECUCION',
        prioridad: 'ALTA',
        delegacionNombre: 'Delegación Centro-Sur',
        sector: 'Barrios Bajos',
        direccionTexto: 'Esquina Pérez Rosales con Arturo Prat',
      },
      puntoCritico: {
        id: 'pc-12',
        codigo: 'PC-012',
        nombre: 'Paso bajo nivel Barrios Bajos',
        tipoRiesgo: 'Anegamiento recurrente',
        descripcion: 'Limpieza de sumideros y posicionamiento de motobomba.',
      },
      recursosPrevencion: [
        {
          id: 'epr-1',
          recursoId: 'rec-moto-1',
          nombre: 'Motobomba Honda WB30XT',
          esIndividual: true,
          cantidadAsignada: 1,
          estadoRecurso: 'ASIGNADO',
          misionId: 'mis-prev-1',
        },
        {
          id: 'epr-2',
          recursoId: 'rec-saco-2',
          nombre: 'Sacos de arena',
          esIndividual: false,
          cantidadAsignada: 40,
          unidad: 'sacos',
          estadoRecurso: 'BAJO_STOCK',
          misionId: 'mis-prev-1',
        },
      ],
      recursosEventoPrevencion: [
        {
          id: 'epr-3',
          recursoId: 'rec-cono-3',
          nombre: 'Conos viales',
          esIndividual: false,
          cantidadAsignada: 12,
          misionId: 'mis-prev-otra',
        },
      ],
    },
  };

  it('muestra evento preventivo, punto crítico, botones de mapa y recursos trazados distinguiendo activos e insumos', () => {
    const onVerMapa = vi.fn();
    const { container } = render(
      <PrevencionMisionCard
        mision={misionPrevencionCompleta}
        esOffline={false}
        onVerMapa={onVerMapa}
      />
    );

    expect(screen.getByTestId('prevencion-mision-card')).toBeInTheDocument();
    expect(
      screen.getByText(/EVP-2026-10 — Operativo Preventivo Invierno Sector Barrios Bajos/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Delegación Centro-Sur')).toBeInTheDocument();
    expect(screen.getByText(/Barrios Bajos — Esquina Pérez Rosales/i)).toBeInTheDocument();
    expect(screen.getByText(/PC-012 — Paso bajo nivel Barrios Bajos/i)).toBeInTheDocument();
    expect(screen.getByText('Anegamiento recurrente')).toBeInTheDocument();

    expect(screen.getByText('2 recursos')).toBeInTheDocument();
    expect(screen.getByText('Motobomba Honda WB30XT')).toBeInTheDocument();
    expect(screen.getByText('Activo individual')).toBeInTheDocument();
    expect(screen.getByText('1 unidad')).toBeInTheDocument();
    expect(screen.getAllByText('Asignado').length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText('Sacos de arena')).toBeInTheDocument();
    expect(screen.getByText('Insumo a granel')).toBeInTheDocument();
    expect(screen.getByText('40 sacos')).toBeInTheDocument();
    expect(screen.getByText('Bajo stock')).toBeInTheDocument();

    expect(screen.getByTestId('otros-recursos-evento')).toHaveTextContent(
      /1 recurso adicional asignado/i
    );

    fireEvent.click(screen.getByRole('button', { name: /Ver punto crítico en mapa/i }));
    expect(onVerMapa).toHaveBeenCalledTimes(1);

    // Prohibición de emojis en UI
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('muestra mensajes informativos offline cuando aún no hay detalle ni recursos cacheados', () => {
    const misionBasicaOffline: MisionLocal = {
      id: 'mis-prev-empty',
      incidenteId: '',
      codigoIncidente: 'MIS-PREV-002',
      tipoMision: 'PREVENCION',
      tipologia: 'Prevención comunitaria',
      prioridad: 'MEDIA',
      estado: 'DESPACHADA',
      direccion: 'Por confirmar en terreno',
      fechaDespacho: '2026-11-19T14:00:00Z',
      actualizadoEn: '2026-11-19T14:00:00Z',
      sincronizacionPendiente: false,
    };

    render(<PrevencionMisionCard mision={misionBasicaOffline} esOffline={true} />);

    expect(screen.getByTestId('nota-prevencion-resumen-basico')).toHaveTextContent(
      /sin incidente previo \(§3\.4\).*recuperar cobertura/i
    );
    expect(screen.getByTestId('sin-recursos-prevencion')).toHaveTextContent(
      /Sin recursos cacheados localmente/i
    );
  });
});
