import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  CargaEvidenciaCard,
  resolverUrlEvidencia,
} from '@/components/misiones/CargaEvidenciaCard';
import * as evidenciaService from '@/services/evidenciaService';
import type { AdjuntoLocal } from '@/types/offline';

describe('CargaEvidenciaCard (H43)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza botones de captura fotográfica, grabación de video y selector de archivos/PDF', () => {
    render(
      <CargaEvidenciaCard
        misionId="mision-1"
        incidenteId="22222222-2222-4222-8222-222222222222"
        adjuntos={[]}
      />
    );

    expect(screen.getByRole('button', { name: /Tomar Foto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Grabar Video/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Galería \/ PDF/i })).toBeInTheDocument();

    const inputFoto = screen.getByTestId('input-captura-foto');
    expect(inputFoto).toHaveAttribute('capture', 'environment');
    expect(inputFoto).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');

    const inputVideo = screen.getByTestId('input-captura-video');
    expect(inputVideo).toHaveAttribute('capture', 'environment');
    expect(inputVideo).toHaveAttribute('accept', 'video/mp4,video/webm,video/quicktime');

    const inputArchivo = screen.getByTestId('input-seleccion-archivo');
    expect(inputArchivo).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf'
    );
  });

  it('muestra error inmediato cuando el archivo supera 10 MB o tiene MIME inválido', async () => {
    const spySubir = vi.spyOn(evidenciaService, 'subirEvidenciaMultimedia');

    render(
      <CargaEvidenciaCard
        misionId="mision-1"
        incidenteId="22222222-2222-4222-8222-222222222222"
        adjuntos={[]}
      />
    );

    const inputArchivo = screen.getByTestId('input-seleccion-archivo');
    const archivoInvalido = new File(['texto'], 'notas.txt', { type: 'text/plain' });

    fireEvent.change(inputArchivo, { target: { files: [archivoInvalido] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Formato no permitido/i);
    });
    expect(spySubir).not.toHaveBeenCalled();
  });

  it('previsualiza miniaturas de imagen, reproductor de video y tarjetas de documento PDF', () => {
    const adjuntos: AdjuntoLocal[] = [
      {
        id: 'adj-img',
        nombreArchivo: 'poste_caido.webp',
        url: '/uploads/evidencia/poste.webp',
        tipoMime: 'image/webp',
        tamanoBytes: 120000,
        creadoEn: '2026-11-17T19:00:00.000Z',
        sincronizacionPendiente: false,
      },
      {
        id: 'adj-vid',
        nombreArchivo: 'anegamiento.mp4',
        url: '/uploads/evidencia/anegamiento.mp4',
        tipoMime: 'video/mp4',
        tamanoBytes: 3200000,
        creadoEn: '2026-11-17T19:01:00.000Z',
        sincronizacionPendiente: true,
      },
      {
        id: 'adj-pdf',
        nombreArchivo: 'acta_terreno.pdf',
        url: '/uploads/evidencia/acta.pdf',
        tipoMime: 'application/pdf',
        tamanoBytes: 450000,
        creadoEn: '2026-11-17T19:02:00.000Z',
        sincronizacionPendiente: false,
      },
    ];

    render(
      <CargaEvidenciaCard
        misionId="mision-1"
        incidenteId="22222222-2222-4222-8222-222222222222"
        adjuntos={adjuntos}
      />
    );

    expect(screen.getByAltText('Miniatura de poste_caido.webp')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Previsualización de video anegamiento.mp4')
    ).toBeInTheDocument();
    expect(screen.getByText('acta_terreno.pdf')).toBeInTheDocument();
    expect(screen.getByText('Pendiente offline')).toBeInTheDocument();
    expect(screen.getAllByText('Sincronizado')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Ver PDF/i })).toHaveAttribute(
      'href',
      '/uploads/evidencia/acta.pdf'
    );
  });

  it('invoca subirEvidenciaMultimedia y notifica al padre al seleccionar un archivo válido', async () => {
    const mockAdjunto: AdjuntoLocal = {
      id: 'adj-nuevo',
      nombreArchivo: 'foto.jpg',
      url: 'data:image/jpeg;base64,abc',
      tipoMime: 'image/jpeg',
      tamanoBytes: 25000,
      creadoEn: '2026-11-17T19:05:00.000Z',
      sincronizacionPendiente: true,
    };

    const spySubir = vi
      .spyOn(evidenciaService, 'subirEvidenciaMultimedia')
      .mockResolvedValue({
        adjunto: mockAdjunto,
        enColaOffline: true,
        mensaje: 'Sin conexión. Evidencia guardada localmente.',
      });
    const onAdjuntar = vi.fn();

    render(
      <CargaEvidenciaCard
        misionId="mision-1"
        incidenteId="22222222-2222-4222-8222-222222222222"
        adjuntos={[]}
        alAdjuntarEvidencia={onAdjuntar}
      />
    );

    const inputFoto = screen.getByTestId('input-captura-foto');
    const foto = new File(['jpg-bytes'], 'foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(inputFoto, { target: { files: [foto] } });

    await waitFor(() => {
      expect(spySubir).toHaveBeenCalledTimes(1);
      expect(onAdjuntar).toHaveBeenCalledWith(mockAdjunto, true);
      expect(screen.getByRole('status')).toHaveTextContent(/guardada localmente/i);
    });
  });

  it('resuelve rutas relativas /uploads/evidencia/... contra NEXT_PUBLIC_API_URL y conserva blob:', () => {
    const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4001/';

    try {
      const adjuntos: AdjuntoLocal[] = [
        {
          id: 'adj-remoto',
          nombreArchivo: 'pudu.webp',
          url: '/uploads/evidencia/abc123.webp',
          tipoMime: 'image/webp',
          tamanoBytes: 2048,
          creadoEn: '2026-11-18T00:00:00.000Z',
          sincronizacionPendiente: false,
        },
        {
          id: 'adj-video',
          nombreArchivo: 'clip.mp4',
          url: '/uploads/evidencia/vid123.mp4',
          tipoMime: 'video/mp4',
          tamanoBytes: 4096,
          creadoEn: '2026-11-18T00:01:00.000Z',
          sincronizacionPendiente: false,
        },
        {
          id: 'adj-blob',
          nombreArchivo: 'offline.jpg',
          url: 'blob:http://localhost:3002/offline-1',
          tipoMime: 'image/jpeg',
          tamanoBytes: 1024,
          creadoEn: '2026-11-18T00:02:00.000Z',
          sincronizacionPendiente: true,
        },
      ];

      render(
        <CargaEvidenciaCard
          misionId="mision-1"
          incidenteId="22222222-2222-4222-8222-222222222222"
          adjuntos={adjuntos}
        />
      );

      expect(screen.getByAltText('Miniatura de pudu.webp')).toHaveAttribute(
        'src',
        'http://localhost:4001/uploads/evidencia/abc123.webp'
      );
      expect(screen.getByLabelText('Previsualización de video clip.mp4')).toHaveAttribute(
        'src',
        'http://localhost:4001/uploads/evidencia/vid123.mp4'
      );
      expect(screen.getByAltText('Miniatura de offline.jpg')).toHaveAttribute(
        'src',
        'blob:http://localhost:3002/offline-1'
      );
    } finally {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    }
  });

  it('BUG-H43-PWA-05/06: acumula errores de lote múltiple, renderiza enlace Ver PDF para data:application/pdf y usa ruta relativa en producción navegador', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4001/';
    vi.stubEnv('NODE_ENV', 'production');

    try {
      expect(resolverUrlEvidencia('/uploads/evidencia/prod.jpg')).toBe(
        '/uploads/evidencia/prod.jpg'
      );
    } finally {
      vi.stubEnv('NODE_ENV', originalEnv || 'test');
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    }

    render(
      <CargaEvidenciaCard
        misionId="mision-lote"
        incidenteId="22222222-2222-4222-8222-222222222222"
        adjuntos={[
          {
            id: 'local-pdf-1',
            nombreArchivo: 'acta-offline.pdf',
            url: `data:application/pdf;base64,${btoa('pdf')}`,
            tipoMime: 'application/pdf',
            tamanoBytes: 512,
            creadoEn: '2026-11-20T12:00:00.000Z',
            sincronizacionPendiente: true,
          },
        ]}
      />
    );

    const pdfLink = screen.getByRole('link', { name: /Ver PDF/i });
    expect(pdfLink).toHaveAttribute('download', 'acta-offline.pdf');

    const inputArchivo = screen.getByTestId('input-seleccion-archivo');
    const badMime = new File(['abc'], 'mal.exe', { type: 'application/x-msdownload' });
    const badSize = new File(['x'], 'pesado.pdf', { type: 'application/pdf' });
    Object.defineProperty(badSize, 'size', { value: 11 * 1024 * 1024 });

    fireEvent.change(inputArchivo, { target: { files: [badMime, badSize] } });

    await waitFor(() => {
      const alerta = screen.getByRole('alert').textContent || '';
      expect(alerta).toContain('Formato no permitido');
      expect(alerta).toContain('supera el máximo permitido de 10 MB');
    });
  });
});
