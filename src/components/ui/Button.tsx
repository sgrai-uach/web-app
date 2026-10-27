'use client';

import React from 'react';
import Link from 'next/link';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'teal' | 'destructive' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  target?: string;
  rel?: string;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  href,
  target,
  rel,
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  className = '',
  children,
  onClick,
  type = 'button',
  ...restProps
}: ButtonProps) {
  const isActuallyDisabled = disabled || loading;

  const classList = [
    styles.button,
    styles[variant] || styles.primary,
    styles[size] || styles.md,
    fullWidth ? styles.fullWidth : '',
    isActuallyDisabled ? styles.disabled : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {!loading && icon && iconPosition === 'left' && <span className={styles.iconWrapper} aria-hidden="true">{icon}</span>}
      <span className={styles.text}>{children}</span>
      {!loading && icon && iconPosition === 'right' && <span className={styles.iconWrapper} aria-hidden="true">{icon}</span>}
    </>
  );

  if (href && !isActuallyDisabled) {
    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        className={classList}
        aria-busy={loading}
        {...(restProps as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classList}
      disabled={isActuallyDisabled}
      aria-disabled={isActuallyDisabled}
      aria-busy={loading}
      onClick={isActuallyDisabled ? undefined : onClick}
      {...restProps}
    >
      {content}
    </button>
  );
}

export default Button;
