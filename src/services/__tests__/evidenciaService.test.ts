import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  subirEvidenciaMultimedia,
  extraerMensajeErrorHttp,
  EvidenciaServiceError,
} from '@/services/evidenciaService';
import * as cookieUtils from '@/lib/utils/cookieUtils';
import {
  obtenerAccionesOutbox,
  limpiarAlmacenamientoOffline,
  guardarMisionLocal,
} from '@/services/offlineQueue';
import * as mediaUtils from '@/lib/utils/mediaUtils';

const MISION_ID = '11111111-1111-4111-8111-111111111111';
const INCIDENTE_ID = '22222222-2222-4222-8222-222222222222';

describe('evidenciaService (H43)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await limpiarAlmacenamientoOffline();
    await guardarMisionLocal({
      id: MISION_ID,
      incidenteId: INCIDENTE_ID,
      codigoIncidente: 'INC-2026-043',
      tipologia: 'Árbol caído',
      direccion: 'Av. Alemania 120',
      prioridad: 'ALTA',
      estado: 'EN_CURSO',
      fechaDespacho: '2026-11-17T18:00:00.000Z',
      actualizadoEn: '2026-11-17T18:00:00.000Z',
    });

    vi.spyOn(mediaUtils, 'prepararEvidenciaParaSubida').mockResolvedValue({
      blob: new Blob(['bytes-video'], { type: 'video/mp4' }),
      dataUrl: `data:video/mp4;base64,${btoa('bytes-video')}`,
      nombreArchivo: 'terreno.mp4',
      tipoMime: 'video/mp4',
      tamanoOriginalBytes: 1024,
      tamanoFinalBytes: 1024,
      comprimida: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sube multipart FormData online con incidente_id y actualiza con DTO optimizado del servidor', async () => {
    vi.stubGlobal('navigator', { onLine: true });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: '33333333-3333-4333-8333-333333333333',
        nombreArchivo: 'terreno_opt.mp4',
        url: '/uploads/evidencia/abc123.mp4',
        tipoMime: 'video/mp4',
        tamanoBytes: 512,
        creadoEn: '2026-11-17T19:00:00.000Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const archivo = new File(['bytes-video'], 'terreno.mp4', { type: 'video/mp4' });
    const progreso: number[] = [];

    const res = await subirEvidenciaMultimedia({
      archivo,
      misionId: MISION_ID,
      incidenteId: INCIDENTE_ID,
      onProgress: (p) => progreso.push(p),
    });

    expect(res.enColaOffline).toBe(false);
    expect(res.adjunto.url).toBe('/uploads/evidencia/abc123.mp4');
    expect(res.adjunto.tamanoBytes).toBe(512);
    expect(progreso[progreso.length - 1]).toBe(100);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/evidencia/adjuntos');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('incidente_id')).toBe(INCIDENTE_ID);
    expect((init.body as FormData).get('file')).toBeTruthy();

    const outbox = await obtenerAccionesOutbox();
    expect(outbox).toHaveLength(0);
  });

  it('encola en IndexedDB (SUBIR_EVIDENCIA) cuando no hay conexión', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const archivo = new File(['bytes-video'], 'terreno.mp4', { type: 'video/mp4' });
    const res = await subirEvidenciaMultimedia({
      archivo,
      misionId: MISION_ID,
      incidenteId: INCIDENTE_ID,
    });

    expect(res.enColaOffline).toBe(true);
    expect(res.adjunto.sincronizacionPendiente).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    const outbox = await obtenerAccionesOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].tipo).toBe('SUBIR_EVIDENCIA');
    expect(outbox[0].url).toBe('/api/evidencia/adjuntos');
  });

  it('lanza EvidenciaServiceError ante respuestas 413 o 415 sin encolar', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 415,
        json: async () => ({ message: 'Magic bytes inválidos' }),
      })
    );

    const archivo = new File(['bytes-video'], 'terreno.mp4', { type: 'video/mp4' });

    await expect(
      subirEvidenciaMultimedia({
        archivo,
        misionId: MISION_ID,
        incidenteId: INCIDENTE_ID,
      })
    ).rejects.toThrow(EvidenciaServiceError);

    const outbox = await obtenerAccionesOutbox();
    expect(outbox).toHaveLength(0);
  });

  it('permite encolar múltiples evidencias offline sin sobrescribir la anterior', async () => {
    vi.stubGlobal('navigator', { onLine: false });

    const archivo1 = new File(['v1'], 'video1.mp4', { type: 'video/mp4' });
    const archivo2 = new File(['v2'], 'video2.mp4', { type: 'video/mp4' });

    await subirEvidenciaMultimedia({
      archivo: archivo1,
      misionId: MISION_ID,
      incidenteId: INCIDENTE_ID,
    });
    await subirEvidenciaMultimedia({
      archivo: archivo2,
      misionId: MISION_ID,
      incidenteId: INCIDENTE_ID,
    });

    const outbox = await obtenerAccionesOutbox();
    expect(outbox).toHaveLength(2);
  });

  it('inyecta x-user-id desde JWT, normaliza incidenteId vacío y mapea errores 409 (BUG-H43-PWA-03/06)', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const headerObj = { sub: 'u-patrulla-jwt' };
    const encodeB64Url = (obj: unknown) =>
      btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const jwtFalso = `${encodeB64Url({ alg: 'HS256' })}.${encodeB64Url(headerObj)}.sig`;
    vi.spyOn(cookieUtils, 'getAuthCookie').mockReturnValue(jwtFalso);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: '33333333-3333-4333-8333-333333333333',
        nombreArchivo: 'terreno.mp4',
        url: '/uploads/evidencia/terreno.mp4',
        tipoMime: 'video/mp4',
        tamanoBytes: 1024,
        creadoEn: '2026-11-18T12:00:00.000Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const archivo = new File(['v1'], 'video1.mp4', { type: 'video/mp4' });
    await subirEvidenciaMultimedia({
      archivo,
      misionId: MISION_ID,
      incidenteId: '   ',
      reporteTerrenoId: '44444444-4444-4444-8444-444444444444',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/evidencia/adjuntos',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${jwtFalso}`,
          'x-user-id': 'u-patrulla-jwt',
        }),
      })
    );

    const fdSent = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(fdSent.get('incidente_id')).toBeNull();
    expect(fdSent.get('reporte_terreno_id')).toBe('44444444-4444-4444-8444-444444444444');

    expect(extraerMensajeErrorHttp(409)).toContain('cerrado');
    expect(extraerMensajeErrorHttp(409, 'Incidente ya resuelto')).toBe(
      'Incidente ya resuelto'
    );
  });
});
