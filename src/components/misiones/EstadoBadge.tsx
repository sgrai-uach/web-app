import React from 'react';
import { formatearEstado } from '@/lib/utils/formatters';
import { Chip, type ChipSize } from '@/components/ui/Chip';
import { obtenerVarianteChipEstadoMision } from '@/lib/utils/chipVariants';

interface EstadoBadgeProps {
  estado?: string | null;
  size?: ChipSize;
  className?: string;
}

export function EstadoBadge({ estado, size = 'md', className = '' }: EstadoBadgeProps) {
  return (
    <Chip
      variant={obtenerVarianteChipEstadoMision(estado)}
      size={size}
      className={className}
    >
      {formatearEstado(estado)}
    </Chip>
  );
}
