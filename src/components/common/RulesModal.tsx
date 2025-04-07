import React from 'react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameType: 'Rangvaar' | 'Scambodia';
  rules: {
    title: string;
    sections: {
      heading: string;
      content: string | string[];
    }[];
  };
}

const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose, gameType, rules }) => {
  if (!isOpen) return null;

  // Set different colors based on game type
  const colors = {
    Rangvaar: {
      primary: 'bg-emerald-600',
      secondary: 'text-emerald-700',
      border: 'border-emerald-200',
      background: 'bg-emerald-50',
      button: 'bg-emerald-600 hover:bg-emerald-700'
    },
    Scambodia: {
      primary: 'bg-deep-purple',
      secondary: 'text-deep-purple',
      border: 'border-purple-200',
      background: 'bg-purple-50',
      button: 'bg-deep-purple hover:bg-purple-800'
    }
  };

  const gameColors = colors[gameType];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`${gameColors.primary} text-white px-6 py-4 rounded-t-lg flex justify-between items-center`}>
          <h2 className="text-xl font-bold">{rules.title}</h2>
          <span className="text-sm italic">Or you can just start and figure it out on your own!</span>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-200 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="overflow-y-auto p-6 flex-grow">
          {rules.sections.map((section, index) => (
            <div key={index} className="mb-6">
              <h3 className={`text-lg font-semibold mb-2 ${gameColors.secondary}`}>{section.heading}</h3>
              {Array.isArray(section.content) ? (
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {section.content.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-700">{section.content}</p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-md text-white ${gameColors.button} transition-colors`}
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default RulesModal; 