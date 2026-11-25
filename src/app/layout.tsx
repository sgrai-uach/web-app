import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/context/AuthContext';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';

/**
 * Noto Sans auto-alojada (next/font/local).
 * Evita la descarga de Google Fonts durante el build en CI/Docker, que provoca el
 * error "An error occurred in next/font" cuando no hay salida a Internet.
 */
const notoSans = localFont({
  src: [
    {
      path: '../fonts/noto-sans/NotoSans-Latin-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/noto-sans/NotoSans-Latin-500.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/noto-sans/NotoSans-Latin-600.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/noto-sans/NotoSans-Latin-700.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/noto-sans/NotoSans-Latin-800.woff2',
      weight: '800',
      style: 'normal',
    },
  ],
  variable: '--font-noto-sans',
  display: 'swap',
  fallback: ['system-ui', 'arial', 'sans-serif'],
});

export const viewport: Viewport = {
  themeColor: '#14505A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'SGRAI — App Terreno',
  description:
    'Aplicación de terreno (PWA) del Sistema de Gestión de Recursos para Atención de Incidentes, Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.',
  icons: {
    icon: [
      { url: '/terreno/favicon.ico' },
      { url: '/terreno/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/terreno/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/terreno/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        url: '/terreno/android-chrome-192x192.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        url: '/terreno/android-chrome-512x512.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CL" className={notoSans.variable}>
      <body className={notoSans.className}>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
