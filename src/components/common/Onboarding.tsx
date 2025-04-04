import React, { useState, useEffect } from 'react';
import Button from './Button';

interface OnboardingSlide {
  title: string;
  description: string;
  image?: string;
}

interface OnboardingProps {
  slides: OnboardingSlide[];
  onComplete: () => void;
  canSkip?: boolean;
}

const OnboardingSlide: React.FC<{
  slide: OnboardingSlide;
  isActive: boolean;
}> = ({ slide, isActive }) => {
  return (
    <div 
      className={`transition-all duration-500 flex flex-col items-center justify-center px-6 text-center ${
        isActive ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-8'
      }`}
    >
      {slide.image && (
        <div className="w-64 h-64 mb-6 overflow-hidden rounded-xl">
          <img 
            src={slide.image} 
            alt={slide.title} 
            className="w-full h-full object-contain"
          />
        </div>
      )}
      <h2 className="text-2xl md:text-3xl font-bold text-deep-purple mb-3 font-poppins">{slide.title}</h2>
      <p className="text-muted-violet max-w-md md:text-lg">{slide.description}</p>
    </div>
  );
};

const Onboarding: React.FC<OnboardingProps> = ({ 
  slides, 
  onComplete,
  canSkip = true
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const currentSlide = slides[currentSlideIndex];
  const isLastSlide = currentSlideIndex === slides.length - 1;

  // Handle slide transition
  const transitionToSlide = (index: number) => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSlideIndex(index);
      setIsTransitioning(false);
    }, 300);
  };

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      transitionToSlide(currentSlideIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSlideIndex > 0) {
      transitionToSlide(currentSlideIndex - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  // Auto-advance slides (optional)
  /*
  useEffect(() => {
    if (isLastSlide) return;
    
    const timer = setTimeout(() => {
      handleNext();
    }, 8000); // Auto-advance every 8 seconds
    
    return () => clearTimeout(timer);
  }, [currentSlideIndex, isLastSlide]);
  */

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-deep-purple/5 via-off-white to-soft-pink/10 z-40">
      {/* Progress indicators */}
      <div className="flex justify-center mt-8 px-4">
        {slides.map((_, index) => (
          <div 
            key={index}
            onClick={() => transitionToSlide(index)}
            className={`
              h-1.5 rounded-full mx-1 transition-all duration-300 cursor-pointer
              ${index === currentSlideIndex 
                ? 'w-12 bg-soft-pink' 
                : index < currentSlideIndex 
                  ? 'w-5 bg-muted-violet' 
                  : 'w-5 bg-gray-300'}
            `}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative overflow-hidden">
        {/* Display only the current slide */}
        <OnboardingSlide 
          slide={currentSlide} 
          isActive={!isTransitioning} 
        />
      </div>

      {/* Navigation buttons - mobile friendly with full width on small screens */}
      <div className="px-6 pb-10 flex flex-col sm:flex-row sm:justify-between sm:items-center">
        <div className="hidden sm:block">
          {currentSlideIndex > 0 ? (
            <Button 
              variant="text" 
              onClick={handlePrevious}
            >
              Previous
            </Button>
          ) : (
            <div></div> 
          )}
        </div>

        <div className="flex flex-col sm:flex-row w-full sm:w-auto">
          {canSkip && !isLastSlide && (
            <Button 
              variant="text" 
              onClick={handleSkip}
              className="mb-3 sm:mb-0 sm:mr-4"
            >
              Skip
            </Button>
          )}
          <div className="float-animation">
            <Button 
              variant="cta" 
              onClick={handleNext}
              className="w-full sm:w-auto font-bold text-lg py-3.5 px-8 pulse-animation"
              size="large"
              rightIcon={<i className="fas fa-arrow-right"></i>}
            >
              {isLastSlide ? 'Get Started' : 'Continue'}
            </Button>
          </div>
        </div>
        
        {/* Back button for mobile only */}
        {currentSlideIndex > 0 && (
          <div className="mt-4 sm:hidden text-center">
            <button 
              onClick={handlePrevious}
              className="text-muted-violet text-sm"
            >
              Go back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding; 