import React, { useState } from 'react';
import { Chess } from 'chess.js';
import { GameAnalysisResult, AnalyzedMove, AISettings, MoveClassification } from '../types';
import { ChessBoard } from './ChessBoard';
import { EvalBar } from './EvalBar';
import { EvalGraph } from './EvalGraph';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Bot, 
  ArrowRight, 
  Compass, 
  Award, 
  BarChart3, 
  RotateCcw,
  Target
} from 'lucide-react';

interface AnalysisBoardProps {
  analysis: GameAnalysisResult;
  playerColor: 'w' | 'b';
  botName: string;
  botRating: number;
  settings: AISettings;
  boardTheme: 'emerald' | 'wood' | 'modern' | 'slate';
  onStartWalkthrough: (plyIndex?: number) => void;
  onNewGame: () => void;
}

export const AnalysisBoard: React.FC<AnalysisBoardProps> = ({
  analysis,
  playerColor,
  botName,
  botRating,
  settings,
  boardTheme,
  onStartWalkthrough,
  onNewGame,
}) => {
  const [selectedPly, setSelectedPly] = useState<number>(0);
  const currentMove = analysis.moves[selectedPly] || analysis.moves[0];

  const currentBoard = currentMove ? new Chess(currentMove.fenAfter) : new Chess();

  const isPlayerWhite = playerColor === 'w';
  const playerAccuracy = isPlayerWhite ? analysis.whiteAccuracy : analysis.blackAccuracy;
  const botAccuracy = isPlayerWhite ? analysis.blackAccuracy : analysis.whiteAccuracy;

  const playerStats = isPlayerWhite ? analysis.whiteStats : analysis.blackStats;
  const botStats = isPlayerWhite ? analysis.blackStats : analysis.whiteStats;

  const getMoveColor = (cls: MoveClassification) => {
    switch (cls) {
      case 'brilliant': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'best': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'good': return 'text-teal-400 bg-teal-500/10 border-teal-500/30';
      case 'inaccuracy': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'mistake': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'blunder': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      default: return 'text-neutral-400 bg-neutral-800 border-neutral-700';
    }
  };

  const getMoveSymbol = (cls: MoveClassification) => {
    switch (cls) {
      case 'brilliant': return '!!';
      case 'best': return '★';
      case 'good': return '✔';
      case 'inaccuracy': return '?!';
      case 'mistake': return '?';
      case 'blunder': return '??';
      default: return '';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 p-3 sm:p-6 text-white select-none">
      {/* Top Banner: Accuracy & Quick Launch Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-2xl items-center backdrop-blur">
        {/* Player Accuracy Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/70">
          <div className="w-14 h-14 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Target className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-widest font-mono">
              You ({playerColor === 'w' ? 'White' : 'Black'})
            </span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {playerAccuracy}% <span className="text-xs text-slate-400 font-sans font-normal">Accuracy</span>
            </div>
          </div>
        </div>

        {/* Bot Accuracy Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/70">
          <div className="w-14 h-14 rounded-xl bg-slate-700/40 border border-slate-600/40 flex items-center justify-center text-slate-300 shrink-0">
            <Bot className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-widest font-mono">
              {botName} ({botRating})
            </span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {botAccuracy}% <span className="text-xs text-slate-400 font-sans font-normal">Accuracy</span>
            </div>
          </div>
        </div>

        {/* Walkthrough CTA Button */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onStartWalkthrough(0)}
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2 text-sm transition-all transform active:scale-98 cursor-pointer"
          >
            <Compass className="w-4 h-4" />
            Start Interactive Walkthrough
          </button>
          <button
            onClick={onNewGame}
            className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New Match
          </button>
        </div>
      </div>

      {/* Main Analysis Layout: Board & Eval Graph + Stats & Move List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Board & Interactive Advantage Graph (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <EvalBar evalCp={currentMove.evalAfter} isFlipped={playerColor === 'b'} />
            <div className="flex-1 border-4 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl bg-slate-900">
              <ChessBoard
                chess={currentBoard}
                boardOrientation={playerColor}
                lastMove={{ from: currentMove.from, to: currentMove.to }}
                interactive={false}
                theme={boardTheme}
              />
            </div>
          </div>

          {/* Interactive Advantage Graph */}
          <EvalGraph
            moves={analysis.moves}
            currentPlyIndex={selectedPly}
            onSelectMove={(idx) => setSelectedPly(idx)}
          />
        </div>

        {/* Right: Move Classification Stats & Key Moments (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Move Classification Breakdown Table (Bento Card) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3 backdrop-blur">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Move Quality Breakdown
            </h3>

            <div className="space-y-1.5 text-xs">
              {[
                { label: 'Brilliant', symbol: '!!', color: 'text-cyan-400', pCount: playerStats.brilliant, bCount: botStats.brilliant },
                { label: 'Best Moves', symbol: '★', color: 'text-emerald-400', pCount: playerStats.best, bCount: botStats.best },
                { label: 'Good Moves', symbol: '✔', color: 'text-teal-400', pCount: playerStats.good, bCount: botStats.good },
                { label: 'Inaccuracies', symbol: '?!', color: 'text-yellow-400', pCount: playerStats.inaccuracy, bCount: botStats.inaccuracy },
                { label: 'Mistakes', symbol: '?', color: 'text-orange-400', pCount: playerStats.mistake, bCount: botStats.mistake },
                { label: 'Blunders', symbol: '??', color: 'text-rose-400', pCount: playerStats.blunder, bCount: botStats.blunder },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-700/40"
                >
                  <span className={`font-semibold flex items-center gap-1.5 ${row.color}`}>
                    <span className="w-5 font-mono">{row.symbol}</span>
                    {row.label}
                  </span>
                  <div className="flex items-center gap-4 font-mono font-bold">
                    <span className="text-white">{row.pCount}</span>
                    <span className="text-slate-500">/</span>
                    <span className="text-slate-400">{row.bCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Moments Carousel / Quick Jump (Bento Card) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3 flex-1 backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Key Turning Points ({analysis.keyMoments.length})
              </h3>
              <span className="text-[11px] text-slate-400">Click to inspect</span>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {analysis.keyMoments.map((plyIdx) => {
                const m = analysis.moves[plyIdx];
                const isSelected = selectedPly === plyIdx;
                return (
                  <div
                    key={`key-${plyIdx}`}
                    onClick={() => {
                      setSelectedPly(plyIdx);
                      onStartWalkthrough(plyIdx);
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500 shadow-md'
                        : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {m.moveNumber}{m.color === 'w' ? '.' : '...'}
                      </span>
                      <span className="font-mono font-bold text-white text-xs">{m.san}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${getMoveColor(
                          m.classification
                        )}`}
                      >
                        {m.classification}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-indigo-400 font-semibold shrink-0">
                      Walkthrough <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
