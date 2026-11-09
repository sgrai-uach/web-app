'use client';

import React, { useEffect, useState } from 'react';
import {
  User,
  Shield,
  Compass,
  HardHat,
  BarChart3,
  LogOut,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  History,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatRolLabel } from '@/lib/utils/labels';
import { formatearFechaHora24h } from '@/lib/utils/formatters';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import {
  obtenerMetricasPerfil,
  registrarPatrullaEnHistorial,
  obtenerHistorialUnidades,
  type MetricasPerfilTerreno,
} from '@/services/perfilTerrenoService';
import type { HistorialUnidadOperador } from '@/types/seguridad';
import styles from './PerfilPage.module.css';

export default function TerrenoPerfilPage() {
  const { usuario, esCuadrilla, unidadActiva, tieneUnidadAsignada, logout } = useAuth();
  const [modalSalir, setModalSalir] = useState<boolean>(false);
  const [historialUnidades, setHistorialUnidades] = useState<HistorialUnidadOperador[]>([]);
  const [metricas, setMetricas] = useState<MetricasPerfilTerreno>({
    misionesAtendidas: 0,
    misionesEnCurso: 0,
    misionesPendientes: 0,
    totalMisiones: 0,
    especialidad: esCuadrilla
      ? 'Cuadrilla de Respuesta Operativa y Despeje'
      : 'Operaciones de Terreno y Triage Primario',
  });

  useEffect(() => {
    let cancelado = false;
    async function cargarDatos() {
      if (usuario && tieneUnidadAsignada) {
        await registrarPatrullaEnHistorial(usuario);
      }

      const stats = await obtenerMetricasPerfil(usuario, esCuadrilla);
      if (cancelado) return;
      setMetricas(stats);

      if (usuario?.id) {
        const historial = await obtenerHistorialUnidades(usuario.id);
        if (!cancelado) {
          setHistorialUnidades(historial || []);
        }
      }
    }

    void cargarDatos();
    return () => {
      cancelado = true;
    };
  }, [usuario, esCuadrilla, tieneUnidadAsignada]);

  const nombreOperador = usuario?.nombre || 'Operador de Terreno';
  const rutOperador = usuario?.rut || 'No informado';
  const emailOperador = usuario?.email || 'No informado';
  const rolTexto = formatRolLabel(usuario?.rolCodigo || usuario?.rolNombre);
  const delegacionTexto = usuario?.delegacionNombre || 'Central Valdivia';
  const tieneUnidad = tieneUnidadAsignada || Boolean(usuario?.unidadNombre);
  const unidadTexto = tieneUnidad && usuario?.unidadNombre
    ? usuario.unidadNombre
    : esCuadrilla
    ? 'Sin cuadrilla asignada'
    : 'Sin patrulla asignada';
  const UnidadIcon = esCuadrilla ? HardHat : Compass;

  return (
    <div className={styles.container}>
      {/* 1. Cabecera Institucional del Operador (Sin Foto) */}
      <section className={styles.profileBanner} aria-label="Identificación del operador">
        <h1 className={styles.operatorName}>{nombreOperador}</h1>
        <div className={styles.roleTag}>
          <Shield size={14} aria-hidden="true" />
          <span>{rolTexto}</span>
        </div>
      </section>

      {/* 2. Estadísticas de Desempeño Operativo */}
      <section className={styles.sectionCard} aria-labelledby="heading-metricas">
        <div className={styles.sectionHeader} id="heading-metricas">
          <BarChart3 size={18} aria-hidden="true" />
          <span>Rendimiento Operativo</span>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={`${styles.statNumber} ${styles.statNumberSuccess}`}>
              {metricas.misionesAtendidas}
            </span>
            <span className={styles.statLabel}>Atendidas</span>
          </div>

          <div className={styles.statCard}>
            <span className={`${styles.statNumber} ${styles.statNumberWarning}`}>
              {metricas.misionesEnCurso}
            </span>
            <span className={styles.statLabel}>En curso</span>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statNumber}>
              {metricas.misionesPendientes}
            </span>
            <span className={styles.statLabel}>Pendientes</span>
          </div>
        </div>
      </section>

      {/* 3. Asignación Operativa y Especialidad */}
      <section className={styles.sectionCard} aria-labelledby="heading-unidad">
        <div className={styles.sectionHeader} id="heading-unidad">
          <UnidadIcon size={18} aria-hidden="true" />
          <span>Asignación Operativa</span>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Unidad Asignada</span>
            <span className={`${styles.infoValue} ${styles.infoValueBold}`}>{unidadTexto}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Especialidad Técnica</span>
            <span className={styles.infoValue}>{metricas.especialidad}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Estado Operativo</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!tieneUnidadAsignada ? (
                <>
                  <Clock size={16} color="var(--color-text-muted)" aria-hidden="true" />
                  <span className={styles.infoValue}>Sin asignación operativa activa</span>
                </>
              ) : unidadActiva ? (
                <>
                  <CheckCircle2 size={16} color="var(--color-success)" aria-hidden="true" />
                  <span className={styles.infoValue}>En servicio activo</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} color="var(--color-warning)" aria-hidden="true" />
                  <span className={styles.infoValue}>Unidad retirada del turno (§3.7 de baja)</span>
                </>
              )}
            </div>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Jurisdicción / Delegación</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={16} color="var(--color-primary-teal)" aria-hidden="true" />
              <span className={styles.infoValue}>{delegacionTexto}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Historial de Patrullas / Unidades Asignadas */}
      <section className={styles.sectionCard} aria-labelledby="heading-historial-unidades">
        <div className={styles.sectionHeader} id="heading-historial-unidades">
          <History size={18} aria-hidden="true" />
          <span>{esCuadrilla ? 'Historial de Cuadrillas Asignadas' : 'Historial de Patrullas Asignadas'}</span>
        </div>

        {(historialUnidades || []).length === 0 ? (
          <p className={styles.historyEmpty}>
            No se registran unidades históricas asociadas a este funcionario en este dispositivo.
          </p>
        ) : (
          <div className={styles.historyList}>
            {(historialUnidades || []).map((item) => {
              const esActivaActual =
                tieneUnidadAsignada &&
                usuario?.unidadId === item.unidadId &&
                unidadActiva;
              const chipClass = esActivaActual
                ? styles.statusChipActive
                : styles.statusChipInactive;
              const chipLabel = esActivaActual
                ? 'Activa'
                : item.estadoAlMomento === 'DESACTIVADA'
                ? 'Desactivada'
                : 'Turno Anterior';

              return (
                <div key={item.unidadId} className={styles.historyCard}>
                  <div className={styles.historyHeader}>
                    <span className={styles.historyTitle}>{item.nombre}</span>
                    <span className={`${styles.statusChip} ${chipClass}`}>
                      {chipLabel}
                    </span>
                  </div>
                  <div className={styles.historyDates}>
                    <span>Registro: {formatearFechaHora24h(item.fechaPrimerRegistro)}</span>
                    <span>·</span>
                    <span>Último turno: {formatearFechaHora24h(item.ultimaVezVisto)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Información Personal Institucional */}
      <section className={styles.sectionCard} aria-labelledby="heading-personal">
        <div className={styles.sectionHeader} id="heading-personal">
          <User size={18} aria-hidden="true" />
          <span>Datos del Funcionario</span>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>RUT Institucional</span>
            <span className={styles.infoValue}>{rutOperador}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Correo Electrónico</span>
            <span className={styles.infoValue}>{emailOperador}</span>
          </div>
        </div>
      </section>

      {/* 5. Cierre de Sesión Seguro */}
      <div className={styles.actionsArea}>
        <Button
          variant="outline"
          size="lg"
          icon={<LogOut size={18} />}
          onClick={() => setModalSalir(true)}
        >
          Cerrar sesión de terreno
        </Button>
      </div>

      <ConfirmModal
        abierto={modalSalir}
        titulo="¿Cerrar sesión de terreno?"
        mensaje="Se cerrará la sesión actual en este dispositivo. Para volver a operar misiones deberá ingresar sus credenciales institucionales."
        textoConfirmar="Cerrar sesión"
        textoCancelar="Permanecer"
        alConfirmar={() => {
          setModalSalir(false);
          logout();
        }}
        alCancelar={() => setModalSalir(false)}
      />
    </div>
  );
}
