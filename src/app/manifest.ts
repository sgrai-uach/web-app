import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SGRAI — App Terreno',
    short_name: 'SGRAI Terreno',
    description:
      'Aplicación de terreno (PWA) para Patrulla Verificadora y Delegado de Cuadrilla, Municipalidad de Valdivia.',
    id: '/terreno',
    start_url: '/terreno',
    scope: '/terreno',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ECEFF3',
    theme_color: '#14505A',
    lang: 'es-CL',
    icons: [
      {
        src: '/terreno/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        src: '/terreno/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/terreno/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/terreno/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/terreno/icons/maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/terreno/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
