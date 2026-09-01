import React from 'react';
import { Chess, PieceSymbol } from 'chess.js';
import { BotProfile, PieceColor } from '../types';
import { ChessPieceIcon } from './ChessBoard';
import { PIECE_VALUES } from '../engine/evaluator';
import { 
  RotateCw, 
  Flag, 
  Handshake, 
  Undo2, 
  Settings as SettingsIcon, 
  Bot, 
  User, 
  Clock, 
  Sparkles,
  BarChart2
} from 'lucide-react';

interface GamePanelProps {
  chess: Chess;
  bot: BotProfile;
  playerColor: PieceColor;
  isBotThinking: boolean;
  historyMoves: { san: string; from: string; to: string }[];
  currentMoveIndex: number;
  onJumpToMove: (index: number) => void;
  onFlipBoard: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onUndoMove: () => void;
  onOpenSettings: () => void;
  onAnalyzeGame: () => void;
  isGameOver: boolean;
  gameResultText?: string | null;
  timeControlSeconds?: number;
  whiteTimeSeconds?: number;
  blackTimeSeconds?: number;
}

export const GamePanel: React.FC<GamePanelProps> = ({
  chess,
  bot,
  playerColor,
  isBotThinking,
  historyMoves,
  currentMoveIndex,
  onJumpToMove,
  onFlipBoard,
  onResign,
  onOfferDraw,
  onUndoMove,
  onOpenSettings,
  onAnalyzeGame,
  isGameOver,
  gameResultText,
  whiteTimeSeconds = 600,
  blackTimeSeconds = 600,
}) => {
  const turn = chess.turn();

  // Compute captured pieces
  const board = chess.board();
  const startingPieceCounts: Record<string, number> = {
    'w-p': 8, 'w-n': 2, 'w-b': 2, 'w-r': 2, 'w-q': 1,
    'b-p': 8, 'b-n': 2, 'b-b': 2, 'b-r': 2, 'b-q': 1,
  };

  const currentPieceCounts: Record<string, number> = {
    'w-p': 0, 'w-n': 0, 'w-b': 0, 'w-r': 0, 'w-q': 0,
    'b-p': 0, 'b-n': 0, 'b-b': 0, 'b-r': 0, 'b-q': 0,
  };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type !== 'k') {
        currentPieceCounts[`${p.color}-${p.type}`]++;
      }
    }
  }

  const whiteCaptured: PieceSymbol[] = []; // Black pieces captured by White
  const blackCaptured: PieceSymbol[] = []; // White pieces captured by Black

  (['q', 'r', 'b', 'n', 'p'] as PieceSymbol[]).forEach(type => {
    const missingWhite = startingPieceCounts[`w-${type}`] - currentPieceCounts[`w-${type}`];
    for (let i = 0; i < missingWhite; i++) blackCaptured.push(type);

    const missingBlack = startingPieceCounts[`b-${type}`] - currentPieceCounts[`b-${type}`];
    for (let i = 0; i < missingBlack; i++) whiteCaptured.push(type);
  });

  // Calculate material difference
  const whiteMatScore = whiteCaptured.reduce((sum, p) => sum + PIECE_VALUES[p], 0);
  const blackMatScore = blackCaptured.reduce((sum, p) => sum + PIECE_VALUES[p], 0);
  const whiteAdvantage = Math.round((whiteMatScore - blackMatScore) / 100);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Group moves into pairs (White & Black)
  const movePairs: { moveNumber: number; white?: string; black?: string; whiteIdx?: number; blackIdx?: number }[] = [];
  for (let i = 0; i < historyMoves.length; i += 2) {
    movePairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: historyMoves[i]?.san,
      black: historyMoves[i + 1]?.san,
      whiteIdx: i,
      blackIdx: i + 1,
    });
  }

  const isPlayerWhite = playerColor === 'w';

  return (
    <div className="w-full max-w-[420px] bg-slate-900/85 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between gap-4 text-white select-none backdrop-blur">
      {/* Bot Card (Opponent Bento Tile) */}
      <div
        className={`p-3.5 rounded-xl border transition-all ${
          turn === (isPlayerWhite ? 'b' : 'w') && !isGameOver
            ? 'bg-slate-800/90 border-indigo-500/80 ring-1 ring-indigo-500/40 shadow-lg'
            : 'bg-slate-800/40 border-slate-700/60'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="text-2xl p-1.5 bg-slate-900 rounded-xl border border-slate-700/80 shadow-inner">
              {bot.avatar}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white">{bot.name}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-indigo-400">
                  {bot.rating}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {isBotThinking ? (
                  <span className="text-indigo-400 font-semibold animate-pulse flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Thinking...
                  </span>
                ) : (
                  bot.style
                )}
              </span>
            </div>
          </div>

          {/* Opponent Timer / Material */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 font-mono font-bold text-sm text-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {formatTime(isPlayerWhite ? blackTimeSeconds : whiteTimeSeconds)}
            </div>
            {((isPlayerWhite && whiteAdvantage < 0) || (!isPlayerWhite && whiteAdvantage > 0)) && (
              <span className="text-[10px] font-bold text-slate-300 font-mono">
                +{Math.abs(whiteAdvantage)}
              </span>
            )}
          </div>
        </div>

        {/* Captured Pieces by Opponent */}
        <div className="flex items-center gap-0.5 mt-2 h-5 overflow-x-auto">
          {(isPlayerWhite ? blackCaptured : whiteCaptured).map((p, idx) => (
            <div key={`bot-cap-${idx}`} className="w-4 h-4 shrink-0">
              <ChessPieceIcon type={p} color={isPlayerWhite ? 'w' : 'b'} />
            </div>
          ))}
        </div>
      </div>

      {/* Move History Log (SAN Bento Tile) */}
      <div className="flex-1 min-h-[160px] max-h-[260px] bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col gap-2 overflow-y-auto">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">
          <span>Move History</span>
          <span className="font-mono">{historyMoves.length} plies</span>
        </div>

        {movePairs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500 italic">
            Moves will appear here
          </div>
        ) : (
          <div className="space-y-1 text-xs font-mono">
            {movePairs.map((pair) => (
              <div
                key={`pair-${pair.moveNumber}`}
                className="grid grid-cols-12 items-center py-0.5 px-1.5 rounded hover:bg-slate-800/50"
              >
                <span className="col-span-2 text-slate-500 font-semibold text-[11px]">
                  {pair.moveNumber}.
                </span>
                <span
                  onClick={() => pair.whiteIdx !== undefined && onJumpToMove(pair.whiteIdx)}
                  className={`col-span-5 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    currentMoveIndex === pair.whiteIdx
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-200 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {pair.white}
                </span>
                <span
                  onClick={() => pair.blackIdx !== undefined && onJumpToMove(pair.blackIdx)}
                  className={`col-span-5 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    currentMoveIndex === pair.blackIdx
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-200 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {pair.black || ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Game Over Banner or Active Turn Status */}
      {isGameOver ? (
        <div className="p-3.5 bg-indigo-950/50 border border-indigo-500/50 rounded-xl flex flex-col gap-2.5 text-center animate-in fade-in shadow-xl">
          <span className="text-sm font-bold text-indigo-300">
            {gameResultText || 'Game Finished'}
          </span>
          <button
            onClick={onAnalyzeGame}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-950/40 transition-all cursor-pointer"
          >
            <BarChart2 className="w-4 h-4" />
            Analyze Game & Coach Walkthrough
          </button>
        </div>
      ) : null}

      {/* Player Card (Bento Tile) */}
      <div
        className={`p-3.5 rounded-xl border transition-all ${
          turn === playerColor && !isGameOver
            ? 'bg-slate-800/90 border-indigo-500/80 ring-1 ring-indigo-500/40 shadow-lg'
            : 'bg-slate-800/40 border-slate-700/60'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 rounded-xl border border-slate-700/80 text-indigo-400 shadow-inner">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white">You</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                  ({playerColor === 'w' ? 'White' : 'Black'})
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {turn === playerColor && !isGameOver ? (
                  <span className="text-indigo-400 font-bold">Your turn</span>
                ) : (
                  'Waiting'
                )}
              </span>
            </div>
          </div>

          {/* Player Timer / Material */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 font-mono font-bold text-sm text-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {formatTime(isPlayerWhite ? whiteTimeSeconds : blackTimeSeconds)}
            </div>
            {((isPlayerWhite && whiteAdvantage > 0) || (!isPlayerWhite && whiteAdvantage < 0)) && (
              <span className="text-[10px] font-bold text-indigo-400 font-mono">
                +{Math.abs(whiteAdvantage)}
              </span>
            )}
          </div>
        </div>

        {/* Captured Pieces by Player */}
        <div className="flex items-center gap-0.5 mt-2 h-5 overflow-x-auto">
          {(isPlayerWhite ? whiteCaptured : blackCaptured).map((p, idx) => (
            <div key={`player-cap-${idx}`} className="w-4 h-4 shrink-0">
              <ChessPieceIcon type={p} color={isPlayerWhite ? 'b' : 'w'} />
            </div>
          ))}
        </div>
      </div>

      {/* Game Control Action Toolbar */}
      <div className="grid grid-cols-5 gap-1.5 pt-1.5 border-t border-slate-800">
        <button
          onClick={onUndoMove}
          disabled={historyMoves.length === 0 || isGameOver}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 disabled:opacity-30 text-slate-300 text-xs font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer"
          title="Takeback / Undo"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span className="text-[10px]">Undo</span>
        </button>

        <button
          onClick={onFlipBoard}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 text-xs font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer"
          title="Flip Board"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span className="text-[10px]">Flip</span>
        </button>

        <button
          onClick={onOfferDraw}
          disabled={isGameOver}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 disabled:opacity-30 text-slate-300 text-xs font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer"
          title="Offer Draw"
        >
          <Handshake className="w-3.5 h-3.5" />
          <span className="text-[10px]">Draw</span>
        </button>

        <button
          onClick={onResign}
          disabled={isGameOver}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 disabled:opacity-30 text-rose-400 text-xs font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer"
          title="Resign"
        >
          <Flag className="w-3.5 h-3.5" />
          <span className="text-[10px]">Resign</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 text-xs font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer"
          title="Settings (NVIDIA NIM / Offline / Style)"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          <span className="text-[10px]">Config</span>
        </button>
      </div>
    </div>
  );
};
