'use client';

import React from 'react';
import {
  Layers,
  Compass,
  CheckSquare,
  Archive,
  HardHat,
  Camera,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Heading } from '@/components/ui/Heading';
import { Button } from '@/components/ui/Button';
import styles from './TerrenoModulosGrid.module.css';

export interface ModuloTerrenoConfig {
  id: string;
  titulo: string;
  descripcion: string;
  href: string;
  icon: ComponentType<LucideProps>;
  rolesPermitidos: Array<'PATRULLA_VERIFICADORA' | 'DELEGADO_CUADRILLA'>;
  requiredPermissions: string[];
  badge?: string;
  accionPrimaria: string;
  soloLecturaEnInactividad?: boolean;
}

const MODULOS_TERRENO: ModuloTerrenoConfig[] = [
  // --- Módulos de Patrulla Verificadora ---
  {
    id: 'patrulla-misiones',
    titulo: 'Bandeja de Misiones de Patrulla',
    descripcion:
      'Recepción de despachos de verificación en tiempo real, aceptación o rechazo motivado y consulta de ubicación del incidente.',
    href: '/patrulla/misiones',
    icon: Compass,
    rolesPermitidos: ['PATRULLA_VERIFICADORA'],
    requiredPermissions: ['patrulla:misiones:leer', 'misiones:aceptar'],
    badge: 'Operativo • H35 / H36 / H69',
    accionPrimaria: 'Ver Misiones de Patrulla',
    soloLecturaEnInactividad: true,
  },
  {
    id: 'patrulla-triage',
    titulo: 'Triage, Tipología y Prioridad',
    descripcion:
      'Evaluación en sitio desde catálogo oficial, ajuste fundado de prioridad e informe técnico de situación o dictamen de no abordabilidad.',
    href: '/patrulla/misiones',
    icon: CheckSquare,
    rolesPermitidos: ['PATRULLA_VERIFICADORA'],
    requiredPermissions: ['patrulla:triage:evaluar', 'incidentes:tipologia:actualizar'],
    badge: 'Triage en Sitio • H37 / H38 / H39',
    accionPrimaria: 'Evaluar Incidente en Curso',
    soloLecturaEnInactividad: true,
  },
  {
    id: 'patrulla-historial',
    titulo: 'Historial de Misiones de Triage',
    descripcion:
      'Consulta de verificaciones efectuadas previamente por la patrulla, incluyendo registros almacenados localmente sin conexión.',
    href: '/patrulla/misiones',
    icon: Archive,
    rolesPermitidos: ['PATRULLA_VERIFICADORA'],
    requiredPermissions: ['patrulla:historial:leer'],
    badge: 'Registro Local • H85',
    accionPrimaria: 'Consultar Historial de Patrulla',
    soloLecturaEnInactividad: true,
  },

  // --- Módulos de Delegado de Cuadrilla ---
  {
    id: 'cuadrilla-misiones',
    titulo: 'Bandeja de Faenas de Cuadrilla',
    descripcion:
      'Aceptación o rechazo justificado de misiones pesadas asignadas por el Centro de Mando y reporte de arribo a terreno con GPS.',
    href: '/cuadrilla/misiones',
    icon: HardHat,
    rolesPermitidos: ['DELEGADO_CUADRILLA'],
    requiredPermissions: ['cuadrilla:misiones:leer', 'misiones:aceptar'],
    badge: 'Operativo • H40 / H41 / H42',
    accionPrimaria: 'Ver Faenas de Cuadrilla',
    soloLecturaEnInactividad: true,
  },
  {
    id: 'cuadrilla-ejecucion',
    titulo: 'Evidencia, Apoyos y Cierre de Faena',
    descripcion:
      'Captura fotográfica comprimida en terreno, solicitud estructurada de apoyos adicionales e informe final con insumos consumidos.',
    href: '/cuadrilla/misiones',
    icon: Camera,
    rolesPermitidos: ['DELEGADO_CUADRILLA'],
    requiredPermissions: ['cuadrilla:faena:ejecutar', 'evidencia:adjuntar'],
    badge: 'Ejecución • H43 / H44 / H68',
    accionPrimaria: 'Gestionar Faena Activa',
    soloLecturaEnInactividad: true,
  },
  {
    id: 'cuadrilla-historial',
    titulo: 'Historial de Faenas Operativas',
    descripcion:
      'Registro histórico de intervenciones ejecutadas por la cuadrilla con soporte de consulta offline e historial previo a desactivación.',
    href: '/cuadrilla/misiones',
    icon: Archive,
    rolesPermitidos: ['DELEGADO_CUADRILLA'],
    requiredPermissions: ['cuadrilla:historial:leer'],
    badge: 'Registro Local • H82',
    accionPrimaria: 'Consultar Historial de Faenas',
    soloLecturaEnInactividad: true,
  },
];

export function TerrenoModulosGrid() {
  const { usuario, unidadActiva, tieneAlgunPermiso } = useAuth();
  const rolActual = (usuario?.rolCodigo?.toUpperCase() || '') as
    | 'PATRULLA_VERIFICADORA'
    | 'DELEGADO_CUADRILLA';

  const modulosAutorizados = MODULOS_TERRENO.filter(
    (mod) =>
      mod.rolesPermitidos.includes(rolActual) &&
      tieneAlgunPermiso(mod.requiredPermissions)
  );

  return (
    <section
      className={styles.section}
      aria-labelledby="terreno-modulos-heading"
    >
      <div className={styles.sectionHeader}>
        <Layers size={20} color="var(--color-primary-teal, #1B6F7D)" aria-hidden="true" />
        <Heading as="h2" variant="h3" color="teal" noMargin id="terreno-modulos-heading">
          Módulos y Operaciones Disponibles
        </Heading>
      </div>

      {modulosAutorizados.length === 0 ? (
        <div className={styles.emptyState}>
          <ShieldAlert size={40} color="var(--color-warning, #E65100)" aria-hidden="true" />
          <Heading as="h3" variant="h4" color="charcoal-dark" noMargin>
            Sin Módulos de Terreno Asignados
          </Heading>
          <p className={styles.description}>
            Su cuenta no registra módulos habilitados en la aplicación de terreno. Comuníquese
            con el Encargado de Operaciones o Administrador del sistema.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {modulosAutorizados.map((modulo) => {
            const Icon = modulo.icon;
            const enModoHistorico = !unidadActiva && modulo.soloLecturaEnInactividad;
            const textoAccion = enModoHistorico
              ? 'Ver en Modo Lectura'
              : modulo.accionPrimaria;

            return (
              <article key={modulo.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.iconRow}>
                    <div className={styles.iconBox} aria-hidden="true">
                      <Icon size={22} />
                    </div>
                    <span
                      className={`${styles.badge} ${
                        enModoHistorico ? styles.badgeWarning : ''
                      }`.trim()}
                    >
                      {enModoHistorico ? 'Solo Lectura • Unidad Inactiva' : modulo.badge}
                    </span>
                  </div>

                  <Heading as="h3" variant="h4" color="teal" noMargin>
                    {modulo.titulo}
                  </Heading>

                  <p className={styles.description}>{modulo.descripcion}</p>
                </div>

                <div className={styles.actionsRow}>
                  <Button
                    variant={enModoHistorico ? 'secondary' : 'primary'}
                    size="md"
                    fullWidth
                    href={modulo.href}
                    icon={<ArrowRight size={18} />}
                    iconPosition="right"
                  >
                    {textoAccion}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default TerrenoModulosGrid;
