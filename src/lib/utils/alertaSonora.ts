/**
 * Utilidades para emisión de alertas sonoras y hápticas en terreno (HU-35 §3.3).
 */

/**
 * Patrón institucional de vibración háptica para despacho de misión táctica:
 * 300ms vibra, 150ms pausa, 300ms vibra, 150ms pausa, 450ms vibra prolongada.
 */
export const PATRON_VIBRACION_MISION: number[] = [300, 150, 300, 150, 450];

/**
 * Reproduce un tono de alta audibilidad mediante Web Audio API sintetizada,
 * compatible con dispositivos móviles y resiliente a políticas de reproducción del navegador.
 */
export function reproducirAlertaSonora(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtx) {
      return false;
    }

    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    // Bitono de alerta de emergencia: 880Hz (A5) que asciende a 1174Hz (D6)
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 700);

    return true;
  } catch {
    // Si el navegador bloquea la reproducción automática, silenciar sin lanzar excepción
    return false;
  }
}

/**
 * Dispara la vibración háptica del dispositivo móvil respetando la API nativa de Geolocation/Vibration.
 */
export function dispararVibracionHaptica(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  try {
    if (typeof navigator.vibrate === 'function') {
      return navigator.vibrate(PATRON_VIBRACION_MISION);
    }
  } catch {
    // Silenciar si el hardware no soporta la API
  }

  return false;
}

/**
 * Emite la secuencia integral de alerta auditiva y háptica en el dispositivo.
 */
export function activarAlertaSensorialMision(): { audioEmitido: boolean; vibracionDisparada: boolean } {
  const audioEmitido = reproducirAlertaSonora();
  const vibracionDisparada = dispararVibracionHaptica();
  return { audioEmitido, vibracionDisparada };
}

