import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvaluacionTipologiaCard } from '../EvaluacionTipologiaCard';
import * as tipologiaService from '@/services/tipologiaService';
import type { MisionLocal } from '@/types/offline';

describe('EvaluacionTipologiaCard (H37)', () => {
  const misionMock: MisionLocal = {
    id: '60000000-0000-4000-8000-000000000001',
    incidenteId: '50000000-0000-4000-8000-000000000001',
    codigoIncidente: 'INC-2026-001',
    tipologia: 'Caída de árbol',
    direccion: 'Av. Alemania 600, Valdivia',
    prioridad: 'ALTA',
    estado: 'EN_CURSO',
    fechaDespacho: '2026-11-10T00:00:00Z',
    actualizadoEn: '2026-11-10T00:00:00Z',
  };

  const catalogoMock = [
    {
      id: '40000000-0000-4000-8000-000000000001',
      nombre: 'Inundación',
      descripcion: 'Acumulación desmedida de agua',
      activo: true,
    },
    {
      id: '40000000-0000-4000-8000-000000000003',
      nombre: 'Caída de árbol',
      descripcion: 'Obstrucción de vías',
      activo: true,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(tipologiaService, 'obtenerCatalogoTiposIncidente').mockResolvedValue(catalogoMock);
  });

  it('renderiza la tipología constatada actual y carga las opciones del catálogo oficial', async () => {
    render(
      <EvaluacionTipologiaCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
      />
    );

    expect(screen.getByText('Categorización en Terreno')).toBeInTheDocument();
    expect(screen.getByText('Caída de árbol')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    expect(select.value).toBe('40000000-0000-4000-8000-000000000003');
  });

  it('muestra la descripción técnica del tipo de incidente seleccionado', async () => {
    render(
      <EvaluacionTipologiaCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Obstrucción de vías/i)).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '40000000-0000-4000-8000-000000000001' } });

    await waitFor(() => {
      expect(screen.getByText(/Acumulación desmedida de agua/i)).toBeInTheDocument();
    });
  });

  it('muestra error de validación si la justificación tiene menos de 5 caracteres al enviar', async () => {
    render(
      <EvaluacionTipologiaCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'abc' } });

    const submitBtn = screen.getByRole('button', { name: /Confirmar Tipología/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/La justificación es obligatoria y debe contener al menos 5 caracteres/i)
    ).toBeInTheDocument();
  });

  it('actualiza el contador de caracteres en tiempo real', async () => {
    render(
      <EvaluacionTipologiaCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Evaluación técnica en terreno' } });

    await waitFor(() => {
      expect(screen.getByText('29 / 1000')).toBeInTheDocument();
    });
  });

  it('ejecuta reclasificación con éxito online y dispara callback', async () => {
    const onActualizada = vi.fn();
    vi.spyOn(tipologiaService, 'reclasificarTipologiaEnTerreno').mockResolvedValue({
      ok: true,
      offline: false,
      mensaje: 'Tipología del incidente reclasificada exitosamente en terreno.',
      mision: { ...misionMock, tipologia: 'Inundación' },
    });

    render(
      <EvaluacionTipologiaCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
        onTipologiaActualizada={onActualizada}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '40000000-0000-4000-8000-000000000001' } });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, {
      target: { value: 'Constatación presencial de desborde de río e inundación de calle.' },
    });

    const submitBtn = screen.getByRole('button', { name: /Confirmar Tipología/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Tipología del incidente reclasificada exitosamente en terreno/i)
      ).toBeInTheDocument();
    });

    expect(onActualizada).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        offline: false,
      })
    );
  });

  it('muestra mensaje informativo cuando la reclasificación se guarda offline', async () => {
    vi.spyOn(tipologiaService, 'reclasificarTipologiaEnTerreno').mockResolvedValue({
      ok: true,
      offline: true,
      mensaje: 'Tipología guardada localmente. Se sincronizará automáticamente al recuperar la conexión.',
      mision: { ...misionMock, tipologia: 'Inundación', sincronizacionPendiente: true },
    });

    render(
      <EvaluacionTipologiaCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Sin señal de datos móviles en ruta.' } });

    const submitBtn = screen.getByRole('button', { name: /Confirmar Tipología/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Tipología guardada localmente/i)
      ).toBeInTheDocument();
    });
  });

  it('deshabilita los controles cuando la prop deshabilitado es true', async () => {
    render(
      <EvaluacionTipologiaCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
        deshabilitado={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Confirmar Tipología/i })).toBeDisabled();
  });
});
