import { PlayerInfo } from '../types/scambodia';

/**
 * Helper function to find a player's username by their ID.
 * @param players - The array of PlayerInfo objects.
 * @param userId - The ID of the player whose username is needed.
 * @returns The player's username or 'Unknown Player' if not found.
 */
export const getPlayerUsername = (players: PlayerInfo[], userId: string | null): string => {
  if (!userId) return 'Unknown Player';
  return players.find(p => p.userId === userId)?.username || 'Unknown Player';
}; 