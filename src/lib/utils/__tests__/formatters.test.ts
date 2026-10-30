import { describe, it, expect } from 'vitest';
import {
  formatearEstado,
  formatearPrioridad,
  formatearTipologia,
  formatearFechaHora24h,
} from '../formatters';

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

  describe('formatearTipologia', () => {
    it('debe traducir enums de tipología técnica a texto natural', () => {
      expect(formatearTipologia('CAIDA_ARBOL')).toBe('Caída de árbol');
      expect(formatearTipologia('ANEGAMIENTO')).toBe('Anegamiento');
      expect(formatearTipologia('DESCONOCIDO_TIPO')).toBe('Desconocido tipo');
    });
  });

  describe('formatearFechaHora24h', () => {
    it('formatea fechas a formato 24 horas DD-MM-YYYY HH:mm sin segundos', () => {
      const fecha = new Date(2026, 9, 30, 1, 7); // 30 de Octubre de 2026, 01:07
      expect(formatearFechaHora24h(fecha)).toBe('30-10-2026 01:07');
    });

    it('devuelve Sin fecha ante valores vacíos', () => {
      expect(formatearFechaHora24h(null)).toBe('Sin fecha');
      expect(formatearFechaHora24h('')).toBe('Sin fecha');
    });
  });
});

