import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CargaEvidenciaCard } from '@/components/misiones/CargaEvidenciaCard';
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
});
