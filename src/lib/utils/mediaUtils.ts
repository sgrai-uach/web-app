import {
  MAX_BYTES_EVIDENCIA,
  MIME_PERMITIDOS_EVIDENCIA,
  MIME_PERMITIDOS_IMAGEN,
  MIME_PERMITIDOS_VIDEO,
  type MimePermitidoEvidencia,
} from '@/lib/validations/evidencia';

/**
 * Utilidades para validación, captura y compresión de evidencia multimedia en terreno (H43).
 */

export interface ImagenComprimida {
  base64: string;
  tamanoOriginalBytes: number;
  tamanoComprimidoBytes: number;
  tipoMime: string;
  nombreArchivo: string;
}

export interface ResultadoValidacionArchivo {
  valido: boolean;
  error?: string;
}

export interface EvidenciaPreparada {
  blob: Blob;
  dataUrl: string;
  nombreArchivo: string;
  tipoMime: MimePermitidoEvidencia;
  tamanoOriginalBytes: number;
  tamanoFinalBytes: number;
  comprimida: boolean;
}

export function normalizarMimeBase(tipoMime: string): string {
  if (!tipoMime) return '';
  return tipoMime.split(';')[0].trim().toLowerCase();
}

export function esMimeImagen(tipoMime: string): boolean {
  return (MIME_PERMITIDOS_IMAGEN as readonly string[]).includes(
    normalizarMimeBase(tipoMime)
  );
}

export function esMimeVideo(tipoMime: string): boolean {
  return (MIME_PERMITIDOS_VIDEO as readonly string[]).includes(
    normalizarMimeBase(tipoMime)
  );
}

export function esMimePdf(tipoMime: string): boolean {
  return normalizarMimeBase(tipoMime) === 'application/pdf';
}

export function esMimePermitidoEvidencia(
  tipoMime: string
): tipoMime is MimePermitidoEvidencia {
  return (MIME_PERMITIDOS_EVIDENCIA as readonly string[]).includes(
    normalizarMimeBase(tipoMime)
  );
}

/**
 * Formatea un tamaño en bytes a una cadena legible (KB / MB).
 */
export function formatearTamanoBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Valida estrictamente el tipo MIME y el peso máximo (10 MB) de un archivo antes de procesarlo.
 */
export function validarArchivoEvidencia(archivo: File): ResultadoValidacionArchivo {
  if (!esMimePermitidoEvidencia(archivo.type)) {
    return {
      valido: false,
      error: `Formato no permitido (${archivo.type || 'desconocido'}). Use JPEG, PNG, WebP, MP4, WebM, MOV o PDF.`,
    };
  }

  if (archivo.size <= 0) {
    return {
      valido: false,
      error: 'El archivo seleccionado está vacío.',
    };
  }

  if (archivo.size > MAX_BYTES_EVIDENCIA) {
    return {
      valido: false,
      error: `El archivo "${archivo.name}" pesa ${formatearTamanoBytes(archivo.size)} y supera el máximo permitido de 10 MB.`,
    };
  }

  return { valido: true };
}

/**
 * Convierte un Data URL (base64) en un objeto Blob binario.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const partes = dataUrl.split(',');
  if (partes.length < 2) {
    throw new Error('Formato Data URL inválido.');
  }
  const mimeMatch = partes[0].match(/:(.*?);/);
  const mime = mimeMatch?.[1] || 'application/octet-stream';
  const binario = atob(partes[1]);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Lee un Blob o File como Data URL (base64) para almacenamiento persistente en IndexedDB.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo convertir el archivo a Data URL.'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Error al leer el archivo para almacenamiento local.'));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Comprime un archivo de imagen en cliente usando un elemento Canvas virtual.
 * Redimensiona a dimensiones máximas de 1280x1280 px y calidad JPEG 0.75.
 */
export async function comprimirImagenEnCliente(
  archivo: File,
  maxDimension = 1280,
  calidad = 0.75
): Promise<ImagenComprimida> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el contexto 2D de renderizado.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL('image/jpeg', calidad);
        const bytesAproximados = Math.round((base64.length * 3) / 4);

        resolve({
          base64,
          tamanoOriginalBytes: archivo.size,
          tamanoComprimidoBytes: bytesAproximados,
          tipoMime: 'image/jpeg',
          nombreArchivo: archivo.name.replace(/\.[^/.]+$/, '') + '.jpg',
        });
      };

      img.onerror = () => {
        reject(new Error('Error al cargar la imagen para compresión.'));
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo de la cámara o galería.'));
    };

    reader.readAsDataURL(archivo);
  });
}

/**
 * Valida y prepara cualquier evidencia multimedia (imagen, video o PDF) para subida o cola offline.
 * - Imágenes: se comprimen en cliente a JPEG <= 1280px.
 * - Videos y PDFs: se conservan íntegros verificando límite <= 10 MB.
 */
export async function prepararEvidenciaParaSubida(
  archivo: File
): Promise<EvidenciaPreparada> {
  const validacion = validarArchivoEvidencia(archivo);
  if (!validacion.valido) {
    throw new Error(validacion.error || 'Archivo inválido.');
  }

  if (esMimeImagen(archivo.type)) {
    const comprimida = await comprimirImagenEnCliente(archivo);
    const blob = dataUrlToBlob(comprimida.base64);
    if (blob.size <= 0) {
      throw new Error('La imagen comprimida resultó vacía (0 bytes).');
    }
    if (blob.size > MAX_BYTES_EVIDENCIA) {
      throw new Error('La imagen comprimida supera el límite máximo permitido de 10 MB.');
    }

    return {
      blob,
      dataUrl: comprimida.base64,
      nombreArchivo: comprimida.nombreArchivo,
      tipoMime: 'image/jpeg',
      tamanoOriginalBytes: archivo.size,
      tamanoFinalBytes: blob.size,
      comprimida: true,
    };
  }

  if (archivo.size <= 0) {
    throw new Error('El archivo seleccionado está vacío.');
  }

  const dataUrl = await blobToDataUrl(archivo);
  return {
    blob: archivo,
    dataUrl,
    nombreArchivo: archivo.name,
    tipoMime: normalizarMimeBase(archivo.type) as MimePermitidoEvidencia,
    tamanoOriginalBytes: archivo.size,
    tamanoFinalBytes: archivo.size,
    comprimida: false,
  };
}
