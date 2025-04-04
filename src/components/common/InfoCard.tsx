import React from 'react';

interface InfoCardProps {
  title: string;
  description: string;
  icon: string;
  iconBgColor?: string;
  actionText?: string;
  onClick?: () => void;
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
  onClick
}) => {
  return (
    <div className="bg-white/10 rounded-lg p-4 transform transition-all hover:scale-102 hover:shadow-md">
      <button
        onClick={onClick}
        className="w-full text-left focus:outline-none"
        disabled={!onClick}
      >
        <div className="flex items-center mb-3">
          <div className={`${iconBgColor} text-white p-3 rounded-full`}>
            <i className={`fas ${icon} text-lg`}></i>
          </div>
          <h3 className="ml-3 text-lg font-bold text-white">{title}</h3>
        </div>
        <p className="text-white/80 text-sm ml-1">
          {description}
        </p>
        {onClick && (
          <div className="mt-3 text-right">
            <span className="inline-flex items-center text-soft-pink text-sm font-medium">
              {actionText} <i className="fas fa-arrow-right ml-1"></i>
            </span>
          </div>
        )}
      </button>
    </div>
  );
};

export default InfoCard; 