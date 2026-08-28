import React from 'react';
import { BotProfile } from '../types';
import { BOT_PROFILES } from '../engine/bot';
import { Sparkles, Swords } from 'lucide-react';

interface BotSelectorProps {
  selectedBot: BotProfile;
  onSelectBot: (bot: BotProfile) => void;
  onStartGame: () => void;
  playerColor: 'w' | 'b' | 'random';
  onSelectPlayerColor: (color: 'w' | 'b' | 'random') => void;
}

export const BotSelector: React.FC<BotSelectorProps> = ({
  selectedBot,
  onSelectBot,
  onStartGame,
  playerColor,
  onSelectPlayerColor,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto p-5 sm:p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl flex flex-col gap-6 text-white backdrop-blur">
      {/* Header Bento Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 font-mono mb-1">
            Opponent Selection
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Swords className="w-6 h-6 text-indigo-400" />
            Choose Your AI Opponent
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Play against tailored bots. Get complete post-game analysis and coach walkthrough after the match.
          </p>
        </div>

        {/* Color Choice Bento Pill */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/80 shadow-inner">
          <button
            onClick={() => onSelectPlayerColor('w')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              playerColor === 'w'
                ? 'bg-slate-100 text-slate-900 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-white border border-slate-400 inline-block" />
            White
          </button>
          <button
            onClick={() => onSelectPlayerColor('random')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              playerColor === 'random'
                ? 'bg-indigo-600 text-white shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
            Random
          </button>
          <button
            onClick={() => onSelectPlayerColor('b')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              playerColor === 'b'
                ? 'bg-slate-950 text-white border border-slate-600 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-slate-950 border border-slate-500 inline-block" />
            Black
          </button>
        </div>
      </div>

      {/* Bot Grid (Bento Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {BOT_PROFILES.map((bot) => {
          const isSelected = selectedBot.id === bot.id;
          return (
            <div
              key={bot.id}
              onClick={() => onSelectBot(bot)}
              className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between gap-3 group ${
                isSelected
                  ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/50 shadow-xl -translate-y-0.5'
                  : 'bg-slate-800/40 border-slate-700/70 hover:bg-slate-800/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl p-2.5 bg-slate-900/90 rounded-xl border border-slate-700/80 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                  {bot.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-white truncate">
                      {bot.name}
                    </h3>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-indigo-400">
                      {bot.rating}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {bot.title} • {bot.style}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {bot.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Start Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={onStartGame}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-950/50 flex items-center gap-2 text-sm tracking-wide transition-all transform active:scale-98 cursor-pointer"
        >
          <Swords className="w-4 h-4" />
          Play vs {selectedBot.name} ({selectedBot.rating})
        </button>
      </div>
    </div>
  );
};
