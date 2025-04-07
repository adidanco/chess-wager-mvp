import React, { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'cta' | 'danger' | 'success' | 'warning';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  isLoading?: boolean; // Alias for loading for backward compatibility
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  loading = false,
  isLoading, // For backward compatibility
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  type = 'button',
  ...rest
}) => {
  // Check both loading and isLoading properties
  const isLoadingState = loading || isLoading;
  
  // Base button classes
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";
  
  // Size classes
  const sizeClasses = {
    small: "text-xs py-1.5 px-3",
    medium: "text-sm py-2 px-4",
    large: "text-base py-3 px-6"
  };
  
  // Variant classes - using the Gam(e)Bit color scheme
  const variantClasses = {
    // Primary button: Deeper/brighter pink background, white text, stronger shadow
    primary: "bg-soft-pink text-white hover:bg-soft-pink/90 active:bg-soft-pink/80 focus:ring-soft-pink shadow-md hover:shadow-lg border-2 border-soft-pink/20 font-semibold", 
    
    // Secondary button: Deep purple background, white text
    secondary: "bg-deep-purple text-white hover:bg-deep-purple/90 active:bg-deep-purple focus:ring-deep-purple shadow-sm", 
    
    // Outline button: Transparent with muted violet border
    outline: "border border-muted-violet text-muted-violet hover:bg-muted-violet/10 active:bg-muted-violet/20 focus:ring-muted-violet", 
    
    // Text button: No background, just text
    text: "text-muted-violet hover:bg-muted-violet/10 active:bg-muted-violet/20 focus:ring-muted-violet",
    
    // CTA button: High-impact call to action with gradient, shadow and scale effect
    cta: "bg-gradient-to-r from-soft-pink to-muted-violet text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-100 focus:ring-soft-pink",
    
    // Additional button variants
    danger: "bg-red-500 text-white shadow-sm hover:bg-red-600 focus:ring-red-500",
    success: "bg-green-500 text-white shadow-sm hover:bg-green-600 focus:ring-green-500",
    warning: "bg-amber-500 text-white shadow-sm hover:bg-amber-600 focus:ring-amber-500"
  };
  
  // Width class
  const widthClass = fullWidth ? "w-full" : "";
  
  // Combine all classes
  const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${widthClass} ${className}`;
  
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || isLoadingState}
      {...rest}
    >
      {isLoadingState && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!isLoadingState && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!isLoadingState && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

export default Button; 