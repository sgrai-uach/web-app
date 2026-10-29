import React, { forwardRef } from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  requiredIndicator?: boolean;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, requiredIndicator, rightElement, id, className = '', style, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

    return (
      <div className={styles.wrapper} style={style}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label} {requiredIndicator && <span className={styles.required}>*</span>}
          </label>
        )}
        <div className={styles.inputContainer}>
          <input
            ref={ref}
            id={inputId}
            className={`${styles.input} ${rightElement ? styles.inputWithRightElement : ''} ${error ? styles.inputError : ''} ${className}`.trim()}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error && inputId ? `${inputId}-error` : undefined}
            {...props}
          />
          {rightElement && <div className={styles.rightElement}>{rightElement}</div>}
        </div>
        {error ? (
          <span id={inputId ? `${inputId}-error` : undefined} className={styles.errorText} role="alert">
            {error}
          </span>
        ) : helperText ? (
          <span className={styles.helperText}>{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
