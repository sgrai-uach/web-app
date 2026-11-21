'use client';

import React from 'react';
import {
  Users,
  Baby,
  UserCheck,
  Accessibility,
  Zap,
  HeartHandshake,
  Plus,
  Minus,
  Info,
  Phone,
} from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import {
  NIVELES_COMPROMISO_VIVIENDA,
  calcularLimitesFamilia,
  validarCoherenciaFamiliaTerreno,
} from '@/lib/validations/prioridad';
import { ETIQUETAS_COMPROMISO_VIVIENDA } from '@/lib/utils/labels';
import type { FamiliaAfectadaItem, NivelCompromisoVivienda } from '@/types/offline';
import styles from './FamiliasTerrenoSection.module.css';

export interface FamiliasTerrenoSectionProps {
  titulo?: string;
  familias: FamiliaAfectadaItem[];
  onChange: (familias: FamiliaAfectadaItem[]) => void;
  contactoObligatorio?: boolean;
  disabled?: boolean;
  permitirListaVacia?: boolean;
}

type CampoContador =
  | 'nucleoFamiliarTotal'
  | 'cantidadNinos'
  | 'cantidadAdultosMayores'
  | 'personasDiscapacitadas'
  | 'personasElectrodependientes'
  | 'mascotasAfectadas';

function obtenerRangoContadorFamilia(
  fam: FamiliaAfectadaItem,
  campo: CampoContador
): { min: number; max: number } {
  const { totalEtarios, minimoNucleo, cupoEtarioDisponible } =
    calcularLimitesFamilia(fam);

  switch (campo) {
    case 'nucleoFamiliarTotal':
      return { min: minimoNucleo, max: 999 };
    case 'cantidadNinos':
      return { min: 0, max: fam.cantidadNinos + cupoEtarioDisponible };
    case 'cantidadAdultosMayores':
      return { min: 0, max: fam.cantidadAdultosMayores + cupoEtarioDisponible };
    case 'personasDiscapacitadas':
      return { min: 0, max: fam.nucleoFamiliarTotal };
    case 'personasElectrodependientes':
      return { min: 0, max: fam.nucleoFamiliarTotal };
    case 'mascotasAfectadas':
      return { min: 0, max: 999 };
    default: {
      void totalEtarios;
      return { min: 0, max: 999 };
    }
  }
}

export function FamiliasTerrenoSection({
  titulo = 'Familias y Viviendas Afectadas',
  familias,
  onChange,
  contactoObligatorio = false,
  disabled = false,
  permitirListaVacia = false,
}: FamiliasTerrenoSectionProps) {
  const agregarFamilia = () => {
    const nueva: FamiliaAfectadaItem = {
      id: `fam-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      referencia: '',
      nucleoFamiliarTotal: contactoObligatorio ? 1 : 0,
      cantidadNinos: 0,
      cantidadAdultosMayores: 0,
      personasDiscapacitadas: 0,
      personasElectrodependientes: 0,
      mascotasAfectadas: 0,
      nivelCompromisoVivienda: 'SIN_DANO',
      contactoNombre: '',
      contactoTelefono: '',
      contactoRut: '',
    };
    onChange([...familias, nueva]);
  };

  const eliminarFamilia = (famId: string) => {
    if (!permitirListaVacia && familias.length <= 1) return;
    onChange(familias.filter((f) => f.id !== famId));
  };

  const actualizarFamilia = (
    famId: string,
    parche: Partial<FamiliaAfectadaItem>
  ) => {
    onChange(familias.map((f) => (f.id === famId ? { ...f, ...parche } : f)));
  };

  const ajustarContador = (
    fam: FamiliaAfectadaItem,
    campo: CampoContador,
    delta: number
  ) => {
    const { min, max } = obtenerRangoContadorFamilia(fam, campo);
    const siguienteValor = Math.max(min, Math.min(max, fam[campo] + delta));
    actualizarFamilia(fam.id, { [campo]: siguienteValor });
  };

  return (
    <div className={styles.section}>
      <div className={styles.headerRow}>
        <h4 className={styles.sectionTitle}>
          <Users size={16} aria-hidden="true" />
          <span>{titulo}</span>
        </h4>
        <Chip variant="neutral" size="sm">
          {familias.length}{' '}
          {familias.length === 1 ? 'Hogar / Vivienda' : 'Hogares / Viviendas'}
        </Chip>
      </div>

      <div className={styles.preliminarNotice} role="note">
        <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          Antecedentes preliminares de terreno para eventual derivación social. No
          corresponden a la FIBE (Ficha Básica de Emergencias).
        </span>
      </div>

      {familias.length > 0 && (
        <div className={styles.familiasList}>
          {familias.map((fam, fIndex) => {
            const errores = validarCoherenciaFamiliaTerreno(fam, contactoObligatorio);
            const { totalEtarios } = calcularLimitesFamilia(fam);

            return (
              <div key={fam.id} className={styles.familiaCard}>
                <div className={styles.familiaHeader}>
                  <div className={styles.familiaTitleGroup}>
                    <span className={styles.familiaBadge}>Familia #{fIndex + 1}</span>
                    <input
                      type="text"
                      className={styles.familiaRefInput}
                      placeholder="Referencia (ej: Familia Pérez, Casa 2)"
                      value={fam.referencia || ''}
                      disabled={disabled}
                      onChange={(e) =>
                        actualizarFamilia(fam.id, { referencia: e.target.value })
                      }
                      aria-label={`Referencia para Familia #${fIndex + 1}`}
                    />
                  </div>

                  {(permitirListaVacia || familias.length > 1) && (
                    <button
                      type="button"
                      className={styles.btnEliminarFamilia}
                      disabled={disabled}
                      onClick={() => eliminarFamilia(fam.id)}
                      aria-label={`Eliminar Familia #${fIndex + 1}`}
                    >
                      <Minus size={14} aria-hidden="true" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>

                <div className={styles.countersGrid}>
                  {[
                    {
                      campo: 'nucleoFamiliarTotal' as const,
                      etiqueta: 'Tamaño núcleo familiar',
                      icono: <Users size={16} />,
                    },
                    {
                      campo: 'cantidadNinos' as const,
                      etiqueta: 'Cantidad de niños',
                      icono: <Baby size={16} />,
                    },
                    {
                      campo: 'cantidadAdultosMayores' as const,
                      etiqueta: 'Adultos mayores',
                      icono: <UserCheck size={16} />,
                    },
                    {
                      campo: 'personasDiscapacitadas' as const,
                      etiqueta: 'Personas con discapacidad',
                      icono: <Accessibility size={16} />,
                    },
                    {
                      campo: 'personasElectrodependientes' as const,
                      etiqueta: 'Personas electrodependientes',
                      icono: <Zap size={16} />,
                    },
                    {
                      campo: 'mascotasAfectadas' as const,
                      etiqueta: 'Mascotas afectadas',
                      icono: <HeartHandshake size={16} />,
                    },
                  ].map((item) => {
                    const valorActual = fam[item.campo];
                    const { min, max } = obtenerRangoContadorFamilia(fam, item.campo);
                    return (
                      <div key={item.campo} className={styles.counterCard}>
                        <div className={styles.counterLabelGroup}>
                          <span className={styles.counterIcon}>{item.icono}</span>
                          <span className={styles.counterLabel}>{item.etiqueta}</span>
                        </div>
                        <div className={styles.counterControls}>
                          <button
                            type="button"
                            className={styles.counterBtn}
                            onClick={() => ajustarContador(fam, item.campo, -1)}
                            disabled={disabled || valorActual <= min}
                            aria-label={`Disminuir ${item.etiqueta} Familia #${fIndex + 1}`}
                          >
                            <Minus size={18} aria-hidden="true" />
                          </button>
                          <span
                            className={styles.counterValue}
                            data-testid={
                              fIndex === 0 ? `valor-${item.campo}` : undefined
                            }
                          >
                            {valorActual}
                          </span>
                          <button
                            type="button"
                            className={styles.counterBtn}
                            onClick={() => ajustarContador(fam, item.campo, 1)}
                            disabled={disabled || valorActual >= max}
                            aria-label={`Aumentar ${item.etiqueta} Familia #${fIndex + 1}`}
                          >
                            <Plus size={18} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {fam.nucleoFamiliarTotal === 0 ? (
                  <div className={styles.cupoInfoHint} role="status">
                    <Info size={14} aria-hidden="true" />
                    <span>
                      Defina el tamaño del núcleo familiar para registrar integrantes.
                    </span>
                  </div>
                ) : totalEtarios >= fam.nucleoFamiliarTotal ? (
                  <div className={styles.cupoInfoHint} role="status">
                    <Info size={14} aria-hidden="true" />
                    <span>
                      Cupo de integrantes etarios completo ({totalEtarios}/
                      {fam.nucleoFamiliarTotal}).
                    </span>
                  </div>
                ) : null}

                {errores.nucleoFamiliarTotal && (
                  <p className={styles.errorText} role="alert">
                    {errores.nucleoFamiliarTotal}
                  </p>
                )}

                <div className={styles.fieldGroup}>
                  <span className={styles.infoLabel}>
                    Compromiso de vivienda de esta familia
                  </span>
                  <div
                    className={styles.prioritySelectorGrid}
                    role="radiogroup"
                    aria-label={`Nivel de compromiso de vivienda Familia #${fIndex + 1}`}
                  >
                    {NIVELES_COMPROMISO_VIVIENDA.map((nivel) => {
                      const activo = fam.nivelCompromisoVivienda === nivel;
                      return (
                        <button
                          key={nivel}
                          type="button"
                          role="radio"
                          aria-checked={activo}
                          disabled={disabled}
                          onClick={() =>
                            actualizarFamilia(fam.id, {
                              nivelCompromisoVivienda: nivel as NivelCompromisoVivienda,
                            })
                          }
                          className={`${styles.priorityOptionBtn} ${
                            activo
                              ? nivel === 'GRAVE_INHABITABLE'
                                ? styles.priorityOptionSelectedCritica
                                : nivel === 'MODERADO'
                                  ? styles.priorityOptionSelectedAlta
                                  : styles.priorityOptionSelectedMedia
                              : ''
                          }`}
                        >
                          <span>{ETIQUETAS_COMPROMISO_VIVIENDA[nivel]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.contactoBox}>
                  <h5 className={styles.contactoTitle}>
                    <Phone size={14} aria-hidden="true" />
                    <span>
                      Datos Preliminares de Contacto{' '}
                      {contactoObligatorio ? '(Obligatorio)' : '(Opcional)'}
                    </span>
                  </h5>

                  <div className={styles.contactoGrid}>
                    <div className={styles.contactoField}>
                      <label
                        htmlFor={`fam-contacto-nombre-${fam.id}`}
                        className={styles.contactoLabel}
                      >
                        Nombre de contacto{' '}
                        {contactoObligatorio && (
                          <span className={styles.requiredMark}>*</span>
                        )}
                      </label>
                      <input
                        id={`fam-contacto-nombre-${fam.id}`}
                        type="text"
                        className={styles.contactoInput}
                        placeholder="Ej: Ana Veas"
                        value={fam.contactoNombre || ''}
                        disabled={disabled}
                        onChange={(e) =>
                          actualizarFamilia(fam.id, { contactoNombre: e.target.value })
                        }
                      />
                      {errores.contactoNombre && (
                        <p className={styles.errorText} role="alert">
                          {errores.contactoNombre}
                        </p>
                      )}
                    </div>

                    <div className={styles.contactoField}>
                      <label
                        htmlFor={`fam-contacto-telefono-${fam.id}`}
                        className={styles.contactoLabel}
                      >
                        Teléfono de contacto{' '}
                        {contactoObligatorio && (
                          <span className={styles.requiredMark}>*</span>
                        )}
                      </label>
                      <input
                        id={`fam-contacto-telefono-${fam.id}`}
                        type="tel"
                        className={styles.contactoInput}
                        placeholder="Ej: +56912345678"
                        value={fam.contactoTelefono || ''}
                        disabled={disabled}
                        onChange={(e) =>
                          actualizarFamilia(fam.id, {
                            contactoTelefono: e.target.value,
                          })
                        }
                      />
                      {errores.contactoTelefono && (
                        <p className={styles.errorText} role="alert">
                          {errores.contactoTelefono}
                        </p>
                      )}
                    </div>

                    <div className={styles.contactoField}>
                      <label
                        htmlFor={`fam-contacto-rut-${fam.id}`}
                        className={styles.contactoLabel}
                      >
                        RUT preliminar (Opcional)
                      </label>
                      <input
                        id={`fam-contacto-rut-${fam.id}`}
                        type="text"
                        className={styles.contactoInput}
                        placeholder="Ej: 12.345.678-5"
                        value={fam.contactoRut || ''}
                        disabled={disabled}
                        onChange={(e) =>
                          actualizarFamilia(fam.id, { contactoRut: e.target.value })
                        }
                      />
                      {errores.contactoRut && (
                        <p className={styles.errorText} role="alert">
                          {errores.contactoRut}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className={styles.btnAgregarFamilia}
        disabled={disabled}
        onClick={agregarFamilia}
      >
        <Plus size={16} aria-hidden="true" />
        <span>Añadir otra familia afectada</span>
      </button>
    </div>
  );
}

export default FamiliasTerrenoSection;
