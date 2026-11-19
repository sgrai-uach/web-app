import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  obtenerCatalogoTiposIncidente,
  reclasificarTipologiaEnTerreno,
  CATALOGO_TIPOS_PREDETERMINADO,
} from '../tipologiaService';
import * as offlineQueue from '../offlineQueue';
import type { MisionLocal } from '@/types/offline';

describe('tipologiaService (H37)', () => {
  const misionMock: MisionLocal = {
    id: '60000000-0000-4000-8000-000000000001',
    incidenteId: 'inc-001',
    codigoIncidente: 'INC-2026-001',
    tipologia: 'Anegamiento de calzada',
    direccion: 'Av. Alemania 600',
    prioridad: 'MEDIA',
    estado: 'EN_CURSO',
    fechaDespacho: '2026-11-10T00:00:00Z',
    actualizadoEn: '2026-11-10T00:00:00Z',
  };

  const tipoNuevoId = '40000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(offlineQueue, 'guardarCatalogoLocal').mockResolvedValue();
    vi.spyOn(offlineQueue, 'obtenerCatalogoLocal').mockResolvedValue(null);
    vi.spyOn(offlineQueue, 'encolarAccionOutbox').mockResolvedValue({
      id: 'outbox-1',
      tipo: 'ACTUALIZAR_TIPOLOGIA',
      url: '/api/incidentes/inc-001/tipologia',
      metodo: 'PATCH',
      payload: {},
      timestamp: new Date().toISOString(),
      intentos: 0,
    });
    vi.spyOn(offlineQueue, 'guardarMisionLocal').mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('obtenerCatalogoTiposIncidente', () => {
    it('obtiene el catálogo de la API cuando hay conexión y lo guarda en IndexedDB', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      const mockTipos = [
        { id: tipoNuevoId, nombre: 'Inundación', descripcion: 'Desborde', activo: true },
        { id: '40000000-0000-4000-8000-000000000099', nombre: 'Inactivo', descripcion: null, activo: false },
      ];

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ data: mockTipos }),
        })
      );

      const resultado = await obtenerCatalogoTiposIncidente();
      expect(resultado).toHaveLength(1);
      expect(resultado[0].nombre).toBe('Inundación');
      expect(offlineQueue.guardarCatalogoLocal).toHaveBeenCalledWith(
        'tipos_incidente',
        expect.arrayContaining([expect.objectContaining({ nombre: 'Inundación' })])
      );
    });

    it('recurre a la copia en IndexedDB cuando está offline', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const guardados = [
        { id: tipoNuevoId, nombre: 'Inundación Guardada', descripcion: 'Local', activo: true },
      ];
      vi.spyOn(offlineQueue, 'obtenerCatalogoLocal').mockResolvedValue(guardados);

      const resultado = await obtenerCatalogoTiposIncidente();
      expect(resultado).toEqual(guardados);
    });

    it('recurre al catálogo predeterminado si no hay red ni datos en IndexedDB', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      vi.spyOn(offlineQueue, 'obtenerCatalogoLocal').mockResolvedValue(null);

      const resultado = await obtenerCatalogoTiposIncidente();
      expect(resultado).toEqual(CATALOGO_TIPOS_PREDETERMINADO);
    });
  });

  describe('reclasificarTipologiaEnTerreno', () => {
    it('falla si la justificación tiene menos de 5 caracteres', async () => {
      await expect(
        reclasificarTipologiaEnTerreno('inc-001', {
          tipoIncidenteId: tipoNuevoId,
          justificacion: 'abc',
        })
      ).rejects.toThrow('al menos 5 caracteres');
    });

    it('envía petición PATCH online exitosa y actualiza la misión local', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            message: 'Tipología reclasificada exitosamente en terreno.',
            data: {
              incidente: {
                id: 'inc-001',
                tipoAfectacion: 'Inundación',
                actualizadoEn: '2026-11-10T01:30:00Z',
              },
              hito: {
                id: 'hito-1',
                descripcion: 'Tipología reclasificada en terreno a: Inundación.',
              },
            },
          }),
        })
      );

      const resultado = await reclasificarTipologiaEnTerreno(
        'inc-001',
        {
          tipoIncidenteId: tipoNuevoId,
          justificacion: 'Evaluación presencial constata anegamiento severo con ingreso a casas.',
          misionId: misionMock.id,
        },
        misionMock
      );

      expect(resultado.ok).toBe(true);
      expect(resultado.offline).toBe(false);
      expect(resultado.mision?.tipologia).toBe('Inundación');
      expect(resultado.mision?.sincronizacionPendiente).toBe(false);
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalled();
    });

    it('guarda en outbox y marca sincronizacionPendiente cuando está offline', async () => {
      vi.stubGlobal('navigator', { onLine: false });

      const resultado = await reclasificarTipologiaEnTerreno(
        'inc-001',
        {
          tipoIncidenteId: tipoNuevoId,
          justificacion: 'Constatado sin señal celular en sector rural.',
        },
        misionMock
      );

      expect(resultado.ok).toBe(true);
      expect(resultado.offline).toBe(true);
      expect(resultado.mision?.sincronizacionPendiente).toBe(true);
      expect(offlineQueue.encolarAccionOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'ACTUALIZAR_TIPOLOGIA',
          url: '/api/incidentes/inc-001/tipologia',
          metodo: 'PATCH',
        })
      );
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalled();
    });

    it('maneja error 409 Conflict si la misión aún no ha sido aceptada', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({
            message: 'La patrulla debe haber aceptado la misión previamente.',
          }),
        })
      );

      await expect(
        reclasificarTipologiaEnTerreno(
          'inc-001',
          {
            tipoIncidenteId: tipoNuevoId,
            justificacion: 'Evaluación presencial válida.',
          },
          misionMock
        )
      ).rejects.toThrow('La patrulla debe haber aceptado la misión previamente.');
    });

    it('hace fallback a outbox si la petición fetch falla por error de red', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      );

      const resultado = await reclasificarTipologiaEnTerreno(
        'inc-001',
        {
          tipoIncidenteId: tipoNuevoId,
          justificacion: 'Error intermitente de red en ruta.',
        },
        misionMock
      );

      expect(resultado.ok).toBe(true);
      expect(resultado.offline).toBe(true);
      expect(offlineQueue.encolarAccionOutbox).toHaveBeenCalled();
    });
  });
});
