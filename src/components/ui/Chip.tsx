'use client';

import React from 'react';
import styles from './Chip.module.css';

export type ChipVariant =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'teal'
  | 'solid-teal';

export type ChipSize = 'sm' | 'md';

export interface ChipProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick'> {
  variant?: ChipVariant;
  size?: ChipSize;
  icon?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}

const VARIANT_CLASS_MAP: Record<ChipVariant, string> = {
  neutral: styles.neutral,
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
  teal: styles.teal,
  'solid-teal': styles.solidTeal,
};

export const Chip: React.FC<ChipProps> = ({
  variant = 'neutral',
  size = 'sm',
  icon,
  onClick,
  className = '',
  children,
  ...rest
}) => {
  const sizeClass = size === 'md' ? styles.md : styles.sm;
  const variantClass = VARIANT_CLASS_MAP[variant] || styles.neutral;
  const interactiveClass = onClick ? styles.interactive : '';
  const combinedClassName = `${styles.chip} ${sizeClass} ${variantClass} ${interactiveClass} ${className}`.trim();

  if (onClick) {
    return (
      <button
        type="button"
        className={combinedClassName}
        onClick={onClick}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{children}</span>
      </button>
    );
  }

  return (
    <span
      className={combinedClassName}
      {...(rest as React.HTMLAttributes<HTMLSpanElement>)}
    >
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </span>
  );
};

export default Chip;

