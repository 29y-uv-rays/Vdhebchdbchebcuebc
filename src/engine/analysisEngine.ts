import { Chess } from 'chess.js';
import { 
  AnalyzedMove, 
  GameAnalysisResult, 
  MoveClassification, 
  ExplanationCategory, 
  CoachExplanation,
  AISettings
} from '../types';
import { findBestMove, evaluatePosition, PIECE_VALUES } from './evaluator';

export function classifyMove(
  evalLossCp: number,
  isBestMove: boolean,
  isSacrifice: boolean,
  evalAfterCp: number,
  isWhite: boolean,
  thresholds = { inaccuracy: 0.40, mistake: 0.90, blunder: 2.00 }
): MoveClassification {
  const lossPawns = evalLossCp / 100;
  
  if (isBestMove) {
    if (isSacrifice && ((isWhite && evalAfterCp > 150) || (!isWhite && evalAfterCp < -150))) {
      return 'brilliant';
    }
    return 'best';
  }

  if (lossPawns <= 0.15) {
    return 'best';
  }
  if (lossPawns <= thresholds.inaccuracy) {
    return 'good';
  }
  if (lossPawns <= thresholds.mistake) {
    return 'inaccuracy';
  }
  if (lossPawns <= thresholds.blunder) {
    return 'mistake';
  }
  return 'blunder';
}

// CAPS-style move accuracy calculation
export function calculateMoveAccuracy(lossCp: number): number {
  const lossPawn = Math.max(0, lossCp / 100);
  const accuracy = 100 * Math.exp(-0.05 * Math.pow(lossPawn, 1.8));
  return Math.min(100, Math.max(0, accuracy));
}

// Generate rich heuristic coach explanations
export function generateHeuristicExplanation(
  fenBefore: string,
  sanPlayed: string,
  bestSan: string,
  classification: MoveClassification,
  evalLossCp: number,
  consequenceLine: string[]
): CoachExplanation {
  const chessBefore = new Chess(fenBefore);
  const movingColor = chessBefore.turn();
  const isWhite = movingColor === 'w';

  // Analyze pieces and context
  const playedMove = chessBefore.moves({ verbose: true }).find(m => m.san === sanPlayed);
  const bestMove = chessBefore.moves({ verbose: true }).find(m => m.san === bestSan);

  let category: ExplanationCategory = 'Tactical';
  let principle = 'Tactical awareness & board vision';
  let whatPlayed = `You played ${sanPlayed}.`;
  let strongerMove = `A stronger move was ${bestSan}.`;
  let whyBetter = '';
  let hint = '';

  const pieceNameMap: Record<string, string> = {
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king',
  };

  const playedPieceName = playedMove ? pieceNameMap[playedMove.piece] : 'piece';
  const bestPieceName = bestMove ? pieceNameMap[bestMove.piece] : 'piece';

  // Determine category and coaching narrative
  if (classification === 'blunder' || classification === 'mistake') {
    if (playedMove?.captured && bestMove && !bestMove.captured) {
      category = 'Tactical';
      principle = 'Greed vs Position & Poisoned Pieces';
      whatPlayed = `${sanPlayed} captures material, but leaves your position vulnerable.`;
      strongerMove = `${bestSan} maintains your tactical stability.`;
      whyBetter = `Capturing with ${sanPlayed} falls into a tactical snare or opens attacking lines for the opponent. ${bestSan} preserves your initiative without taking poisoned material.`;
      hint = `Look for a quieter move with your ${bestPieceName} that does not walk into danger.`;
    } else if (playedMove && playedMove.piece === 'q' && bestMove && bestMove.piece !== 'q') {
      category = 'Material';
      principle = 'Queen Safety & Overextension';
      whatPlayed = `${sanPlayed} brings the queen into an exposed square.`;
      strongerMove = `${bestSan} uses the ${bestPieceName} instead.`;
      whyBetter = `Exposing the queen so early invites enemy minor pieces to attack it with tempo. ${bestSan} coordinates your pieces safely.`;
      hint = `Look for a move that activates your minor pieces (${bestPieceName}) rather than moving the queen.`;
    } else if (chessBefore.inCheck()) {
      category = 'King Safety';
      principle = 'King Defense & Parrying Checks';
      whatPlayed = `${sanPlayed} steps into a dangerous follow-up attack.`;
      strongerMove = `${bestSan} neutralizes the check safely.`;
      whyBetter = `When facing check, ${bestSan} shields your king and prevents the opponent from stacking further threats.`;
      hint = `Find a defensive response to the check using your ${bestPieceName}.`;
    } else if (bestMove && bestMove.captured) {
      const capVal = PIECE_VALUES[bestMove.captured || 'p'];
      category = 'Opportunity';
      principle = 'Seizing Tactical Opportunities';
      whatPlayed = `${sanPlayed} missed a tactical breakthrough.`;
      strongerMove = `${bestSan} wins an opposing ${pieceNameMap[bestMove.captured || 'p']}.`;
      whyBetter = `You had an opportunity to capture a free or poorly defended piece with ${bestSan}. ${sanPlayed} lets the opponent off the hook.`;
      hint = `Look across the board for an undefended black piece that your ${bestPieceName} can target.`;
    } else if (bestMove && (bestMove.san.includes('O-O') || bestMove.piece === 'k')) {
      category = 'King Safety';
      principle = 'Castling & King Shelter';
      whatPlayed = `${sanPlayed} delays securing your king.`;
      strongerMove = `${bestSan} secures the king behind a solid pawn shield.`;
      whyBetter = `Leaving the king in the center exposes it to vertical pins along open files. Castling immediately tucks the king safely away.`;
      hint = `Look for a move that safeguards your king to the flank.`;
    } else if (playedMove && playedMove.piece === 'p' && bestMove && (bestMove.piece === 'n' || bestMove.piece === 'b')) {
      category = 'Development';
      principle = 'Piece Activity & Opening Principles';
      whatPlayed = `${sanPlayed} wastes time with unnecessary pawn pushes.`;
      strongerMove = `${bestSan} activates your ${bestPieceName}.`;
      whyBetter = `In the opening and middlegame, mobilizing your knights and bishops is crucial for controlling the center. Moving pawns repeatedly falls behind in development.`;
      hint = `Look for a development move to get your ${bestPieceName} into the game.`;
    } else {
      category = 'Position';
      principle = 'Positional Harmony & Board Control';
      whatPlayed = `${sanPlayed} creates weaknesses or concedes crucial squares.`;
      strongerMove = `${bestSan} solidifies your structure and controls key central squares.`;
      whyBetter = `${bestSan} increases the mobility of your forces while restricting your opponent's active counterplay.`;
      hint = `Find a square where your ${bestPieceName} dominates the center.`;
    }
  } else if (classification === 'inaccuracy') {
    category = 'Tempo';
    principle = 'Efficient Move Orders';
    whatPlayed = `${sanPlayed} is playable, but slightly suboptimal.`;
    strongerMove = `${bestSan} creates more immediate pressure.`;
    whyBetter = `${bestSan} forces your opponent to respond defensively, whereas ${sanPlayed} gives them extra time to organize their defense.`;
    hint = `Look for a more direct and active square for your ${bestPieceName}.`;
  } else if (classification === 'brilliant') {
    category = 'Tactical';
    principle = 'Brilliant Tactical Breakthrough';
    whatPlayed = `Brilliant move! You found the decisive ${sanPlayed}!`;
    strongerMove = `${sanPlayed} is the masterpiece move.`;
    whyBetter = `This stunning move penetrates the enemy defenses with unstoppable tactical threats.`;
    hint = `You found the best possible tactical continuation!`;
  } else {
    category = 'Development';
    principle = 'Solid Chess Fundamentals';
    whatPlayed = `${sanPlayed} is a strong, accurate move.`;
    strongerMove = `${bestSan} is the top engine recommendation.`;
    whyBetter = `Maintains high positional pressure and executes sound chess principles.`;
    hint = `Keep up the accurate play!`;
  }

  // Construct consequence summary
  const consequenceLineStr = consequenceLine.length > 0 ? consequenceLine.join(' ') : bestSan;
  const consequenceSummary = consequenceLine.length > 0
    ? `Recommended engine continuation: ${consequenceLineStr}. This consolidates the advantage and keeps Black under pressure.`
    : `Following up with ${bestSan} secures tactical dominance.`;

  return {
    whatPlayed,
    strongerMove,
    whyBetter,
    category,
    principle,
    consequenceSummary,
    consequenceLine,
    hint,
  };
}

export interface AnalyzeGameOptions {
  depth?: number;
  thresholds?: {
    inaccuracy: number;
    mistake: number;
    blunder: number;
  };
  onProgress?: (progress: number, currentPly: number, totalPlies: number) => void;
}

// Full move-by-move game analysis
export async function analyzeFullGame(
  movesPgnList: { san: string; from: string; to: string }[],
  options: AnalyzeGameOptions = {}
): Promise<GameAnalysisResult> {
  const depth = options.depth || 3;
  const thresholds = options.thresholds || {
    inaccuracy: 0.40,
    mistake: 0.90,
    blunder: 2.00,
  };

  const analyzedMoves: AnalyzedMove[] = [];
  const chess = new Chess();
  const totalMoves = movesPgnList.length;

  let whiteLossSum = 0;
  let blackLossSum = 0;
  let whiteMoveCount = 0;
  let blackMoveCount = 0;

  const whiteStats = { brilliant: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  const blackStats = { brilliant: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  const keyMoments: number[] = [];

  let currentEval = evaluatePosition(chess);

  for (let i = 0; i < totalMoves; i++) {
    const moveData = movesPgnList[i];
    const fenBefore = chess.fen();
    const evalBefore = currentEval;
    const color = chess.turn();
    const isWhite = color === 'w';
    const moveNumber = Math.floor(i / 2) + 1;

    // Search best move before the move was played
    const bestEngineResult = findBestMove(fenBefore, { depth });
    const bestMoveSan = bestEngineResult ? bestEngineResult.bestMoveSan : moveData.san;
    const bestMoveFrom = bestEngineResult ? bestEngineResult.bestMove.from : moveData.from;
    const bestMoveTo = bestEngineResult ? bestEngineResult.bestMove.to : moveData.to;
    const bestMoveEval = bestEngineResult ? bestEngineResult.evaluation : evalBefore;
    const pvLine = bestEngineResult ? bestEngineResult.pvLine : [];

    // Make the actual move
    const executedMove = chess.move(moveData.san);
    const fenAfter = chess.fen();
    const evalAfter = evaluatePosition(chess);
    currentEval = evalAfter;

    // Calculate evaluation loss from the moving side's perspective
    // (If white: eval loss is bestMoveEval - evalAfter)
    // (If black: eval loss is evalAfter - bestMoveEval)
    let evalLossCp = 0;
    if (isWhite) {
      evalLossCp = Math.max(0, bestMoveEval - evalAfter);
    } else {
      evalLossCp = Math.max(0, evalAfter - bestMoveEval);
    }

    const isBest = moveData.san === bestMoveSan || evalLossCp <= 15;
    const isSacrifice = !!executedMove && ['q', 'r', 'b', 'n'].includes(executedMove.piece) && executedMove.captured === undefined && Math.abs(evalAfter) < 200;

    const classification = classifyMove(
      evalLossCp,
      isBest,
      isSacrifice,
      evalAfter,
      isWhite,
      thresholds
    );

    // Track stats
    if (isWhite) {
      whiteLossSum += calculateMoveAccuracy(evalLossCp);
      whiteMoveCount++;
      if (classification in whiteStats) {
        whiteStats[classification as keyof typeof whiteStats]++;
      }
    } else {
      blackLossSum += calculateMoveAccuracy(evalLossCp);
      blackMoveCount++;
      if (classification in blackStats) {
        blackStats[classification as keyof typeof blackStats]++;
      }
    }

    const isKeyMoment = ['blunder', 'mistake', 'inaccuracy', 'brilliant'].includes(classification);
    if (isKeyMoment) {
      keyMoments.push(i);
    }

    // Generate initial explanation
    const explanation = generateHeuristicExplanation(
      fenBefore,
      moveData.san,
      bestMoveSan,
      classification,
      evalLossCp,
      pvLine
    );

    analyzedMoves.push({
      ply: i,
      moveNumber,
      color,
      san: moveData.san,
      from: moveData.from,
      to: moveData.to,
      fenBefore,
      fenAfter,
      evalBefore,
      evalAfter,
      bestMoveSan,
      bestMoveFrom,
      bestMoveTo,
      bestMoveEval,
      evalLoss: evalLossCp,
      classification,
      explanation,
      isKeyMoment,
    });

    if (options.onProgress) {
      options.onProgress(Math.round(((i + 1) / totalMoves) * 100), i + 1, totalMoves);
    }

    // Yield to browser UI thread periodically
    if (i % 4 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  const whiteAccuracy = whiteMoveCount > 0 ? Math.round(whiteLossSum / whiteMoveCount) : 100;
  const blackAccuracy = blackMoveCount > 0 ? Math.round(blackLossSum / blackMoveCount) : 100;

  return {
    moves: analyzedMoves,
    whiteAccuracy,
    blackAccuracy,
    whiteStats,
    blackStats,
    keyMoments,
    overallSummary: `Game finished with ${analyzedMoves.length} moves. White accuracy: ${whiteAccuracy}%, Black accuracy: ${blackAccuracy}%. ${keyMoments.length} key moments identified.`,
  };
}
