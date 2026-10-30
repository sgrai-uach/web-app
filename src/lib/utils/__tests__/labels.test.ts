import { describe, it, expect } from 'vitest';
import {
  formatearEtiquetaSegura,
  limpiarTituloMision,
  ETIQUETAS_ESTADO,
  ETIQUETAS_PRIORIDAD,
  ETIQUETAS_TIPOLOGIA,
} from '../labels';

describe('labels — Mapeo estricto a lenguaje natural y respaldo seguro', () => {
  it('mapea correctamente enums conocidos de estado', () => {
    expect(formatearEtiquetaSegura('EN_CURSO', ETIQUETAS_ESTADO)).toBe('En curso');
    expect(formatearEtiquetaSegura('DESPACHADA', ETIQUETAS_ESTADO)).toBe('Despachada');
    expect(formatearEtiquetaSegura('COMPLETADA', ETIQUETAS_ESTADO)).toBe('Finalizada');
  });

  it('mapea prioridades a lenguaje natural', () => {
    expect(formatearEtiquetaSegura('CRITICA', ETIQUETAS_PRIORIDAD)).toBe('Crítica');
    expect(formatearEtiquetaSegura('ALTA', ETIQUETAS_PRIORIDAD)).toBe('Alta');
  });

  it('mapea tipologías a lenguaje natural', () => {
    expect(formatearEtiquetaSegura('CAIDA_ARBOL', ETIQUETAS_TIPOLOGIA)).toBe('Caída de árbol');
    expect(formatearEtiquetaSegura('ANEGAMIENTO', ETIQUETAS_TIPOLOGIA)).toBe('Anegamiento');
  });

  it('aplica respaldo seguro convirtiendo mayúsculas y guiones bajos en caso no registrado', () => {
    expect(formatearEtiquetaSegura('CAMION_ALJIBE_DESCONOCIDO')).toBe('Camion aljibe desconocido');
  });

  it('limpia prefijos de títulos de misión (Triage, Evaluación de)', () => {
    expect(limpiarTituloMision('Triage Caída de árbol en tendido')).toBe('Caída de árbol en tendido');
    expect(limpiarTituloMision('Triage: Deslizamiento')).toBe('Deslizamiento');
    expect(limpiarTituloMision('Evaluación de anegamiento en calzada')).toBe('anegamiento en calzada');
    expect(limpiarTituloMision('Despeje regular')).toBe('Despeje regular');
  });
});
