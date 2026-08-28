import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { AnalyzedMove, AISettings, MoveClassification } from '../types';
import { ChessBoard, ArrowData } from './ChessBoard';
import { EvalBar } from './EvalBar';
import { soundManager } from '../utils/sound';
import confetti from 'canvas-confetti';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  RotateCcw, 
  Sparkles, 
  AlertTriangle, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  Bot, 
  Lightbulb, 
  Eye, 
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Cpu
} from 'lucide-react';

interface WalkthroughModeProps {
  moves: AnalyzedMove[];
  initialPlyIndex?: number;
  settings: AISettings;
  boardTheme: 'emerald' | 'wood' | 'modern' | 'slate';
  playerColor: 'w' | 'b';
  onExitWalkthrough: () => void;
}

export const WalkthroughMode: React.FC<WalkthroughModeProps> = ({
  moves,
  initialPlyIndex = 0,
  settings,
  boardTheme,
  playerColor,
  onExitWalkthrough,
}) => {
  const [currentPly, setCurrentPly] = useState<number>(initialPlyIndex);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showConsequence, setShowConsequence] = useState<boolean>(false);
  const [interactiveBoard, setInteractiveBoard] = useState<Chess>(new Chess());
  const [puzzleState, setPuzzleState] = useState<{
    solved: boolean;
    attempted: boolean;
    feedbackMessage: string;
    showHint: boolean;
    showAnswer: boolean;
  }>({
    solved: false,
    attempted: false,
    feedbackMessage: '',
    showHint: false,
    showAnswer: false,
  });

  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [deepAiExplanation, setDeepAiExplanation] = useState<string | null>(null);

  const currentMove: AnalyzedMove | undefined = moves[currentPly];
  const isPlayerMove = currentMove ? currentMove.color === playerColor : false;
  const isMistakeOrBlunder = currentMove && ['blunder', 'mistake', 'inaccuracy'].includes(currentMove.classification);

  // Synchronize board position to current ply
  useEffect(() => {
    if (!currentMove) return;
    const c = new Chess(currentMove.fenBefore);
    setInteractiveBoard(c);
    setShowConsequence(false);
    setDeepAiExplanation(null);
    setPuzzleState({
      solved: false,
      attempted: false,
      feedbackMessage: '',
      showHint: false,
      showAnswer: false,
    });
  }, [currentPly, currentMove?.fenBefore]);

  // Auto-play timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentPly((prev) => {
          if (prev >= moves.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, moves.length]);

  if (!currentMove) {
    return null;
  }

  // Handle board move in "Try the Better Move" puzzle mode
  const handlePuzzleMove = (from: string, to: string, promotion?: string): boolean => {
    const c = new Chess(interactiveBoard.fen());
    try {
      const move = c.move({ from, to, promotion: promotion || 'q' });
      if (!move) return false;

      // Check if user played the best move
      const isBest = move.san === currentMove.bestMoveSan || (from === currentMove.bestMoveFrom && to === currentMove.bestMoveTo);

      if (isBest) {
        setInteractiveBoard(c);
        setPuzzleState({
          solved: true,
          attempted: true,
          feedbackMessage: `✓ Correct! ${currentMove.bestMoveSan} is the best move.`,
          showHint: false,
          showAnswer: true,
        });
        soundManager.playCorrect();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
        return true;
      } else {
        // Incorrect move
        setInteractiveBoard(c);
        setPuzzleState((prev) => ({
          ...prev,
          solved: false,
          attempted: true,
          feedbackMessage: currentMove.explanation?.hint 
            ? `Not quite: ${currentMove.explanation.hint}` 
            : `Not quite. Try looking for a more active move with ${currentMove.bestMoveSan[0] || 'a piece'}.`,
        }));
        soundManager.playError();
        return true;
      }
    } catch {
      return false;
    }
  };

  // Reset puzzle board back to starting position
  const handleResetPuzzle = () => {
    setInteractiveBoard(new Chess(currentMove.fenBefore));
    setPuzzleState({
      solved: false,
      attempted: false,
      feedbackMessage: '',
      showHint: false,
      showAnswer: false,
    });
  };

  // Reveal answer on board
  const handleRevealAnswer = () => {
    const c = new Chess(currentMove.fenBefore);
    try {
      c.move(currentMove.bestMoveSan);
      setInteractiveBoard(c);
    } catch {
      // fallback
    }
    setPuzzleState((prev) => ({
      ...prev,
      showAnswer: true,
      solved: true,
      feedbackMessage: `Best move was ${currentMove.bestMoveSan}!`,
    }));
  };

  // Jump to next/prev key moment
  const jumpToKeyMoment = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      const nextIdx = moves.findIndex((m, idx) => idx > currentPly && m.isKeyMoment);
      if (nextIdx !== -1) setCurrentPly(nextIdx);
    } else {
      const prevList = moves.map((m, idx) => ({ isKey: m.isKeyMoment, idx })).filter(item => item.idx < currentPly && item.isKey);
      if (prevList.length > 0) {
        setCurrentPly(prevList[prevList.length - 1].idx);
      }
    }
  };

  // Request deep AI coaching explanation
  const handleAskAiCoach = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/analyze-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.provider,
          nvidiaApiKey: settings.nvidiaApiKey,
          nvidiaModel: settings.nvidiaModel,
          coachPersona: settings.coachPersona,
          fenBefore: currentMove.fenBefore,
          color: currentMove.color,
          sanPlayed: currentMove.san,
          bestSan: currentMove.bestMoveSan,
          classification: currentMove.classification,
          evalLossCp: currentMove.evalLoss,
          evalBefore: currentMove.evalBefore,
          evalAfter: currentMove.evalAfter,
          consequenceLine: currentMove.explanation?.consequenceLine,
        }),
      });

      const data = await res.json();
      if (data.whyBetter) {
        setDeepAiExplanation(
          `${data.whatPlayed} ${data.whyBetter} (Principle: ${data.principle || 'Sound Play'})`
        );
      }
    } catch {
      setDeepAiExplanation(currentMove.explanation?.whyBetter || 'AI Coach analysis unavailable.');
    } finally {
      setAiLoading(false);
    }
  };

  // Generate arrows
  const arrows: ArrowData[] = [];
  if (puzzleState.showAnswer || !isMistakeOrBlunder) {
    arrows.push({
      from: currentMove.bestMoveFrom,
      to: currentMove.bestMoveTo,
      color: 'green',
    });
  }
  if (isMistakeOrBlunder && !puzzleState.solved) {
    arrows.push({
      from: currentMove.from,
      to: currentMove.to,
      color: currentMove.classification === 'blunder' ? 'red' : 'yellow',
    });
  }

  const getClassificationBadge = (cls: MoveClassification) => {
    switch (cls) {
      case 'brilliant':
        return <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 font-mono"><Sparkles className="w-3.5 h-3.5" /> Brilliant (!!)</span>;
      case 'best':
        return <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 font-mono"><CheckCircle2 className="w-3.5 h-3.5" /> Best Move (★)</span>;
      case 'good':
        return <span className="px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold flex items-center gap-1.5 font-mono"><CheckCircle2 className="w-3.5 h-3.5" /> Good Move (✔)</span>;
      case 'inaccuracy':
        return <span className="px-2.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-xs font-bold flex items-center gap-1.5 font-mono"><AlertTriangle className="w-3.5 h-3.5" /> Inaccuracy (?!)</span>;
      case 'mistake':
        return <span className="px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-bold flex items-center gap-1.5 font-mono"><AlertTriangle className="w-3.5 h-3.5" /> Mistake (?)</span>;
      case 'blunder':
        return <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 font-mono"><XCircle className="w-3.5 h-3.5" /> Blunder (??)</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold font-mono">Book Move</span>;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-start justify-center gap-6 p-3 sm:p-6 text-white select-none">
      {/* Left Column: Board & Eval Bar */}
      <div className="flex flex-col items-center gap-4 w-full lg:w-auto shrink-0">
        <div className="flex items-center gap-3">
          <EvalBar evalCp={currentMove.evalAfter} isFlipped={playerColor === 'b'} />
          <div className="border-4 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl bg-slate-900">
            <ChessBoard
              chess={interactiveBoard}
              boardOrientation={playerColor}
              lastMove={{ from: currentMove.from, to: currentMove.to }}
              onMove={handlePuzzleMove}
              interactive={isPlayerMove && isMistakeOrBlunder && !puzzleState.solved}
              arrows={arrows}
              hintSquare={puzzleState.showHint ? currentMove.bestMoveFrom : null}
              theme={boardTheme}
            />
          </div>
        </div>

        {/* Step Navigation Controls (Bento Control Bar) */}
        <div className="flex items-center justify-between w-full max-w-[560px] bg-slate-900/80 border border-slate-800 p-3 rounded-2xl shadow-xl backdrop-blur">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPly(0)}
              disabled={currentPly === 0}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 disabled:opacity-30 text-slate-300 transition-colors"
              title="First Move"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => jumpToKeyMoment('prev')}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-semibold text-slate-300 flex items-center gap-1 transition-colors"
              title="Previous Mistake"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Key
            </button>
            <button
              onClick={() => setCurrentPly(p => Math.max(0, p - 1))}
              disabled={currentPly === 0}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 disabled:opacity-30 text-slate-300 transition-colors"
              title="Previous Move"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Ply counter */}
          <div className="text-xs font-mono font-bold text-slate-300">
            {currentMove.moveNumber}{currentMove.color === 'w' ? '.' : '...'} {currentMove.san}
            <span className="text-slate-500 ml-1.5">({currentPly + 1}/{moves.length})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/40 transition-colors"
              title={isPlaying ? 'Pause' : 'Auto Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setCurrentPly(p => Math.min(moves.length - 1, p + 1))}
              disabled={currentPly === moves.length - 1}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 disabled:opacity-30 text-slate-300 transition-colors"
              title="Next Move"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => jumpToKeyMoment('next')}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-semibold text-slate-300 flex items-center gap-1 transition-colors"
              title="Next Mistake"
            >
              Key <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Coach Commentary & Interactive Puzzle Bento Card */}
      <div className="flex-1 w-full flex flex-col gap-4">
        {/* Main Coach Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 backdrop-blur">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  Move {currentMove.moveNumber} — {isPlayerMove ? 'Your Move' : "Opponent's Move"}
                </h3>
                <span className="text-xs text-slate-400">
                  {currentMove.color === 'w' ? 'White to move' : 'Black to move'}
                </span>
              </div>
            </div>

            {getClassificationBadge(currentMove.classification)}
          </div>

          {/* Move Comparison Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                Played
              </span>
              <div className="text-lg font-bold font-mono text-white flex items-center gap-2 mt-0.5">
                {currentMove.moveNumber}{currentMove.color === 'w' ? '.' : '...'} {currentMove.san}
                {isMistakeOrBlunder && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 font-sans font-medium flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" />
                    -{(currentMove.evalLoss / 100).toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block font-mono">
                Recommended Move
              </span>
              <div className="text-lg font-bold font-mono text-emerald-400 flex items-center gap-2 mt-0.5">
                {currentMove.moveNumber}{currentMove.color === 'w' ? '.' : '...'} {currentMove.bestMoveSan}!
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-sans font-medium flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +{(currentMove.bestMoveEval / 100).toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive "Try the Better Move" Puzzle Section */}
          {isPlayerMove && isMistakeOrBlunder && (
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/40 flex flex-col gap-3 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Can you find the better move?
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Move piece on board
                </span>
              </div>

              {puzzleState.feedbackMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                    puzzleState.solved
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {puzzleState.solved ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  )}
                  <div className="leading-relaxed">{puzzleState.feedbackMessage}</div>
                </div>
              )}

              {/* Puzzle Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() =>
                    setPuzzleState(s => ({
                      ...s,
                      showHint: true,
                      feedbackMessage: currentMove.explanation?.hint || 'Look for central control or piece safety.',
                    }))
                  }
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  Give Hint
                </button>
                <button
                  onClick={handleRevealAnswer}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  Show Answer
                </button>
                <button
                  onClick={handleResetPuzzle}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors ml-auto cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Board
                </button>
              </div>
            </div>
          )}

          {/* Coach Reasoning & Principle Explanation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-indigo-400" />
                Coach Analysis & Reasoning
              </span>
              {currentMove.explanation?.category && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 font-mono">
                  {currentMove.explanation.category} • {currentMove.explanation.principle}
                </span>
              )}
            </div>

            <div className="text-sm text-slate-300 leading-relaxed space-y-2 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
              <p>
                <strong className="text-white">What happened:</strong>{' '}
                {currentMove.explanation?.whatPlayed}
              </p>
              <p>
                <strong className="text-emerald-400">Why {currentMove.bestMoveSan} was better:</strong>{' '}
                {currentMove.explanation?.whyBetter}
              </p>
              {deepAiExplanation && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-indigo-300 text-xs italic">
                  💡 Deep Coach Insight: {deepAiExplanation}
                </div>
              )}
            </div>

            {/* Ask AI Coach button */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleAskAiCoach}
                disabled={aiLoading}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl text-xs font-semibold text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                {aiLoading ? (
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Cpu className="w-3.5 h-3.5" />
                )}
                Ask AI Coach for Deep Breakdown ({settings.provider.toUpperCase()})
              </button>

              <button
                onClick={() => setShowConsequence(!showConsequence)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                {showConsequence ? 'Hide Continuation' : 'Show Engine Consequence'}
              </button>
            </div>

            {/* Consequence Line Box */}
            {showConsequence && (
              <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200 flex flex-col gap-1.5 animate-in fade-in duration-150">
                <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5" />
                  Engine Continuation Line
                </span>
                <div className="font-mono font-semibold text-white">
                  {currentMove.explanation?.consequenceLine && currentMove.explanation.consequenceLine.length > 0
                    ? currentMove.explanation.consequenceLine.join(' ')
                    : `${currentMove.bestMoveSan} leads to standard consolidation.`}
                </div>
                <p className="text-slate-300 mt-1">
                  {currentMove.explanation?.consequenceSummary}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Exit Walkthrough Button */}
        <div className="flex justify-end">
          <button
            onClick={onExitWalkthrough}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            Back to Game Summary
          </button>
        </div>
      </div>
    </div>
  );
};
