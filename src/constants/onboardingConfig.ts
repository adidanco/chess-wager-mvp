import gamebitLogo from '../assets/GamEBit.png';

export interface OnboardingSlide {
  title: string;
  description: string;
  image?: string;
}

// Define onboarding slides
export const onboardingSlides: OnboardingSlide[] = [
  {
    title: "Welcome to Gam(e)Bit",
    description: "Your gateway to competitive skill-based gaming with real money rewards.",
    image: gamebitLogo
  },
  {
    title: "Multiple Game Options",
    description: "From Chess to Rangvaar, challenge players in games that match your unique skills.",
  },
  {
    title: "Play Games, Win Cash",
    description: "Challenge other players in various games and win real money based on your skill.",
  },
  {
    title: "Safe & Secure Transactions",
    description: "Our platform ensures secure deposits and withdrawals for a worry-free gaming experience.",
  },
  {
    title: "Ready to Play?",
    description: "Sign up or log in to start playing and winning right away!",
  }
];

export default onboardingSlides; 