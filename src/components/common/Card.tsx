import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  titleAction?: ReactNode;
  footer?: ReactNode;
  isHoverable?: boolean;
  variant?: 'default' | 'outlined' | 'accent' | 'primary' | 'dark';
  onClick?: () => void;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  noPadding?: boolean;
}

/**
 * Card component for Gam(e)Bit UI
 * Provides consistent styling with several variants and customization options
 */
const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  titleAction,
  footer,
  isHoverable = false,
  variant = 'default',
  onClick,
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  noPadding = false
}) => {
  // Base card classes based on variant
  const variantClasses = {
    default: "bg-white border border-gray-100 shadow-sm",
    outlined: "bg-off-white border border-soft-pink/30 shadow-none",
    accent: "bg-soft-lavender/20 border border-soft-lavender shadow-sm",
    primary: "bg-deep-purple text-white border border-muted-violet shadow-md",
    dark: "bg-deep-purple/90 text-white border border-deep-purple shadow-md"
  };
  
  const baseClasses = `${variantClasses[variant]} rounded-lg overflow-hidden`;
  const hoverableClass = isHoverable ? "transition-all duration-200 hover:shadow-md hover:scale-[1.01]" : "";
  const clickableClass = onClick ? "cursor-pointer" : "";
  const cardClasses = `${baseClasses} ${hoverableClass} ${clickableClass} ${className}`;
  
  // Title class based on variant
  const titleClass = {
    default: "text-deep-purple",
    outlined: "text-deep-purple",
    accent: "text-deep-purple",
    primary: "text-white",
    dark: "text-white"
  };
  
  // Subtitle class based on variant
  const subtitleClass = {
    default: "text-muted-violet/70",
    outlined: "text-muted-violet/70",
    accent: "text-muted-violet/80",
    primary: "text-soft-pink/90",
    dark: "text-soft-lavender/80"
  };
  
  // Header border class based on variant
  const headerBorderClass = {
    default: "border-gray-100",
    outlined: "border-soft-pink/20",
    accent: "border-soft-lavender/30",
    primary: "border-muted-violet",
    dark: "border-deep-purple/60"
  };
  
  // Footer class based on variant
  const footerClass = {
    default: "bg-off-white border-t border-gray-100",
    outlined: "bg-transparent border-t border-soft-pink/20",
    accent: "bg-soft-lavender/30 border-t border-soft-lavender/30",
    primary: "bg-muted-violet/80 border-t border-muted-violet",
    dark: "bg-deep-purple border-t border-deep-purple/60"
  };
  
  return (
    <div className={cardClasses} onClick={onClick}>
      {(title || subtitle) && (
        <div className={`px-4 py-3 border-b ${headerBorderClass[variant]} flex justify-between items-center ${headerClassName}`}>
          <div>
            {title && <h3 className={`text-lg font-medium ${titleClass[variant]}`}>{title}</h3>}
            {subtitle && <p className={`text-sm mt-0.5 ${subtitleClass[variant]}`}>{subtitle}</p>}
          </div>
          {titleAction && <div>{titleAction}</div>}
        </div>
      )}
      
      <div className={`${noPadding ? '' : 'px-4 py-4'} ${bodyClassName}`}>
        {children}
      </div>
      
      {footer && (
        <div className={`px-4 py-3 ${footerClass[variant]} ${footerClassName}`}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card; 