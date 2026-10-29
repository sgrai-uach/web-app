'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button, Heading, Input, useToast } from '@/components/ui';
import ConnectionStatusBadge from '@/components/common/ConnectionStatusBadge';
import { validarRutChileno, formatearRut } from '@/lib/validations/rut';
import { LogIn, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login, cargando, autenticado, usuario } = useAuth();
  const { showError, showSuccess } = useToast();

  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    setIdentificador(e.target.value);
  };

  const handleIdentificadorBlur = () => {
    const trimmed = identificador.trim();
    // Si no contiene arroba y parece un número/RUT, aplicar formato estándar con guion
    if (trimmed && !trimmed.includes('@') && /^[0-9kK.-]+$/.test(trimmed)) {
      setIdentificador(formatearRut(trimmed));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);

    const limpio = identificador.trim();
    if (!limpio) {
      setErrorLocal('Ingrese su RUT o correo electrónico.');
      return;
    }

    if (!password) {
      setErrorLocal('Ingrese su contraseña de acceso.');
      return;
    }

    // Validación de formato según tipo de identificador
    const esEmail = limpio.includes('@');
    let identificadorFinal = limpio;

    if (!esEmail) {
      const soloDigitos = limpio.replace(/[^0-9kK]/g, '');
      if (!validarRutChileno(limpio) && !validarRutChileno(soloDigitos)) {
        setErrorLocal('El formato de RUT ingresado no es válido (ej: 12.345.678-K).');
        return;
      }
      identificadorFinal = formatearRut(limpio);
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(limpio)) {
        setErrorLocal('El formato de correo electrónico ingresado no es válido.');
        return;
      }
    }

    setProcesando(true);
    try {
      const perfil = await login({ identificador: identificadorFinal, password });
      showSuccess(`Bienvenido(a), ${perfil.nombre}. Sesión iniciada.`);

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

  const handleVolver = () => {
    router.push('/');
  };

  return (
    <div className={styles.container}>
      <div className={styles.topUtilityBar}>
        <ConnectionStatusBadge connected={typeof navigator !== 'undefined' ? navigator.onLine : true} />
      </div>

      <main className={styles.mainContent}>
        <div className={styles.card}>
          <div className={styles.cardHeaderBanner}>
            <span className={styles.brandTitle}>SGRAI</span>
            <span className={styles.brandDivider}>|</span>
            <span className={styles.brandSubtitle}>DGRD VALDIVIA</span>
          </div>

          <div className={styles.cardBody}>
            <Heading as="h1" variant="h2" color="teal-dark" noMargin className={styles.title}>
              Inicio de Sesión
            </Heading>
            <p className={styles.subtitle}>
              Ingrese sus credenciales para acceder a la plataforma.
            </p>

            {errorLocal && (
              <div className={styles.errorMessage} role="alert">
                {errorLocal}
              </div>
            )}

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <Input
                id="identificador-input"
                label="Identificador"
                placeholder="Correo o RUT con dígito verificador"
                value={identificador}
                onChange={handleIdentificadorChange}
                onBlur={handleIdentificadorBlur}
                disabled={procesando || cargando}
                requiredIndicator
                autoComplete="username"
                autoFocus
              />

              <Input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                label="Contraseña"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={procesando || cargando}
                requiredIndicator
                autoComplete="current-password"
                rightElement={
                  <button
                    type="button"
                    className={styles.togglePasswordBtn}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    disabled={procesando || cargando}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                loading={procesando || cargando}
                icon={<LogIn size={20} />}
              >
                Ingresar al Sistema
              </Button>

              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                icon={<ArrowLeft size={18} />}
                onClick={handleVolver}
                disabled={procesando || cargando}
              >
                Volver al Inicio de SGRAI
              </Button>

              <hr className={styles.divider} />

              <p className={styles.restrictionNotice}>
                Acceso restringido a personal autorizado.
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
