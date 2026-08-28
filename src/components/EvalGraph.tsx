import React, { useState } from 'react';
import { AnalyzedMove, MoveClassification } from '../types';

interface EvalGraphProps {
  moves: AnalyzedMove[];
  currentPlyIndex: number;
  onSelectMove: (plyIndex: number) => void;
}

export const EvalGraph: React.FC<EvalGraphProps> = ({
  moves,
  currentPlyIndex,
  onSelectMove,
}) => {
  const [hoveredPly, setHoveredPly] = useState<number | null>(null);

  if (moves.length === 0) {
    return (
      <div className="h-28 w-full flex items-center justify-center text-xs text-slate-500 bg-slate-900/60 rounded-xl border border-slate-800">
        No evaluation data yet.
      </div>
    );
  }

  // Graph dimensions
  const width = 640;
  const height = 120;
  const paddingX = 24;
  const paddingY = 16;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;
  const centerY = height / 2;

  // Max centipawn cap for graph scaling (e.g. +/- 600 cp = +/- 6.0 pawns)
  const maxEvalCp = 600;

  // Convert centipawns to graph Y coordinate
  const evalToY = (evalCp: number) => {
    const clamped = Math.max(-maxEvalCp, Math.min(maxEvalCp, evalCp));
    // White advantage (+eval) goes UP (smaller Y), Black advantage goes DOWN (larger Y)
    const normalized = -clamped / maxEvalCp; // -1 to 1
    return centerY + normalized * (graphHeight / 2);
  };

  // Convert ply index to X coordinate
  const plyToX = (index: number) => {
    if (moves.length <= 1) return paddingX + graphWidth / 2;
    return paddingX + (index / (moves.length - 1)) * graphWidth;
  };

  // Generate SVG path for the evaluation line
  const points = moves.map((m, idx) => ({
    x: plyToX(idx),
    y: evalToY(m.evalAfter),
    move: m,
    index: idx,
  }));

  const linePath = points.reduce((acc, p, idx) => {
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, '');

  // Fill area under white advantage / above black advantage
  const areaPath = `${linePath} L ${plyToX(moves.length - 1)},${centerY} L ${plyToX(0)},${centerY} Z`;

  const getMarkerColor = (classification: MoveClassification) => {
    switch (classification) {
      case 'brilliant': return '#06b6d4'; // Cyan
      case 'blunder': return '#ef4444';   // Red
      case 'mistake': return '#f97316';   // Orange
      case 'inaccuracy': return '#eab308'; // Yellow
      case 'best': return '#22c55e';      // Green
      default: return '#64748b';
    }
  };

  const getMarkerSymbol = (classification: MoveClassification) => {
    switch (classification) {
      case 'brilliant': return '!!';
      case 'blunder': return '??';
      case 'mistake': return '?';
      case 'inaccuracy': return '?!';
      default: return '';
    }
  };

  const activeMove = hoveredPly !== null ? moves[hoveredPly] : moves[currentPlyIndex];
  const activeX = hoveredPly !== null ? plyToX(hoveredPly) : plyToX(currentPlyIndex);

  return (
    <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-2 select-none backdrop-blur">
      {/* Top Bar / Advantage labels & Active Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 font-semibold">White (+Adv)</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 font-mono">0.0</span>
          <span className="text-slate-600">/</span>
          <span className="text-rose-400 font-semibold">Black (-Adv)</span>
        </div>

        {activeMove && (
          <div className="flex items-center gap-2 font-mono">
            <span className="text-slate-300">
              Move {activeMove.moveNumber}{activeMove.color === 'w' ? '.' : '...'}
              <strong className="text-white ml-1">{activeMove.san}</strong>
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${getMarkerColor(activeMove.classification)}25`,
                color: getMarkerColor(activeMove.classification),
              }}
            >
              {activeMove.classification}
            </span>
            <span className="text-slate-400 font-mono">
              Eval: {(activeMove.evalAfter / 100).toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-[110px] overflow-hidden rounded-xl bg-slate-950/60 border border-slate-800/80">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full cursor-crosshair"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Gradient fill */}
            <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#ef4444" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={evalToY(300)}
            x2={width - paddingX}
            y2={evalToY(300)}
            stroke="#1e293b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={centerY}
            x2={width - paddingX}
            y2={centerY}
            stroke="#334155"
            strokeWidth="1.2"
          />
          <line
            x1={paddingX}
            y1={evalToY(-300)}
            x2={width - paddingX}
            y2={evalToY(-300)}
            stroke="#1e293b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* Area Fill */}
          <path d={areaPath} fill="url(#evalGrad)" />

          {/* Main Eval Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#818cf8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active / Selected vertical scrubber line */}
          <line
            x1={activeX}
            y1={paddingY}
            x2={activeX}
            y2={height - paddingY}
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />

          {/* Key Mistake & Classification Markers */}
          {points.map((p) => {
            const isKey = ['blunder', 'mistake', 'inaccuracy', 'brilliant'].includes(
              p.move.classification
            );
            const isSelected = p.index === currentPlyIndex;

            if (!isKey && !isSelected) return null;

            const color = getMarkerColor(p.move.classification);
            const symbol = getMarkerSymbol(p.move.classification);
            const radius = isKey ? (p.move.classification === 'blunder' ? 7 : 5.5) : 4;

            return (
              <g
                key={`marker-${p.index}`}
                onClick={() => onSelectMove(p.index)}
                onMouseEnter={() => setHoveredPly(p.index)}
                onMouseLeave={() => setHoveredPly(null)}
                className="cursor-pointer transition-transform hover:scale-125"
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={radius}
                  fill={color}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
                {isKey && (
                  <text
                    x={p.x}
                    y={p.y + (symbol === '!!' ? 2.5 : 3)}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="7.5"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    {symbol}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Transparent click targets across width */}
        <div
          className="absolute inset-0 flex"
          onMouseLeave={() => setHoveredPly(null)}
        >
          {moves.map((_, idx) => (
            <div
              key={`click-zone-${idx}`}
              className="flex-1 h-full cursor-pointer hover:bg-white/5"
              onClick={() => onSelectMove(idx)}
              onMouseEnter={() => setHoveredPly(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
