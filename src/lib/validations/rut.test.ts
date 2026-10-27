import { describe, it, expect } from 'vitest';
import { validarRutChileno, formatearRut } from './rut';

describe('Validación de RUT chileno (Módulo 11)', () => {
  it('valida RUTs chilenos reales válidos', () => {
    expect(validarRutChileno('11.111.111-1')).toBe(true);
    expect(validarRutChileno('11111111-1')).toBe(true);
    expect(validarRutChileno('111111111')).toBe(true);
    expect(validarRutChileno('10.000.013-K')).toBe(true);
    expect(validarRutChileno('10000013-k')).toBe(true);
  });

  it('rechaza RUTs con dígito verificador erróneo o formato inválido', () => {
    expect(validarRutChileno('11.111.111-2')).toBe(false);
    expect(validarRutChileno('12345678-0')).toBe(false);
    expect(validarRutChileno('abc')).toBe(false);
    expect(validarRutChileno('')).toBe(false);
  });

  it('formatea correctamente el RUT con guión', () => {
    expect(formatearRut('111111111')).toBe('11111111-1');
    expect(formatearRut('11.111.111-1')).toBe('11111111-1');
  });

  it('formatea correctamente con puntos', () => {
    expect(formatearRut('111111111', true)).toBe('11.111.111-1');
  });
});
