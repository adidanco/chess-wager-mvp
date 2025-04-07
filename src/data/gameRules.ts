export const scambodiaRules = {
  title: "Rules: Scambodia",
  sections: [
    {
      heading: "Game Overview",
      content: "Scambodia is a strategic card game about memory, deception, and bluffing. Players manage their hand of face-down cards, trying to achieve the lowest score or discard all their cards."
    },
    {
      heading: "Setup",
      content: [
        "Each player receives 4 cards arranged in a 2×2 grid",
        "Players can peek at their 2 bottom cards at the start of the game",
        "A discard pile is created with one card face-up",
        "The remaining cards form the draw pile"
      ]
    },
    {
      heading: "Card Values",
      content: [
        "Number cards (2-10) are worth their face value",
        "Ace is worth 1 point",
        "Jack, Queen, King are worth 10 points but have special powers"
      ]
    },
    {
      heading: "Turn Structure",
      content: [
        "1. Draw a card (from the deck or discard pile)",
        "2. Take one action: exchange with one of your cards, discard if it matches a card in your hand, or use a special power",
        "3. End your turn"
      ]
    },
    {
      heading: "Special Powers",
      content: [
        "Jack: Peek at one of any opponent's cards",
        "Queen: Swap one of your cards with a random card of an opponent (without seeing it)",
        "King: Swap one of your cards with a specific card of an opponent (you can look at it first)"
      ]
    },
    {
      heading: "Declaring Scambodia",
      content: "A player can declare 'Scambodia' at the start of their turn if they believe they have the lowest total card value. All other players get one more turn, then scores are compared."
    },
    {
      heading: "Winning",
      content: [
        "The player with the lowest score at the end of the round wins",
        "If a player discards all their cards, they win automatically",
        "The game is played for the specified number of rounds (1, 3, or 5)",
        "The player with the most round wins at the end receives the pot"
      ]
    }
  ]
};

export const rangvaarRules = {
  title: "Rules: Rangvaar",
  sections: [
    {
      heading: "Game Overview",
      content: "Rangvaar is a team-based color strategy game for 4 players, where teams compete to claim the most territory on the game board using colored tiles."
    },
    {
      heading: "Teams",
      content: [
        "4 players divided into 2 teams of 2 players each",
        "Team members sit opposite each other",
        "Teams are assigned colors: Red/Blue vs Green/Yellow"
      ]
    },
    {
      heading: "Game Board",
      content: [
        "6×6 grid of cells",
        "Each cell can be claimed with a colored tile",
        "Corner cells start pre-claimed with each player's color"
      ]
    },
    {
      heading: "Gameplay",
      content: [
        "Players take turns placing a tile of their color on the board",
        "Tiles must be placed adjacent to a tile of the same color (orthogonally or diagonally)",
        "When a tile is placed, it can convert adjacent enemy tiles to your color",
        "Players draw from a limited pool of tiles in their color"
      ]
    },
    {
      heading: "Conversion Rules",
      content: [
        "A newly placed tile converts adjacent enemy tiles if:",
        "- The enemy tile is sandwiched between your new tile and your existing tile",
        "- The enemy tile is surrounded by your color on at least three sides",
        "Tiles of your teammate's color are never converted"
      ]
    },
    {
      heading: "Special Moves",
      content: [
        "Boost: Once per round, place an extra tile immediately after your regular turn",
        "Swap: Once per game, exchange positions of two tiles (one must be yours)",
        "Shield: Once per game, protect one of your tiles from being converted for one round"
      ]
    },
    {
      heading: "Scoring & Winning",
      content: [
        "Each round ends when the board is full or nobody can make a valid move",
        "Team score is the sum of tiles in both team members' colors",
        "Team with the highest score wins the round",
        "The game is played for 3 or 5 rounds",
        "Team with the most round wins at the end receives the pot"
      ]
    }
  ]
}; 