# Scambodia Implementation Plan

## Overview

This document outlines the implementation plan for the Scambodia card game, a memory-based shedding-style card game for 2-4 players. The implementation will follow a phased approach, focusing on code stability, proper state management, and reliable transaction processing.

## Lessons Learned from Rangvaar Implementation

Based on a thorough review of the Rangvaar implementation, we've identified the following challenges that need to be addressed in the Scambodia implementation:

### Authentication and Payout Issues
1. **Authentication Timing Problems**: We encountered issues with auth tokens being stale when initiating payouts. The Rangvaar implementation attempted to fix this with forced token refreshes before Cloud Function calls.
2. **Client-Side Payout Failures**: Initial attempts to handle payouts on the client side led to transaction failures and race conditions.
3. **Error Handling**: Error messages weren't user-friendly, exposing technical details that confused users.

### State Management Challenges
1. **Complex State Transitions**: Game phases in Rangvaar had complex transitions that sometimes led to inconsistent states.
2. **Race Conditions**: Concurrent updates from multiple clients sometimes caused state conflicts.
3. **Reference Handling**: Not properly managing React refs for one-time operations led to duplicate actions.

### Code Organization Issues
1. **Monolithic Components**: Some components became too large and difficult to maintain.
2. **Inadequate Type Definitions**: Type definitions were sometimes incomplete, leading to runtime errors.
3. **Insufficient Testing**: Lack of comprehensive testing for edge cases.

## Implementation Strategy

### Phase 1: Data Modeling and Type Definitions

1. **Type Definitions**
   - Define comprehensive types for Scambodia game state
   - Create separate interfaces for different game phases
   - Ensure all edge cases from the rulebook are represented

2. **Database Schema**
   - Design Firestore collections and documents structure
   - Plan for efficient queries and updates
   - Include fields for transaction tracking and payout status

### Phase 2: Core Game Logic

1. **Service Layer**
   - Implement card dealing and shuffling logic
   - Create functions for player actions (peeking, matching, swapping)
   - Build scoring and win condition detection
   - Implement special card powers

2. **State Management**
   - Create a dedicated hook for Scambodia game state
   - Use refs for one-time operations to prevent duplicate actions
   - Implement proper cleanup and error handling

### Phase 3: Cloud Functions for Critical Operations

1. **Payout Processing**
   - Implement dedicated Cloud Function for payouts with robust authentication
   - Use transactions to ensure atomicity
   - Add comprehensive logging for debugging
   - Include proper validation and error handling

2. **Game State Transitions**
   - Use server-side logic for critical state transitions
   - Prevent race conditions through transaction-based updates
   - Implement retries for failed operations

### Phase 4: User Interface

1. **Component Structure**
   - Create modular, testable components
   - Separate presentation from game logic
   - Use composition for reusable UI elements

2. **Responsive Design**
   - Ensure mobile-friendly layouts
   - Optimize for different screen sizes
   - Focus on accessibility

### Phase 5: Testing and Validation

1. **Unit Tests**
   - Test core game logic thoroughly
   - Verify scoring mechanisms
   - Validate special card operations

2. **Integration Tests**
   - Test state transitions and Cloud Function interactions
   - Verify multiplayer interactions

3. **User Acceptance Testing**
   - Verify against rulebook specifications
   - Test edge cases for different player counts

## Specific Implementation Details

### Scambodia Game State

```typescript
export interface ScambodiaGameState {
  gameId: string;
  gameType: 'Scambodia';
  status: GameStatus; // 'Waiting' | 'Playing' | 'Finished' | 'Cancelled'
  players: PlayerInfo[];
  wagerPerPlayer: number;
  currentRoundNumber: number;
  totalRounds: 1 | 3 | 5;
  roundStates: RoundState[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  winnerPlayerId?: string;
  payoutProcessed?: boolean;
  payoutTimestamp?: Timestamp;
}
```

### Scambodia Round State

```typescript
export interface RoundState {
  roundNumber: number;
  phase: RoundPhase; // 'Setup' | 'Playing' | 'Scoring' | 'Ended'
  currentTurnPlayerId?: string;
  cards: { [playerId: string]: Card[] }; // Cards each player holds
  visibleCards: { [playerId: string]: string[] }; // IDs of cards a player can see
  discardPile: Card[];
  drawPile: Card[];
  playerDeclaredScambodia?: string; // ID of player who declared
  scores: { [playerId: string]: number }; // Score for this round
}
```

### Cloud Function Strategy

For each critical operation (payout processing, game state transitions), we'll implement a dedicated Cloud Function with:

1. Robust authentication checks at the beginning
2. Explicit validation of input parameters
3. Transaction-based updates to prevent race conditions
4. Comprehensive error handling with user-friendly messages
5. Detailed logging for debugging
6. Proper response formatting

## Risk Mitigation

1. **Authentication Issues**
   - Implement proper token refresh before critical operations
   - Add explicit checks for `currentUser` before any sensitive operation
   - Handle auth failures gracefully with user-friendly messages

2. **Transaction Failures**
   - Use server-side operations for critical updates via Cloud Functions
   - Implement retries with exponential backoff for failed operations
   - Ensure idempotent operations where possible

3. **State Management**
   - Use React refs correctly for one-time operations
   - Implement strict validation for state transitions
   - Add comprehensive logging for debugging state issues

4. **Performance Considerations**
   - Optimize Firebase queries and updates
   - Minimize unnecessary re-renders
   - Implement proper loading states and error handling

## Timeline and Milestones

1. **Week 1: Data Modeling and Planning**
   - Complete type definitions
   - Set up project structure
   - Implement initial service stubs

2. **Week 2: Core Game Logic**
   - Implement card dealing and game setup
   - Build player action logic
   - Create state management hook

3. **Week 3: Cloud Functions and Backend**
   - Implement payout processing function
   - Create game state transition functions
   - Set up logging and monitoring

4. **Week 4: User Interface**
   - Build game creation and lobby UI
   - Implement game board and card UI
   - Create player action controls

5. **Week 5: Testing and Refinement**
   - Conduct thorough testing
   - Fix bugs and edge cases
   - Optimize performance

## Conclusion

By learning from the challenges encountered in the Rangvaar implementation, this phased approach for Scambodia focuses on stability, maintainability, and reliability. By implementing proper state management, robust Cloud Functions, and comprehensive testing, we aim to deliver a high-quality implementation that provides a smooth gaming experience for users. 