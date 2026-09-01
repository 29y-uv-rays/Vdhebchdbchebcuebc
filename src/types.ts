export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type MoveClassification = 
  | 'brilliant' 
  | 'great' 
  | 'best' 
  | 'good' 
  | 'inaccuracy' 
  | 'mistake' 
  | 'blunder' 
  | 'book';

export type ExplanationCategory =
  | 'Tactical'
  | 'Material'
  | 'King Safety'
  | 'Development'
  | 'Position'
  | 'Tempo'
  | 'Opportunity'
  | 'Endgame';

export interface CoachExplanation {
  whatPlayed: string;
  strongerMove: string;
  whyBetter: string;
  category: ExplanationCategory;
  principle: string;
  consequenceSummary: string;
  consequenceLine: string[]; // e.g. ["Bxf6", "gxf6", "Qh5"]
  hint: string;
}

export interface AnalyzedMove {
  ply: number;
  moveNumber: number;
  color: PieceColor;
  san: string;
  from: string;
  to: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore: number; // in centipawns (from White perspective)
  evalAfter: number;  // in centipawns (from White perspective)
  bestMoveSan: string;
  bestMoveFrom: string;
  bestMoveTo: string;
  bestMoveEval: number;
  evalLoss: number; // centipawns lost from moving player's perspective
  classification: MoveClassification;
  explanation?: CoachExplanation;
  isKeyMoment: boolean;
}

export interface GameAnalysisResult {
  moves: AnalyzedMove[];
  whiteAccuracy: number; // 0 - 100
  blackAccuracy: number; // 0 - 100
  whiteStats: {
    brilliant: number;
    best: number;
    good: number;
    inaccuracy: number;
    mistake: number;
    blunder: number;
  };
  blackStats: {
    brilliant: number;
    best: number;
    good: number;
    inaccuracy: number;
    mistake: number;
    blunder: number;
  };
  keyMoments: number[]; // indices of moves that are key moments
  overallSummary?: string;
}

export interface BotProfile {
  id: string;
  name: string;
  rating: number;
  title: string;
  avatar: string;
  description: string;
  style: 'Beginner' | 'Solid' | 'Aggressive' | 'Positional' | 'Master';
  searchDepth: number;
  randomness: number; // 0 to 1
  blunderRate: number; // 0 to 1
}

export interface AISettings {
  provider: 'nvidia' | 'heuristic';
  nvidiaModel: string;
  coachPersona: 'encouraging' | 'strict' | 'tactical' | 'friendly';
  mistakeThresholds: {
    inaccuracy: number; // default 0.40
    mistake: number;    // default 0.90
    blunder: number;    // default 2.00
  };
}

export interface GameHistoryItem {
  id: string;
  date: string;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  reason: string;
  playerColor: PieceColor;
  opponent: string;
  opponentRating: number;
  pgn: string;
  movesCount: number;
  playerAccuracy: number;
  analysis?: GameAnalysisResult;
}
