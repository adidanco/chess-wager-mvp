import React from 'react';

interface InfoCardProps {
  title: string;
  description: string;
  icon: string;
  iconBgColor?: string;
  actionText?: string;
  onClick?: () => void;
  className?: string;
  ['data-cy']?: string;
}

/**
 * InfoCard component for displaying information with an icon and action button
 * Used for game options, game listings, and other informational displays
 */
const InfoCard: React.FC<InfoCardProps> = ({
  title,
  description,
  icon,
  iconBgColor = 'bg-soft-pink',
  actionText = 'Learn More',
  onClick,
  className = '',
  ['data-cy']: dataCy
}) => {
  return (
    <div className={`bg-white/15 backdrop-blur-sm rounded-lg p-5 transform transition-all hover:scale-102 hover:bg-white/20 hover:shadow-lg ${className}`}>
      <button
        onClick={onClick}
        className="w-full text-left focus:outline-none"
        disabled={!onClick}
        data-cy={dataCy}
      >
        <div className="flex items-center mb-4">
          <div className={`${iconBgColor} text-white p-3 rounded-full shadow-md`}>
            <i className={`fas ${icon} text-lg`}></i>
          </div>
          <h3 className="ml-4 text-xl font-bold text-white tracking-tight">{title}</h3>
        </div>
        <p className="text-white/90 text-sm ml-1 mb-3 leading-relaxed">
          {description}
        </p>
        {onClick && (
          <div className="mt-4 text-right">
            <span className="inline-flex items-center text-soft-pink text-sm font-semibold hover:text-white transition-colors">
              {actionText} <i className="fas fa-arrow-right ml-2"></i>
            </span>
          </div>
        )}
      </button>
    </div>
  );
};

export default InfoCard; 