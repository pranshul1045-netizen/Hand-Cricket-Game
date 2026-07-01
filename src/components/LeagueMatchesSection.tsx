import React, { useState } from 'react';
import { Calendar, Plus, Trophy, Shield, Search, ArrowRight, User, Trash2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { SchoolMatch, UserProfile } from '../types';

interface LeagueMatchesSectionProps {
  userProfile: UserProfile | null;
  schoolMatches: SchoolMatch[];
  isAdmin: boolean;
  onAddMatch?: (newMatch: SchoolMatch) => void;
  onDeleteMatch?: (matchId: string) => void;
}

export default function LeagueMatchesSection({ userProfile, schoolMatches, isAdmin, onAddMatch, onDeleteMatch }: LeagueMatchesSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [player1Runs, setPlayer1Runs] = useState<number>(0);
  const [player2Runs, setPlayer2Runs] = useState<number>(0);
  const [player1Conceded, setPlayer1Conceded] = useState<number>(0);
  const [player2Conceded, setPlayer2Conceded] = useState<number>(0);
  const [winner, setWinner] = useState<'player1' | 'player2' | 'tie'>('player1');
  const [status, setStatus] = useState<'completed' | 'scheduled'>('completed');
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  // Save new official school match
  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const matchId = `school_${Date.now()}`;
    const calculatedWinner = winner === 'player1' ? player1 : winner === 'player2' ? player2 : 'Tie';
    
    const newMatchPayload: SchoolMatch = {
      id: matchId,
      player1: player1.trim(),
      player2: player2.trim(),
      player1Runs: Number(player1Runs),
      player2Runs: Number(player2Runs),
      player1Conceded: Number(player1Conceded || player2Runs),
      player2Conceded: Number(player2Conceded || player1Runs),
      winner: calculatedWinner,
      status,
      date: matchDate,
      creatorId: auth.currentUser?.uid || 'guest_local',
      createdAt: new Date().toISOString()
    };

    try {
      if (!auth.currentUser || auth.currentUser.uid === 'guest_local' || userProfile?.uid === 'guest_local') {
        if (onAddMatch) {
          onAddMatch(newMatchPayload);
        }
      } else {
        await setDoc(doc(db, 'schoolMatches', matchId), newMatchPayload);
      }
      // Reset form
      setPlayer1('');
      setPlayer2('');
      setPlayer1Runs(0);
      setPlayer2Runs(0);
      setPlayer1Conceded(0);
      setPlayer2Conceded(0);
      setShowAddForm(false);
    } catch (err) {
      console.error("Error writing schoolyard match scorecard: ", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!window.confirm("Are you sure you want to remove this match scorecard?")) return;
    try {
      if (!auth.currentUser || auth.currentUser.uid === 'guest_local' || userProfile?.uid === 'guest_local') {
        if (onDeleteMatch) {
          onDeleteMatch(matchId);
        }
      } else {
        await deleteDoc(doc(db, 'schoolMatches', matchId));
      }
    } catch (err) {
      console.error("Error deleting schoolyard match scorecard: ", err);
    }
  };

  // Filtering matches by search query
  const filteredMatches = schoolMatches.filter(match => {
    const q = searchQuery.toLowerCase();
    return match.player1.toLowerCase().includes(q) || match.player2.toLowerCase().includes(q);
  });

  return (
    <div id="league-matches-section" className="space-y-6">
      
      {/* Header and Add Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display font-black text-xl text-orange-400 tracking-tight flex items-center gap-1.5 uppercase">
            <Trophy className="w-5 h-5 text-orange-400" /> Official School Scorecards
          </h3>
          <p className="text-slate-400 text-xs font-medium">
            Browse match results, scorecards, and future fixtures registered by your schoolyard admins.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-xs uppercase px-5 py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_3px_0_0_#9a3412] active:translate-y-0.5 active:shadow-none transition-all duration-100 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? 'Cancel Form' : 'Add School Scorecard'}
          </button>
        )}
      </div>

      {/* Add School Scorecard Form */}
      {showAddForm && isAdmin && (
        <form onSubmit={handleAddMatch} className="bg-[#161D2F] border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4 max-w-xl mx-auto animate-in slide-in-from-top-4 duration-200">
          <h4 className="font-display font-black text-base text-orange-400 uppercase tracking-tight">New Match Scorecard</h4>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Player 1 Details */}
            <div className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-xl space-y-3">
              <span className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-wider block">Player 1 (Bat First)</span>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={player1}
                    onChange={(e) => setPlayer1(e.target.value)}
                    placeholder="E.g. Pranshul"
                    className="w-full bg-[#1A2238] border border-slate-700 px-3 py-1.5 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Runs Scored</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={player1Runs}
                    onChange={(e) => setPlayer1Runs(Number(e.target.value))}
                    className="w-full bg-[#1A2238] border border-slate-700 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Runs Conceded (Bowling)</label>
                  <input
                    type="number"
                    min="0"
                    value={player1Conceded}
                    onChange={(e) => setPlayer1Conceded(Number(e.target.value))}
                    placeholder="What Player 2 scored"
                    className="w-full bg-[#1A2238] border border-slate-700 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Player 2 Details */}
            <div className="bg-[#1A2238] border border-slate-700 p-4 rounded-xl space-y-3">
              <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider block">Player 2 (Chase)</span>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={player2}
                    onChange={(e) => setPlayer2(e.target.value)}
                    placeholder="E.g. Rahul"
                    className="w-full bg-[#1A2238] border border-slate-700 px-3 py-1.5 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Runs Scored</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={player2Runs}
                    onChange={(e) => setPlayer2Runs(Number(e.target.value))}
                    className="w-full bg-[#1A2238] border border-slate-700 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Runs Conceded (Bowling)</label>
                  <input
                    type="number"
                    min="0"
                    value={player2Conceded}
                    onChange={(e) => setPlayer2Conceded(Number(e.target.value))}
                    placeholder="What Player 1 scored"
                    className="w-full bg-[#1A2238] border border-slate-700 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
            {/* Match Winner */}
            <div className="space-y-1">
              <label className="font-bold text-slate-400 block">Winner</label>
              <select
                value={winner}
                onChange={(e: any) => setWinner(e.target.value)}
                className="w-full bg-[#1A2238] border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-orange-500"
              >
                <option value="player1">Player 1 Won</option>
                <option value="player2">Player 2 Won</option>
                <option value="tie">Draw / Tie</option>
              </select>
            </div>

            {/* Match Date */}
            <div className="space-y-1">
              <label className="font-bold text-slate-400 block">Match Date</label>
              <input
                type="date"
                required
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full bg-[#1A2238] border border-slate-700 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Match Status */}
            <div className="space-y-1">
              <label className="font-bold text-slate-400 block">Status</label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full bg-[#1A2238] border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-orange-500"
              >
                <option value="completed">Completed Scorecard</option>
                <option value="scheduled">Scheduled Fixture</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving || !player1.trim() || !player2.trim()}
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-xs uppercase tracking-wider py-3 rounded-xl shadow-[0_3px_0_0_#9a3412] active:translate-y-0.5 active:shadow-none transition-all duration-100 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Submitting Scorecard...' : 'Submit Official Scorecard'}
          </button>
        </form>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md bg-[#161D2F] border border-slate-700 rounded-xl shadow-lg">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search matches by player name..."
          className="w-full bg-transparent pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-200 font-medium"
        />
      </div>

      {/* Scorecards Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredMatches.map(match => (
          <div key={match.id} className="bg-[#161D2F] border border-slate-700 rounded-2xl p-5 shadow-xl relative flex flex-col justify-between group overflow-hidden">
            
            {/* Header Details */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span className="font-mono">{match.date || 'School Yard Match'}</span>
              </div>
              <span className={`px-2.5 py-0.5 font-mono font-bold text-[9px] uppercase tracking-wider rounded border ${
                match.status === 'completed'
                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
              }`}>
                {match.status}
              </span>
            </div>

            {/* Match Grid representation */}
            <div className="grid grid-cols-3 items-center gap-2">
              {/* Player 1 Runs */}
              <div className="text-center space-y-1">
                <span className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider truncate">
                  {match.player1}
                </span>
                <span className="font-display font-black text-3xl text-slate-100 block leading-none pt-1">
                  {match.status === 'completed' ? match.player1Runs : '-'}
                </span>
                <span className="block text-[10px] font-mono text-orange-400/80">
                  Innings 1
                </span>
              </div>

              {/* Match outcome VS / Winner indicator */}
              <div className="text-center flex flex-col items-center justify-center">
                {match.status === 'completed' ? (
                  <div className="bg-orange-500/10 px-2.5 py-1 rounded border border-orange-500/20 text-center">
                    <span className="text-[8px] font-mono font-black text-orange-400 tracking-wider uppercase block">
                      {match.winner === 'Tie' ? 'Draw' : `${match.winner} won`}
                    </span>
                  </div>
                ) : (
                  <span className="font-display font-black text-slate-700 text-xl">VS</span>
                )}
              </div>

              {/* Player 2 Runs */}
              <div className="text-center space-y-1">
                <span className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider truncate">
                  {match.player2}
                </span>
                <span className="font-display font-black text-3xl text-slate-100 block leading-none pt-1">
                  {match.status === 'completed' ? match.player2Runs : '-'}
                </span>
                <span className="block text-[10px] font-mono text-purple-400/80">
                  Innings 2
                </span>
              </div>
            </div>

            {/* Extra summary data for completed matches */}
            {match.status === 'completed' && (
              <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-400 flex justify-between items-center">
                <span>Runs Conceded (Bowl):</span>
                <span className="text-slate-300">P1: {match.player1Conceded} | P2: {match.player2Conceded}</span>
              </div>
            )}

            {/* Delete control for Admin */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleDeleteMatch(match.id)}
                className="absolute top-2 right-2 p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Remove match scorecard"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {filteredMatches.length === 0 && (
          <div className="col-span-full py-12 text-center bg-[#1A2238]/50 rounded-2xl border-2 border-dashed border-slate-700 text-slate-400">
            No official schoolyard scorecard records matching your search query.
          </div>
        )}
      </div>

    </div>
  );
}
