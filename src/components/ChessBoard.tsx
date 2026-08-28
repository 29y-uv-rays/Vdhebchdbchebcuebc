import React, { useState, useRef, useEffect } from 'react';
import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import { PieceColor, AnalyzedMove } from '../types';
import { soundManager } from '../utils/sound';

export interface ArrowData {
  from: string;
  to: string;
  color: 'green' | 'red' | 'blue' | 'yellow' | 'purple';
}

interface ChessBoardProps {
  chess: Chess;
  boardOrientation?: 'w' | 'b';
  lastMove?: { from: string; to: string } | null;
  onMove?: (from: string, to: string, promotion?: string) => boolean;
  interactive?: boolean;
  arrows?: ArrowData[];
  highlightSquares?: { square: string; color: string }[];
  hintSquare?: string | null;
  theme?: 'modern' | 'emerald' | 'wood' | 'slate';
}

// Vector Chess Piece SVGs
export const ChessPieceIcon: React.FC<{ type: PieceSymbol; color: Color; className?: string }> = ({
  type,
  color,
  className = 'w-full h-full drop-shadow-sm',
}) => {
  const isWhite = color === 'w';
  const fill = isWhite ? '#FFFFFF' : '#262421';
  const stroke = isWhite ? '#312E2B' : '#FFFFFF';
  const strokeWidth = 1.5;

  switch (type) {
    case 'p':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <path
            d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 C 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </svg>
      );
    case 'n':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <path
            d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 15,7.5 C 14.5,6 16.5,5 18,5 C 19.5,5 21,6.5 21.5,7.5 C 23.5,8 24.5,9 25,10 z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <circle cx="15.5" cy="11.5" r="1.5" fill={isWhite ? '#312E2B' : '#FFFFFF'} />
        </svg>
      );
    case 'b':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round">
            <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z" />
            <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z" />
            <circle cx="22.5" cy="8" r="2" />
            <path d="M 17.5,26 L 27.5,26" />
            <path d="M 15,30 L 30,30" />
            <path d="M 22.5,15.5 L 22.5,20.5" />
            <path d="M 20,18 L 25,18" />
          </g>
        </svg>
      );
    case 'r':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round">
            <path d="M 9,39 L 36,39 L 36,36 L 9,36 z" />
            <path d="M 12,36 L 12,32 L 33,32 L 33,36 z" />
            <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 z" />
            <path d="M 34,14 L 31,17 L 14,17 L 11,14 z" />
            <path d="M 14,17 L 14,29.5 L 31,29.5 L 31,17 z" />
            <path d="M 14,29.5 L 12,32 L 33,32 L 31,29.5 z" />
          </g>
        </svg>
      );
    case 'q':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round">
            <path d="M 8.5,38.5 C 8.5,38.5 22.5,37.5 36.5,38.5 C 36.5,38.5 38.5,35 38.5,35 C 38.5,35 6.5,35 6.5,35 C 6.5,35 8.5,38.5 8.5,38.5 z" />
            <path d="M 9,32 C 9,32 36,32 36,32 C 36,32 37.5,28 37.5,28 C 37.5,28 7.5,28 7.5,28 C 7.5,28 9,32 9,32 z" />
            <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.5 L 22.5,24.5 L 14.3,10.5 L 14,25 L 6.5,13.5 z" />
            <circle cx="6" cy="12" r="2" />
            <circle cx="14" cy="9" r="2" />
            <circle cx="22.5" cy="8" r="2" />
            <circle cx="31" cy="9" r="2" />
            <circle cx="39" cy="12" r="2" />
          </g>
        </svg>
      );
    case 'k':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round">
            <path d="M 22.5,11.63 L 22.5,6" />
            <path d="M 20,8 L 25,8" />
            <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 21,11.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" />
            <path d="M 11.5,37 C 17,40.5 28,40.5 33.5,37 C 36.5,35 34.5,30 31,30 C 26.5,30 25.5,34 22.5,34 C 19.5,34 18.5,30 14,30 C 10.5,30 8.5,35 11.5,37 z" />
            <path d="M 11.5,30 C 17,27 28,27 33.5,30 C 36.5,32 35.5,22 30,20 C 27,19 24.5,20 22.5,22.5 C 20.5,20 18,19 15,20 C 9.5,22 8.5,32 11.5,30 z" />
          </g>
        </svg>
      );
  }
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  chess,
  boardOrientation = 'w',
  lastMove,
  onMove,
  interactive = true,
  arrows = [],
  highlightSquares = [],
  hintSquare,
  theme = 'emerald',
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const isFlipped = boardOrientation === 'b';
  const board = chess.board();
  const inCheck = chess.inCheck();
  const turn = chess.turn();

  // Find king square for check highlight
  let kingInCheckSquare: string | null = null;
  if (inCheck) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turn) {
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
          kingInCheckSquare = `${files[c]}${ranks[r]}`;
        }
      }
    }
  }

  // Color schemes
  const themeColors = {
    emerald: {
      light: 'bg-[#EBECD0]',
      dark: 'bg-[#739552]',
      selected: 'bg-[#BACA44]/80',
      lastMove: 'bg-[#F5F682]/60',
      hint: 'ring-4 ring-[#38bdf8] ring-inset animate-pulse',
    },
    wood: {
      light: 'bg-[#F0D9B5]',
      dark: 'bg-[#B58863]',
      selected: 'bg-[#CED26B]/80',
      lastMove: 'bg-[#CDD26A]/60',
      hint: 'ring-4 ring-amber-400 ring-inset animate-pulse',
    },
    modern: {
      light: 'bg-[#ECEFF1]',
      dark: 'bg-[#78909C]',
      selected: 'bg-[#80CBC4]/80',
      lastMove: 'bg-[#FFE082]/60',
      hint: 'ring-4 ring-cyan-400 ring-inset animate-pulse',
    },
    slate: {
      light: 'bg-[#E2E8F0]',
      dark: 'bg-[#475569]',
      selected: 'bg-[#94A3B8]/80',
      lastMove: 'bg-[#FBBF24]/50',
      hint: 'ring-4 ring-indigo-400 ring-inset animate-pulse',
    }
  }[theme];

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const displayedRanks = isFlipped ? [...ranks].reverse() : ranks;
  const displayedFiles = isFlipped ? [...files].reverse() : files;

  const handleSquareClick = (square: string) => {
    if (!interactive) return;

    // If a square is already selected
    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }

      // Check if move is legal
      if (validMoves.includes(square)) {
        // Check for promotion
        const piece = chess.get(selectedSquare as Square);
        const isPawnPromotion =
          piece &&
          piece.type === 'p' &&
          ((piece.color === 'w' && square.endsWith('8')) ||
            (piece.color === 'b' && square.endsWith('1')));

        if (isPawnPromotion) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }

        const success = onMove ? onMove(selectedSquare, square) : false;
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }
    }

    // Select piece
    const piece = chess.get(square as Square);
    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      const moves = chess.moves({ square: square as Square, verbose: true });
      setValidMoves(moves.map(m => m.to));
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const handlePromotionChoice = (promPiece: PieceSymbol) => {
    if (!pendingPromotion || !onMove) return;
    onMove(pendingPromotion.from, pendingPromotion.to, promPiece);
    setPendingPromotion(null);
    setSelectedSquare(null);
    setValidMoves([]);
  };

  // Convert chess square ('e4') to 0-100% SVG coordinates
  const squareToSvgCoord = (sq: string) => {
    const file = sq[0];
    const rank = sq[1];
    const fileIdx = displayedFiles.indexOf(file);
    const rankIdx = displayedRanks.indexOf(rank);
    return {
      x: (fileIdx + 0.5) * 12.5,
      y: (rankIdx + 0.5) * 12.5,
    };
  };

  return (
    <div className="relative select-none w-full max-w-[560px] aspect-square rounded-2xl shadow-2xl overflow-hidden border border-slate-700 bg-slate-900">
      <div
        ref={boardRef}
        className="grid grid-cols-8 grid-rows-8 w-full h-full"
        id="chess-interactive-board"
      >
        {displayedRanks.map((rank, rankIdx) =>
          displayedFiles.map((file, fileIdx) => {
            const square = `${file}${rank}`;
            const isDark = (fileIdx + rankIdx) % 2 === 1;
            const piece = chess.get(square as Square);

            const isSelected = selectedSquare === square;
            const isLastMoveFrom = lastMove?.from === square;
            const isLastMoveTo = lastMove?.to === square;
            const isValidTarget = validMoves.includes(square);
            const isKingInCheck = kingInCheckSquare === square;
            const isHint = hintSquare === square;

            // Custom highlight
            const customHighlight = highlightSquares.find(h => h.square === square);

            return (
              <div
                key={square}
                id={`square-${square}`}
                onClick={() => handleSquareClick(square)}
                className={`relative flex items-center justify-center cursor-pointer transition-colors duration-150 ${
                  isDark ? themeColors.dark : themeColors.light
                } ${isSelected ? themeColors.selected : ''} ${
                  isLastMoveFrom || isLastMoveTo ? themeColors.lastMove : ''
                } ${isKingInCheck ? 'bg-red-500/80 animate-pulse' : ''} ${
                  isHint ? themeColors.hint : ''
                } ${customHighlight ? customHighlight.color : ''}`}
              >
                {/* Coordinates (Labels) */}
                {fileIdx === 0 && (
                  <span
                    className={`absolute top-1 left-1.5 text-[10px] font-bold pointer-events-none select-none ${
                      isDark ? 'text-[#EBECD0]/80' : 'text-[#739552]/80'
                    }`}
                  >
                    {rank}
                  </span>
                )}
                {rankIdx === 7 && (
                  <span
                    className={`absolute bottom-0.5 right-1.5 text-[10px] font-bold pointer-events-none select-none ${
                      isDark ? 'text-[#EBECD0]/80' : 'text-[#739552]/80'
                    }`}
                  >
                    {file}
                  </span>
                )}

                {/* Valid move target dots / rings */}
                {isValidTarget && !piece && (
                  <div className="w-3.5 h-3.5 rounded-full bg-black/25 dark:bg-white/30 pointer-events-none" />
                )}
                {isValidTarget && piece && (
                  <div className="absolute inset-1 rounded-full border-4 border-black/30 dark:border-white/40 pointer-events-none" />
                )}

                {/* Chess Piece */}
                {piece && (
                  <div
                    className={`w-[84%] h-[84%] flex items-center justify-center transition-transform duration-100 ${
                      isSelected ? 'scale-110 -translate-y-1' : 'hover:scale-105'
                    }`}
                  >
                    <ChessPieceIcon type={piece.type} color={piece.color} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* SVG Arrow Overlay for Best Moves, Mistakes & Consequence Lines */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
        viewBox="0 0 100 100"
      >
        <defs>
          <marker
            id="arrow-head-green"
            markerWidth="4"
            markerHeight="4"
            refX="2"
            refY="2"
            orient="auto"
          >
            <path d="M0,0 L4,2 L0,4 z" fill="#22c55e" />
          </marker>
          <marker
            id="arrow-head-red"
            markerWidth="4"
            markerHeight="4"
            refX="2"
            refY="2"
            orient="auto"
          >
            <path d="M0,0 L4,2 L0,4 z" fill="#ef4444" />
          </marker>
          <marker
            id="arrow-head-blue"
            markerWidth="4"
            markerHeight="4"
            refX="2"
            refY="2"
            orient="auto"
          >
            <path d="M0,0 L4,2 L0,4 z" fill="#3b82f6" />
          </marker>
          <marker
            id="arrow-head-yellow"
            markerWidth="4"
            markerHeight="4"
            refX="2"
            refY="2"
            orient="auto"
          >
            <path d="M0,0 L4,2 L0,4 z" fill="#eab308" />
          </marker>
        </defs>

        {arrows.map((arr, idx) => {
          const from = squareToSvgCoord(arr.from);
          const to = squareToSvgCoord(arr.to);
          const strokeColor = {
            green: '#22c55e',
            red: '#ef4444',
            blue: '#3b82f6',
            yellow: '#eab308',
            purple: '#a855f7',
          }[arr.color] || '#22c55e';

          const markerId = `arrow-head-${arr.color}`;

          return (
            <line
              key={`arrow-${idx}-${arr.from}-${arr.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={strokeColor}
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeOpacity="0.85"
              markerEnd={`url(#${markerId})`}
            />
          );
        })}
      </svg>

      {/* Pawn Promotion Modal */}
      {pendingPromotion && (
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-2xl flex flex-col items-center gap-3">
            <span className="text-sm font-bold text-white">Promote Pawn</span>
            <div className="flex gap-2.5">
              {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map(p => (
                <button
                  key={p}
                  onClick={() => handlePromotionChoice(p)}
                  className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-xl p-2 flex items-center justify-center border border-slate-600 hover:border-indigo-500 transition-all hover:scale-105 cursor-pointer shadow-md"
                  title={`Promote to ${p.toUpperCase()}`}
                >
                  <ChessPieceIcon type={p} color={chess.turn()} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
