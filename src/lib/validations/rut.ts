/**
 * Utilidades de validación y formateo de RUT chileno (Módulo 11).
 */

export function validarRutChileno(rut: string): boolean {
  if (!rut || typeof rut !== 'string') {
    return false;
  }

  const limpio = rut.replace(/[^0-9kK]/g, '').toUpperCase();

  if (limpio.length < 8 || limpio.length > 9) {
    return false;
  }

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  if (!/^\d+$/.test(cuerpo)) {
    return false;
  }

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const dvEsperadoCalculado = 11 - resto;

  let dvEsperado = '';
  if (dvEsperadoCalculado === 11) {
    dvEsperado = '0';
  } else if (dvEsperadoCalculado === 10) {
    dvEsperado = 'K';
  } else {
    dvEsperado = dvEsperadoCalculado.toString();
  }

  return dv === dvEsperado;
}

export function formatearRut(rut: string, conPuntos = false): string {
  const limpio = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 2) return limpio;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  if (!conPuntos) {
    return `${cuerpo}-${dv}`;
  }

  let formateado = '';
  let contador = 0;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    formateado = cuerpo[i] + formateado;
    contador++;
    if (contador === 3 && i !== 0) {
      formateado = '.' + formateado;
      contador = 0;
    }
  }

  return `${formateado}-${dv}`;
}
