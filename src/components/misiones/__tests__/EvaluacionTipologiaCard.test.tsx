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

    expect(
      screen.getByRole('group', { name: /Categorización del incidente/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Caída de árbol')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    expect(select.value).toBe('40000000-0000-4000-8000-000000000003');
  });

  it('permite ratificar la tipología original sin exigir justificación', async () => {
    const onActualizada = vi.fn();
    vi.spyOn(tipologiaService, 'reclasificarTipologiaEnTerreno').mockResolvedValue({
      ok: true,
      offline: false,
      mensaje: 'Tipología ratificada exitosamente.',
      mision: { ...misionMock, datosAdicionales: { tipologiaEvaluada: true } },
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

    // Al coincidir con la original, debe mostrar la nota de ratificación sin textarea
    expect(
      screen.getByText(/Tipología original constatada. No se requiere justificación adicional para ratificar/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    // Clic en Confirmar tipología abre el modal de confirmación
    const submitBtn = screen.getByRole('button', { name: /Confirmar Tipología/i });
    fireEvent.click(submitBtn);

    // Verifica que el modal se despliega
    expect(screen.getByText('Confirmar Evaluación de Tipología')).toBeInTheDocument();
    expect(screen.getByText(/¿Desea ratificar la tipología del incidente/i)).toBeInTheDocument();

    // Confirmar en el modal
    const confirmBtn = screen.getByRole('button', { name: /Confirmar y Enviar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(tipologiaService.reclasificarTipologiaEnTerreno).toHaveBeenCalledWith(
        misionMock.incidenteId,
        expect.objectContaining({
          tipoIncidenteId: '40000000-0000-4000-8000-000000000003',
          esCambio: false,
        }),
        expect.anything()
      );
    });
  });

  it('muestra la descripción técnica del tipo seleccionado y activa justificación obligatoria al cambiar tipología', async () => {
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

    // Al cambiar la tipología, el campo de justificación se hace visible
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('muestra error de validación si al reclasificar la justificación tiene menos de 5 caracteres', async () => {
    render(
      <EvaluacionTipologiaCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Cambiar a tipo diferente
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '40000000-0000-4000-8000-000000000001' } });

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'abc' } });

    const submitBtn = screen.getByRole('button', { name: /Confirmar Tipología/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/La justificación es obligatoria y debe contener al menos 5 caracteres/i)
    ).toBeInTheDocument();

    // No debe abrirse el modal si hay error de validación
    expect(screen.queryByText('Confirmar Evaluación de Tipología')).not.toBeInTheDocument();
  });

  it('actualiza el contador de caracteres en tiempo real al ingresar justificación', async () => {
    render(
      <EvaluacionTipologiaCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '40000000-0000-4000-8000-000000000001' } });

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Evaluación técnica en terreno' } });

    await waitFor(() => {
      expect(screen.getByText('29 / 1000')).toBeInTheDocument();
    });
  });

  it('permite cancelar el modal de confirmación sin ejecutar la mutación', async () => {
    const spyService = vi.spyOn(tipologiaService, 'reclasificarTipologiaEnTerreno');

    render(
      <EvaluacionTipologiaCard
        incidenteId={misionMock.incidenteId}
        misionActual={misionMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Confirmar Tipología/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Confirmar Evaluación de Tipología')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Confirmar Evaluación de Tipología')).not.toBeInTheDocument();
    expect(spyService).not.toHaveBeenCalled();
  });

  it('ejecuta reclasificación con éxito online tras confirmar en modal y dispara callback', async () => {
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

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, {
      target: { value: 'Constatación presencial de desborde de río e inundación de calle.' },
    });

    const submitBtn = screen.getByRole('button', { name: /Confirmar Tipología/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Confirmar Evaluación de Tipología')).toBeInTheDocument();

    const confirmModalBtn = screen.getByRole('button', { name: /Confirmar y Enviar/i });
    fireEvent.click(confirmModalBtn);

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

  it('muestra mensaje informativo cuando la reclasificación se guarda offline tras confirmar en modal', async () => {
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

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '40000000-0000-4000-8000-000000000001' } });

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Sin señal de datos móviles en ruta.' } });

    const submitBtn = screen.getByRole('button', { name: /Confirmar Tipología/i });
    fireEvent.click(submitBtn);

    const confirmModalBtn = screen.getByRole('button', { name: /Confirmar y Enviar/i });
    fireEvent.click(confirmModalBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Tipología guardada localmente/i)
      ).toBeInTheDocument();
    });
  });

  it('renderiza resumen de evaluación cuando ya fue evaluada y permite modificar', async () => {
    const misionEvaluadaMock: MisionLocal = {
      ...misionMock,
      tipologia: 'Inundación',
      datosAdicionales: {
        tipologiaEvaluada: true,
        esReclasificacion: true,
        justificacionTipologia: 'Crecida histórica del río Calle-Calle.',
        fechaEvaluacionTipologia: '2026-11-10T12:00:00Z',
      },
    };

    render(
      <EvaluacionTipologiaCard
        incidenteId={misionEvaluadaMock.incidenteId}
        misionActual={misionEvaluadaMock}
      />
    );

    // Debe mostrar la tarjeta de resumen
    expect(screen.getByTestId('resumen-tipologia')).toBeInTheDocument();
    expect(screen.getByText('Resumen de Evaluación en Terreno')).toBeInTheDocument();
    expect(screen.getByText('Reclasificación en terreno')).toBeInTheDocument();
    expect(screen.getByText('Crecida histórica del río Calle-Calle.')).toBeInTheDocument();

    // Botón para volver a editar
    const modBtn = screen.getByRole('button', { name: /Modificar categorización/i });
    expect(modBtn).toBeInTheDocument();
    fireEvent.click(modBtn);

    // Al hacer clic, se abre el formulario de modificación
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Cancelar modificación/i })).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: /Confirmar Tipología/i })).toBeDisabled();
  });
});
