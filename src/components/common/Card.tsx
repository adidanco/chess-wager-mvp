import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  titleAction?: ReactNode;
  footer?: ReactNode;
  isHoverable?: boolean;
  variant?: 'default' | 'outlined' | 'accent';
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  titleAction,
  footer,
  isHoverable = false,
  variant = 'default'
}) => {
  // Base card classes based on variant
  const variantClasses = {
    default: "bg-white border border-gray-100 shadow-sm",
    outlined: "bg-off-white border border-soft-pink/30 shadow-none",
    accent: "bg-soft-lavender/20 border border-soft-lavender shadow-sm"
  };
  
  const baseClasses = `${variantClasses[variant]} rounded-lg overflow-hidden`;
  const hoverableClass = isHoverable ? "transition-shadow duration-200 hover:shadow-md" : "";
  const cardClasses = `${baseClasses} ${hoverableClass} ${className}`;
  
  // Title class based on variant
  const titleClass = {
    default: "text-deep-purple",
    outlined: "text-deep-purple",
    accent: "text-deep-purple"
  };
  
  // Subtitle class based on variant
  const subtitleClass = {
    default: "text-muted-violet/70",
    outlined: "text-muted-violet/70",
    accent: "text-muted-violet/80"
  };
  
  // Footer class based on variant
  const footerClass = {
    default: "bg-off-white border-t border-gray-100",
    outlined: "bg-transparent border-t border-soft-pink/20",
    accent: "bg-soft-lavender/30 border-t border-soft-lavender/30"
  };
  
  return (
    <div className={cardClasses}>
      {(title || subtitle) && (
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
          <div>
            {title && <h3 className={`text-lg font-medium ${titleClass[variant]}`}>{title}</h3>}
            {subtitle && <p className={`text-sm mt-0.5 ${subtitleClass[variant]}`}>{subtitle}</p>}
          </div>
          {titleAction && <div>{titleAction}</div>}
        </div>
      )}
      
      <div className="px-4 py-4">
        {children}
      </div>
      
      {footer && (
        <div className={`px-4 py-3 ${footerClass[variant]}`}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card; 