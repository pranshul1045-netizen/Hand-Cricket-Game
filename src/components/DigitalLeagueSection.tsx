import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trophy, Shield, Search, ArrowRight, User, Trash2, Gamepad2, Flame, Users } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { DigitalTournamentMatch, UserProfile, formatGroupName } from '../types';

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

export function formatTimeTo12Hour(timeStr?: string): string {
  if (!timeStr) return '';
  if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
    return timeStr;
  }
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`;
}

interface DigitalLeagueSectionProps {
  userProfile: UserProfile | null;
  digitalTournamentMatches: DigitalTournamentMatch[];
  isAdmin: boolean;
  digitalTournamentLocked?: boolean;
  onAddMatch?: (newMatch: DigitalTournamentMatch) => void;
  onDeleteMatch?: (matchId: string) => void;
  setActiveTab?: (tab: 'dashboard' | 'game' | 'league' | 'rules' | 'updates' | 'digital_home' | 'digital_league') => void;
}

export default function DigitalLeagueSection({ 
  userProfile, 
  digitalTournamentMatches, 
  isAdmin, 
  digitalTournamentLocked, 
  onAddMatch, 
  onDeleteMatch,
  setActiveTab 
}: DigitalLeagueSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Player Profiles
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, string>>({});
  const [fullProfiles, setFullProfiles] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'playerProfiles'), (snapshot) => {
      const profiles: Record<string, string> = {};
      const full: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.photoURL) {
          profiles[docSnap.id] = data.photoURL; // doc.id is lowercased name
        }
        full.push({
          id: docSnap.id,
          ...data
        });
      });
      setPlayerProfiles(profiles);
      setFullProfiles(full);
    }, (err) => {
      console.error("Error loading profiles in DigitalLeagueSection:", err);
      handleFirestoreError(err, OperationType.LIST, 'playerProfiles');
    });
    return () => unsub();
  }, []);

  // 1-second interval for real-time timer
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to lookup player profiles and check online status
  const getPlayerProfileByTeamOrName = (identifier: string) => {
    if (!identifier) return null;
    const idLow = identifier.toLowerCase().trim();
    return fullProfiles.find(p => {
      const pNameLow = (p.name || '').toLowerCase().trim();
      const pTeamLow = (p.teamName || '').toLowerCase().trim();
      return pNameLow === idLow || pTeamLow === idLow;
    });
  };

  const isPlayerOnline = (lastActive: string | null) => {
    if (!lastActive) return false;
    try {
      const diff = Date.now() - new Date(lastActive).getTime();
      return diff < 30000; // 30 seconds
    } catch {
      return false;
    }
  };

  const playerTeamName = userProfile?.teamName || '';
  const myPlayerName = userProfile?.displayName || '';
  
  const isMatchPlayer = (match: DigitalTournamentMatch) => {
    if (!playerTeamName && !myPlayerName) return false;
    const p1Low = match.player1.toLowerCase().trim();
    const p2Low = match.player2.toLowerCase().trim();
    const myTeamLow = playerTeamName.toLowerCase().trim();
    const myNameLow = myPlayerName.toLowerCase().trim();
    
    return p1Low === myTeamLow || p2Low === myTeamLow || p1Low === myNameLow || p2Low === myNameLow;
  };

  const formatCountdown = (matchTimeStr: string, matchDateStr: string) => {
    try {
      const matchTimeMs = new Date(`${matchDateStr}T${matchTimeStr}:00`).getTime();
      const diffMs = matchTimeMs - nowMs;
      if (diffMs <= 0) {
        const elapsedSec = Math.floor(Math.abs(diffMs) / 1000);
        const mins = Math.floor(elapsedSec / 60);
        const secs = elapsedSec % 60;
        return {
          status: 'live',
          text: `LIVE • ${mins}m ${secs}s elapsed`
        };
      } else {
        const totalSec = Math.floor(diffMs / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        return {
          status: 'upcoming',
          text: `Starts in ${mins}:${String(secs).padStart(2, '0')}`
        };
      }
    } catch {
      return { status: 'unknown', text: '' };
    }
  };

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
  const [matchHour, setMatchHour] = useState<string>('12');
  const [matchMinute, setMatchMinute] = useState<string>('00');
  const [matchAmPm, setMatchAmPm] = useState<'AM' | 'PM'>('PM');
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize 12-hour selectors with matchTime state string for firestore
  useEffect(() => {
    let hr = parseInt(matchHour, 10);
    if (matchAmPm === 'PM' && hr < 12) hr += 12;
    if (matchAmPm === 'AM' && hr === 12) hr = 0;
    const hrStr = String(hr).padStart(2, '0');
    setMatchTime(`${hrStr}:${matchMinute}`);
  }, [matchHour, matchMinute, matchAmPm]);

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
      setMatchHour('12');
      setMatchMinute('00');
      setMatchAmPm('PM');
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

  // Filter scheduled matches starting in 5 minutes (or currently in progress)
  const lobbyMatches = (digitalTournamentMatches || []).filter(match => {
    if (match.status !== 'scheduled') return false;
    if (!match.date || !match.time) return false;
    try {
      const matchTimeMs = new Date(`${match.date}T${match.time}:00`).getTime();
      if (isNaN(matchTimeMs)) return false;
      // Show match if it's within 5 minutes of starting, or up to 60 minutes after start time
      return nowMs >= matchTimeMs - 5 * 60 * 1000 && nowMs <= matchTimeMs + 60 * 60 * 1000;
    } catch {
      return false;
    }
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

      {/* Live Match Lobby Banner (Starting within 5 min / ongoing) */}
      {lobbyMatches.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500/10 via-purple-600/10 to-pink-500/10 border border-orange-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-4">
          <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl transform translate-x-12 -translate-y-12"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl transform -translate-x-12 translate-y-12"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-display font-black text-lg text-orange-400 tracking-tight flex items-center gap-2 uppercase">
                <Flame className="w-5 h-5 text-orange-500 animate-pulse" /> Live Match Lobby
              </h3>
              <p className="text-slate-400 text-xs font-medium">
                Official tournament matches starting now or within the next 5 minutes. Players, enter the arena to play!
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-[#1A2238]/60 border border-slate-700/50 px-3 py-1.5 rounded-lg">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="font-mono text-xs text-slate-300 font-bold">{lobbyMatches.length} Match{lobbyMatches.length > 1 ? 'es' : ''} Active</span>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 gap-4">
            {lobbyMatches.map(match => {
              const countdown = formatCountdown(match.time || '', match.date || '');
              const p1Profile = getPlayerProfileByTeamOrName(match.player1);
              const p2Profile = getPlayerProfileByTeamOrName(match.player2);
              const p1Online = p1Profile ? isPlayerOnline(p1Profile.lastActive) : false;
              const p2Online = p2Profile ? isPlayerOnline(p2Profile.lastActive) : false;
              const amIInMatch = isMatchPlayer(match);

              return (
                <div key={match.id} className="bg-[#111827]/90 border border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-orange-500/30 transition-all duration-300">
                  <div className="flex-1 space-y-3">
                    {/* Stage Badge & Countdown */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2.5 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded font-mono text-[10px] font-bold uppercase tracking-wider text-orange-400">
                        {match.stage === 'Group Stage' && match.group ? `${match.stage} - ${formatGroupName(match.group)}` : (match.stage || 'Group Stage')}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                        countdown.status === 'live' 
                          ? 'bg-red-500/15 text-red-400 border border-red-500/20 animate-pulse' 
                          : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {countdown.text}
                      </span>
                    </div>

                    {/* Players & Status Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-3">
                      {/* Player 1 */}
                      <div className="sm:col-span-5 flex items-center gap-3 bg-[#1A2238]/40 border border-slate-800/80 p-2.5 rounded-lg">
                        <div className="relative">
                          {p1Profile?.photoURL ? (
                            <img src={p1Profile.photoURL} alt={match.player1} className="w-8 h-8 rounded-full object-cover border border-slate-700" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#1A2238] border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                              {match.player1.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111827] ${p1Online ? 'bg-emerald-500' : 'bg-slate-500'}`} title={p1Online ? 'Online' : 'Offline'}></span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-200 text-sm truncate flex items-center gap-1.5">
                            {match.player1}
                            {userProfile?.teamName === match.player1 && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1 py-0.2 rounded font-mono">YOU</span>}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${p1Online ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                            {p1Online ? 'Ready / Online' : 'Offline'}
                          </div>
                        </div>
                      </div>

                      {/* VS Indicator */}
                      <div className="sm:col-span-1 text-center font-mono font-bold text-xs text-slate-500 py-1 sm:py-0">
                        VS
                      </div>

                      {/* Player 2 */}
                      <div className="sm:col-span-5 flex items-center gap-3 bg-[#1A2238]/40 border border-slate-800/80 p-2.5 rounded-lg">
                        <div className="relative">
                          {p2Profile?.photoURL ? (
                            <img src={p2Profile.photoURL} alt={match.player2} className="w-8 h-8 rounded-full object-cover border border-slate-700" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#1A2238] border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                              {match.player2.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111827] ${p2Online ? 'bg-emerald-500' : 'bg-slate-500'}`} title={p2Online ? 'Online' : 'Offline'}></span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-200 text-sm truncate flex items-center gap-1.5">
                            {match.player2}
                            {userProfile?.teamName === match.player2 && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1 py-0.2 rounded font-mono">YOU</span>}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${p2Online ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                            {p2Online ? 'Ready / Online' : 'Offline'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="flex md:flex-col items-stretch justify-center gap-2 min-w-[140px] md:border-l md:border-slate-800 md:pl-4">
                    {amIInMatch ? (
                      <button
                        onClick={() => {
                          if (setActiveTab) {
                            setActiveTab('game');
                          }
                        }}
                        className="w-full bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-display font-black text-xs uppercase py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Gamepad2 className="w-4 h-4 text-white animate-bounce" />
                        Play Live Duel
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (setActiveTab) {
                            setActiveTab('game');
                          }
                        }}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] font-bold uppercase py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        Enter Game Arena
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
              <div className="flex items-center gap-1">
                {/* Hour */}
                <select
                  value={matchHour}
                  onChange={(e) => setMatchHour(e.target.value)}
                  className="w-1/3 bg-[#1A2238] border border-slate-700 px-1 py-1.5 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-orange-500 cursor-pointer"
                  title="Hour"
                >
                  {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>

                <span className="text-slate-500 font-bold font-mono px-0.5">:</span>

                {/* Minute */}
                <select
                  value={matchMinute}
                  onChange={(e) => setMatchMinute(e.target.value)}
                  className="w-1/3 bg-[#1A2238] border border-slate-700 px-1 py-1.5 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-orange-500 cursor-pointer"
                  title="Minute"
                >
                  {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                {/* AM/PM */}
                <select
                  value={matchAmPm}
                  onChange={(e: any) => setMatchAmPm(e.target.value)}
                  className="w-1/3 bg-[#1A2238] border border-slate-700 px-1 py-1.5 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-orange-500 cursor-pointer"
                  title="AM/PM"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
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
                      {formatGroupName(`Group ${i + 1}`)}
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
                <span className="font-mono">{match.date || 'Digital Tournament Match'} {match.time && `| ${formatTimeTo12Hour(match.time)}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 font-mono font-bold text-[9px] uppercase tracking-wider rounded border ${
                  (match.stage || 'Group Stage') === 'Final'
                    ? 'bg-red-500/15 text-red-400 border-red-500/30 font-extrabold'
                    : (match.stage || 'Group Stage').startsWith('Semifinal')
                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}>
                  {match.stage === 'Group Stage' && match.group ? `${match.stage} - ${formatGroupName(match.group)}` : (match.stage || 'Group Stage')}
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
