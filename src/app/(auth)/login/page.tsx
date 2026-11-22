'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Heading';
import { Input } from '@/components/ui/Input';
import { validarRutChileno, formatearRut } from '@/lib/validations/rut';
import { UNIFIED_LOGIN_PATH } from '@/proxy';
import styles from './LoginPage.module.css';

export default function LoginRedirectPage() {
  const router = useRouter();
  const { autenticado, usuario, cargando, login } = useAuth();

  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (cargando) return;

    if (autenticado && usuario) {
      if (usuario.rolCodigo === 'PATRULLA_VERIFICADORA') {
        router.push('/patrulla/misiones');
        return;
      }
      if (usuario.rolCodigo === 'DELEGADO_CUADRILLA') {
        router.push('/cuadrilla/misiones');
        return;
      }
    }

    const esEntornoStandaloneTerreno =
      typeof window !== 'undefined' &&
      (window.location.port === '3002' ||
        window.location.pathname.startsWith('/terreno'));

    if (!esEntornoStandaloneTerreno) {
      const destino = `${UNIFIED_LOGIN_PATH}?returnUrl=${encodeURIComponent('/terreno')}`;
      router.push(destino);
    }
  }, [autenticado, usuario, cargando, router]);

  const handleIdentificadorBlur = () => {
    const trimmed = identificador.trim();
    if (trimmed && !trimmed.includes('@') && /^[0-9kK.-]+$/.test(trimmed)) {
      setIdentificador(formatearRut(trimmed));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ( typeof login !== 'function') return;
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

    const esEmail = limpio.includes('@');
    let identificadorFinal = limpio;

    if (!esEmail) {
      const soloDigitos = limpio.replace(/[^0-9kK]/g, '');
      if (!validarRutChileno(limpio) && !validarRutChileno(soloDigitos)) {
        setErrorLocal('El formato de RUT ingresado no es válido (ej: 12.345.678-K).');
        return;
      }
      identificadorFinal = formatearRut(limpio);
    }

    setProcesando(true);
    try {
      const perfil = await login({ identificador: identificadorFinal, password });
      if (perfil.rolCodigo === 'PATRULLA_VERIFICADORA') {
        router.push('/patrulla/misiones');
      } else if (perfil.rolCodigo === 'DELEGADO_CUADRILLA') {
        router.push('/cuadrilla/misiones');
      } else {
        router.push('/');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Credenciales inválidas o problema de conectividad con la central.';
      setErrorLocal(msg);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.mainContent}>
        <div className={styles.card}>
          <div className={styles.cardHeaderBanner}>
            <span className={styles.brandTitle}>SGRAI</span>
            <span className={styles.brandDivider}>|</span>
            <span className={styles.brandSubtitle}>DGRD VALDIVIA</span>
          </div>
          <div className={styles.cardBody}>
            <Heading
              as="h1"
              variant="h2"
              color="teal-dark"
              noMargin
              className={styles.title}
            >
              Inicio de Sesión
            </Heading>
            <p className={styles.subtitle} role="status">
              Redirigiendo al portal de autenticación institucional... Ingrese sus credenciales de terreno para continuar.
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
                onChange={(e) => setIdentificador(e.target.value)}
                onBlur={handleIdentificadorBlur}
                disabled={procesando || cargando}
                requiredIndicator
                autoComplete="username"
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
                    aria-label={
                      showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }
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
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
