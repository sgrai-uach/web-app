import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validarArchivoEvidencia,
  prepararEvidenciaParaSubida,
  formatearTamanoBytes,
  dataUrlToBlob,
} from '@/lib/utils/mediaUtils';
import { MAX_BYTES_EVIDENCIA } from '@/lib/validations/evidencia';

describe('mediaUtils (H43)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('validarArchivoEvidencia', () => {
    it('acepta imágenes JPEG, PNG, WebP, videos MP4, WebM, MOV y documentos PDF dentro de 10 MB', () => {
      const mimesValidos = [
        { name: 'foto.jpg', type: 'image/jpeg' },
        { name: 'captura.png', type: 'image/png' },
        { name: 'terreno.webp', type: 'image/webp' },
        { name: 'recorrido.mp4', type: 'video/mp4' },
        { name: 'clip.webm', type: 'video/webm' },
        { name: 'iphone.mov', type: 'video/quicktime' },
        { name: 'informe.pdf', type: 'application/pdf' },
      ];

      for (const item of mimesValidos) {
        const file = new File(['contenido'], item.name, { type: item.type });
        const res = validarArchivoEvidencia(file);
        expect(res.valido).toBe(true);
      }
    });

    it('rechaza tipos MIME no autorizados (ej. image/gif, text/plain)', () => {
      const gif = new File(['gif'], 'anim.gif', { type: 'image/gif' });
      const txt = new File(['hola'], 'notas.txt', { type: 'text/plain' });

      expect(validarArchivoEvidencia(gif).valido).toBe(false);
      expect(validarArchivoEvidencia(gif).error).toContain('Formato no permitido');
      expect(validarArchivoEvidencia(txt).valido).toBe(false);
    });

    it('rechaza archivos que superen los 10 MB', () => {
      const archivoGrande = new File(['x'], 'video_pesado.mp4', { type: 'video/mp4' });
      Object.defineProperty(archivoGrande, 'size', {
        value: MAX_BYTES_EVIDENCIA + 1,
      });

      const res = validarArchivoEvidencia(archivoGrande);
      expect(res.valido).toBe(false);
      expect(res.error).toContain('supera el máximo permitido de 10 MB');
    });

    it('rechaza archivos vacíos (0 bytes)', () => {
      const vacio = new File([], 'vacio.pdf', { type: 'application/pdf' });
      const res = validarArchivoEvidencia(vacio);
      expect(res.valido).toBe(false);
      expect(res.error).toContain('vacío');
    });
  });

  describe('prepararEvidenciaParaSubida', () => {
    it('comprime imágenes en cliente usando Canvas y retorna JPEG', async () => {
      const mockDataUrl = 'data:image/jpeg;base64,' + btoa('imagen-comprimida');
      const mockCtx = { drawImage: vi.fn() };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockCtx),
        toDataURL: vi.fn(() => mockDataUrl),
      };

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName);
      });

      class MockFileReader {
        result: string | null = null;
        onload: ((e: { target: { result: string } }) => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL() {
          this.result = 'data:image/png;base64,' + btoa('original');
          if (this.onload) {
            this.onload({ target: { result: this.result } });
          }
        }
      }

      class MockImage {
        width = 2560;
        height = 1440;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_val: string) {
          if (this.onload) this.onload();
        }
      }

      vi.stubGlobal('FileReader', MockFileReader);
      vi.stubGlobal('Image', MockImage);

      const file = new File(['png-bytes'], 'evidencia.png', { type: 'image/png' });
      const preparada = await prepararEvidenciaParaSubida(file);

      expect(preparada.comprimida).toBe(true);
      expect(preparada.tipoMime).toBe('image/jpeg');
      expect(preparada.nombreArchivo).toBe('evidencia.jpg');
      expect(mockCanvas.width).toBe(1280);
      expect(mockCanvas.height).toBe(720);
      expect(preparada.blob.size).toBeGreaterThan(0);
    });

    it('mantiene íntegros los videos MP4 y documentos PDF sin compresión Canvas', async () => {
      class MockFileReader {
        result: string | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL(blob: Blob) {
          this.result = `data:${blob.type};base64,${btoa('binario')}`;
          if (this.onload) this.onload();
        }
      }
      vi.stubGlobal('FileReader', MockFileReader);

      const video = new File(['video-data'], 'inspeccion.mp4', { type: 'video/mp4' });
      const resVideo = await prepararEvidenciaParaSubida(video);
      expect(resVideo.comprimida).toBe(false);
      expect(resVideo.tipoMime).toBe('video/mp4');
      expect(resVideo.nombreArchivo).toBe('inspeccion.mp4');

      const pdf = new File(['pdf-data'], 'acta.pdf', { type: 'application/pdf' });
      const resPdf = await prepararEvidenciaParaSubida(pdf);
      expect(resPdf.comprimida).toBe(false);
      expect(resPdf.tipoMime).toBe('application/pdf');
      expect(resPdf.nombreArchivo).toBe('acta.pdf');
    });
  });

  describe('utilidades auxiliares', () => {
    it('formatea tamaños en B, KB y MB correctamente', () => {
      expect(formatearTamanoBytes(500)).toBe('500 B');
      expect(formatearTamanoBytes(2048)).toBe('2.0 KB');
      expect(formatearTamanoBytes(5 * 1024 * 1024)).toBe('5.00 MB');
    });

    it('reconstruye un Blob válido desde un Data URL', () => {
      const dataUrl = `data:application/pdf;base64,${btoa('hola-pdf')}`;
      const blob = dataUrlToBlob(dataUrl);
      expect(blob.type).toBe('application/pdf');
      expect(blob.size).toBe(8);
    });
  });
});
