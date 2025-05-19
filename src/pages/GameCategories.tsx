import React from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../components/common/PageLayout";

// Import category-related images
import skillGamesImage from "../assets/Chess.png";
import videoGamesImage from "../assets/Fifa.png";
import cardGamesImage from "../assets/PineappleOpenFace.png";
import boardGamesImage from "../assets/Catan.png";
import chineseGamesImage from "../assets/DouDizhu.png";
import otherGamesImage from "../assets/F1.png";

// Define the categories with more detailed information
const categories = [
  {
    id: "skill",
    name: "Skill Games",
    image: skillGamesImage,
    description: "Strategic games that test your planning and execution skills",
    color: "from-deep-purple to-soft-pink",
  },
  {
    id: "video",
    name: "Video Games",
    image: videoGamesImage,
    description: "Connect your favorite video games and play with friends",
    color: "from-blue-600 to-blue-400",
  },
  {
    id: "card", 
    name: "Card Games",
    image: cardGamesImage,
    description: "Classic and modern card games for all skill levels",
    color: "from-red-600 to-red-400",
  },
  {
    id: "board",
    name: "Board Games",
    image: boardGamesImage,
    description: "Digital versions of your favorite tabletop experiences",
    color: "from-green-600 to-green-400",
  },
  {
    id: "chinese",
    name: "Chinese Games",
    image: chineseGamesImage,
    description: "Traditional and popular games from Chinese culture",
    color: "from-yellow-600 to-yellow-400",
  },
  {
    id: "other",
    name: "Other Games",
    image: otherGamesImage,
    description: "Unique games that don't fit in other categories",
    color: "from-purple-600 to-purple-400",
  },
];

export default function GameCategories(): JSX.Element {
  const navigate = useNavigate();

  const handleCategorySelect = (categoryId: string) => {
    // Navigate to the choose game page with the category pre-selected
    navigate(`/choose-game/${categoryId}`);
  };

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-deep-purple mb-3">Choose a Category</h1>
          <p className="text-muted-violet text-lg max-w-2xl mx-auto">
            Select a game category to explore our collection of games
          </p>
        </div>

        {/* Large, eye-catching category buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategorySelect(category.id)}
              data-cy={`category-btn-${category.id}`}
              className="h-64 rounded-2xl overflow-hidden shadow-lg transform transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-soft-pink"
            >
              <div className={`h-full w-full bg-gradient-to-br ${category.color} p-6 flex flex-col items-center justify-center text-center text-white`}>
                <div className="bg-white/20 rounded-full p-4 mb-4">
                  <img 
                    src={category.image} 
                    alt={category.name} 
                    className="w-16 h-16 object-contain"
                  />
                </div>
                <h2 className="text-2xl font-extrabold mb-2">{category.name}</h2>
                <p className="text-white/90 text-sm">{category.description}</p>
              </div>
            </button>
          ))}
          
          {/* More Categories Coming Soon Button */}
          <div className="h-64 rounded-2xl overflow-hidden shadow-lg relative border-2 border-dashed border-gray-300">
            <div className="h-full w-full bg-gray-100 p-6 flex flex-col items-center justify-center text-center">
              <div className="bg-white/70 rounded-full p-4 mb-4 border-2 border-dashed border-gray-400">
                <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-extrabold mb-2 text-gray-700">More Categories<br/>Coming Soon</h2>
              <span className="mt-2 px-3 py-1 bg-soft-pink text-white text-xs font-bold rounded-full animate-pulse">
                Stay Tuned!
              </span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/30 pointer-events-none"></div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-12 text-center">
          <button
            onClick={() => navigate('/')}
            className="bg-deep-purple/10 text-deep-purple py-3 px-6 rounded-md font-medium hover:bg-deep-purple/20 transition-colors"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Back to Home
          </button>
        </div>
      </div>
    </PageLayout>
  );
} 