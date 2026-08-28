import React from 'react';

interface EvalBarProps {
  evalCp: number; // in centipawns (from White perspective)
  isFlipped?: boolean;
}

export const EvalBar: React.FC<EvalBarProps> = ({ evalCp, isFlipped = false }) => {
  // Convert centipawns to winning percentage sigmoid (0 to 100)
  // Win probability formula: P = 1 / (1 + 10^(-eval / 400))
  // For standard bar display: clamp centipawns between -1000 and +1000
  const clampedCp = Math.max(-1200, Math.min(1200, evalCp));
  
  // Calculate white percentage (50% is 0.0 eval)
  let whitePercent = 50;
  if (clampedCp >= 20000) {
    whitePercent = 100; // White forced mate
  } else if (clampedCp <= -20000) {
    whitePercent = 0; // Black forced mate
  } else {
    // Sigmoid mapping for smooth visualization
    const winningProb = 1 / (1 + Math.pow(10, -clampedCp / 400));
    whitePercent = Math.min(96, Math.max(4, winningProb * 100));
  }

  // Format evaluation text (+1.4, -0.8, M3, -M2)
  const isMate = Math.abs(evalCp) > 15000;
  let evalText = '0.0';
  if (isMate) {
    evalText = evalCp > 0 ? 'M+' : 'M-';
  } else {
    const pawns = evalCp / 100;
    evalText = (pawns > 0 ? '+' : '') + pawns.toFixed(1);
  }

  const isWhiteAdvantage = evalCp >= 0;

  return (
    <div
      className="relative w-7 h-full min-h-[320px] max-h-[560px] bg-slate-950 rounded-xl overflow-hidden flex flex-col border border-slate-700/80 shadow-lg select-none text-[10px] font-mono font-bold"
      title={`Engine Evaluation: ${evalText}`}
    >
      {/* Black side (top if not flipped) */}
      <div
        className="w-full bg-slate-900 transition-all duration-300 relative flex items-start justify-center pt-1.5 text-slate-400"
        style={{ height: `${100 - whitePercent}%` }}
      >
        {!isWhiteAdvantage && (
          <span className="z-10 text-[10px] drop-shadow font-mono">{evalText}</span>
        )}
      </div>

      {/* White side (bottom if not flipped) */}
      <div
        className="w-full bg-slate-100 transition-all duration-300 relative flex items-end justify-center pb-1.5 text-slate-900"
        style={{ height: `${whitePercent}%` }}
      >
        {isWhiteAdvantage && (
          <span className="z-10 text-[10px] drop-shadow font-mono">{evalText}</span>
        )}
      </div>

      {/* Center 0.0 line indicator */}
      <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-indigo-500/60 pointer-events-none" />
    </div>
  );
};
