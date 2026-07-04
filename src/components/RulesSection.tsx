import React from 'react';
import { BookOpen, HelpCircle, User, Award, Shield, CheckCircle2 } from 'lucide-react';

export default function RulesSection() {
  return (
    <div id="rules-section" className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Hero Header */}
      <div className="text-center bg-gradient-to-br from-[#161D2F] to-[#1A2238] border border-slate-700 rounded-2xl p-6 md:p-8 shadow-xl">
        <h2 className="font-display text-2xl md:text-3xl font-black text-orange-400 tracking-tight mb-2 uppercase">
          Hand Cricket League Rules
        </h2>
        <p className="text-slate-400 font-medium text-sm md:text-base max-w-2xl mx-auto">
          Learn the ultimate indoor schoolyard sport! Hand Cricket is a fast-paced, highly strategic game of mind-reading and quick gestures.
        </p>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* The Basics */}
        <div className="bg-[#161D2F] border border-slate-700 p-6 rounded-xl shadow-lg space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 text-orange-400 rounded-lg flex items-center justify-center border border-orange-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-100 uppercase tracking-tight">The Core Objective</h3>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            The game is played <strong>Individual vs Individual (1v1)</strong>. There are no overs or traditional team wickets. Instead, one player bats first to set a score, and the other chases it.
          </p>
          <ul className="text-xs text-slate-400 space-y-2 pl-4 list-disc">
            <li><strong>Batting:</strong> Score as many runs as possible by displaying numbers (1 to 6) on your hand.</li>
            <li><strong>Bowling:</strong> Try to guess the batter's exact number. If you show the same number simultaneously, the batter is <strong>OUT</strong>!</li>
          </ul>
        </div>

        {/* The Hand Signals */}
        <div className="bg-[#161D2F] border border-slate-700 p-6 rounded-xl shadow-lg space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center border border-purple-500/20">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-100 uppercase tracking-tight">Hand Gestures & Values</h3>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Players make moves simultaneously using one hand. The thumb represents <strong>6</strong>.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono font-bold">
            <div className="bg-[#1A2238] p-2 rounded-lg border border-slate-700 text-slate-300">
              <span className="block text-lg">☝️</span>
              <span>1 (Single)</span>
            </div>
            <div className="bg-[#1A2238] p-2 rounded-lg border border-slate-700 text-slate-300">
              <span className="block text-lg">✌️</span>
              <span>2 (Double)</span>
            </div>
            <div className="bg-[#1A2238] p-2 rounded-lg border border-slate-700 text-slate-300">
              <span className="block text-lg">🤟</span>
              <span>3 (Triple)</span>
            </div>
            <div className="bg-orange-500/10 text-orange-400 p-2 rounded-lg border border-orange-500/20">
              <span className="block text-lg">🖐️</span>
              <span>4 (Boundary)</span>
            </div>
            <div className="bg-[#1A2238] p-2 rounded-lg border border-slate-700 text-slate-300">
              <span className="block text-lg">✋</span>
              <span>5 (Power)</span>
            </div>
            <div className="bg-purple-500/10 text-purple-400 p-2 rounded-lg border border-purple-500/20">
              <span className="block text-lg">👍</span>
              <span>6 (Sixer)</span>
            </div>
          </div>
        </div>

        {/* How to Toss */}
        <div className="bg-[#161D2F] border border-slate-700 p-6 rounded-xl shadow-lg space-y-4 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 text-orange-400 rounded-lg flex items-center justify-center border border-orange-500/20">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-100 uppercase tracking-tight">The Schoolyard Toss</h3>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Before play starts, a random player is designated to call <strong>ODD</strong> or <strong>EVEN</strong>.
          </p>
          <div className="bg-[#1A2238] p-4 rounded-xl border border-slate-700 space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold">1</div>
                <p>Player A chooses <strong>ODD</strong>.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold">2</div>
                <p>Both show fingers simultaneously. Let's say <span className="font-bold">A</span> shows <span className="underline font-mono">4</span> and <span className="font-bold">B</span> shows <span className="underline font-mono">2</span>.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold">3</div>
                <p>Add both together: <span className="font-bold">4 + 2 = 6</span> (which is <strong>EVEN</strong>). B wins the toss!</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 italic font-medium pt-2 border-t border-slate-800">
              Winner of the toss can choose to <strong>BAT</strong> first (score runs) or <strong>BOWL</strong> first (defend and get target).
            </p>
          </div>
        </div>

        {/* Match Structure & The Chase */}
        <div className="bg-[#161D2F] border border-slate-700 p-6 rounded-xl shadow-lg space-y-4 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center border border-purple-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-100 uppercase tracking-tight">Innings & Chasing</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div className="space-y-2">
              <h4 className="font-bold text-orange-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-orange-400" /> Innings 1: Setting the Target
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                The batting player chooses moves (1-6) continuously. Each move adds to their total runs. If the bowler matches the batter's move, the batter is <strong>OUT</strong>.
              </p>
              <p className="text-xs bg-[#1A2238] p-2.5 rounded-lg font-mono text-slate-300 border border-slate-800">
                Example: Batter shows [4, 3, 6] = 13. Next move is 2, bowler also shows 2. Batter is OUT! Target to win is <strong>14</strong>.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-purple-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400" /> Innings 2: Chasing the Target
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                The roles swap. The second batter now chases the score. They must score <strong>Target runs</strong> to win. If they get OUT before passing the target, the first batter wins!
              </p>
              <p className="text-xs bg-[#1A2238] p-2.5 rounded-lg font-mono text-slate-300 border border-slate-800">
                If second batsman reaches 14 runs, they instantly win the match!
              </p>
            </div>
          </div>
        </div>

        {/* League Format & Playoff Qualification */}
        <div className="bg-[#161D2F] border border-slate-700 p-6 rounded-xl shadow-lg space-y-4 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 text-orange-400 rounded-lg flex items-center justify-center border border-orange-500/20">
              <User className="w-5 h-5 text-orange-400" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-100 uppercase tracking-tight">League Format & Playoff Qualification</h3>
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <p className="leading-relaxed">
              To keep the league completely fair and competitive, we enforce a strict round-robin matches cycle:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#1A2238] p-3 rounded-lg border border-slate-700 space-y-1.5">
                <h4 className="font-bold text-orange-400 text-xs uppercase tracking-wider font-mono">📅 Double Round-Robin</h4>
                <p className="text-xs text-slate-400">
                  Every team / player will play exactly <strong>two matches with the same opponent</strong> (one Home and one Away style) in the regular Group Stage.
                </p>
              </div>
              <div className="bg-[#1A2238] p-3 rounded-lg border border-slate-700 space-y-1.5">
                <h4 className="font-bold text-purple-400 text-xs uppercase tracking-wider font-mono">🏆 Playoffs Qualification</h4>
                <p className="text-xs text-slate-400">
                  All standard played matches default to <strong>Group Stage</strong>. After completing all regular matches, the <strong>Top 4 players</strong> qualify for the playoffs (Semifinal 1, Semifinal 2, and the Final).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
