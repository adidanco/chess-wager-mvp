import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
        description: "Spy, Swap and Peek.",
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
    id: "asian",
    name: "Asian Card Games",
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
  const [activeCategory, setActiveCategory] = useState("skill");

  const handleGameSelect = (path: string, available: boolean) => {
    if (available) {
      navigate(path);
    } else {
      // Navigate to the ComingSoon page instead of showing an alert
      navigate('/coming-soon');
    }
  };

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-6 text-emerald-700">Choose a Game</h1>
        
        {/* Category Tabs - Horizontal Scrollable on Mobile */}
        <div className="mb-6 overflow-x-auto pb-2">
          <div className="flex space-x-2 md:space-x-4 min-w-max">
            {gameCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-3 py-2 rounded-lg text-sm md:text-base font-medium whitespace-nowrap transition-colors
                  ${
                    activeCategory === category.id
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
              >
                {category.name}
              </button>
            ))}
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {category.games.map((game) => (
                <div
                  key={game.name}
                  className={`bg-white rounded-lg shadow-md p-4 flex flex-col items-center text-center 
                    ${
                      game.available
                        ? "cursor-pointer hover:shadow-lg border-2 border-transparent hover:border-emerald-300"
                        : "opacity-75"
                    }`}
                  onClick={() => handleGameSelect(game.path, game.available)}
                >
                  <div className="relative w-full pt-[100%] mb-3">
                    <img
                      src={game.icon}
                      alt={`${game.name} icon`}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                    {!game.available && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                        <span className="bg-amber-500 text-white px-2 py-1 text-xs font-bold rounded rotate-[-15deg]">
                          COMING SOON
                        </span>
                      </div>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold mb-1 text-emerald-800">{game.name}</h2>
                  <p className="text-gray-600 text-xs">{game.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="bg-emerald-100 text-emerald-800 py-2 px-6 rounded-md font-medium hover:bg-emerald-200 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </PageLayout>
  );
} 