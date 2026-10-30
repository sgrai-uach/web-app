import { describe, it, expect } from 'vitest';
import { formatearEstado, formatearPrioridad } from '../formatters';

describe('formatters — Conversión de Enums a Lenguaje Natural', () => {
  describe('formatearEstado', () => {
    it('debe convertir enums de estados operativos a lenguaje natural capitalizado', () => {
      expect(formatearEstado('DISPONIBLE')).toBe('Disponible');
      expect(formatearEstado('EN_CURSO')).toBe('En curso');
      expect(formatearEstado('ASIGNADA')).toBe('Asignada');
      expect(formatearEstado('FINALIZADA')).toBe('Finalizada');
      expect(formatearEstado('CANCELADA')).toBe('Cancelada');
      expect(formatearEstado('RECHAZADA')).toBe('Rechazada');
      expect(formatearEstado('DESPACHADA')).toBe('Despachada');
      expect(formatearEstado('EN_RUTA')).toBe('En ruta');
      expect(formatearEstado('EN_TERRENO')).toBe('En terreno');
      expect(formatearEstado('NO_DISPONIBLE')).toBe('No disponible');
    });

    it('debe manejar cadenas vacías, nulas o no contempladas limpiamente', () => {
      expect(formatearEstado(null)).toBe('');
      expect(formatearEstado(undefined)).toBe('');
      expect(formatearEstado('')).toBe('');
      expect(formatearEstado('OTRO_ESTADO')).toBe('Otro estado');
    });
  });

  describe('formatearPrioridad', () => {
    it('debe convertir prioridades a lenguaje natural con tildes correctas', () => {
      expect(formatearPrioridad('CRITICA')).toBe('Crítica');
      expect(formatearPrioridad('ALTA')).toBe('Alta');
      expect(formatearPrioridad('MEDIA')).toBe('Media');
      expect(formatearPrioridad('BAJA')).toBe('Baja');
    });

    it('debe manejar nulos y vacíos', () => {
      expect(formatearPrioridad(null)).toBe('');
      expect(formatearPrioridad(undefined)).toBe('');
      expect(formatearPrioridad('')).toBe('');
    });
  });
});

