# Scambodia Cloud Functions

This document outlines the Cloud Functions required for the Scambodia game implementation, focusing on secure payout processing and reliable game state management.

## Learning from Rangvaar Implementation

The Rangvaar implementation encountered several challenges with Cloud Functions:

1. **Authentication Issues**: The client-side token sometimes became stale before payout processing.
2. **Inconsistent State**: Race conditions during critical game state transitions.
3. **Error Handling**: Technical error messages exposed to users.
4. **Transaction Failures**: Client-side transactions failing with precondition errors.

## Required Cloud Functions

### 1. Process Scambodia Payout

```typescript
/**
 * Processes the payout for a completed Scambodia game.
 * Awards winnings to the player with the lowest total score across all rounds.
 */
export const processScambodiaPayout = functions.https.onCall(async (data, context) => {
  // Authentication Check
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to trigger payout processing."
    );
  }

  const { gameId } = data;
  if (!gameId || typeof gameId !== 'string') {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Valid gameId is required."
    );
  }

  functions.logger.info(`Attempting to process Scambodia payout for game: ${gameId}`);

  const gameRef = db.collection("scambodiaGames").doc(gameId);
  const transactionsRef = db.collection("transactions");

  try {
    await db.runTransaction(async (t) => {
      // 1. Get the game document
      const gameDoc = await t.get(gameRef);
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Scambodia game ${gameId} not found.`);
      }
      const gameData = gameDoc.data();

      // 2. Perform Validation Checks
      if (!gameData) {
        throw new functions.https.HttpsError("internal", `Game data missing for ${gameId}.`);
      }
      if (gameData.gameType !== 'Scambodia') {
        throw new functions.https.HttpsError("failed-precondition", `Game ${gameId} is not a Scambodia game.`);
      }
      if (gameData.status !== 'Finished') {
        throw new functions.https.HttpsError("failed-precondition", `Game ${gameId} is not finished. Current status: ${gameData.status}`);
      }
      if (gameData.payoutProcessed) {
        functions.logger.warn(`Payout already processed for game ${gameId}. Exiting.`);
        return; 
      }
      if (!gameData.gameWinnerId) {
        throw new functions.https.HttpsError("failed-precondition", `No winner determined for game ${gameId}.`);
      }
      if (typeof gameData.wagerPerPlayer !== 'number' || gameData.wagerPerPlayer <= 0) {
        throw new functions.https.HttpsError("failed-precondition", `Invalid wagerPerPlayer for game ${gameId}.`);
      }

      // 3. Calculate Payout
      const winnerId = gameData.gameWinnerId;
      const playerCount = gameData.players.length;
      const wagerPerPlayer = gameData.wagerPerPlayer;
      const totalWagerPool = wagerPerPlayer * playerCount;
      const platformFee = 0; // No platform fee for MVP
      const winnings = totalWagerPool - platformFee;
      
      functions.logger.info(`Processing payout for game ${gameId}. Winner: ${winnerId}, Winnings: ${winnings}`);

      // 4. Update Winner Balance
      const winnerRef = db.collection("users").doc(winnerId);
      const winnerDoc = await t.get(winnerRef);
      if (!winnerDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Winning player ${winnerId} not found.`);
      }
      
      // Increment balance
      t.update(winnerRef, {
        realMoneyBalance: admin.firestore.FieldValue.increment(winnings),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 5. Log Transaction
      t.set(transactionsRef.doc(), {
        userId: winnerId,
        type: 'scambodia_payout',
        amount: winnings,
        status: 'completed',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        relatedGameId: gameId,
        platformFee: platformFee,
        notes: `Winnings from Scambodia game ${gameId}`
      });
      
      // 6. Mark Game as Processed
      t.update(gameRef, {
        payoutProcessed: true,
        payoutTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      functions.logger.info(`Successfully processed payout for Scambodia game ${gameId}.`);
    });

    return { success: true, message: `Scambodia payout for game ${gameId} processed successfully.` };

  } catch (error) {
    functions.logger.error(`Error processing Scambodia payout for game ${gameId}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      "internal",
      "An unexpected error occurred while processing the payout. We're working on fixing this issue."
    );
  }
});
```

### 2. Handle Round Transition

```typescript
/**
 * Handles the transition between rounds in Scambodia.
 * Scores the current round and initializes the next round or ends the game.
 */
export const transitionScambodiaRound = functions.https.onCall(async (data, context) => {
  // Authentication Check
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to trigger round transition."
    );
  }

  const { gameId, currentRoundNumber } = data;
  if (!gameId || typeof gameId !== 'string' || !currentRoundNumber || typeof currentRoundNumber !== 'number') {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Valid gameId and currentRoundNumber are required."
    );
  }

  functions.logger.info(`Attempting to transition Scambodia round for game: ${gameId}, round: ${currentRoundNumber}`);

  const gameRef = db.collection("scambodiaGames").doc(gameId);

  try {
    await db.runTransaction(async (t) => {
      // 1. Get the game document
      const gameDoc = await t.get(gameRef);
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Scambodia game ${gameId} not found.`);
      }
      const gameData = gameDoc.data();

      // 2. Perform Validation Checks
      if (!gameData) {
        throw new functions.https.HttpsError("internal", `Game data missing for ${gameId}.`);
      }
      if (gameData.gameType !== 'Scambodia') {
        throw new functions.https.HttpsError("failed-precondition", `Game ${gameId} is not a Scambodia game.`);
      }
      if (gameData.status !== 'Playing') {
        throw new functions.https.HttpsError("failed-precondition", `Game ${gameId} is not in Playing status.`);
      }
      if (gameData.currentRoundNumber !== currentRoundNumber) {
        functions.logger.warn(`Round number mismatch for game ${gameId}. Expected: ${currentRoundNumber}, Actual: ${gameData.currentRoundNumber}`);
        // Don't throw error, just skip if already transitioned
        return; 
      }

      const currentRound = gameData.rounds[currentRoundNumber];
      if (!currentRound) {
        throw new functions.https.HttpsError("not-found", `Round ${currentRoundNumber} not found in game ${gameId}.`);
      }
      if (currentRound.phase !== 'Scoring') {
        throw new functions.https.HttpsError("failed-precondition", `Round ${currentRoundNumber} is not in scoring phase.`);
      }

      // 3. Calculate round scores and update cumulative scores
      // (scoring logic would go here - determining who had lowest points, etc.)
      const roundScores = currentRound.scores;
      const newCumulativeScores = { ...gameData.cumulativeScores };
      
      // Update cumulative scores
      Object.entries(roundScores).forEach(([playerId, score]) => {
        newCumulativeScores[playerId] = (newCumulativeScores[playerId] || 0) + score;
      });

      // 4. Check if this was the final round
      if (currentRoundNumber >= gameData.totalRounds) {
        // Determine game winner (player with lowest cumulative score)
        let lowestScore = Infinity;
        let gameWinnerId = null;
        let tiedPlayers = [];
        
        Object.entries(newCumulativeScores).forEach(([playerId, score]) => {
          if (score < lowestScore) {
            lowestScore = score;
            gameWinnerId = playerId;
            tiedPlayers = [playerId];
          } else if (score === lowestScore) {
            tiedPlayers.push(playerId);
          }
        });
        
        // Handle tie using scambodiaCalls
        if (tiedPlayers.length > 1) {
          let mostCalls = -1;
          tiedPlayers.forEach(playerId => {
            const calls = gameData.scambodiaCalls[playerId] || 0;
            if (calls > mostCalls) {
              mostCalls = calls;
              gameWinnerId = playerId;
            }
          });
        }
        
        // End game
        t.update(gameRef, {
          status: 'Finished',
          gameWinnerId,
          cumulativeScores: newCumulativeScores,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          'rounds.$currentRoundNumber.phase': 'Complete'
        });
        
        functions.logger.info(`Game ${gameId} completed. Winner: ${gameWinnerId}, Score: ${lowestScore}`);
      } else {
        // Initialize next round
        const nextRoundNumber = currentRoundNumber + 1;
        
        // Create next round state
        // (this would initialize a new round using a helper function)
        const nextRound = {
          roundNumber: nextRoundNumber,
          phase: 'Setup',
          // ... other round initialization data
        };
        
        // Update game state
        t.update(gameRef, {
          currentRoundNumber: nextRoundNumber,
          cumulativeScores: newCumulativeScores,
          [`rounds.${currentRoundNumber}.phase`]: 'Complete',
          [`rounds.${nextRoundNumber}`]: nextRound,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        functions.logger.info(`Transitioned game ${gameId} from round ${currentRoundNumber} to ${nextRoundNumber}`);
      }
    });

    return { 
      success: true, 
      message: `Round transition for game ${gameId} processed successfully.` 
    };

  } catch (error) {
    functions.logger.error(`Error transitioning round for Scambodia game ${gameId}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      "internal",
      "An unexpected error occurred during round transition. We're working on fixing this issue."
    );
  }
});
```

## Implementation Strategy

1. **Deploy Functions First**: Deploy and test Cloud Functions before implementing client-side code.
2. **Test with Minimal Game States**: Create test game states to validate each function.
3. **Robust Error Handling**: Implement comprehensive error handling and user-friendly messages.
4. **Logging**: Add detailed logging for all key operations for debugging.
5. **Transaction Validation**: Validate all preconditions within transactions to prevent failures.

## Security Considerations

1. **Authentication**: Verify user identity and permissions for all operations.
2. **Data Validation**: Validate all input data before processing.
3. **Idempotent Operations**: Ensure operations can be safely retried without side effects.
4. **Rate Limiting**: Protect against abuse with appropriate rate limiting.

## Testing Process

1. **Unit Tests**: Create unit tests for each Cloud Function.
2. **Integration Tests**: Test end-to-end flow including client and server.
3. **Edge Cases**: Test various error conditions and edge cases.
4. **Performance Testing**: Test with realistic game data and concurrent users.

## Deployment Checklist

- [ ] Write Cloud Function code
- [ ] Deploy to test environment
- [ ] Validate correct functionality
- [ ] Update client code to use Cloud Functions
- [ ] Monitor initial deployments for errors
- [ ] Document any issues and resolutions 