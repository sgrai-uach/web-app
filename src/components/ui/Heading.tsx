import React from 'react';
import styles from './Heading.module.css';

export type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'p';
export type HeadingVariant = 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'subtitle';
export type HeadingColor = 'teal-dark' | 'teal' | 'charcoal-dark' | 'charcoal' | 'white' | 'inherit';
export type HeadingAlign = 'left' | 'center' | 'right';

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingTag;
  variant?: HeadingVariant;
  color?: HeadingColor;
  align?: HeadingAlign;
  noMargin?: boolean;
  children: React.ReactNode;
}

const COLOR_CLASS_MAP: Record<HeadingColor, string> = {
  'teal-dark': styles.colorTealDark,
  teal: styles.colorTeal,
  'charcoal-dark': styles.colorCharcoalDark,
  charcoal: styles.colorCharcoal,
  white: styles.colorWhite,
  inherit: styles.colorInherit,
};

const ALIGN_CLASS_MAP: Record<HeadingAlign, string> = {
  left: styles.alignLeft,
  center: styles.alignCenter,
  right: styles.alignRight,
};

export function Heading({
  as,
  variant,
  color = 'teal-dark',
  align = 'left',
  noMargin = false,
  className = '',
  children,
  ...restProps
}: HeadingProps) {
  const Component = as || (variant === 'display' ? 'h1' : variant === 'subtitle' ? 'p' : variant) || 'h2';
  const resolvedVariant = variant || (as === 'p' || as === 'span' ? 'subtitle' : (as as HeadingVariant)) || 'h2';

  const classList = [
    styles.heading,
    styles[resolvedVariant] || styles.h2,
    COLOR_CLASS_MAP[color] || styles.colorTealDark,
    ALIGN_CLASS_MAP[align] || styles.alignLeft,
    noMargin ? styles.noMargin : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classList} {...restProps}>
      {children}
    </Component>
  );
}

export default Heading;
