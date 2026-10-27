'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button, Heading, Input, useToast } from '@/components/ui';
import ConnectionStatusBadge from '@/components/common/ConnectionStatusBadge';
import { validarRutChileno, formatearRut } from '@/lib/validations/rut';
import { LogIn, ShieldAlert } from 'lucide-react';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login, cargando, autenticado, usuario } = useAuth();
  const { showError, showSuccess } = useToast();

  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Redirección si ya está autenticado
  React.useEffect(() => {
    if (autenticado && usuario) {
      if (usuario.rolCodigo === 'PATRULLA_VERIFICADORA') {
        router.push('/patrulla');
      } else if (usuario.rolCodigo === 'DELEGADO_CUADRILLA') {
        router.push('/cuadrilla');
      }
    }
  }, [autenticado, usuario, router]);

  const handleIdentificadorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes('@')) {
      setIdentificador(val);
    } else {
      setIdentificador(formatearRut(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);

    const limpio = identificador.trim();
    if (!limpio) {
      setErrorLocal('Ingrese su RUT institucional o correo electrónico.');
      return;
    }

    if (!password) {
      setErrorLocal('Ingrese su contraseña de acceso.');
      return;
    }

    // Validación básica de formato
    const esEmail = limpio.includes('@');
    if (!esEmail && !validarRutChileno(limpio)) {
      setErrorLocal('El formato de RUT ingresado no es válido (ej: 12.345.678-K).');
      return;
    }

    setProcesando(true);
    try {
      const perfil = await login({ identificador: limpio, password });
      showSuccess(`Bienvenido(a), ${perfil.nombre}. Turno iniciado.`);

      if (perfil.rolCodigo === 'PATRULLA_VERIFICADORA') {
        router.push('/patrulla');
      } else if (perfil.rolCodigo === 'DELEGADO_CUADRILLA') {
        router.push('/cuadrilla');
      } else {
        router.push('/');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Credenciales inválidas o problema de conectividad con la central.';
      setErrorLocal(msg);
      showError(msg);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.institution}>DGRD • Municipalidad de Valdivia</span>
          <span className={styles.systemName}>SGRAI — App Terreno</span>
        </div>
        <ConnectionStatusBadge connected={typeof navigator !== 'undefined' ? navigator.onLine : true} />
      </header>

      <main className={styles.mainContent}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <Heading as="h1" variant="h2" color="teal-dark" noMargin>
              Acceso a Operaciones
            </Heading>
            <div className={styles.roleNote}>
              Patrulla Verificadora / Delegado de Cuadrilla
            </div>
          </div>

          {errorLocal && (
            <div className={styles.errorMessage} role="alert">
              {errorLocal}
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit}>
            <Input
              id="identificador-input"
              label="RUT o Correo Institucional"
              placeholder="12.345.678-K o usuario@valdivia.cl"
              value={identificador}
              onChange={handleIdentificadorChange}
              disabled={procesando || cargando}
              requiredIndicator
              autoComplete="username"
              autoFocus
            />

            <Input
              id="password-input"
              type="password"
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={procesando || cargando}
              requiredIndicator
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={procesando || cargando}
              icon={<LogIn size={20} />}
            >
              Iniciar Turno de Terreno
            </Button>
          </form>

          <div className={styles.infoBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
              <ShieldAlert size={16} />
              <span>Acceso Exclusivo de Emergencia</span>
            </div>
            Esta aplicación móvil está destinada estrictamente para la gestión de incidentes en terreno.
            Los roles de Centro de Mando, Call Center y Supervisión deben operar desde la plataforma web central.
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        Ilustre Municipalidad de Valdivia • Gestión de Riesgos de Desastres (DGRD)
      </footer>
    </div>
  );
}
