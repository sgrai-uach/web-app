/**
 * Utilidades para captura y compresión de evidencia fotográfica en terreno
 */

export interface ImagenComprimida {
  base64: string;
  tamanoOriginalBytes: number;
  tamanoComprimidoBytes: number;
  tipoMime: string;
  nombreArchivo: string;
}

/**
 * Comprime un archivo de imagen en cliente usando un elemento Canvas virtual
 * Redimensiona a dimensiones máximas de 1280x1280 px y calidad JPEG 0.75
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
