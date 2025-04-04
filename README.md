# Chess Wager MVP

This is the stable TypeScript version of the Chess Wager MVP platform. The platform supports multiple games with real or virtual wagers, with comprehensive user authentication, balance management, and gameplay features.

## Project Overview

Chess Wager is a platform where users can play chess and other games with real or virtual wagers. The platform now supports two game types:

1. **Chess**: A fully functional chess game with standard rules, wagers, and Glicko-2 ratings.
2. **Rangvaar** (new): A trick-taking card game for 4 players in 2 teams, with bidding and trump mechanics.

## Game Status

### Chess Game
- ✅ **Fully Functional**: The Chess game implementation is stable and includes complete gameplay, wagering, and payout systems.
- ✅ **Rating System**: Glicko-2 rating system implemented for fair matchmaking.
- ✅ **Payouts**: Cloud Functions securely handle payouts when games finish.

### Rangvaar Game (New Addition)
- ✅ **Core Gameplay**: Game creation, player joining, bidding, card playing, and trick-taking mechanics are complete.
- ✅ **UI Implementation**: Complete UI for game creation, lobby, and gameplay.
- ✅ **Game Logic**: Rules enforcement, trick evaluation, and round management are working.
- ✅ **Debug Controls**: Development-only controls for testing game flow transitions.
- ⚠️ **Payout System**: Client-side payout transactions are implemented but encountering errors.
- ⚠️ **Known Issue**: Transaction failures during round transitions and game completion.
- 🔄 **Next Step**: Implementing a Cloud Function for secure payouts similar to the Chess game.

## Technical Features

### Authentication & User Management
- Email verification and OTP
- User profiles and statistics
- Balance management

### Transaction System
- Secure deposit and withdrawal using UPI
- Transaction logs and history
- Admin approval system for withdrawals

### Firebase Integration
- Firestore for data storage
- Cloud Functions for secure transaction processing
- Authentication with email verification
- Hosting for frontend deployment
- Security rules for data protection

## Development Setup

1. **Install dependencies**:
   ```
   npm install
   ```

2. **Set up Firebase Functions**:
   ```
   cd functions
   npm install
   ```

3. **Run development server**:
   ```
   npm run dev
   ```

4. **Type checking**:
   ```
   npm run tsc
   ```

5. **Build for production**:
   ```
   npm run build
   ```

6. **Deploy to Firebase**:
   ```
   firebase deploy
   ```

## Rangvaar Game Architecture

The Rangvaar game follows a client-server architecture with Firestore as the database:

### Data Model
- `rangvaarGames`: Collection for storing game state
- `RangvaarGameState`: Core game state type with team scores, round information
- `RoundState`: Per-round state including hands, bids, tricks, and scores

### Key Components
- `CreateRangvaarGame.tsx`: Game creation interface
- `RangvaarLobby.tsx`: Pre-game lobby for players to join
- `RangvaarGame.tsx`: Main game UI with bidding and card playing interfaces
- `rangvaarService.ts`: Core game logic and Firestore interaction
- `useRangvaarGame.ts`: React hook for game state management

### Game Flow
1. Game creation with wager amount and number of rounds
2. Players join via lobby
3. Rounds proceed with:
   - Bidding phase
   - Trump selection
   - Trick playing
   - Scoring
4. Game completion and payout (currently experiencing issues)

## Known Issues & Roadmap

### Current Issues
- **Rangvaar Payout System**: Firestore transactions failing during payout attempts with `failed-precondition` errors.
- **Concurrent Transactions**: Race conditions during round transitions occasionally cause inconsistent state.
- **Client-Side Updates**: Security rules sometimes block balance updates from client code.

### Roadmap
1. **Immediate**: Implement Cloud Function for Rangvaar payouts
2. **Short-term**: Fix wager calculation UI issue on create game screen
3. **Medium-term**: Enhance state transitions to prevent race conditions
4. **Long-term**: Add additional card games and tournament structure

## Contributing

When contributing to this project, please consider the following:

1. Ensure all new code adheres to TypeScript standards
2. Add appropriate type definitions for new features
3. Run type checking before submitting changes
4. Update tests when modifying existing functionality
5. Follow security best practices for financial features
