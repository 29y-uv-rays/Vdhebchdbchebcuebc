import React, { useState, useEffect, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { 
  BotProfile, 
  PieceColor, 
  GameAnalysisResult, 
  AISettings, 
  GameHistoryItem 
} from './types';
import { BOT_PROFILES, getBotMove } from './engine/bot';
import { analyzeFullGame } from './engine/analysisEngine';
import { evaluatePosition } from './engine/evaluator';
import { soundManager } from './utils/sound';
import { ChessBoard } from './components/ChessBoard';
import { EvalBar } from './components/EvalBar';
import { GamePanel } from './components/GamePanel';
import { BotSelector } from './components/BotSelector';
import { AnalysisBoard } from './components/AnalysisBoard';
import { WalkthroughMode } from './components/WalkthroughMode';
import { SettingsModal } from './components/SettingsModal';
import { 
  Sparkles, 
  Swords, 
  Compass, 
  BarChart2, 
  Settings as SettingsIcon, 
  Volume2, 
  VolumeX, 
  History, 
  Play, 
  Cpu, 
  RotateCcw,
  Bot
} from 'lucide-react';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'nvidia',
  nvidiaModel: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  coachPersona: 'encouraging',
  mistakeThresholds: {
    inaccuracy: 0.40,
    mistake: 0.90,
    blunder: 2.00,
  },
};

export default function App() {
  // Game & Mode States
  const [appMode, setAppMode] = useState<'lobby' | 'playing' | 'analyzing' | 'analysis' | 'walkthrough' | 'history'>('lobby');
  const [selectedBot, setSelectedBot] = useState<BotProfile>(BOT_PROFILES[1]); // Guardian Gary default
  const [playerColor, setPlayerColor] = useState<PieceColor>('w');
  const [boardOrientation, setBoardOrientation] = useState<PieceColor>('w');
  const [boardTheme, setBoardTheme] = useState<'emerald' | 'wood' | 'modern' | 'slate'>('emerald');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settings, setSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('chess_ai_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AISettings> & { provider?: string };
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          provider: parsed.provider === 'heuristic' ? 'heuristic' : 'nvidia',
        };
      } catch {
        /* ignore */
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Active Chess Game State
  const [chess, setChess] = useState<Chess>(new Chess());
  const [historyMoves, setHistoryMoves] = useState<{ san: string; from: string; to: string }[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [gameResultText, setGameResultText] = useState<string | null>(null);

  // Clocks
  const [whiteTime, setWhiteTime] = useState<number>(600); // 10 minutes
  const [blackTime, setBlackTime] = useState<number>(600);

  // Analysis State
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisResult, setAnalysisResult] = useState<GameAnalysisResult | null>(null);
  const [walkthroughInitialPly, setWalkthroughInitialPly] = useState<number>(0);

  // Match History
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>(() => {
    const saved = localStorage.getItem('chess_game_history');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [];
  });

  // Save settings to localStorage
  const handleSaveSettings = (newSettings: AISettings) => {
    setSettings(newSettings);
    localStorage.setItem('chess_ai_settings', JSON.stringify(newSettings));
  };

  // Sound manager sync
  useEffect(() => {
    soundManager.setMuted(!soundEnabled);
  }, [soundEnabled]);

  // Clocks Timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (appMode === 'playing' && !isGameOver && historyMoves.length > 0) {
      timer = setInterval(() => {
        const turn = chess.turn();
        if (turn === 'w') {
          setWhiteTime(t => {
            if (t <= 1) {
              handleGameOver('0-1', 'Black wins on time');
              return 0;
            }
            return t - 1;
          });
        } else {
          setBlackTime(t => {
            if (t <= 1) {
              handleGameOver('1-0', 'White wins on time');
              return 0;
            }
            return t - 1;
          });
        }
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [appMode, isGameOver, chess.turn(), historyMoves.length]);

  // Start new match
  const handleStartGame = (chosenColor: 'w' | 'b' | 'random' = 'w') => {
    const assignedColor = chosenColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : chosenColor;
    const newGame = new Chess();
    setChess(newGame);
    setHistoryMoves([]);
    setCurrentMoveIndex(-1);
    setIsGameOver(false);
    setGameResultText(null);
    setPlayerColor(assignedColor);
    setBoardOrientation(assignedColor);
    setWhiteTime(600);
    setBlackTime(600);
    setAppMode('playing');

    // If player is Black, trigger bot's opening move
    if (assignedColor === 'b') {
      triggerBotMove(newGame);
    }
  };

  // Check Game Over conditions
  const checkGameEnd = (c: Chess) => {
    if (c.isCheckmate()) {
      const winner = c.turn() === 'w' ? 'Black' : 'White';
      const score = c.turn() === 'w' ? '0-1' : '1-0';
      handleGameOver(score, `Checkmate! ${winner} wins.`);
      return true;
    }
    if (c.isDraw()) {
      let reason = 'Draw';
      if (c.isStalemate()) reason = 'Draw by stalemate';
      else if (c.isThreefoldRepetition()) reason = 'Draw by threefold repetition';
      else if (c.isInsufficientMaterial()) reason = 'Draw by insufficient material';
      handleGameOver('1/2-1/2', reason);
      return true;
    }
    return false;
  };

  const handleGameOver = (result: '1-0' | '0-1' | '1/2-1/2' | '*', reason: string) => {
    setIsGameOver(true);
    setGameResultText(reason);
    soundManager.playGameOver();
  };

  // Bot move logic
  const triggerBotMove = async (c: Chess) => {
    if (isGameOver) return;
    setIsBotThinking(true);
    try {
      const botMove = await getBotMove(c, selectedBot);
      if (botMove && appMode === 'playing') {
        const moveRes = c.move(botMove);
        if (moveRes) {
          if (moveRes.captured) soundManager.playCapture();
          else if (moveRes.san.includes('O-O')) soundManager.playCastle();
          else soundManager.playMove();

          if (c.inCheck()) soundManager.playCheck();

          setHistoryMoves(prev => [...prev, { san: moveRes.san, from: moveRes.from, to: moveRes.to }]);
          setCurrentMoveIndex(prev => prev + 1);
          setChess(new Chess(c.fen()));

          checkGameEnd(c);
        }
      }
    } catch (err) {
      console.error('Error executing bot move:', err);
    } finally {
      setIsBotThinking(false);
    }
  };

  // Human player move handler
  const handlePlayerMove = (from: string, to: string, promotion?: string): boolean => {
    if (isGameOver || isBotThinking || chess.turn() !== playerColor) {
      return false;
    }

    const c = new Chess(chess.fen());
    try {
      const move = c.move({ from, to, promotion: promotion || 'q' });
      if (!move) return false;

      // Play audio
      if (move.captured) soundManager.playCapture();
      else if (move.san.includes('O-O')) soundManager.playCastle();
      else soundManager.playMove();

      if (c.inCheck()) soundManager.playCheck();

      const newHistory = [...historyMoves, { san: move.san, from: move.from, to: move.to }];
      setHistoryMoves(newHistory);
      setCurrentMoveIndex(newHistory.length - 1);
      setChess(c);

      const ended = checkGameEnd(c);
      if (!ended) {
        // Trigger Bot's reply
        triggerBotMove(c);
      }
      return true;
    } catch {
      return false;
    }
  };

  // Run full game analysis
  const handleRunAnalysis = async () => {
    if (historyMoves.length === 0) return;
    setAppMode('analyzing');
    setAnalysisProgress(0);

    try {
      const result = await analyzeFullGame(historyMoves, {
        depth: 3,
        thresholds: settings.mistakeThresholds,
        onProgress: (prog) => setAnalysisProgress(prog),
      });

      setAnalysisResult(result);

      // Save to game history
      const historyItem: GameHistoryItem = {
        id: `game-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        result: (gameResultText?.includes('1-0') ? '1-0' : gameResultText?.includes('0-1') ? '0-1' : '1/2-1/2') as GameHistoryItem['result'],
        reason: gameResultText || 'Completed',
        playerColor,
        opponent: selectedBot.name,
        opponentRating: selectedBot.rating,
        pgn: chess.pgn(),
        movesCount: historyMoves.length,
        playerAccuracy: playerColor === 'w' ? result.whiteAccuracy : result.blackAccuracy,
        analysis: result,
      };

      const updatedHistory = [historyItem, ...gameHistory.slice(0, 19)];
      setGameHistory(updatedHistory);
      localStorage.setItem('chess_game_history', JSON.stringify(updatedHistory));

      setAppMode('analysis');
    } catch (err) {
      console.error('Analysis error:', err);
      setAppMode('playing');
    }
  };

  // Undo move (takes back bot move and player move)
  const handleUndo = () => {
    if (historyMoves.length < 2 || isBotThinking || isGameOver) return;
    const c = new Chess();
    const truncated = historyMoves.slice(0, historyMoves.length - 2);
    truncated.forEach(m => c.move(m.san));
    setChess(c);
    setHistoryMoves(truncated);
    setCurrentMoveIndex(truncated.length - 1);
  };

  const handleResign = () => {
    const score = playerColor === 'w' ? '0-1' : '1-0';
    handleGameOver(score, `You resigned. ${selectedBot.name} wins.`);
  };

  const handleDraw = () => {
    // Bot accepts draw if position is roughly equal
    const evalCp = evaluatePosition(chess);
    if (Math.abs(evalCp) < 150) {
      handleGameOver('1/2-1/2', `${selectedBot.name} accepted your draw offer.`);
    } else {
      alert(`${selectedBot.name}: "I decline your draw offer, the game continues!"`);
    }
  };

  const lastMove = historyMoves.length > 0 ? historyMoves[historyMoves.length - 1] : null;
  const currentEval = evaluatePosition(chess);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-800/90 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 flex items-center justify-between">
        {/* Logo & Title */}
        <div 
          onClick={() => setAppMode('lobby')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-0.5 shadow-lg shadow-indigo-950/60 flex items-center justify-center text-white">
            <span className="text-xl">♟️</span>
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-2">
              Grandmaster<span className="text-indigo-400">AI</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                Coach Engine
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Interactive Bot Matches & Post-Game Coaching Walkthroughs
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* AI Provider Badge */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-semibold text-slate-300 transition-colors"
            title="Configure AI Model & NVIDIA NIM"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI: {settings.provider.toUpperCase()}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 transition-colors"
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Settings Modal Toggle */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Navigation Pill (Lobby / Analysis) */}
          {appMode !== 'lobby' && (
            <button
              onClick={() => setAppMode('lobby')}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow-md shadow-indigo-950/40 transition-colors"
            >
              New Match
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 max-w-7xl w-full mx-auto">
        {/* 1. LOBBY / BOT SELECTOR SCREEN */}
        {appMode === 'lobby' && (
          <div className="w-full flex flex-col items-center gap-8 animate-in fade-in duration-200">
            <BotSelector
              selectedBot={selectedBot}
              onSelectBot={(bot) => setSelectedBot(bot)}
              playerColor={playerColor}
              onSelectPlayerColor={(c) => {
                if (c === 'random') {
                  setPlayerColor(Math.random() < 0.5 ? 'w' : 'b');
                } else {
                  setPlayerColor(c);
                }
              }}
              onStartGame={() => handleStartGame(playerColor)}
            />

            {/* Game History Drawer / List */}
            {gameHistory.length > 0 && (
              <div className="w-full max-w-4xl bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" />
                    Past Matches & Analysis Logs
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">{gameHistory.length} saved</span>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {gameHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.analysis) {
                          setAnalysisResult(item.analysis);
                          setPlayerColor(item.playerColor);
                          setAppMode('analysis');
                        }
                      }}
                      className="p-3.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/60 cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">♟️</span>
                        <div>
                          <div className="font-bold text-xs text-white">
                            vs {item.opponent} ({item.opponentRating}) • Result: {item.result}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {item.date} • {item.movesCount} moves • Accuracy: {item.playerAccuracy}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/30">
                          View Analysis
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. PLAYING SCREEN */}
        {appMode === 'playing' && (
          <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 animate-in fade-in duration-200">
            <div className="flex items-center gap-3 w-full max-w-[560px]">
              <EvalBar evalCp={currentEval} isFlipped={boardOrientation === 'b'} />
              <div className="flex-1 border-4 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl bg-slate-900">
                <ChessBoard
                  chess={chess}
                  boardOrientation={boardOrientation}
                  lastMove={lastMove}
                  onMove={handlePlayerMove}
                  interactive={!isGameOver && !isBotThinking && chess.turn() === playerColor}
                  theme={boardTheme}
                />
              </div>
            </div>

            {/* Game Panel Sidebar */}
            <GamePanel
              chess={chess}
              bot={selectedBot}
              playerColor={playerColor}
              isBotThinking={isBotThinking}
              historyMoves={historyMoves}
              currentMoveIndex={currentMoveIndex}
              onJumpToMove={(idx) => {
                const c = new Chess();
                for (let i = 0; i <= idx; i++) c.move(historyMoves[i].san);
                setChess(c);
                setCurrentMoveIndex(idx);
              }}
              onFlipBoard={() => setBoardOrientation(o => o === 'w' ? 'b' : 'w')}
              onResign={handleResign}
              onOfferDraw={handleDraw}
              onUndoMove={handleUndo}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onAnalyzeGame={handleRunAnalysis}
              isGameOver={isGameOver}
              gameResultText={gameResultText}
              whiteTimeSeconds={whiteTime}
              blackTimeSeconds={blackTime}
            />
          </div>
        )}

        {/* 3. ANALYZING PROGRESS SCREEN */}
        {appMode === 'analyzing' && (
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-5 text-center animate-in zoom-in-95 duration-200 backdrop-blur">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 animate-pulse">
              <Compass className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Coach Engine Analyzing Game...</h2>
              <p className="text-xs text-slate-400 mt-1">
                Calculating move-by-move evaluations, blunders, missed opportunities, and tactical ideas.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700/80">
              <div
                className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full transition-all duration-150 rounded-full"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400">
              {analysisProgress}% Complete
            </span>
          </div>
        )}

        {/* 4. POST-MATCH ANALYSIS OVERVIEW */}
        {appMode === 'analysis' && analysisResult && (
          <div className="w-full animate-in fade-in duration-200">
            <AnalysisBoard
              analysis={analysisResult}
              playerColor={playerColor}
              botName={selectedBot.name}
              botRating={selectedBot.rating}
              settings={settings}
              boardTheme={boardTheme}
              onStartWalkthrough={(plyIdx = 0) => {
                setWalkthroughInitialPly(plyIdx);
                setAppMode('walkthrough');
              }}
              onNewGame={() => setAppMode('lobby')}
            />
          </div>
        )}

        {/* 5. INTERACTIVE COACH WALKTHROUGH MODE */}
        {appMode === 'walkthrough' && analysisResult && (
          <div className="w-full animate-in fade-in duration-200">
            <WalkthroughMode
              moves={analysisResult.moves}
              initialPlyIndex={walkthroughInitialPly}
              settings={settings}
              boardTheme={boardTheme}
              playerColor={playerColor}
              onExitWalkthrough={() => setAppMode('analysis')}
            />
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        boardTheme={boardTheme}
        onChangeBoardTheme={(th) => setBoardTheme(th)}
        soundEnabled={soundEnabled}
        onToggleSound={(en) => setSoundEnabled(en)}
      />
    </div>
  );
}
