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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatRolLabel } from '@/lib/utils/labels';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import {
  obtenerMetricasPerfil,
  type MetricasPerfilTerreno,
} from '@/services/perfilTerrenoService';
import styles from './PerfilPage.module.css';

export default function TerrenoPerfilPage() {
  const { usuario, esCuadrilla, unidadActiva, logout } = useAuth();
  const [modalSalir, setModalSalir] = useState<boolean>(false);
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
    async function cargarEstadisticas() {
      const data = await obtenerMetricasPerfil(usuario, esCuadrilla);
      if (!cancelado) {
        setMetricas(data);
      }
    }
    void cargarEstadisticas();
    return () => {
      cancelado = true;
    };
  }, [usuario, esCuadrilla]);

  const nombreOperador = usuario?.nombre || 'Operador de Terreno';
  const rutOperador = usuario?.rut || 'No informado';
  const emailOperador = usuario?.email || 'No informado';
  const rolTexto = formatRolLabel(usuario?.rolCodigo || usuario?.rolNombre);
  const delegacionTexto = usuario?.delegacionNombre || 'Central Valdivia';
  const unidadTexto =
    usuario?.unidadNombre ||
    (esCuadrilla ? 'Cuadrilla Asignada' : 'Patrulla Asignada');
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
              <CheckCircle2
                size={16}
                color={unidadActiva ? 'var(--color-success)' : 'var(--color-danger)'}
                aria-hidden="true"
              />
              <span className={styles.infoValue}>
                {unidadActiva ? 'En servicio activo' : 'Unidad retirada del turno'}
              </span>
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

      {/* 4. Información Personal Institucional */}
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
