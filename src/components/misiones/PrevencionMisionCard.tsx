'use client';

import React from 'react';
import { ShieldCheck, Package, Wrench, Map } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import {
  BloqueFormularioReporte,
  CampoResumenReporte,
  NotaInformativaReporte,
} from './ReporteTerrenoBase';
import {
  obtenerVarianteChipEstadoMision,
  obtenerVarianteChipEstadoRecurso,
  obtenerVarianteChipPrioridad,
} from '@/lib/utils/chipVariants';
import { formatearEstado, formatearPrioridad, formatearTipologia } from '@/lib/utils/formatters';
import { obtenerContextoPrevencionMision } from '@/services/prevencionService';
import type { MisionLocal } from '@/types/offline';
import styles from './PrevencionMisionCard.module.css';

export interface PrevencionMisionCardProps {
  mision: MisionLocal;
  esOffline?: boolean;
  onVerMapa?: () => void;
}

export function PrevencionMisionCard({
  mision,
  esOffline = false,
  onVerMapa,
}: PrevencionMisionCardProps) {
  const { eventoPrevencion, puntoCritico, recursosMision } =
    obtenerContextoPrevencionMision(mision);

  const estadoEvento =
    eventoPrevencion?.estado ||
    (typeof mision.datosAdicionales?.estadoEventoPrevencion === 'string'
      ? mision.datosAdicionales.estadoEventoPrevencion
      : null);

  const delegacionTexto =
    eventoPrevencion?.delegacionNombre ||
    puntoCritico?.delegacionNombre ||
    null;

  const sectorDireccion = [eventoPrevencion?.sector, eventoPrevencion?.direccionTexto]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' — ');

  return (
    <section
      className={styles.card}
      data-testid="prevencion-mision-card"
      aria-label="Detalle de operación preventiva y recursos logísticos asignados"
    >
      <BloqueFormularioReporte
        icono={<ShieldCheck size={16} aria-hidden="true" />}
        titulo="Evento Preventivo y Punto Crítico"
        chipDerecha={
          <Chip variant="teal" size="sm">
            Prevención territorial
          </Chip>
        }
      >
        <div className={styles.eventoHeaderGrid}>
          {eventoPrevencion && (
            <>
              <CampoResumenReporte
                label="Evento programado"
                valor={`${eventoPrevencion.codigo} — ${eventoPrevencion.nombre}`}
              />

              <div className={styles.chipsInline}>
                {estadoEvento && (
                  <Chip variant={obtenerVarianteChipEstadoMision(estadoEvento)} size="sm">
                    {formatearEstado(estadoEvento)}
                  </Chip>
                )}
                {eventoPrevencion.prioridad && (
                  <Chip
                    variant={obtenerVarianteChipPrioridad(eventoPrevencion.prioridad)}
                    size="sm"
                  >
                    {formatearPrioridad(eventoPrevencion.prioridad)}
                  </Chip>
                )}
              </div>
            </>
          )}

          {delegacionTexto && (
            <CampoResumenReporte label="Delegación municipal" valor={delegacionTexto} />
          )}

          {sectorDireccion && (
            <CampoResumenReporte label="Sector / Referencia" valor={sectorDireccion} />
          )}

          {puntoCritico && (
            <>
              <CampoResumenReporte
                label="Punto crítico monitoreado"
                valor={`${puntoCritico.codigo} — ${puntoCritico.nombre}`}
              />
              {puntoCritico.tipoRiesgo && (
                <CampoResumenReporte
                  label="Amenaza recurrente"
                  valor={formatearTipologia(puntoCritico.tipoRiesgo)}
                />
              )}
              {puntoCritico.descripcion && (
                <CampoResumenReporte
                  label="Detalle de vulnerabilidad"
                  valor={puntoCritico.descripcion}
                  esBloqueTexto
                />
              )}
            </>
          )}

          {!eventoPrevencion && !puntoCritico && (
            <NotaInformativaReporte testId="nota-prevencion-resumen-basico">
              Operación preventiva programada sin incidente previo.
              {esOffline
                ? ' El detalle extendido del punto crítico se sincronizará al recuperar cobertura.'
                : ''}
            </NotaInformativaReporte>
          )}

          {mision.coordenadas && onVerMapa && (
            <Button
              type="button"
              variant="outline"
              size="md"
              icon={<Map size={16} />}
              onClick={onVerMapa}
              className={styles.mapBtn}
            >
              Ver punto crítico en mapa
            </Button>
          )}
        </div>
      </BloqueFormularioReporte>

      <BloqueFormularioReporte
        icono={<Package size={16} aria-hidden="true" />}
        titulo="Recursos Logísticos Asignados"
        chipDerecha={
          <Chip variant="solid-teal" size="sm">
            {recursosMision.length}{' '}
            {recursosMision.length === 1 ? 'recurso' : 'recursos'}
          </Chip>
        }
      >
        {recursosMision.length > 0 ? (
          <ul
            className={styles.resourceList}
            data-testid="lista-recursos-prevencion"
          >
            {recursosMision.map((recurso) => {
              const unidadTexto =
                recurso.unidad?.trim() ||
                (recurso.esIndividual ? 'unidad' : 'un.');
              return (
                <li
                  key={recurso.id || `${recurso.recursoId}-${recurso.misionId ?? 'ev'}`}
                  className={styles.resourceItem}
                  data-testid={`recurso-prevencion-${recurso.recursoId}`}
                >
                  <div className={styles.resourceInfo}>
                    <div className={styles.resourceTitleRow}>
                      {recurso.esIndividual ? (
                        <Wrench
                          size={16}
                          className={styles.resourceIcon}
                          aria-hidden="true"
                        />
                      ) : (
                        <Package
                          size={16}
                          className={styles.resourceIcon}
                          aria-hidden="true"
                        />
                      )}
                      <span>{recurso.nombre}</span>
                    </div>

                    <div className={styles.resourceBadges}>
                      <Chip
                        variant={recurso.esIndividual ? 'info' : 'neutral'}
                        size="sm"
                      >
                        {recurso.esIndividual ? 'Activo individual' : 'Insumo a granel'}
                      </Chip>
                      {recurso.estadoRecurso && (
                        <Chip
                          variant={obtenerVarianteChipEstadoRecurso(
                            recurso.estadoRecurso
                          )}
                          size="sm"
                        >
                          {formatearEstado(recurso.estadoRecurso)}
                        </Chip>
                      )}
                    </div>
                  </div>

                  <div className={styles.resourceQuantityBox}>
                    <span className={styles.resourceQuantityLabel}>Asignado</span>
                    <span className={styles.resourceQuantityValue}>
                      {recurso.cantidadAsignada} {unidadTexto}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <NotaInformativaReporte testId="sin-recursos-prevencion">
            {esOffline
              ? 'Sin recursos cacheados localmente para esta misión. Conéctese a la red para sincronizar el detalle logístico.'
              : 'Esta misión preventiva no registra materiales o activos individuales asignados hasta el momento.'}
          </NotaInformativaReporte>
        )}
      </BloqueFormularioReporte>
    </section>
  );
}

export default PrevencionMisionCard;
