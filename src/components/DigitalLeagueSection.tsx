import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trophy, Shield, Search, ArrowRight, User, Trash2 } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { DigitalTournamentMatch, UserProfile } from '../types';

const getGradientByName = (name: string) => {
  const gradients = [
    'from-pink-500 to-rose-500',
    'from-amber-500 to-orange-600',
    'from-emerald-400 to-teal-600',
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-fuchsia-500 to-pink-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

interface DigitalLeagueSectionProps {
  userProfile: UserProfile | null;
  digitalTournamentMatches: DigitalTournamentMatch[];
  isAdmin: boolean;
  digitalTournamentLocked?: boolean;
  onAddMatch?: (newMatch: DigitalTournamentMatch) => void;
  onDeleteMatch?: (matchId: string) => void;
}

export default function DigitalLeagueSection({ userProfile, digitalTournamentMatches, isAdmin, digitalTournamentLocked, onAddMatch, onDeleteMatch }: DigitalLeagueSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Player Profile Photos
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'playerProfiles'), (snapshot) => {
      const profiles: Record<string, string> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.photoURL) {
          profiles[docSnap.id] = data.photoURL; // doc.id is lowercased name
        }
      });
      setPlayerProfiles(profiles);
    }, (err) => {
      console.error("Error loading profiles in DigitalLeagueSection:", err);
      handleFirestoreError(err, OperationType.LIST, 'playerProfiles');
    });
    return () => unsub();
  }, []);

  // Form State
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [player1Runs, setPlayer1Runs] = useState<number>(0);
  const [player2Runs, setPlayer2Runs] = useState<number>(0);
  const [player1Conceded, setPlayer1Conceded] = useState<number>(0);
  const [player2Conceded, setPlayer2Conceded] = useState<number>(0);
  const [winner, setWinner] = useState<'player1' | 'player2' | 'tie'>('player1');
  const [status, setStatus] = useState<'completed' | 'scheduled'>('completed');
  const [stage, setStage] = useState<string>('Group Stage');
  const [group, setGroup] = useState<string>('Group 1');
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [matchTime, setMatchTime] = useState<string>('12:00');
  const [isSaving, setIsSaving] = useState(false);

  // Save new official digital tournament match
  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const matchId = `digital_tournament_${Date.now()}`;
    const calculatedWinner = winner === 'player1' ? player1 : winner === 'player2' ? player2 : 'Tie';
    
    const newMatchPayload: DigitalTournamentMatch = {
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
      time: matchTime,
      stage,
      group: stage === 'Group Stage' ? group : undefined,
      creatorId: auth.currentUser?.uid || 'guest_local',
      createdAt: new Date().toISOString()
    };

    try {
      if (digitalTournamentLocked) {
        console.error("Cannot add scorecard: tournament is locked.");
        setIsSaving(false);
        return;
      }
      const isUserAdmin = isAdmin || userProfile?.role === 'admin' || userProfile?.uid === 'admin_local';
      if (isUserAdmin) {
        await setDoc(doc(db, 'digitalTournamentMatches', matchId), newMatchPayload);
      } else {
        if (onAddMatch) {
          onAddMatch(newMatchPayload);
        }
      }
      // Reset form
      setPlayer1('');
      setPlayer2('');
      setPlayer1Runs(0);
      setPlayer2Runs(0);
      setPlayer1Conceded(0);
      setPlayer2Conceded(0);
      setStage('Group Stage');
      setShowAddForm(false);
    } catch (err) {
      console.error("Error writing digital tournament match scorecard: ", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    try {
      if (digitalTournamentLocked) {
        console.error("Cannot delete scorecard: tournament is locked.");
        return;
      }
      const isUserAdmin = isAdmin || userProfile?.role === 'admin' || userProfile?.uid === 'admin_local';
      if (isUserAdmin) {
        await deleteDoc(doc(db, 'digitalTournamentMatches', matchId));
      } else {
        if (onDeleteMatch) {
          onDeleteMatch(matchId);
        }
      }
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("Error deleting digital tournament match scorecard: ", err);
    }
  };

  // Filtering matches by search query
  const filteredMatches = digitalTournamentMatches.filter(match => {
    const q = searchQuery.toLowerCase();
    return match.player1.toLowerCase().includes(q) || match.player2.toLowerCase().includes(q);
  });

  return (
    <div id="league-matches-section" className="space-y-6">
      
      {digitalTournamentLocked && (
        <div className="bg-red-950/20 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-3.5 shadow">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <div className="text-xs">
            <span className="font-bold text-slate-200 block">Schoolyard Match Entry Frozen</span>
            <span className="text-slate-400 font-sans mt-0.5 block">
              New scorecards are locked for the current stage. Even administrators cannot make changes at this time.
            </span>
          </div>
        </div>
      )}

      {/* Header and Add Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display font-black text-xl text-orange-400 tracking-tight flex items-center gap-1.5 uppercase">
            <Trophy className="w-5 h-5 text-orange-400" /> Official School Scorecards
          </h3>
          <p className="text-slate-400 text-xs font-medium">
            Browse match results, scorecards, and future fixtures registered by your tournament admins.
          </p>
        </div>

        {isAdmin && !digitalTournamentLocked && (
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-2">
            {/* Match Winner */}
            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="font-bold text-slate-400 block">Winner</label>
              <select
                value={winner}
                onChange={(e: any) => setWinner(e.target.value)}
                className="w-full bg-[#1A2238] border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="player1">Player 1 Won</option>
                <option value="player2">Player 2 Won</option>
                <option value="tie">Draw / Tie</option>
              </select>
            </div>

            {/* Match Date */}
            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="font-bold text-slate-400 block">Match Date</label>
              <input
                type="date"
                required
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full bg-[#1A2238] border border-slate-700 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Match Time */}
            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="font-bold text-slate-400 block">Match Time</label>
              <input
                type="time"
                value={matchTime}
                onChange={(e) => setMatchTime(e.target.value)}
                className="w-full bg-[#1A2238] border border-slate-700 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Match Stage */}
            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="font-bold text-slate-400 block">Match Stage</label>
              <select
                value={stage}
                onChange={(e: any) => setStage(e.target.value)}
                className="w-full bg-[#1A2238] border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="Group Stage">Group Stage</option>
                <option value="Round of 32">Round of 32</option>
                <option value="Round of 16">Round of 16</option>
                <option value="Quarterfinal">Quarterfinal</option>
                <option value="Semifinal">Semifinal</option>
                <option value="Final">Final</option>
                <option value="3rd-Place Match">3rd-Place Match</option>
              </select>
            </div>

            {stage === 'Group Stage' && (
              <div className="space-y-1 col-span-2 md:col-span-1">
                <label className="font-bold text-slate-400 block">Group</label>
                <select
                  value={group}
                  onChange={(e: any) => setGroup(e.target.value)}
                  className="w-full bg-[#1A2238] border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={`Group ${i + 1}`}>
                      Group {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Match Status */}
            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="font-bold text-slate-400 block">Status</label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full bg-[#1A2238] border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer"
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
                <span className="font-mono">{match.date || 'Digital Tournament Match'} {match.time && `| ${match.time}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 font-mono font-bold text-[9px] uppercase tracking-wider rounded border ${
                  (match.stage || 'Group Stage') === 'Final'
                    ? 'bg-red-500/15 text-red-400 border-red-500/30 font-extrabold'
                    : (match.stage || 'Group Stage').startsWith('Semifinal')
                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}>
                  {match.stage === 'Group Stage' && match.group ? `${match.stage} - ${match.group}` : (match.stage || 'Group Stage')}
                </span>
                <span className={`px-2.5 py-0.5 font-mono font-bold text-[9px] uppercase tracking-wider rounded border ${
                  match.status === 'completed'
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                }`}>
                  {match.status}
                </span>
                {isAdmin && !digitalTournamentLocked && (
                  <div className="flex items-center gap-1.5">
                    {confirmDeleteId === match.id ? (
                      <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150">
                        <button
                          type="button"
                          onClick={() => handleDeleteMatch(match.id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-[9px] uppercase rounded transition-all duration-150 cursor-pointer"
                        >
                          Sure?
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-mono font-bold text-[9px] uppercase rounded transition-all duration-150 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(match.id)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-all duration-200 cursor-pointer"
                        title="Remove match scorecard"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Match Grid representation */}
            <div className="grid grid-cols-3 items-center gap-2">
              {/* Player 1 Runs */}
              <div className="text-center space-y-1 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center mb-1">
                  {playerProfiles[match.player1.toLowerCase()] ? (
                    <img 
                      src={playerProfiles[match.player1.toLowerCase()]} 
                      alt={match.player1} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${getGradientByName(match.player1)} flex items-center justify-center text-white text-xs font-bold font-display uppercase`}>
                      {match.player1.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider truncate max-w-[85px]" title={match.player1}>
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
              <div className="text-center space-y-1 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center mb-1">
                  {playerProfiles[match.player2.toLowerCase()] ? (
                    <img 
                      src={playerProfiles[match.player2.toLowerCase()]} 
                      alt={match.player2} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${getGradientByName(match.player2)} flex items-center justify-center text-white text-xs font-bold font-display uppercase`}>
                      {match.player2.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider truncate max-w-[85px]" title={match.player2}>
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


          </div>
        ))}

        {filteredMatches.length === 0 && (
          <div className="col-span-full py-12 text-center bg-[#1A2238]/50 rounded-2xl border-2 border-dashed border-slate-700 text-slate-400">
            No official digital scorecard records matching your search query.
          </div>
        )}
      </div>

    </div>
  );
}
