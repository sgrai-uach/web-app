import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SGRAI — App Terreno',
    short_name: 'SGRAI Terreno',
    description:
      'Aplicación de terreno (PWA) para Patrulla Verificadora y Delegado de Cuadrilla, Municipalidad de Valdivia.',
    start_url: '/terreno',
    scope: '/terreno/',
    display: 'standalone',
    background_color: '#ECEFF3',
    theme_color: '#14505A',
    lang: 'es-CL',
    icons: [
      {
        src: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
