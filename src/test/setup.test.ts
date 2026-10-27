import { describe, it, expect } from 'vitest';

describe('Entorno de pruebas PWA', () => {
  it('inicializa localStorage mock correctamente', () => {
    localStorage.setItem('prueba', 'sgrai-pwa');
    expect(localStorage.getItem('prueba')).toBe('sgrai-pwa');
    localStorage.removeItem('prueba');
    expect(localStorage.getItem('prueba')).toBeNull();
  });
});
