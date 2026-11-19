import { describe, it, expect } from 'vitest';
import {
  cerrarMisionCuadrillaSchema,
  materialConsumidoSchema,
} from '../cierreCuadrilla';

describe('cierreCuadrillaSchema (H68)', () => {
  const baseInput = {
    resumen_faenas:
      'Se realizó desagüe de calzada con motobomba de 4 pulgadas y limpieza de sumideros.',
    horas_hombre: 4.5,
    estado_terreno: 'FINALIZADO' as const,
  };

  it('valida un payload completo con y sin materiales consumidos', () => {
    const resSinMateriales = cerrarMisionCuadrillaSchema.safeParse(baseInput);
    expect(resSinMateriales.success).toBe(true);
    if (resSinMateriales.success) {
      expect(resSinMateriales.data).not.toHaveProperty(
        'requiere_asistencia_social'
      );
    }

    const resConMateriales = cerrarMisionCuadrillaSchema.safeParse({
      ...baseInput,
      materiales_consumidos: [
        {
          recurso_id: 'e1000000-0000-4000-8000-000000000004',
          cantidad: 25,
          unidad: 'sacos',
          observacion: 'Contención en acceso peatonal',
        },
      ],
      requiere_apoyo_adicional: true,
      latitud: -39.817,
      longitud: -73.242,
    });
    expect(resConMateriales.success).toBe(true);
  });

  it('rechaza resumen_faenas menor a 15 caracteres', () => {
    const res = cerrarMisionCuadrillaSchema.safeParse({
      ...baseInput,
      resumen_faenas: '   Corto   ',
    });
    expect(res.success).toBe(false);
  });

  it('rechaza horas_hombre menores o iguales a 0 o mayores a 1000', () => {
    expect(
      cerrarMisionCuadrillaSchema.safeParse({
        ...baseInput,
        horas_hombre: 0,
      }).success
    ).toBe(false);

    expect(
      cerrarMisionCuadrillaSchema.safeParse({
        ...baseInput,
        horas_hombre: 1000.5,
      }).success
    ).toBe(false);
  });

  it('acepta los 6 estados de terreno de cuadrilla incluyendo REQUIERE_SEGUIMIENTO', () => {
    for (const estado of [
      'FINALIZADO',
      'CONTROLADO',
      'ESTABLE',
      'REQUIERE_SEGUIMIENTO',
      'CRITICO',
      'INACCESIBLE',
    ] as const) {
      const res = cerrarMisionCuadrillaSchema.safeParse({
        ...baseInput,
        estado_terreno: estado,
      });
      expect(res.success).toBe(true);
    }
  });

  it('rechaza recurso_id duplicados en materiales_consumidos y cantidades <= 0', () => {
    expect(
      materialConsumidoSchema.safeParse({
        recurso_id: 'e1000000-0000-4000-8000-000000000004',
        cantidad: 0,
      }).success
    ).toBe(false);

    const resDuplicado = cerrarMisionCuadrillaSchema.safeParse({
      ...baseInput,
      materiales_consumidos: [
        {
          recurso_id: 'e1000000-0000-4000-8000-000000000004',
          cantidad: 10,
        },
        {
          recurso_id: 'e1000000-0000-4000-8000-000000000004',
          cantidad: 5,
        },
      ],
    });
    expect(resDuplicado.success).toBe(false);
  });

  it('exige par completo de coordenadas latitud y longitud', () => {
    const resIncompleto = cerrarMisionCuadrillaSchema.safeParse({
      ...baseInput,
      latitud: -39.817,
    });
    expect(resIncompleto.success).toBe(false);
  });
});
