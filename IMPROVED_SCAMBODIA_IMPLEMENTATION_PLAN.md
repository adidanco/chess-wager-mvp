# Improved Scambodia Implementation Plan

## Core Philosophy

This implementation plan incorporates the best elements from both the initial structured approach and the strategic directives. Our implementation will focus on:

1. **Complete Isolation**: Making Scambodia a self-contained module that doesn't affect existing games
2. **Turn-Based Flow**: Following the established pattern for player actions from existing games
3. **Memory Mechanics**: Proper tracking of what cards each player can see
4. **Minimal Touch**: Avoiding disruption to the existing codebase

## Architecture Overview

We'll organize Scambodia into these distinct layers:

```
src/
├── types/
│   └── scambodia.ts           // Type definitions (already created)
├── services/
│   └── scambodiaService.ts    // Core game logic (already created skeleton)
├── hooks/
│   └── useScambodiaGame.ts    // Game state management (already created skeleton)
├── components/
│   └── scambodia/             // UI components specific to Scambodia
│       ├── GameBoard.tsx      // Main game board layout
│       ├── PlayerHand.tsx     // Player's cards display
│       ├── CardComponent.tsx  // Individual card rendering
│       ├── GameControls.tsx   // Action buttons and controls
│       ├── SpecialPower.tsx   // Special card power UI
│       └── GameStatus.tsx     // Game status display
├── pages/
│   ├── CreateScambodiaGame.tsx  // Already created
│   ├── ScambodiaLobby.tsx       // Waiting room for players
│   └── ScambodiaGame.tsx        // Main game page
└── functions/
    └── scambodia/             // Cloud Functions for critical operations
        ├── processScambodiaPayout.ts      // Handle game payouts
        └── transitionScambodiaRound.ts    // Handle round transitions
```

## Implementation Phases

### Phase 1: Core Game Logic Implementation

1. **Finalize Game State Types** (Already done)
   - Ensure all game phases and player actions are properly typed
   - Define card structure and special powers

2. **Complete the Scambodia Service** (Skeleton exists)
   - Implement card dealing and shuffling logic
   - Build core game actions (draw, exchange, discard, match)
   - Implement special card powers with proper visibility tracking
   - Add round transition and scoring logic

3. **Game State Hook** (Skeleton exists)
   - Complete the `useScambodiaGame` hook for client-side state management
   - Implement robust player action handlers
   - Add auth token refresh before critical operations
   - Set up proper error handling and user-friendly messages

### Phase 2: UI Components

1. **Create Scambodia-Specific Components**
   - Design a 2x2 grid for card display
   - Implement face-down card rendering with peek capability
   - Build special power interfaces with clear user flow
   - Create game status display for current phase and player turn

2. **Main Game Page**
   - Follow the pattern from RangvaarGame.tsx
   - Create ScambodiaGame.tsx to orchestrate all game components
   - Handle all game phases with appropriate UI

3. **Lobby Page**
   - Create ScambodiaLobby.tsx for pre-game waiting
   - Show joined players and wager amounts
   - Provide game start controls for the host

### Phase 3: Cloud Functions and Backend

1. **Implement Payout Processing**
   - Build robust payout function with proper validation
   - Handle edge cases (ties, multiple winners)
   - Include comprehensive logging

2. **Round Transition Management**
   - Create function to handle scoring and round transitions
   - Implement proper validation and error handling

### Phase 4: Integration with Existing System

1. **Register Game in ChooseGame.tsx**
   - Add Scambodia to the "Card Games" category
   - Link to the Create Scambodia Game page

2. **Navigation Flow**
   - Establish clear pathing between pages:
     - Choose Game → Create Scambodia Game → Scambodia Lobby → Scambodia Game

3. **Error Handling and Loading States**
   - Implement consistent loading indicators
   - Add user-friendly error messages

### Phase A: Core Game Rules Implementation

#### A.1 Setup & Initialization
- Shuffle and deal 4 cards to each player in a 2x2 grid
- Flip one card to start discard pile
- Let players peek at bottom two cards only

#### A.2 Player Turn Flow
- Each turn consists of exactly one action:
  1. Draw from deck → exchange with face-down card or discard
  2. Draw from discard → replace a face-down card
  3. Attempt to match a face-down card with top discard
  4. Declare "Scambodia" if player believes they have lowest score

#### A.3 Special Card Powers
- Implement when a player discards a special card:
  - 7-8: Peek at own face-down card
  - 9-10: Peek at opponent's face-down card
  - J-Q: Blind swap with opponent
  - K: Peek at opponent's card, then choose to swap or not

#### A.4 Round End Conditions
- A player declares "Scambodia"
- A player discards all cards (reduces to zero)

#### A.5 Multi-Round Support
- Handle game with 1, 3, or 5 rounds
- Track cumulative scores across rounds
- Determine overall winner

## Key Technical Strategies

### 1. Isolation
All Scambodia logic will be contained in its own modules with clear interfaces. We'll ensure the code is isolated by:
- Using Scambodia-specific naming conventions (`SCAMBODIA_*` prefixes where needed)
- Creating dedicated components that don't rely on shared UI
- Minimizing dependencies on global state

### 2. Memory Tracking
We'll carefully manage what cards each player can see:
- Track `visibleToPlayer` in the game state to record which cards a player has seen
- Only allow peeking at cards when rules explicitly permit
- Reset visibility when cards are exchanged

### 3. Turn Sequence
We'll follow the existing pattern from other games:
- Store `currentTurnPlayerId` in the game state
- Only allow actions from the current player
- Handle turn transitions with proper validation

### 4. Error Prevention
To prevent bugs and edge cases:
- Validate all actions on both client and server
- Use transactions for critical state changes
- Implement comprehensive logging for debugging

## Testing Strategy

1. **Unit Testing**
   - Test game logic functions in isolation
   - Verify scoring mechanisms
   - Test special card powers

2. **Integration Testing**
   - Test the flow between pages
   - Verify game state transitions
   - Test multiplayer interactions

3. **User Acceptance Testing**
   - Verify against game rules
   - Test edge cases with different player counts

## Security Considerations

### Authentication and Authorization
- Ensure all game actions require authentication
- Validate that players are authorized to perform actions in a specific game
- Verify current player's turn before processing actions
- Force token refresh before payout operations to prevent stale tokens

### Data Validation
- Implement server-side validation for all inputs
- Sanitize card indices and positions to prevent out-of-bounds access
- Validate game state transitions to ensure no illegal moves

### Transaction Security
- Use atomic Firestore transactions for operations affecting balances
- Implement idempotent payout processing to prevent double payments
- Add transaction logs with timestamps for audit trail

### Visibility Control
- Strictly enforce card visibility rules on both client and server
- Only reveal face-down cards when explicitly permitted by game rules
- Reset visibility state when cards are exchanged or shuffled
- Prevent leaking other players' private card information

### Rate Limiting
- Implement rate limiting for sensitive operations
- Add cooldown periods for game creation and special actions
- Protect payout functions from abuse with thorough validation

## Implementation Timeline

1. **Week 1: Core Game Logic**
   - Complete service implementation
   - Finish state management hook

2. **Week 2: UI Components**
   - Build all Scambodia-specific components
   - Create game and lobby pages

3. **Week 3: Cloud Functions and Integration**
   - Implement backend functions
   - Integrate with existing navigation
   - Test end-to-end flow

## Implementation Progress Tracking

| Component | Status | Notes |
|-----------|--------|-------|
| Types (scambodia.ts) | ✅ Complete | Initial types defined |
| Service (scambodiaService.ts) | 🟡 Partial | Core structure created, action functions need implementation |
| Hook (useScambodiaGame.ts) | 🟡 Partial | Structure created, action handlers need implementation |
| UI: Card Component | ✅ Complete | Basic card component with front/back support |
| UI: Player Hand | ✅ Complete | 2x2 grid layout for player cards |
| UI: Game Controls | 🟡 Partial | Interface defined, needs implementation |
| Page: Create Game | ✅ Complete | Basic create game form working |
| Page: Lobby | ✅ Complete | Player joining and game start support |
| Page: Game | 🟡 Partial | Basic structure in place, needs component integration |
| Cloud Function: Payout | ❌ Not Started | Need to implement |
| Cloud Function: Round Transition | ❌ Not Started | Need to implement |
| Route Registration | ❌ Not Started | Need to add routes to router |

## Next Steps

1. Complete the remaining UI components
2. Finish implementing the service action methods (draw, exchange, match, etc.)
3. Connect the hook action handlers to the service methods
4. Implement the cloud functions
5. Test the complete flow

## Conclusion

This implementation plan ensures Scambodia will be isolated from other games while following the established patterns in the codebase. By focusing on modularity, proper memory mechanics, and clean integration, we'll deliver a polished card game that works seamlessly with the existing platform. 