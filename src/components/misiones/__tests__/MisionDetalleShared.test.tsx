import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HardHat } from 'lucide-react';
import {
  MisionDetalleTopBar,
  MisionDetalleHeaderCard,
  MisionDespachoActionsCard,
  MisionEstadoActivoCard,
  MisionNoEncontradaCard,
  MisionSoloLecturaNotice,
  MisionRechazoBanner,
  MisionBitacoraTimeline,
} from '../MisionDetalleShared';
import type { MisionLocal } from '@/types/offline';

const mockMision: MisionLocal = {
  id: 'mis-shared-01',
  incidenteId: 'inc-shared-01',
  codigoIncidente: 'INC-2026-0999',
  tipologia: 'CAIDA_ARBOL',
  direccion: 'Av. Picarte 1100, Valdivia',
  prioridad: 'ALTA',
  estado: 'DESPACHADA',
  fechaDespacho: '2026-11-22T12:00:00.000Z',
  actualizadoEn: '2026-11-22T12:00:00.000Z',
};

describe('MisionDetalleShared — Componentes compartidos de detalle', () => {
  it('renderiza MisionDetalleTopBar con enlace de retorno y badge de conectividad', () => {
    const onRetry = vi.fn();
    render(
      <MisionDetalleTopBar
        backHref="/cuadrilla/misiones"
        backLabel="Faenas"
        status="connected"
        pendingCount={0}
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('link', { name: /faenas/i })).toHaveAttribute(
      'href',
      '/cuadrilla/misiones'
    );
    expect(screen.getByText(/sincronizado/i)).toBeInTheDocument();
  });

  it('renderiza MisionDetalleHeaderCard y dispara onVerMapa', () => {
    const onVerMapa = vi.fn();
    render(
      <MisionDetalleHeaderCard
        mision={mockMision}
        trabajoTexto="Despeje de calzada"
        etiquetaFecha="Despachada"
        fechaPrincipal={mockMision.fechaDespacho}
        onVerMapa={onVerMapa}
      />
    );

    expect(screen.getByText('INC-2026-0999')).toBeInTheDocument();
    expect(screen.getByText('Despeje de calzada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver mapa/i }));
    expect(onVerMapa).toHaveBeenCalledTimes(1);
  });

  it('renderiza MisionDespachoActionsCard con aceptar, rechazar y alerta de error', () => {
    const onAceptar = vi.fn();
    const onRechazar = vi.fn();
    render(
      <MisionDespachoActionsCard
        ariaLabel="Acciones de despacho"
        titulo="Acciones de Despacho"
        descripcion="Confirme o rechace"
        mostrarAceptar
        etiquetaAceptar="Aceptar Asignación"
        onAceptar={onAceptar}
        mostrarRechazar
        etiquetaRechazar="Rechazar Misión"
        onRechazar={onRechazar}
        errorAceptacion="Error al aceptar"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Error al aceptar');
    fireEvent.click(screen.getByRole('button', { name: /aceptar asignación/i }));
    expect(onAceptar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /rechazar misión/i }));
    expect(onRechazar).toHaveBeenCalledTimes(1);
  });

  it('renderiza MisionEstadoActivoCard en modo offline y sincronizado', () => {
    const { rerender } = render(
      <MisionEstadoActivoCard
        ariaLabel="Faena en curso"
        icono={<HardHat size={20} />}
        titulo="Faena en Curso"
        sincronizacionPendiente
        mensajeOffline="Pendiente de sincronizar"
        estadosCanonicos={[
          { etiqueta: 'Misión', valor: 'En curso' },
          { etiqueta: 'Cuadrilla', valor: 'En misión' },
          { etiqueta: 'Incidente', valor: 'En atención' },
        ]}
      />
    );

    expect(screen.getByText('Pendiente de sincronizar')).toBeInTheDocument();
    expect(screen.getByText('En misión')).toBeInTheDocument();

    rerender(
      <MisionEstadoActivoCard
        ariaLabel="Faena en curso"
        icono={<HardHat size={20} />}
        titulo="Faena en Curso"
        sincronizacionPendiente={false}
        mensajeOffline="Pendiente de sincronizar"
        mensajeConfirmacion="Asignación aceptada"
        estadosCanonicos={[
          { etiqueta: 'Misión', valor: 'En curso' },
          { etiqueta: 'Cuadrilla', valor: 'En misión' },
          { etiqueta: 'Incidente', valor: 'En atención' },
        ]}
      />
    );

    expect(screen.getByText('Asignación aceptada')).toBeInTheDocument();
  });

  it('renderiza MisionNoEncontradaCard y MisionSoloLecturaNotice', () => {
    render(
      <>
        <MisionNoEncontradaCard
          backHref="/patrulla/misiones"
          backLabel="Misiones"
          status="offline"
          pendingCount={1}
          onRetry={vi.fn()}
          descripcion="No encontrada en caché."
        />
        <MisionSoloLecturaNotice />
      </>
    );

    expect(screen.getByText('Misión no encontrada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a la bandeja/i })).toHaveAttribute(
      'href',
      '/patrulla/misiones'
    );
    expect(screen.getByText('Solo lectura')).toBeInTheDocument();
  });

  it('renderiza MisionRechazoBanner de forma estandarizada', () => {
    render(
      <MisionRechazoBanner
        titulo="Misión Rechazada por Patrulla Verificadora"
        justificacion="Camino cortado por socavón."
      />
    );

    expect(
      screen.getByText('Misión Rechazada por Patrulla Verificadora')
    ).toBeInTheDocument();
    expect(screen.getByText(/Camino cortado por socavón\./)).toBeInTheDocument();
  });

  it('renderiza MisionBitacoraTimeline estandarizada para Patrulla y Cuadrilla', () => {
    const { rerender } = render(
      <MisionBitacoraTimeline
        tipoUnidad="PATRULLA"
        responsableFallback="Laura Gómez"
        bitacora={[
          {
            id: 'h-1',
            hito: 'DESPACHADA',
            descripcion: 'Misión de verificación asignada a Patrulla Sur.',
            fecha: '22-11-2026',
            hora: '13:16:55',
          },
          {
            id: 'h-2',
            hito: 'MISION_ACEPTADA',
            descripcion: 'Misión Aceptada por Patrulla',
            fecha: '22-11-2026',
            hora: '13:17:31',
          },
        ]}
      />
    );

    expect(screen.getByText('Bitácora Cronológica (2)')).toBeInTheDocument();
    expect(screen.getByText('Patrulla Verificadora Despachada')).toBeInTheDocument();
    expect(screen.getByText('Misión Aceptada por Unidad')).toBeInTheDocument();
    expect(screen.getByText('Reportado por: Laura Gómez')).toBeInTheDocument();

    rerender(
      <MisionBitacoraTimeline
        tipoUnidad="CUADRILLA"
        responsableFallback="Sandra Huequeman"
        bitacora={[
          {
            id: 'h-3',
            hito: 'CUADRILLA_DESPACHADA',
            descripcion: 'Cuadrilla despachada a terreno.',
            fecha: '22-11-2026',
            hora: '13:39:28',
          },
          {
            id: 'h-4',
            hito: 'LLEGADA_TERRENO',
            descripcion: 'Llegada a terreno reportada.',
            fecha: '22-11-2026',
            hora: '23:51:41',
            latitud: -39.8142,
            longitud: -73.2459,
          },
        ]}
      />
    );

    expect(screen.getByText('Cuadrilla Despachada')).toBeInTheDocument();
    expect(screen.getByText('Llegada a Terreno')).toBeInTheDocument();
    expect(screen.getByText('Reportado por: Sandra Huequeman')).toBeInTheDocument();
    expect(screen.getByText('-39.81420, -73.24590')).toBeInTheDocument();
  });
});
