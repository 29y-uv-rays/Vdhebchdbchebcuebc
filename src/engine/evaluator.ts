import { Chess, Move, Square } from 'chess.js';

// Piece base values in centipawns
export const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece Square Tables (White's perspective; flipped for Black)
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const ROOK_TABLE = [
    0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_MIDGAME_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20
];

const KING_ENDGAME_TABLE = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50
];

function getSquareIndex(fileIdx: number, rankIdx: number, isWhite: boolean): number {
  const row = isWhite ? 7 - rankIdx : rankIdx;
  const col = fileIdx;
  return row * 8 + col;
}

// Static Evaluation Function: Returns centipawns from White's perspective (+ = White ahead)
export function evaluatePosition(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -25000 : 25000;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
    return 0;
  }

  const board = chess.board();
  let materialScore = 0;
  let positionalScore = 0;
  let totalNonPawnMaterial = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = PIECE_VALUES[piece.type];
      const isWhite = piece.color === 'w';
      const sign = isWhite ? 1 : -1;
      const rankIdx = 7 - r; // 0 for rank 1, 7 for rank 8
      const fileIdx = c;
      const sqIdx = getSquareIndex(fileIdx, rankIdx, isWhite);

      materialScore += sign * val;
      if (piece.type !== 'p' && piece.type !== 'k') {
        totalNonPawnMaterial += val;
      }

      let pstVal = 0;
      switch (piece.type) {
        case 'p': pstVal = PAWN_TABLE[sqIdx]; break;
        case 'n': pstVal = KNIGHT_TABLE[sqIdx]; break;
        case 'b': pstVal = BISHOP_TABLE[sqIdx]; break;
        case 'r': pstVal = ROOK_TABLE[sqIdx]; break;
        case 'q': pstVal = QUEEN_TABLE[sqIdx]; break;
        case 'k': 
          pstVal = totalNonPawnMaterial < 1500 
            ? KING_ENDGAME_TABLE[sqIdx] 
            : KING_MIDGAME_TABLE[sqIdx]; 
          break;
      }
      positionalScore += sign * pstVal;
    }
  }

  // Mobility bonus (legal moves)
  const currentTurn = chess.turn();
  const mobility = chess.moves().length;
  const mobilityBonus = currentTurn === 'w' ? mobility * 2 : -mobility * 2;

  // Check penalty
  let checkBonus = 0;
  if (chess.inCheck()) {
    checkBonus = currentTurn === 'w' ? -40 : 40;
  }

  return materialScore + positionalScore + mobilityBonus + checkBonus;
}

// Quiescence search to handle captures
function quiescence(chess: Chess, alpha: number, beta: number, depthLimit = 4): number {
  const standPat = evaluatePosition(chess);
  const isWhite = chess.turn() === 'w';

  if (depthLimit <= 0) return standPat;

  if (isWhite) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    // Get capture moves only
    const moves = chess.moves({ verbose: true }).filter(m => m.captured);
    // Sort captures by MVV-LVA
    moves.sort((a, b) => (PIECE_VALUES[b.captured || 'p'] - PIECE_VALUES[b.piece]) - (PIECE_VALUES[a.captured || 'p'] - PIECE_VALUES[a.piece]));

    for (const move of moves) {
      chess.move(move);
      const score = quiescence(chess, alpha, beta, depthLimit - 1);
      chess.undo();

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;

    const moves = chess.moves({ verbose: true }).filter(m => m.captured);
    moves.sort((a, b) => (PIECE_VALUES[b.captured || 'p'] - PIECE_VALUES[b.piece]) - (PIECE_VALUES[a.captured || 'p'] - PIECE_VALUES[a.piece]));

    for (const move of moves) {
      chess.move(move);
      const score = quiescence(chess, alpha, beta, depthLimit - 1);
      chess.undo();

      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
    return beta;
  }
}

export interface EngineSearchOptions {
  depth: number;
  maxTimeMs?: number;
  randomness?: number; // for lower rating bots
}

export interface EngineSearchResult {
  bestMove: Move;
  bestMoveSan: string;
  evaluation: number; // centipawns (from White perspective)
  pvLine: string[];   // continuation SANs
  depth: number;
}

// Minimax with Alpha-Beta pruning & PV collection
export function findBestMove(
  fen: string,
  options: EngineSearchOptions = { depth: 3 }
): EngineSearchResult | null {
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  const isWhite = chess.turn() === 'w';
  const targetDepth = Math.max(1, options.depth);

  let alpha = -Infinity;
  let beta = Infinity;
  let bestMove: Move = legalMoves[0];
  let bestScore = isWhite ? -Infinity : Infinity;
  let bestLine: string[] = [];

  // Order moves: captures first, checks next
  legalMoves.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    if (a.captured) scoreA += 1000 + PIECE_VALUES[a.captured] - PIECE_VALUES[a.piece];
    if (b.captured) scoreB += 1000 + PIECE_VALUES[b.captured] - PIECE_VALUES[b.piece];
    if (a.promotion) scoreA += 800;
    if (b.promotion) scoreB += 800;
    return scoreB - scoreA;
  });

  function minimax(
    c: Chess,
    depth: number,
    a: number,
    b: number,
    collectLine: string[]
  ): number {
    if (depth === 0 || c.isGameOver()) {
      return quiescence(c, a, b);
    }

    const moves = c.moves({ verbose: true });
    if (moves.length === 0) {
      return evaluatePosition(c);
    }

    // Move ordering
    moves.sort((x, y) => {
      let sx = 0;
      let sy = 0;
      if (x.captured) sx += 1000 + PIECE_VALUES[x.captured] - PIECE_VALUES[x.piece];
      if (y.captured) sy += 1000 + PIECE_VALUES[y.captured] - PIECE_VALUES[y.piece];
      return sy - sx;
    });

    const turn = c.turn();
    if (turn === 'w') {
      let maxEval = -Infinity;
      for (const m of moves) {
        c.move(m);
        const subLine: string[] = [];
        const evalScore = minimax(c, depth - 1, a, b, subLine);
        c.undo();

        if (evalScore > maxEval) {
          maxEval = evalScore;
          if (collectLine) {
            collectLine.length = 0;
            collectLine.push(m.san, ...subLine);
          }
        }
        a = Math.max(a, evalScore);
        if (b <= a) break; // Beta cutoff
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const m of moves) {
        c.move(m);
        const subLine: string[] = [];
        const evalScore = minimax(c, depth - 1, a, b, subLine);
        c.undo();

        if (evalScore < minEval) {
          minEval = evalScore;
          if (collectLine) {
            collectLine.length = 0;
            collectLine.push(m.san, ...subLine);
          }
        }
        b = Math.min(b, evalScore);
        if (b <= a) break; // Alpha cutoff
      }
      return minEval;
    }
  }

  // Iterative search through legal root moves
  const scoredMoves: { move: Move; score: number; line: string[] }[] = [];

  for (const move of legalMoves) {
    chess.move(move);
    const subLine: string[] = [];
    const score = minimax(chess, targetDepth - 1, alpha, beta, subLine);
    chess.undo();

    scoredMoves.push({ move, score, line: [move.san, ...subLine] });

    if (isWhite) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
        bestLine = [move.san, ...subLine];
      }
      alpha = Math.max(alpha, score);
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
        bestLine = [move.san, ...subLine];
      }
      beta = Math.min(beta, score);
    }
  }

  // Add bot randomness if configured (for beginner/intermediate bots)
  if (options.randomness && options.randomness > 0 && scoredMoves.length > 1) {
    // Sort moves by score
    scoredMoves.sort((x, y) => isWhite ? y.score - x.score : x.score - y.score);
    // Introduce chance of picking a 2nd or 3rd best move
    const r = Math.random();
    if (r < options.randomness && scoredMoves.length > 1) {
      const pickIdx = Math.min(Math.floor(r * 4) + 1, scoredMoves.length - 1);
      bestMove = scoredMoves[pickIdx].move;
      bestScore = scoredMoves[pickIdx].score;
      bestLine = scoredMoves[pickIdx].line;
    }
  }

  return {
    bestMove,
    bestMoveSan: bestMove.san,
    evaluation: bestScore,
    pvLine: bestLine.slice(0, 5),
    depth: targetDepth,
  };
}
