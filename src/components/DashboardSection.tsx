import React, { useState, useEffect } from 'react';
import { Award, Shield, User, Edit3, Save, Flame, Trophy, TrendingUp, Sparkles } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { UserProfile, SchoolMatch, PlayerStanding } from '../types';

const AVATAR_PRESETS = [
  { name: 'Red Cap', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Blue Bowler', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Green Athlete', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Gold Captain', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Cricket Star', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Youth Batter', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Sport Pro', url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Cricket Fan', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80' },
];

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

interface DashboardSectionProps {
  userProfile: UserProfile | null;
  schoolMatches: SchoolMatch[];
  onStartGame: () => void;
  onUpdateProfile?: (updatedProfile: UserProfile) => void;
}

export default function DashboardSection({ userProfile, schoolMatches, onStartGame, onUpdateProfile }: DashboardSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [battingStyle, setBattingStyle] = useState<'Right-handed' | 'Left-handed'>('Right-handed');
  const [favoriteNumber, setFavoriteNumber] = useState<number>(6);
  const [isSaving, setIsSaving] = useState(false);

  // Player Profile Photo States
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, string>>({});
  const [selectedPlayerForPhoto, setSelectedPlayerForPhoto] = useState('');
  const [customPlayerName, setCustomPlayerName] = useState('');
  const [customPlayerPhotoURL, setCustomPlayerPhotoURL] = useState('');
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  // Detect isAdmin
  const isAdmin = 
    auth.currentUser?.email === 'pranshul1045@gmail.com' || 
    auth.currentUser?.email === 'pranshul1045@gamil.com' || 
    auth.currentUser?.uid === 'admin_local' || 
    userProfile?.role === 'admin';

  useEffect(() => {
    // Real-time subscribe to custom player profiles
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
      console.error("Error loading player profiles:", err);
    });
    return () => unsub();
  }, []);

  const handleSavePlayerPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerForPhoto) return;
    
    let targetName = selectedPlayerForPhoto;
    if (selectedPlayerForPhoto === 'new_custom') {
      if (!customPlayerName.trim()) return;
      targetName = customPlayerName.trim();
    }

    setIsSavingPhoto(true);
    try {
      const docId = targetName.toLowerCase();
      await setDoc(doc(db, 'playerProfiles', docId), {
        name: targetName,
        photoURL: customPlayerPhotoURL.trim(),
        updatedAt: new Date().toISOString()
      });
      
      if (selectedPlayerForPhoto === 'new_custom') {
        setCustomPlayerName('');
      }
      setSelectedPlayerForPhoto('');
      setCustomPlayerPhotoURL('');
      alert(`Success! Set profile photo for ${targetName}`);
    } catch (err) {
      console.error("Error saving player photo:", err);
      alert("Failed to save player photo. Please try again.");
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const handleStartEditPhoto = (name: string) => {
    setSelectedPlayerForPhoto(name);
    setCustomPlayerPhotoURL(playerProfiles[name.toLowerCase()] || '');
    const adminEl = document.getElementById('admin-photos-panel');
    if (adminEl) {
      adminEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBattingStyle(userProfile.battingStyle || 'Right-handed');
      setFavoriteNumber(userProfile.favoriteNumber || 6);
    }
  }, [userProfile]);

  // Compute stats dynamically from school matches for real-time Orange & Purple caps!
  const playerStatsMap: Record<string, {
    name: string;
    runsScored: number;
    runsConceded: number;
    matchesPlayed: number;
    won: number;
    lost: number;
    points: number;
    runRate: number;
  }> = {};

  // Process official school yard matches
  schoolMatches.forEach(match => {
    if (match.status !== 'completed') return;

    const p1 = match.player1;
    const p2 = match.player2;

    if (!playerStatsMap[p1]) {
      playerStatsMap[p1] = { name: p1, runsScored: 0, runsConceded: 0, matchesPlayed: 0, won: 0, lost: 0, points: 0, runRate: 0 };
    }
    if (!playerStatsMap[p2]) {
      playerStatsMap[p2] = { name: p2, runsScored: 0, runsConceded: 0, matchesPlayed: 0, won: 0, lost: 0, points: 0, runRate: 0 };
    }

    // Accumulate runs
    playerStatsMap[p1].runsScored += match.player1Runs;
    playerStatsMap[p2].runsScored += match.player2Runs;

    // Accumulate runs conceded (what the opponent scored)
    const p1Conceded = match.player1Conceded !== undefined ? match.player1Conceded : match.player2Runs;
    const p2Conceded = match.player2Conceded !== undefined ? match.player2Conceded : match.player1Runs;
    playerStatsMap[p1].runsConceded += p1Conceded;
    playerStatsMap[p2].runsConceded += p2Conceded;

    playerStatsMap[p1].matchesPlayed += 1;
    playerStatsMap[p2].matchesPlayed += 1;

    // Wins and losses
    if (match.winner === p1 || match.winner === 'player1') {
      playerStatsMap[p1].won += 1;
      playerStatsMap[p1].points += 2;
      playerStatsMap[p2].lost += 1;
    } else if (match.winner === p2 || match.winner === 'player2') {
      playerStatsMap[p2].won += 1;
      playerStatsMap[p2].points += 2;
      playerStatsMap[p1].lost += 1;
    } else {
      // Draw/Tie
      playerStatsMap[p1].points += 1;
      playerStatsMap[p2].points += 1;
    }
  });

  // Calculate runRate for each player
  Object.keys(playerStatsMap).forEach(key => {
    const player = playerStatsMap[key];
    player.runRate = player.runsScored - player.runsConceded;
  });

  const playersArray = Object.values(playerStatsMap);

  // Orange Cap (Most Runs Scored)
  const orangeCapWinner = [...playersArray].sort((a, b) => b.runsScored - a.runsScored)[0] || null;

  // Purple Cap (Lowest Total Runs Conceded, minimum 1 match played)
  const purpleCapWinner = [...playersArray]
    .filter(p => p.matchesPlayed > 0)
    .sort((a, b) => {
      if (a.runsConceded !== b.runsConceded) {
        return a.runsConceded - b.runsConceded; // Lowest total runs conceded wins
      }
      const avgA = a.runsConceded / a.matchesPlayed;
      const avgB = b.runsConceded / b.matchesPlayed;
      return avgA - avgB; // Tiebreaker: Lowest average runs conceded wins
    })[0] || null;

  // Standings Sorted by Points, then Run Rate
  const sortedStandings = [...playersArray].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.runRate !== a.runRate) return b.runRate - a.runRate;
    return b.runsScored - a.runsScored;
  });

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      if (!auth.currentUser || auth.currentUser.uid === 'guest_local' || userProfile?.uid === 'guest_local') {
        const updatedProfile: UserProfile = {
          uid: 'guest_local',
          displayName: displayName.trim(),
          role: userProfile?.role || 'admin',
          battingStyle,
          favoriteNumber,
          createdAt: userProfile?.createdAt || new Date().toISOString()
        };
        localStorage.setItem('hcl_local_guest_profile', JSON.stringify(updatedProfile));
        if (onUpdateProfile) {
          onUpdateProfile(updatedProfile);
        }
        setIsEditing(false);
      } else {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          displayName,
          battingStyle,
          favoriteNumber
        });
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Error updating profile: ", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="dashboard-section" className="space-y-8 pb-12">
      {/* Welcome Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#161D2F] to-[#1A2238] border border-slate-700 text-slate-200 rounded-2xl p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 bg-orange-500/15 text-orange-400 px-3 py-1 rounded border border-orange-500/20 text-xs font-bold font-mono tracking-wider uppercase">
              <Sparkles className="w-3 h-3 fill-current" /> School Yard Showdown
            </div>
            <h1 className="font-display text-2xl md:text-4xl font-black leading-tight text-white uppercase tracking-tight">
              Hand Cricket League Dashboard
            </h1>
            <p className="text-slate-400 max-w-xl text-sm md:text-base font-sans">
              Welcome back, <span className="font-bold text-orange-400">{userProfile?.displayName || 'Player'}</span>! Track your schoolyard runs, view dynamic cap tables, and play the digital arena game.
            </p>
          </div>
          <button
            onClick={onStartGame}
            className="w-full md:w-auto bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-sm uppercase tracking-wide px-8 py-4 rounded-xl shadow-[0_4px_0_0_#9a3412] hover:brightness-105 active:translate-y-1 active:shadow-none transition-all duration-100 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Flame className="w-5 h-5 fill-current" /> Play Digital Game
          </button>
        </div>
      </section>

      {/* Caps Arena - Orange & Purple Caps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Orange Cap Card */}
        <div className="bg-[#161D2F] border border-slate-700 border-l-4 border-l-orange-500 text-slate-200 rounded-2xl p-6 shadow-md relative overflow-hidden group">
          <div className="absolute right-[-10px] bottom-[-10px] opacity-5 text-orange-500 transform group-hover:scale-110 transition-transform duration-500">
            <Trophy className="w-40 h-40" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-center">
              <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1 rounded text-xs font-mono font-bold tracking-widest uppercase">
                Orange Cap
              </span>
              <Award className="w-6 h-6 text-orange-400 fill-orange-400/20" />
            </div>
            {orangeCapWinner ? (
              <div className="space-y-1">
                <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Leading Run Scorer</p>
                <div className="flex items-center gap-3 py-1">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-600 bg-slate-800 flex items-center justify-center flex-shrink-0">
                    {playerProfiles[orangeCapWinner.name.toLowerCase()] ? (
                      <img 
                        src={playerProfiles[orangeCapWinner.name.toLowerCase()]} 
                        alt={orangeCapWinner.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${getGradientByName(orangeCapWinner.name)} flex items-center justify-center text-white text-sm font-bold font-display uppercase`}>
                        {orangeCapWinner.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <h3 className="font-display font-black text-3xl text-white tracking-tight">
                    {orangeCapWinner.name}
                  </h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display font-black text-5xl text-orange-400">{orangeCapWinner.runsScored}</span>
                  <span className="text-sm font-semibold text-slate-400">Runs</span>
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  Scored across {orangeCapWinner.matchesPlayed} match(es) played at school.
                </p>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-sm">
                No official runs registered yet. Add school matches to trigger cap nominations!
              </div>
            )}
          </div>
        </div>

        {/* Purple Cap Card */}
        <div className="bg-[#161D2F] border border-slate-700 border-l-4 border-l-purple-500 text-slate-200 rounded-2xl p-6 shadow-md relative overflow-hidden group">
          <div className="absolute right-[-10px] bottom-[-10px] opacity-5 text-purple-500 transform group-hover:scale-110 transition-transform duration-500">
            <Shield className="w-40 h-40" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-center">
              <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-3 py-1 rounded text-xs font-mono font-bold tracking-widest uppercase">
                Purple Cap
              </span>
              <Award className="w-6 h-6 text-purple-400 fill-purple-400/20" />
            </div>
            {purpleCapWinner ? (
              <div className="space-y-1">
                <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Most Restrictive Bowler</p>
                <div className="flex items-center gap-3 py-1">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-600 bg-slate-800 flex items-center justify-center flex-shrink-0">
                    {playerProfiles[purpleCapWinner.name.toLowerCase()] ? (
                      <img 
                        src={playerProfiles[purpleCapWinner.name.toLowerCase()]} 
                        alt={purpleCapWinner.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${getGradientByName(purpleCapWinner.name)} flex items-center justify-center text-white text-sm font-bold font-display uppercase`}>
                        {purpleCapWinner.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <h3 className="font-display font-black text-3xl text-white tracking-tight">
                    {purpleCapWinner.name}
                  </h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display font-black text-5xl text-purple-400">
                    {purpleCapWinner.runsConceded}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">Runs Conceded</span>
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  An average of {(purpleCapWinner.runsConceded / purpleCapWinner.matchesPlayed).toFixed(1)} runs conceded per match across {purpleCapWinner.matchesPlayed} match(es).
                </p>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-sm">
                No bowling stats registered yet. Add matches to claim the Purple Cap!
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* League Standing Table - 8 cols */}
        <div className="lg:col-span-8 bg-[#161D2F] border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-orange-400" />
              <h3 className="font-display font-bold text-lg text-slate-100 uppercase tracking-tight">Official League Standings</h3>
            </div>
            <span className="text-[10px] font-mono text-orange-400 uppercase font-bold bg-[#1A2238] px-2 py-1 rounded border border-slate-700">
              Schoolyard 1v1 HCL
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-[10px] md:text-xs font-mono font-bold text-slate-400 bg-[#1A2238]">
                  <th className="py-3 px-2 text-center w-12 border-r border-slate-700">Pos</th>
                  <th className="py-3 px-3">Player</th>
                  <th className="py-3 px-2 text-center w-16">Played</th>
                  <th className="py-3 px-2 text-center w-12">W</th>
                  <th className="py-3 px-2 text-center w-12">L</th>
                  <th className="py-3 px-2 text-center w-20">Runs Scored</th>
                  <th className="py-3 px-2 text-center w-20">Runs Conc.</th>
                  <th className="py-3 px-2 text-center w-20">Run Rate</th>
                  <th className="py-3 px-3 text-center w-16 bg-orange-500/10 text-orange-400 border-l border-slate-700">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs md:text-sm">
                {sortedStandings.map((standing, index) => (
                  <tr key={standing.name} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-2 text-center font-display font-bold text-slate-400 border-r border-slate-700">
                      {index + 1}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center flex-shrink-0">
                            {playerProfiles[standing.name.toLowerCase()] ? (
                              <img 
                                src={playerProfiles[standing.name.toLowerCase()]} 
                                alt={standing.name} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${getGradientByName(standing.name)} flex items-center justify-center text-white text-xs font-bold font-display uppercase`}>
                                {standing.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <span>{standing.name}</span>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleStartEditPhoto(standing.name)}
                            className="p-1 hover:bg-slate-700/50 rounded-md text-slate-400 hover:text-orange-400 transition-colors cursor-pointer"
                            title="Set Profile Photo"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center text-slate-400 font-mono">
                      {standing.matchesPlayed}
                    </td>
                    <td className="py-3 px-2 text-center font-semibold text-green-400 font-mono">
                      {standing.won}
                    </td>
                    <td className="py-3 px-2 text-center font-semibold text-red-400 font-mono">
                      {standing.lost}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-300">
                      {standing.runsScored}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-400">
                      {standing.runsConceded}
                    </td>
                    <td className={`py-3 px-2 text-center font-mono font-bold ${
                      standing.runRate > 0 
                        ? 'text-green-400' 
                        : standing.runRate < 0 
                          ? 'text-red-400' 
                          : 'text-slate-400'
                    }`}>
                      {standing.runRate > 0 ? `+${standing.runRate}` : standing.runRate}
                    </td>
                    <td className="py-3 px-3 text-center font-display font-black bg-orange-500/5 text-orange-400 text-sm font-mono border-l border-slate-700">
                      {standing.points}
                    </td>
                  </tr>
                ))}
                {sortedStandings.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-sm">
                      No matching records found. Create an Admin profile or log in to register official matches!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Container - 4 cols */}
        <div className="lg:col-span-4 space-y-6">
          {/* Profile Card / Customize Arena Preferences */}
          <div className="bg-[#161D2F] border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-orange-400" />
                <h3 className="font-display font-bold text-lg text-slate-100 uppercase tracking-tight">My HCL Profile</h3>
              </div>
              {!isEditing && userProfile && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              )}
            </div>

            <div className="space-y-4">
              {isEditing ? (
                <div className="space-y-4 text-xs">
                  {/* Display Name */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-400 block">Player Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-[#1A2238] border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                      placeholder="E.g. Pranshul"
                    />
                  </div>

                  {/* Batting Stance */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-400 block">Batting Stance</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBattingStyle('Right-handed')}
                        className={`px-3 py-2 rounded-lg text-center font-medium border transition-colors cursor-pointer ${
                          battingStyle === 'Right-handed'
                            ? 'bg-orange-500/15 border-orange-500 text-orange-400 font-bold'
                            : 'bg-[#1A2238] border-slate-700 text-slate-400'
                        }`}
                      >
                        Right-handed
                      </button>
                      <button
                        type="button"
                        onClick={() => setBattingStyle('Left-handed')}
                        className={`px-3 py-2 rounded-lg text-center font-medium border transition-colors cursor-pointer ${
                          battingStyle === 'Left-handed'
                            ? 'bg-orange-500/15 border-orange-500 text-orange-400 font-bold'
                            : 'bg-[#1A2238] border-slate-700 text-slate-400'
                        }`}
                      >
                        Left-handed
                      </button>
                    </div>
                  </div>

                  {/* Favorite Number */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-400 block">Favorite Number (1-6)</label>
                    <div className="grid grid-cols-6 gap-1 font-mono">
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setFavoriteNumber(num)}
                          className={`py-2 rounded-lg text-center font-bold border transition-colors cursor-pointer ${
                            favoriteNumber === num
                              ? 'bg-orange-500/15 border-orange-500 text-orange-400 text-sm'
                              : 'bg-[#1A2238] border-slate-700 text-slate-400'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Save controls */}
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isSaving || !displayName.trim()}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-[0_3px_0_0_#9a3412] active:translate-y-0.5 active:shadow-none transition-all duration-100 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-full flex items-center justify-center font-display font-black text-2xl uppercase tracking-tighter shadow-md">
                      {userProfile?.displayName ? userProfile.displayName.charAt(0) : 'P'}
                    </div>
                    <div>
                      <h4 className="font-display font-black text-lg text-slate-200 leading-tight">
                        {userProfile?.displayName || 'Guest Player'}
                      </h4>
                      <span className="inline-block bg-orange-500/15 text-orange-400 border border-orange-500/20 font-mono font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded mt-1">
                        {userProfile?.role || 'Guest'}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800 text-xs pt-2">
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Batting Stance</span>
                      <span className="font-bold text-slate-200">{userProfile?.battingStyle || 'Right-handed'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Favorite Hand Gesture</span>
                      <span className="font-mono font-bold text-orange-400 text-xs bg-[#1A2238] border border-slate-700 px-2 py-0.5 rounded">
                        {userProfile?.favoriteNumber || 6} (Thumb)
                      </span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Join Date</span>
                      <span className="text-slate-400 font-mono">
                        {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'Today'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Admin: Manage Player Photos */}
          {isAdmin && (
            <div id="admin-photos-panel" className="bg-[#161D2F] border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Shield className="w-5 h-5 text-red-400" />
                <h3 className="font-display font-bold text-base text-slate-100 uppercase tracking-tight">Admin: Player Photos</h3>
              </div>
              
              <form onSubmit={handleSavePlayerPhoto} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 block">Select Player</label>
                  <select
                    value={selectedPlayerForPhoto}
                    onChange={(e) => {
                      setSelectedPlayerForPhoto(e.target.value);
                      if (e.target.value && e.target.value !== 'new_custom') {
                        setCustomPlayerPhotoURL(playerProfiles[e.target.value.toLowerCase()] || '');
                      } else {
                        setCustomPlayerPhotoURL('');
                      }
                    }}
                    className="w-full bg-[#1A2238] border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">-- Choose existing player --</option>
                    {playersArray.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                    <option value="new_custom">-- Add a new player name --</option>
                  </select>
                </div>

                {selectedPlayerForPhoto === 'new_custom' && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-400 block">New Player Name</label>
                    <input
                      type="text"
                      value={customPlayerName}
                      onChange={(e) => setCustomPlayerName(e.target.value)}
                      placeholder="E.g. Sachin"
                      className="w-full bg-[#1A2238] border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="font-bold text-slate-400 block">Choose Avatar Preset</label>
                  <div className="grid grid-cols-4 gap-2">
                    {AVATAR_PRESETS.map((avatar) => (
                      <button
                        key={avatar.name}
                        type="button"
                        onClick={() => setCustomPlayerPhotoURL(avatar.url)}
                        className={`relative w-10 h-10 rounded-full overflow-hidden border-2 transition-all hover:scale-105 cursor-pointer ${
                          customPlayerPhotoURL === avatar.url ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-slate-700'
                        }`}
                        title={avatar.name}
                      >
                        <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-400 block">Or Custom Image URL</label>
                  <input
                    type="url"
                    value={customPlayerPhotoURL}
                    onChange={(e) => setCustomPlayerPhotoURL(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-[#1A2238] border border-slate-700 px-3 py-2 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>

                {customPlayerPhotoURL && (
                  <div className="flex items-center gap-3 bg-[#1A2238] p-2 rounded-xl border border-slate-700">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-600 flex-shrink-0">
                      <img src={customPlayerPhotoURL} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono truncate">Avatar Preview</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSavingPhoto || (!selectedPlayerForPhoto) || (selectedPlayerForPhoto === 'new_custom' && !customPlayerName.trim())}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-[0_3px_0_0_#9a3412] active:translate-y-0.5 active:shadow-none transition-all duration-100 disabled:opacity-50 cursor-pointer text-xs uppercase"
                >
                  <Save className="w-4 h-4" />
                  {isSavingPhoto ? 'Saving Photo...' : 'Apply Photo'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
