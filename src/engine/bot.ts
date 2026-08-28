import { Chess, Move } from 'chess.js';
import { BotProfile } from '../types';
import { findBestMove } from './evaluator';

export const BOT_PROFILES: BotProfile[] = [
  {
    id: 'pawn-pip',
    name: 'Pip the Pawn',
    rating: 600,
    title: 'Beginner',
    avatar: '🐣',
    description: 'Friendly starter bot who loves pushing pawns and occasionally forgets to guard pieces.',
    style: 'Beginner',
    searchDepth: 1,
    randomness: 0.45,
    blunderRate: 0.35,
  },
  {
    id: 'guardian-gary',
    name: 'Guardian Gary',
    rating: 1100,
    title: 'Club Player',
    avatar: '🛡️',
    description: 'Solid and defensive. Likes castling early and keeping the position safe and closed.',
    style: 'Solid',
    searchDepth: 2,
    randomness: 0.25,
    blunderRate: 0.15,
  },
  {
    id: 'tactical-tina',
    name: 'Tactical Tina',
    rating: 1550,
    title: 'Tactician',
    avatar: '⚡',
    description: 'Aggressive attacking player looking for pins, forks, sacrifices, and king attacks.',
    style: 'Aggressive',
    searchDepth: 3,
    randomness: 0.1,
    blunderRate: 0.05,
  },
  {
    id: 'dr-sophia',
    name: 'Dr. Sophia Positional',
    rating: 1850,
    title: 'Expert',
    avatar: '🔬',
    description: 'Master of piece harmony, outposts, pawn structure, and patient endgame squeeze.',
    style: 'Positional',
    searchDepth: 3,
    randomness: 0.04,
    blunderRate: 0.01,
  },
  {
    id: 'grandmaster-apex',
    name: 'Apex Grandmaster',
    rating: 2300,
    title: 'Grandmaster',
    avatar: '👑',
    description: 'Ruthless calculation and near-flawless tactical vision. Ready to punish every inaccuracy.',
    style: 'Master',
    searchDepth: 4,
    randomness: 0.0,
    blunderRate: 0.0,
  }
];

export async function getBotMove(
  chess: Chess,
  bot: BotProfile
): Promise<Move | null> {
  // Simulate natural bot thinking time (300ms to 900ms)
  const thinkTime = 300 + Math.random() * 500;
  await new Promise(resolve => setTimeout(resolve, thinkTime));

  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  // Check blunder chance for beginner bots
  if (bot.blunderRate > 0 && Math.random() < bot.blunderRate) {
    const nonCheckmateMoves = legalMoves.filter(m => {
      chess.move(m);
      const isMate = chess.isCheckmate();
      chess.undo();
      return !isMate;
    });
    if (nonCheckmateMoves.length > 0) {
      const randomMove = nonCheckmateMoves[Math.floor(Math.random() * nonCheckmateMoves.length)];
      return randomMove;
    }
  }

  const result = findBestMove(chess.fen(), {
    depth: bot.searchDepth,
    randomness: bot.randomness,
  });

  if (result) {
    return result.bestMove;
  }

  return legalMoves[Math.floor(Math.random() * legalMoves.length)];
}
