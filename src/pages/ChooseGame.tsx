import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageLayout from "../components/common/PageLayout";
import chessIcon from "../assets/Chess.png";
import rangvaarIcon from "../assets/Rangvaar.png";
import scambodiaIcon from "../assets/Scambodia.png";
import fifaIcon from "../assets/Fifa.png";
import pubgIcon from "../assets/pubg.png.jpg";
import fortniteIcon from "../assets/Fortnite.png";
import codIcon from "../assets/Call Of Duty.png";
import clashRoyaleIcon from "../assets/ClashRoyale.png";
import pineappleIcon from "../assets/PineappleOpenFace.png";
import catanIcon from "../assets/Catan.png";
import monodealIcon from "../assets/MonoDeal.png";
import chauparIcon from "../assets/Chaupar.png";
import unoIcon from "../assets/Uno.png";
import f1Icon from "../assets/F1.png";
// Import new game icons
import blackjackIcon from "../assets/Blackjack.png";
import bridgeIcon from "../assets/Bridge.png";
import doudizhuIcon from "../assets/DouDizhu.png";
import donkeyIcon from "../assets/Donkey.png";
import explodingKittensIcon from "../assets/ExplodingKittens.png";
import ghulamChorIcon from "../assets/GhulamChor.png";
import napoleanIcon from "../assets/Napolean.png";
import sergeantMajorIcon from "../assets/3-5-8 Sergeant Major.jpg";
import twentyEightIcon from "../assets/28.png.jpg";
import sequenceIcon from "../assets/Seqeunce.png";
import zhengShangyouIcon from "../assets/ZhengShangyou.png";
import zhegShangyouIcon from "../assets/ZhegShangyou.png";

// Game categories
const gameCategories = [
  {
    id: "skill",
    name: "Skill Games",
    games: [
      {
        name: "Chess",
        icon: chessIcon,
        path: "/create-game",
        description: "The classic game of strategy.",
        available: true,
      },
      {
        name: "Rangvaar",
        icon: rangvaarIcon,
        path: "/create-rangvaar-game",
        description: "A trick-taking card game.",
        available: true,
      },
      {
        name: "Scambodia",
        icon: scambodiaIcon,
        path: "/create-scambodia-game",
        description: "A fast-paced card game of strategy and bluffing. Outwit your opponents to claim victory!",
        available: true,
      },
      {
        name: "Bridge",
        icon: bridgeIcon,
        path: "/coming-soon",
        description: "Strategic trick-taking partnership card game.",
        available: false,
      },
      {
        name: "Sequence",
        icon: sequenceIcon,
        path: "/coming-soon",
        description: "Connect five in a row on the board.",
        available: false,
      },
    ],
  },
  {
    id: "video",
    name: "Video Games",
    games: [
      {
        name: "FIFA",
        icon: fifaIcon,
        path: "/coming-soon",
        description: "Login on your PC or Console",
        available: false,
      },
      {
        name: "PubG",
        icon: pubgIcon,
        path: "/coming-soon",
        description: "Be the last one standing in a Battle Royale",
        available: false,
      },
      {
        name: "Fortnite",
        icon: fortniteIcon,
        path: "/coming-soon",
        description: "Build, Play and Battle",
        available: false,
      },
      {
        name: "Call Of Duty",
        icon: codIcon,
        path: "/coming-soon",
        description: "India's game of the year",
        available: false,
      },
    ],
  },
  {
    id: "card",
    name: "Card Games",
    games: [
      {
        name: "Pineapple Open Face",
        icon: pineappleIcon,
        path: "/coming-soon",
        description: "First Time in India",
        available: false,
      },
      {
        name: "Uno",
        icon: unoIcon,
        path: "/coming-soon",
        description: "Classic game of cards",
        available: false,
      },
      {
        name: "Blackjack",
        icon: blackjackIcon,
        path: "/coming-soon",
        description: "Beat the dealer to 21 without going over.",
        available: false,
      },
      {
        name: "Exploding Kittens",
        icon: explodingKittensIcon,
        path: "/coming-soon",
        description: "Avoid the explosion in this strategic card game.",
        available: false,
      },
      {
        name: "Donkey",
        icon: donkeyIcon,
        path: "/coming-soon",
        description: "Match cards quickly or spell out D-O-N-K-E-Y.",
        available: false,
      },
      {
        name: "Napolean",
        icon: napoleanIcon,
        path: "/coming-soon",
        description: "Popular South Indian trick-taking card game.",
        available: false,
      },
      {
        name: "28",
        icon: twentyEightIcon,
        path: "/coming-soon",
        description: "Trick-taking card game played in Kerala.",
        available: false,
      },
      {
        name: "Sergeant Major",
        icon: sergeantMajorIcon,
        path: "/coming-soon",
        description: "Also known as 3-5-8, trick-bidding card game.",
        available: false,
      },
    ],
  },
  {
    id: "board",
    name: "Board Games",
    games: [
      {
        name: "Catan",
        icon: catanIcon,
        path: "/coming-soon",
        description: "Trade, Build, Settle : Most trending board game",
        available: false,
      },
      {
        name: "Monodeal",
        icon: monodealIcon,
        path: "/coming-soon",
        description: "Make your fortune fast",
        available: false,
      },
      {
        name: "Chaupar",
        icon: chauparIcon,
        path: "/coming-soon",
        description: "Game of dice from Mahabharata",
        available: false,
      },
    ],
  },
  {
    id: "chinese",
    name: "Chinese Games",
    games: [
      {
        name: "Dou Dizhu",
        icon: doudizhuIcon,
        path: "/coming-soon",
        description: "Popular Chinese game of 'Fighting the Landlord'.",
        available: false,
      },
      {
        name: "Zheng Shangyou",
        icon: zhengShangyouIcon,
        path: "/coming-soon",
        description: "Chinese climbing card game of combos.",
        available: false,
      },
      {
        name: "Zheg Shangyou",
        icon: zhegShangyouIcon,
        path: "/coming-soon",
        description: "Variant of the popular Chinese climbing game.",
        available: false,
      },
      {
        name: "Ghulam Chor",
        icon: ghulamChorIcon,
        path: "/coming-soon",
        description: "Indian card game of thieves and officers.",
        available: false,
      },
    ],
  },
  {
    id: "other",
    name: "Other Games",
    games: [
      {
        name: "Clash Royale",
        icon: clashRoyaleIcon,
        path: "/coming-soon",
        description: "Tower Rush, Strategy",
        available: false,
      },
      {
        name: "F1 Racing",
        icon: f1Icon,
        path: "/coming-soon",
        description: "Fastest growing sport",
        available: false,
      },
    ],
  },
];

export default function ChooseGame(): JSX.Element {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId?: string }>();
  const [activeCategory, setActiveCategory] = useState(categoryId || "skill");

  // Update active category when route param changes
  useEffect(() => {
    if (categoryId) {
      setActiveCategory(categoryId);
    }
  }, [categoryId]);

  const handleGameSelect = (path: string, available: boolean) => {
    navigate(path);
  };

  // Back button should now go to categories page
  const handleBackClick = () => {
    navigate('/categories');
  };

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-deep-purple mb-2">
            {gameCategories.find(cat => cat.id === activeCategory)?.name || "Choose a Game"}
          </h1>
          <p className="text-muted-violet">Select a game to create a new game room or browse available matches</p>
        </div>
        
        {/* Category Tabs - Sticky Horizontal Scrollable on Mobile */}
        <div className="sticky top-0 z-10 -mx-4 px-4 pt-3 pb-4 mb-6 bg-gradient-to-r from-deep-purple/10 to-soft-pink/10 shadow-lg">
          <div className="overflow-x-auto">
            <div className="flex space-x-3 md:space-x-4 min-w-max">
              {gameCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`px-5 py-4 rounded-xl text-sm md:text-base font-extrabold whitespace-nowrap transition-all transform hover:scale-105 ${
                    activeCategory === category.id
                      ? "bg-soft-pink text-white shadow-lg shadow-soft-pink/30"
                      : "bg-white text-gray-700 border-2 border-gray-200 hover:border-soft-pink/50"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Games Grid with Responsive Design */}
        {gameCategories.map((category) => (
          <div
            key={category.id}
            className={`transition-opacity duration-300 ${
              activeCategory === category.id ? "block" : "hidden"
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.games.map((game) => (
                game.available ? (
                  // Use InfoCard for available games
                  <div key={game.name} onClick={() => handleGameSelect(game.path, true)} className="h-full">
                    <div className="bg-white rounded-lg shadow-md overflow-hidden h-full transition-all hover:shadow-lg hover:translate-y-[-2px]">
                      <div className="h-40 bg-gradient-to-b from-deep-purple to-soft-lavender flex items-center justify-center">
                        <img
                          src={game.icon}
                          alt={`${game.name} icon`}
                          className="h-32 w-32 object-contain drop-shadow-md"
                        />
                      </div>
                      <div className="p-5">
                        <div className="flex items-center mb-3">
                          <h2 className="text-xl font-bold text-deep-purple tracking-tight">{game.name}</h2>
                          <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Available</span>
                        </div>
                        <p className="text-gray-600 text-sm mb-3 leading-relaxed">{game.description}</p>
                        <div className="flex justify-end">
                          <span className="inline-flex items-center text-soft-pink text-sm font-semibold">
                            Play Now <i className="fas fa-arrow-right ml-1"></i>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Simpler card for unavailable games
                  <div key={game.name} onClick={() => handleGameSelect(game.path, false)} className="h-full">
                    <div className="bg-white rounded-lg shadow-md overflow-hidden h-full relative transition-all hover:shadow-lg">
                      <div className="h-40 bg-white flex items-center justify-center">
                        <img
                          src={game.icon}
                          alt={`${game.name} icon`}
                          className="h-32 w-32 object-contain"
                        />
                      </div>
                      <div className="p-5">
                        <div className="flex items-center mb-2">
                          <h2 className="text-xl font-medium text-gray-700">{game.name}</h2>
                          <span className="ml-2 px-2 py-0.5 bg-soft-pink text-white text-xs font-semibold rounded-full">
                            {game.name === "Scambodia" ? "Coming Tomorrow" : "Coming Soon"}
                          </span>
                        </div>
                        <p className="text-gray-500 text-sm leading-relaxed">{game.description}</p>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        ))}

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={handleBackClick}
            className="bg-deep-purple/10 text-deep-purple py-3 px-6 rounded-md font-medium hover:bg-deep-purple/20 transition-colors"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Back to Categories
          </button>
        </div>
      </div>
    </PageLayout>
  );
} 