import React, { useState, useEffect } from 'react';
import { Award, Shield, User, Edit3, Save, Flame, Trophy, TrendingUp, Sparkles, Upload, Target, Activity, BarChart2 } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
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
  const [fullProfiles, setFullProfiles] = useState<Record<string, { name: string; photoURL?: string; pin: string }>>({});
  const [isProfilesLoaded, setIsProfilesLoaded] = useState(false);
  const [customPlayerPin, setCustomPlayerPin] = useState('');
  const [selectedPlayerForPhoto, setSelectedPlayerForPhoto] = useState('');
  const [customPlayerName, setCustomPlayerName] = useState('');
  const [customPlayerPhotoURL, setCustomPlayerPhotoURL] = useState('');
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedScenarioPlayer, setSelectedScenarioPlayer] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file.');
      return;
    }

    setUploadError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 160;
        const MAX_HEIGHT = 160;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCustomPlayerPhotoURL(dataUrl);
        }
      };
      img.onerror = () => {
        setUploadError('Failed to load image.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Detect isAdmin
  const isAdmin = 
    auth.currentUser?.email === 'pranshul1045@gmail.com' || 
    auth.currentUser?.email === 'pranshul1045@gamil.com' || 
    auth.currentUser?.uid === 'admin_local' || 
    userProfile?.role === 'admin';

  useEffect(() => {
    // Real-time subscribe to custom player profiles
    const unsub = onSnapshot(collection(db, 'playerProfiles'), (snapshot) => {
      const photoMap: Record<string, string> = {};
      const fullMap: Record<string, { name: string; photoURL?: string; pin: string }> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        if (data.photoURL) {
          photoMap[id] = data.photoURL;
        }
        fullMap[id] = {
          name: data.name || id,
          photoURL: data.photoURL || '',
          pin: data.pin || ''
        };
      });
      setPlayerProfiles(photoMap);
      setFullProfiles(fullMap);
      setIsProfilesLoaded(true);
    }, (err) => {
      console.error("Error loading player profiles:", err);
      handleFirestoreError(err, OperationType.LIST, 'playerProfiles');
    });
    return () => unsub();
  }, []);

  // Sync moved below

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
      const finalPin = 'password';

      await setDoc(doc(db, 'playerProfiles', docId), {
        name: targetName,
        photoURL: customPlayerPhotoURL.trim(),
        pin: finalPin,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      if (selectedPlayerForPhoto === 'new_custom') {
        setCustomPlayerName('');
      }
      setSelectedPlayerForPhoto('');
      setCustomPlayerPhotoURL('');
      setCustomPlayerPin('');
      alert(`Success! Updated profile for ${targetName}`);
    } catch (err) {
      console.error("Error saving player profile:", err);
      alert("Failed to save player profile. Please try again.");
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const handleStartEditPhoto = (name: string) => {
    const docId = name.toLowerCase();
    setSelectedPlayerForPhoto(name);
    setCustomPlayerPhotoURL(playerProfiles[docId] || '');
    setCustomPlayerPin(fullProfiles[docId]?.pin || '');
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

  // Compute stats dynamically from school matches for real-time Orange & Purple bands!
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

  // Orange Band (Most Runs Scored)
  const orangeBandWinner = [...playersArray].sort((a, b) => b.runsScored - a.runsScored)[0] || null;

  // Purple Band (Lowest Total Runs Conceded, minimum 1 match played)
  const purpleBandWinner = [...playersArray]
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

  // Calculate playoff race parameters dynamically based on Double Round-Robin (2 matches with same team)
  // Each team plays exactly 2 matches against each other opponent.
  const targetMatches = sortedStandings.length > 1 ? (sortedStandings.length - 1) * 2 : 10;

  const getPlayoffStatus = (player: any, index: number) => {
    if (sortedStandings.length <= 4) {
      return player.matchesPlayed > 0 ? 'Qualified' : 'In Contention';
    }
    
    // 7 wins mathematically guarantees full qualification
    if (player.won >= 7) {
      return 'Qualified';
    }
    
    const fourthPlacePoints = sortedStandings[3]?.points || 0;
    
    // Find max possible points of anyone currently in 5th place or below
    const lowerBracketPlayers = sortedStandings.slice(4);
    const maxPossiblePointsForLowerBracket = lowerBracketPlayers.length > 0
      ? Math.max(...lowerBracketPlayers.map(p => p.points + Math.max(0, targetMatches - p.matchesPlayed) * 2))
      : 0;
      
    const remMatches = Math.max(0, targetMatches - player.matchesPlayed);
    const playerMaxPts = player.points + remMatches * 2;
    const playerMinPts = player.points;
    
    if (playerMaxPts < fourthPlacePoints) {
      return 'Eliminated';
    } else if (playerMinPts > maxPossiblePointsForLowerBracket && index < 4) {
      return 'Qualified';
    } else {
      return 'In Contention';
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const isPlayerLogin = userProfile?.uid && userProfile.uid.startsWith('player_');
      const isGuestLogin = !auth.currentUser || auth.currentUser.uid === 'guest_local' || userProfile?.uid === 'guest_local';

      if (isPlayerLogin) {
        // Logged in as Player via Name & PIN
        const docId = userProfile.uid.replace('player_', '').toLowerCase();
        
        // 1. Update Firestore playerProfile
        await setDoc(doc(db, 'playerProfiles', docId), {
          name: displayName.trim(),
          battingStyle,
          favoriteNumber,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // 2. Update local state & storage
        const updatedProfile: UserProfile = {
          ...userProfile,
          displayName: displayName.trim(),
          battingStyle,
          favoriteNumber
        };
        localStorage.setItem('hcl_local_guest_profile', JSON.stringify(updatedProfile));
        if (onUpdateProfile) {
          onUpdateProfile(updatedProfile);
        }
        setIsEditing(false);
      } else if (isGuestLogin) {
        // Guest login
        const updatedProfile: UserProfile = {
          uid: userProfile?.uid || 'guest_local',
          displayName: displayName.trim(),
          role: userProfile?.role || 'user',
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
        // Authenticated admin / user via real firebase auth
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

  // Background sync: Ensure all active standings players have a PIN generated in DB
  useEffect(() => {
    if (!isProfilesLoaded || sortedStandings.length === 0) return;
    
    const initializeMissingProfiles = async () => {
      for (const p of sortedStandings) {
        const docId = p.name.toLowerCase();
        const profile = fullProfiles[docId];
        if (!profile || !profile.pin) {
          try {
            // We omit photoURL to guarantee that auto-pin initialization NEVER overwrites or clears existing pictures!
            await setDoc(doc(db, 'playerProfiles', docId), {
              name: p.name,
              pin: 'password',
              updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log(`Initialized PIN for ${p.name}: password`);
          } catch (err) {
            console.error(`Error initializing PIN for ${p.name}:`, err);
          }
        }
      }
    };

    initializeMissingProfiles();
  }, [isProfilesLoaded, sortedStandings, fullProfiles]);

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
              Welcome back, <span className="font-bold text-orange-400">{userProfile?.displayName || 'Player'}</span>! Track your schoolyard runs, view dynamic band tables, and play the digital arena game.
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

      {/* Bands Arena - Orange & Purple Bands */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Orange Band Card */}
        <div className="bg-[#161D2F] border border-slate-700 border-l-4 border-l-orange-500 text-slate-200 rounded-2xl p-6 shadow-md relative overflow-hidden group">
          <div className="absolute right-[-10px] bottom-[-10px] opacity-5 text-orange-500 transform group-hover:scale-110 transition-transform duration-500">
            <Trophy className="w-40 h-40" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-center">
              <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1 rounded text-xs font-mono font-bold tracking-widest uppercase">
                Orange Band
              </span>
              <Award className="w-6 h-6 text-orange-400 fill-orange-400/20" />
            </div>
            {orangeBandWinner ? (
              <div className="space-y-1">
                <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Leading Run Scorer</p>
                <div className="flex items-center gap-3 py-1">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-600 bg-slate-800 flex items-center justify-center flex-shrink-0">
                    {playerProfiles[orangeBandWinner.name.toLowerCase()] ? (
                      <img 
                        src={playerProfiles[orangeBandWinner.name.toLowerCase()]} 
                        alt={orangeBandWinner.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${getGradientByName(orangeBandWinner.name)} flex items-center justify-center text-white text-sm font-bold font-display uppercase`}>
                        {orangeBandWinner.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <h3 className="font-display font-black text-3xl text-white tracking-tight">
                    {orangeBandWinner.name}
                  </h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display font-black text-5xl text-orange-400">{orangeBandWinner.runsScored}</span>
                  <span className="text-sm font-semibold text-slate-400">Runs</span>
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  Scored across {orangeBandWinner.matchesPlayed} match(es) played at school.
                </p>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-sm">
                No official runs registered yet. Add school matches to trigger band nominations!
              </div>
            )}
          </div>
        </div>

        {/* Purple Band Card */}
        <div className="bg-[#161D2F] border border-slate-700 border-l-4 border-l-purple-500 text-slate-200 rounded-2xl p-6 shadow-md relative overflow-hidden group">
          <div className="absolute right-[-10px] bottom-[-10px] opacity-5 text-purple-500 transform group-hover:scale-110 transition-transform duration-500">
            <Shield className="w-40 h-40" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-center">
              <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-3 py-1 rounded text-xs font-mono font-bold tracking-widest uppercase">
                Purple Band
              </span>
              <Award className="w-6 h-6 text-purple-400 fill-purple-400/20" />
            </div>
            {purpleBandWinner ? (
              <div className="space-y-1">
                <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Most Restrictive Bowler</p>
                <div className="flex items-center gap-3 py-1">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-600 bg-slate-800 flex items-center justify-center flex-shrink-0">
                    {playerProfiles[purpleBandWinner.name.toLowerCase()] ? (
                      <img 
                        src={playerProfiles[purpleBandWinner.name.toLowerCase()]} 
                        alt={purpleBandWinner.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${getGradientByName(purpleBandWinner.name)} flex items-center justify-center text-white text-sm font-bold font-display uppercase`}>
                        {purpleBandWinner.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <h3 className="font-display font-black text-3xl text-white tracking-tight">
                    {purpleBandWinner.name}
                  </h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display font-black text-5xl text-purple-400">
                    {purpleBandWinner.runsConceded}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">Runs Conceded</span>
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  An average of {(purpleBandWinner.runsConceded / purpleBandWinner.matchesPlayed).toFixed(1)} runs conceded per match across {purpleBandWinner.matchesPlayed} match(es).
                </p>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-sm">
                No bowling stats registered yet. Add matches to claim the Purple Band!
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
                  <th className="py-3 px-2 text-center w-28 border-l border-r border-slate-700">Playoff Status</th>
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
                    <td className="py-2.5 px-2 text-center border-l border-r border-slate-800/50 bg-[#1A2238]/20">
                      {(() => {
                        const status = getPlayoffStatus(standing, index);
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wide border ${
                            status === 'Qualified'
                              ? 'bg-green-500/10 text-green-400 border-green-500/25'
                              : status === 'Eliminated'
                              ? 'bg-red-500/10 text-red-400 border-red-500/25'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/25'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              status === 'Qualified'
                                ? 'bg-green-400 animate-pulse'
                                : status === 'Eliminated'
                                ? 'bg-red-400'
                                : 'bg-blue-400'
                            }`}></span>
                            {status === 'Qualified' ? 'QUALIFIED' : status === 'Eliminated' ? 'ELIMINATED' : 'CONTENDING'}
                          </span>
                        );
                      })()}
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
                    <td colSpan={10} className="py-8 text-center text-slate-400 text-sm">
                      No matching records found. Create an Admin profile or log in to register official matches!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Interactive Playoff Qualification Scenario Panel */}
          <div className="bg-[#1A2238] border border-slate-700/60 rounded-xl p-4 mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4.5 h-4.5 text-orange-400" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Playoff Qualification Scenarios (Top 4 Semis)
              </h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {sortedStandings.length <= 4 ? (
                <span>
                  Currently, there are only <strong className="text-orange-400">{sortedStandings.length}</strong> active player(s) in the league. Since 4 players are needed to populate the Semifinal bracket, <strong>all registered players will qualify</strong> for the playoffs automatically! Add more players to spark a fierce qualification battle.
                </span>
              ) : (
                <span>
                  The <strong>Top 4 players</strong> in the standings qualify for the <strong>Semifinals (SF 1 & SF 2)</strong>. Under the double round-robin format, <strong>each team plays exactly 2 matches against the same opponent</strong>, making the group stage target <strong className="text-orange-400">{targetMatches}</strong> matches per player. Specifically, reaching <strong>7 wins will fully qualify</strong> a player for the playoffs automatically! See individual qualification scenarios below:
                </span>
              )}
            </p>
            {sortedStandings.length > 4 && (
              <div className="space-y-3 pt-1">
                <p className="text-[11px] text-slate-400 font-mono italic">
                  💡 Click on any player below to view their detailed double round-robin schedule and mathematical qualification scenarios:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                  {sortedStandings.map((p, idx) => {
                    const status = getPlayoffStatus(p, idx);
                    const rem = Math.max(0, targetMatches - p.matchesPlayed);
                    const fourthPlaceName = sortedStandings[3]?.name || '4th place';
                    const fourthPlacePts = sortedStandings[3]?.points || 0;
                    
                    // Math projections
                    const maxPts = p.points + rem * 2;
                    const minPts = p.points;
                    
                    // Teams strictly better than our max possible (we cannot beat them)
                    const strictlyBetterCount = sortedStandings.filter(other => other.name !== p.name && other.points > maxPts).length;
                    const highestRank = strictlyBetterCount + 1;
                    
                    // Teams that can potentially finish above or equal to us (if they win all games)
                    const potentialBetterCount = sortedStandings.filter(other => {
                      if (other.name === p.name) return false;
                      const otherRem = Math.max(0, targetMatches - other.matchesPlayed);
                      const otherMax = other.points + otherRem * 2;
                      return otherMax >= p.points;
                    }).length;
                    const lowestRank = Math.min(sortedStandings.length, potentialBetterCount + 1);

                    // Calculations for guaranteed qualification points
                    const fifthPlacePlayer = sortedStandings[4];
                    const fifthPlaceMaxPotential = fifthPlacePlayer 
                      ? (fifthPlacePlayer.points + Math.max(0, targetMatches - fifthPlacePlayer.matchesPlayed) * 2)
                      : 0;
                    const ptsToGuarantee = fifthPlaceMaxPotential + 1;
                    const ptsNeeded = Math.max(0, ptsToGuarantee - p.points);
                    const winsNeeded = Math.ceil(ptsNeeded / 2);

                    const isExpanded = selectedScenarioPlayer === p.name;

                    // Opponents tracking for double round-robin (each must be played twice)
                    const opponentsBreakdown = sortedStandings
                      .filter(other => other.name !== p.name)
                      .map(opp => {
                        const matchesAgainstOpp = schoolMatches.filter(m => 
                          m.status === 'completed' &&
                          ((m.player1 === p.name && m.player2 === opp.name) || (m.player1 === opp.name && m.player2 === p.name))
                        );
                        const played = matchesAgainstOpp.length;
                        const remaining = Math.max(0, 2 - played);
                        const results = matchesAgainstOpp.map(m => {
                          const isP1 = m.player1 === p.name;
                          if (m.winner === 'tie' || m.winner === 'draw' || !m.winner) return 'D';
                          if (m.winner === (isP1 ? 'player1' : 'player2') || m.winner === p.name) return 'W';
                          return 'L';
                        });
                        return {
                          opponentName: opp.name,
                          played,
                          remaining,
                          results
                        };
                      });

                    return (
                      <div 
                        key={p.name} 
                        onClick={() => setSelectedScenarioPlayer(isExpanded ? null : p.name)}
                        className={`bg-[#161D2F] border rounded-lg p-3 flex flex-col gap-2 hover:border-slate-600 transition-all cursor-pointer ${
                          isExpanded ? 'border-orange-500/80 ring-1 ring-orange-500/20' : 'border-slate-800'
                        }`}
                      >
                        {/* Header Row */}
                        <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-bold bg-slate-800 px-1.5 py-0.5 rounded">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-slate-200">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                              status === 'Qualified'
                                ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                                : status === 'Eliminated'
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            }`}>
                              {status === 'Qualified' ? 'QUALIFIED' : status === 'Eliminated' ? 'ELIMINATED' : 'CONTENDING'}
                            </span>
                            <span className="text-slate-500 hover:text-slate-300">
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          </div>
                        </div>

                        {/* Collapsed / Basic view */}
                        <div className="grid grid-cols-3 text-center text-[10px] py-1">
                          <div className="border-r border-slate-800/60">
                            <span className="text-slate-500 block">Progress</span>
                            <span className="font-bold text-slate-300">{p.matchesPlayed}/{targetMatches} games</span>
                          </div>
                          <div className="border-r border-slate-800/60">
                            <span className="text-slate-500 block">Current Pts</span>
                            <span className="font-bold text-orange-400">{p.points}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Net RR</span>
                            <span className="font-bold text-slate-300">{p.runRate > 0 ? `+${p.runRate}` : p.runRate}</span>
                          </div>
                        </div>

                        {/* Expanded Deep Analysis */}
                        {isExpanded && (
                          <div className="border-t border-slate-800/80 pt-2.5 mt-1 space-y-3 text-[10.5px]" onClick={(e) => e.stopPropagation()}>
                            {/* Point Potential Slider */}
                            <div className="space-y-1 bg-[#1A2238]/40 p-2 rounded border border-slate-800/50">
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Points Potential Range</span>
                                <span className="font-bold text-slate-300">{minPts} to {maxPts} Pts</span>
                              </div>
                              <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                {/* Current Points percentage (of maximum possible league points) */}
                                <div 
                                  className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-l-full"
                                  style={{ width: `${Math.min(100, (p.points / (targetMatches * 2)) * 100)}%` }}
                                ></div>
                                {/* Potential Points percentage */}
                                <div 
                                  className="bg-blue-500/40 h-full border-l border-dashed border-slate-600"
                                  style={{ width: `${Math.min(100, ((rem * 2) / (targetMatches * 2)) * 100)}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between text-[8px] text-slate-500 pt-0.5">
                                <span>Current: {minPts} Pts</span>
                                <span className="text-blue-400">Max Possible: {maxPts} Pts</span>
                              </div>
                            </div>

                            {/* Rank Finish Projections */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-slate-900/60 p-2 rounded border border-slate-800/50 text-center">
                                <span className="text-[9px] text-slate-500 uppercase block font-bold tracking-wider">Best Possible Rank</span>
                                <span className="text-xs font-extrabold text-green-400">Rank #{highestRank}</span>
                              </div>
                              <div className="bg-slate-900/60 p-2 rounded border border-slate-800/50 text-center">
                                <span className="text-[9px] text-slate-500 uppercase block font-bold tracking-wider">Worst Possible Rank</span>
                                <span className="text-xs font-extrabold text-red-400">Rank #{lowestRank}</span>
                              </div>
                            </div>

                            {/* Double Round-Robin Schedule Status */}
                            <div className="space-y-1.5">
                              <h5 className="text-[9px] text-orange-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                                <Activity className="w-3 h-3" /> Opponent Head-to-Head Tracker (Double RR)
                              </h5>
                              <div className="space-y-1">
                                {opponentsBreakdown.map(opp => (
                                  <div key={opp.opponentName} className="flex justify-between items-center bg-slate-900/30 px-2 py-1.5 rounded border border-slate-800/30">
                                    <span className="text-slate-300 font-medium">{opp.opponentName}</span>
                                    <div className="flex items-center gap-2">
                                      <div className="flex gap-1">
                                        {[0, 1].map(mIdx => {
                                          const result = opp.results[mIdx];
                                          const hasPlayed = mIdx < opp.played;
                                          return (
                                            <span 
                                              key={mIdx} 
                                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border ${
                                                hasPlayed
                                                  ? result === 'W'
                                                    ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                                    : result === 'L'
                                                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                                                  : 'bg-slate-800/40 text-slate-600 border-slate-700/50'
                                              }`}
                                              title={hasPlayed ? `Match ${mIdx + 1}: ${result}` : `Match ${mIdx + 1}: Remaining`}
                                            >
                                              {hasPlayed ? result : '•'}
                                            </span>
                                          );
                                        })}
                                      </div>
                                      <span className={`text-[8px] font-bold ${opp.remaining === 0 ? 'text-green-400' : 'text-slate-500'}`}>
                                        {opp.remaining === 0 ? 'COMPLETED' : `${opp.remaining} REMAINING`}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Custom Playoff Scenario Advice */}
                            <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800/80 text-[10px] text-slate-300 leading-relaxed space-y-1">
                              <span className="font-extrabold text-orange-400 block uppercase tracking-wider text-[8px]">
                                Playoff Mathematics & Road to Semifinals
                              </span>
                              {status === 'Qualified' ? (
                                <span>
                                  🏆 <strong>Playoff Spot Locked!</strong> {p.name} has mathematically guaranteed a spot in the Top 4 Semifinals. Remaining matches will determine final seeding positions (#1 to #{lowestRank}).
                                </span>
                              ) : status === 'Eliminated' ? (
                                <span>
                                  ❌ <strong>Out of Contention:</strong> Even if {p.name} wins all {rem} remaining match{rem !== 1 ? 'es' : ''}, they can at best reach {maxPts} points, which is less than 4th place's current score of {fourthPlacePts} pts.
                                </span>
                              ) : (
                                <div className="space-y-1.5">
                                  <div>
                                    {idx >= 4 ? (
                                      <span>
                                        🎯 <strong>Chasing the Top 4:</strong> Currently in Rank #{idx + 1}. Needs to gain at least <strong>{fourthPlacePts - p.points + 1} more points</strong> to leapfrog {fourthPlaceName} for the final playoff spot.
                                      </span>
                                    ) : (
                                      <span>
                                        🛡️ <strong>Defending Playoff Berth:</strong> Currently in Rank #{idx + 1} and inside the qualifying bracket. Must protect this spot from {sortedStandings[4]?.name || 'chasing players'} who are hunting from below.
                                      </span>
                                    )}
                                  </div>
                                  <div className="border-t border-slate-800/50 pt-1 text-[9.5px]">
                                    {ptsNeeded <= 0 ? (
                                      <span className="text-green-400">
                                        ⚡ Highly likely to qualify! A single draw or favorable outcome seals the deal.
                                      </span>
                                    ) : ptsNeeded > rem * 2 ? (
                                      <span className="text-amber-400 font-bold">
                                        ⚠️ Needs Help: Even winning every remaining game leaves {p.name} at {maxPts} points. They need chasing teams to drop matches to sneak in.
                                      </span>
                                    ) : (
                                      <span>
                                        🔑 <strong>Self-Determination:</strong> Needs at least <strong className="text-orange-400">{ptsNeeded} points ({winsNeeded} win{winsNeeded !== 1 ? 's' : ''})</strong> from {rem} remaining game{rem !== 1 ? 's' : ''} to mathematically secure a Top 4 spot. Alternatively, reaching <strong>7 wins</strong> total (needs <strong>{Math.max(0, 7 - p.won)}</strong> more win{Math.max(0, 7 - p.won) !== 1 ? 's' : ''}) will fully qualify {p.name} automatically!
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                    {(() => {
                      const docId = userProfile?.uid?.startsWith('player_') 
                        ? userProfile.uid.replace('player_', '').toLowerCase() 
                        : userProfile?.displayName?.toLowerCase() || '';
                      const photo = playerProfiles[docId];
                      return photo ? (
                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-orange-500 shadow-md flex-shrink-0">
                          <img src={photo} alt={userProfile?.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-full flex items-center justify-center font-display font-black text-2xl uppercase tracking-tighter shadow-md flex-shrink-0">
                          {userProfile?.displayName ? userProfile.displayName.charAt(0) : 'P'}
                        </div>
                      );
                    })()}
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

          {/* Admin: Manage Player Profiles & PINs */}
          {isAdmin && (
            <div id="admin-photos-panel" className="bg-[#161D2F] border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-400" />
                  <h3 className="font-display font-bold text-base text-slate-100 uppercase tracking-tight">Admin: Player Profiles & PINs Directory</h3>
                </div>
                <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded font-bold font-mono">
                  ADMIN ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Column 1: Player Directory List */}
                <div className="space-y-3 bg-[#111625] p-4 rounded-xl border border-slate-800 text-xs">
                  <h4 className="font-display font-bold text-xs text-slate-300 uppercase tracking-wider mb-2">Registered Player Directory</h4>
                  <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {(Object.values(fullProfiles) as Array<{ name: string; photoURL?: string; pin: string }>).length === 0 ? (
                      <p className="text-slate-500 italic text-xs py-4 text-center">No registered players yet.</p>
                    ) : (
                      (Object.values(fullProfiles) as Array<{ name: string; photoURL?: string; pin: string }>)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((profile) => {
                          const docId = profile.name.toLowerCase();
                          return (
                            <div key={docId} className="flex items-center justify-between p-2.5 bg-[#161D2F] rounded-lg border border-slate-700/60 hover:border-slate-600 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-600 flex-shrink-0 bg-slate-800">
                                  {profile.photoURL ? (
                                    <img src={profile.photoURL} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-600 text-white font-bold text-xs">
                                      {profile.name[0]?.toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-xs text-slate-200">{profile.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">ID: {docId}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="bg-slate-800 text-orange-400 border border-slate-700 px-2 py-1 rounded font-mono font-bold text-xs tracking-wider" title="Login PIN">
                                  {profile.pin || '••••'}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPhoto(profile.name)}
                                  className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                  title="Edit Profile"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (window.confirm(`Are you sure you want to reset the password for ${profile.name} to 'password'?`)) {
                                      try {
                                        await setDoc(doc(db, 'playerProfiles', docId), {
                                          name: profile.name,
                                          photoURL: profile.photoURL || '',
                                          pin: 'password',
                                          updatedAt: new Date().toISOString()
                                        }, { merge: true });
                                      } catch (err) {
                                        console.error("Error resetting password:", err);
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                  title="Reset Password to 'password'"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15h-1.562a6 6 0 10-11.83 0H4.21" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Column 2: Edit/Add Form */}
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-xs">
                  <h4 className="font-display font-bold text-xs text-slate-300 uppercase tracking-wider mb-3">Add / Edit Player Profile</h4>
                  
                  <form onSubmit={handleSavePlayerPhoto} className="space-y-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400 block">Select Player</label>
                      <select
                        value={selectedPlayerForPhoto}
                        onChange={(e) => {
                          setSelectedPlayerForPhoto(e.target.value);
                          if (e.target.value && e.target.value !== 'new_custom') {
                            const docId = e.target.value.toLowerCase();
                            setCustomPlayerPhotoURL(playerProfiles[docId] || '');
                            setCustomPlayerPin(fullProfiles[docId]?.pin || '');
                          } else {
                            setCustomPlayerPhotoURL('');
                            setCustomPlayerPin('');
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

                    {/* PIN Input Field */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400 block text-xs">
                        Player Login Password
                      </label>
                      <div className="w-full bg-[#161D2F] border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-400 font-mono tracking-wider">
                        password
                      </div>
                      <span className="text-[10px] text-slate-500 block">The password for all players is fixed to <strong>password</strong>. No custom password creation is required.</span>
                    </div>

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
                      <label className="font-bold text-slate-400 block">Or Upload from Device</label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-20 border border-dashed border-slate-700 rounded-lg cursor-pointer bg-[#1A2238] hover:bg-[#202942] hover:border-slate-600 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-3 pb-3 text-center">
                            <Upload className="w-5 h-5 text-slate-400 mb-1" />
                            <p className="text-[10px] text-slate-400"><span className="font-semibold text-orange-400">Click to upload photo</span></p>
                            <p className="text-[9px] text-slate-500">Auto-compressed for database storage</p>
                          </div>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileUpload} 
                          />
                        </label>
                      </div>
                      {uploadError && (
                        <p className="text-red-400 text-[9px] font-semibold mt-1">{uploadError}</p>
                      )}
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
                      {isSavingPhoto ? 'Saving Profile...' : 'Apply Profile & PIN'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
