import React, { useState, useEffect } from 'react';
import { 
  Trophy, Gamepad2, BookOpen, Sparkles, LogIn, LogOut, 
  User, Loader2, Calendar, ShieldAlert, CheckCircle2, Megaphone
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  onAuthStateChanged, signInAnonymously, signInWithPopup, 
  GoogleAuthProvider, signOut 
} from 'firebase/auth';
import { 
  doc, onSnapshot, setDoc, getDoc, collection, query, orderBy 
} from 'firebase/firestore';
import { UserProfile, SchoolMatch } from './types';

// Importing sub-sections
import DashboardSection from './components/DashboardSection';
import DigitalGameSection from './components/DigitalGameSection';
import LeagueMatchesSection from './components/LeagueMatchesSection';
import RulesSection from './components/RulesSection';
import UpdatesSection from './components/UpdatesSection';

const DEFAULT_DEMO_MATCHES: SchoolMatch[] = [
  {
    id: 'demo_1',
    player1: 'Pranshul',
    player2: 'Rohan',
    player1Runs: 42,
    player2Runs: 36,
    player1Balls: 18,
    player2Balls: 24,
    player1Conceded: 36,
    player2Conceded: 42,
    winner: 'Pranshul',
    status: 'completed',
    date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    creatorId: 'demo',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'demo_2',
    player1: 'Sachin',
    player2: 'Dhoni',
    player1Runs: 56,
    player2Runs: 60,
    player1Balls: 30,
    player2Balls: 28,
    player1Conceded: 60,
    player2Conceded: 56,
    winner: 'Dhoni',
    status: 'completed',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    creatorId: 'demo',
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'demo_3',
    player1: 'Virat',
    player2: 'Rohit',
    player1Runs: 33,
    player2Runs: 33,
    player1Balls: 15,
    player2Balls: 15,
    player1Conceded: 33,
    player2Conceded: 33,
    winner: 'Tie',
    status: 'completed',
    date: new Date().toISOString().split('T')[0],
    creatorId: 'demo',
    createdAt: new Date().toISOString()
  }
];

export default function App() {
  const [user, setUser] = useState<any>(() => {
    const isGuestActive = localStorage.getItem('hcl_local_guest_active') === 'true';
    if (isGuestActive) {
      const stored = localStorage.getItem('hcl_local_guest_profile');
      if (stored) {
        try {
          const profile = JSON.parse(stored);
          return { uid: 'guest_local', isAnonymous: true, displayName: profile.displayName };
        } catch (e) {
          // ignore
        }
      }
    }
    return null;
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const isGuestActive = localStorage.getItem('hcl_local_guest_active') === 'true';
    if (isGuestActive) {
      const stored = localStorage.getItem('hcl_local_guest_profile');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // ignore
        }
      }
    }
    return null;
  });

  const [schoolMatches, setSchoolMatches] = useState<SchoolMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'game' | 'league' | 'rules' | 'updates'>('dashboard');

  // Login states
  const [loginMode, setLoginMode] = useState<'guest' | 'admin'>('guest');
  const [guestName, setGuestName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  // Is super admin check
  const isAdmin = 
    user?.email === 'pranshul1045@gmail.com' || 
    user?.email === 'pranshul1045@gamil.com' || 
    user?.uid === 'admin_local' || 
    userProfile?.role === 'admin';

  // Handle Auth state transitions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Retrieve or create User Profile in Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Listen to User Profile changes in real-time
        const unsubProfile = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile({ uid: currentUser.uid, ...snapshot.data() } as UserProfile);
          } else {
            // Profile doesn't exist, create initial default user profile
            const isSuperAdmin = currentUser.email === 'pranshul1045@gmail.com';
            const initialProfile: Omit<UserProfile, 'uid'> = {
              displayName: currentUser.displayName || guestName || 'HCL Player',
              email: currentUser.email || undefined,
              photoURL: currentUser.photoURL || undefined,
              role: isSuperAdmin ? 'admin' : 'user',
              battingStyle: 'Right-handed',
              favoriteNumber: 6,
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(userDocRef, initialProfile);
            } catch (err) {
              console.error("Error creating default profile in Firestore: ", err);
            }
          }
        }, (error) => {
          console.error("Failed to sync user profile: ", error);
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        });

        setLoading(false);
        return () => {
          unsubProfile();
        };
      } else {
        // If a real Firebase user is null, check if we have an active local guest session
        const isGuestActive = localStorage.getItem('hcl_local_guest_active') === 'true';
        if (isGuestActive) {
          const stored = localStorage.getItem('hcl_local_guest_profile');
          if (stored) {
            try {
              const profile = JSON.parse(stored);
              setUser({ uid: 'guest_local', isAnonymous: true, displayName: profile.displayName });
              setUserProfile(profile);
            } catch (e) {
              // ignore
            }
          }
        } else {
          setUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [guestName]);

  // Always synchronize schoolyard matches in real-time for ALL visitors (guests, signed-in, or anonymous)
  useEffect(() => {
    const matchesQuery = query(
      collection(db, 'schoolMatches'),
      orderBy('createdAt', 'desc')
    );
    const unsubMatches = onSnapshot(matchesQuery, (snapshot) => {
      const matchesList: SchoolMatch[] = [];
      snapshot.forEach((docSnap) => {
        matchesList.push({ id: docSnap.id, ...docSnap.data() } as SchoolMatch);
      });
      setSchoolMatches(matchesList);
    }, (error) => {
      console.error("Failed to query school matches: ", error);
      handleFirestoreError(error, OperationType.LIST, 'schoolMatches');
    });

    return () => unsubMatches();
  }, []);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      localStorage.removeItem('hcl_local_guest_active');
      localStorage.removeItem('hcl_local_guest_profile');
    } catch (err: any) {
      console.error("Google authentication failed:", err);
      
      let message = "Google login failed. Please use 'Quick Start (Guest)' to access instantly!";
      if (err.code === 'auth/unauthorized-domain') {
        message = "This domain (hand-cricket-game-pe56.onrender.com) is not authorized in your Firebase Console. Please add it to your Firebase Auth -> Settings -> Authorized Domains.";
      } else if (err.code === 'auth/popup-blocked') {
        message = "The sign-in popup was blocked by your browser. Please allow popups for this site or try again.";
      } else if (err.message) {
        message = `Google login failed: ${err.message}. You can still play using 'Quick Start (Guest)'.`;
      }
      
      alert(message);
    } finally {
      setSigningIn(false);
    }
  };

  const handleAnonymousLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    setSigningIn(true);
    try {
      await signInAnonymously(auth);
      localStorage.removeItem('hcl_local_guest_active');
      localStorage.removeItem('hcl_local_guest_profile');
    } catch (err) {
      console.warn("Anonymous authentication restricted. Falling back to secure Local Guest session...", err);
      
      // Fallback to local guest persistence
      const initialProfile: UserProfile = {
        uid: 'guest_local',
        displayName: guestName.trim(),
        role: 'user', // Guest is a general viewer, not an administrator
        battingStyle: 'Right-handed',
        favoriteNumber: 6,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('hcl_local_guest_active', 'true');
      localStorage.setItem('hcl_local_guest_profile', JSON.stringify(initialProfile));
      
      setUser({ uid: 'guest_local', isAnonymous: true, displayName: guestName.trim() });
      setUserProfile(initialProfile);
    } finally {
      setSigningIn(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setSigningIn(true);
    const username = adminUsername.trim();
    const password = adminPassword.trim();

    try {
      // 1. Check if Admin Login
      if (username.toLowerCase() === 'pranshul' && password === 'pranshul1045') {
        const initialProfile: UserProfile = {
          uid: 'admin_local',
          displayName: 'Pranshul (Admin)',
          role: 'admin',
          battingStyle: 'Right-handed',
          favoriteNumber: 10,
          createdAt: new Date().toISOString()
        };
        localStorage.setItem('hcl_local_guest_active', 'true');
        localStorage.setItem('hcl_local_guest_profile', JSON.stringify(initialProfile));
        
        setUser({ uid: 'admin_local', isAnonymous: true, displayName: 'Pranshul (Admin)' });
        setUserProfile(initialProfile);
        setAdminUsername('');
        setAdminPassword('');
        return;
      }

      // 2. Check if Player Login in Firestore
      const docId = username.toLowerCase();
      const profileDocRef = doc(db, 'playerProfiles', docId);
      const docSnap = await getDoc(profileDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const storedPin = data.pin || '';
        
        if (password === 'password' || (storedPin && password === storedPin)) {
          // Log in successfully as Player!
          const initialProfile: UserProfile = {
            uid: `player_${docId}`,
            displayName: data.name || username,
            role: 'user',
            battingStyle: (data.battingStyle || 'Right-handed') as 'Right-handed' | 'Left-handed',
            favoriteNumber: data.favoriteNumber || 6,
            createdAt: data.createdAt || new Date().toISOString()
          };
          
          localStorage.setItem('hcl_local_guest_active', 'true');
          localStorage.setItem('hcl_local_guest_profile', JSON.stringify(initialProfile));
          
          setUser({ uid: `player_${docId}`, isAnonymous: true, displayName: data.name || username });
          setUserProfile(initialProfile);
          setAdminUsername('');
          setAdminPassword('');
        } else {
          setAdminError('Invalid PIN / Password for player!');
        }
      } else {
        setAdminError('Player name not registered or invalid credentials!');
      }
    } catch (err) {
      console.error("Login error:", err);
      setAdminError('An error occurred during login. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('hcl_local_guest_active');
      localStorage.removeItem('hcl_local_guest_profile');
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setGuestName('');
    } catch (err) {
      console.error("Logout failed: ", err);
    }
  };

  const handleAddLocalMatch = (newMatch: SchoolMatch) => {
    setSchoolMatches((prev) => {
      const updated = [newMatch, ...prev];
      localStorage.setItem('hcl_local_school_matches', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteLocalMatch = (matchId: string) => {
    setSchoolMatches((prev) => {
      const updated = prev.filter(m => m.id !== matchId);
      localStorage.setItem('hcl_local_school_matches', JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdateLocalProfile = (updatedProfile: UserProfile) => {
    setUserProfile(updatedProfile);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1423] flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        <p className="font-display font-bold text-sm text-slate-400">Bootstrapping HCL Arena...</p>
      </div>
    );
  }

  // 1. SIGN IN / ONBOARDING SCREEN (if no auth session exists)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0F1423] text-slate-200 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#161D2F] border border-slate-700 rounded-3xl p-6 md:p-8 space-y-8 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12"></div>
          
          <div className="space-y-4 relative z-10">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 px-4 py-2 rounded-sm skew-x-[-12deg] shadow-lg inline-block">
              <span className="italic font-black text-white tracking-tighter text-xl block">HCL ARENA</span>
            </div>
            <h2 className="font-display font-black text-2xl md:text-3xl text-orange-400 tracking-tight leading-none pt-2">
              Hand Cricket League
            </h2>
            <p className="text-slate-400 font-medium text-xs md:text-sm">
              The ultimate schoolyard dashboard & digital arena. Join the tournament, track live stats, and lead the points table!
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex border border-slate-700 p-1 bg-[#1A2238]/60 rounded-xl">
            <button
              onClick={() => { setLoginMode('guest'); setAdminError(''); }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                loginMode === 'guest'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Guest Play
            </button>
            <button
              onClick={() => { setLoginMode('admin'); setAdminError(''); }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                loginMode === 'admin'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Secure Login
            </button>
          </div>

          {/* Login Options Container */}
          <div className="space-y-6 relative z-10">
            {loginMode === 'guest' ? (
              /* Quick Guest Join */
              <form onSubmit={handleAnonymousLogin} className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Quick Start (Enter Player Name)
                  </label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="E.g. Pranshul"
                    maxLength={15}
                    className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-100 font-semibold"
                  />
                </div>
                <button
                  type="submit"
                  disabled={signingIn || !guestName.trim()}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-xs uppercase tracking-wide py-3.5 rounded-xl shadow-[0_3.5px_0_0_#9a3412] hover:brightness-105 active:translate-y-0.5 active:shadow-none transition-all duration-100 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 fill-current" /> Quick Guest Play
                </button>
              </form>
            ) : (
              /* Secure Player / Admin Form */
              <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
                {adminError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-xl text-center font-bold">
                    {adminError}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Name / Username
                  </label>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="Enter player name or admin username"
                    className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-100 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    PIN / Password
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="PIN or Password"
                    className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-100 font-semibold font-mono tracking-widest"
                  />
                </div>
                <button
                  type="submit"
                  disabled={signingIn}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-xs uppercase tracking-wide py-3.5 rounded-xl shadow-[0_3.5px_0_0_#9a3412] hover:brightness-105 active:translate-y-0.5 active:shadow-none transition-all duration-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" /> {signingIn ? 'Signing In...' : 'Secure Sign In'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1423] text-slate-200 pb-24 md:pb-20">
      
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 bg-[#1A2238] border-b border-slate-700 px-4 md:px-8 py-3 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-orange-500 to-red-600 px-3 py-1.5 rounded-sm skew-x-[-12deg] shadow-md flex items-center justify-center">
            <span className="italic font-black text-white tracking-tighter text-sm leading-none">HCL</span>
          </div>
          <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>
          <div>
            <h1 className="font-display font-black text-base text-slate-100 tracking-tight leading-none uppercase flex items-center gap-1.5">
              ARENA
            </h1>
            <span className="text-[9px] font-mono font-bold text-orange-400 tracking-wider block uppercase">
              Hand Cricket League
            </span>
          </div>
        </div>

        {/* User Info & Controls */}
        <div className="flex items-center gap-3">
          <div className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded border border-green-500/30 uppercase font-bold animate-pulse hidden md:block">
            Network Online
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 bg-red-500/10 text-red-400 px-2.5 py-1 rounded border border-red-500/20 text-[10px] font-bold font-mono uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5" /> Admin
            </div>
          )}
          <div className="flex items-center gap-2 bg-[#161D2F] px-3 py-1.5 rounded-lg border border-slate-700">
            <span className="text-xs font-bold text-slate-300">
              {userProfile?.displayName || 'Player'}
            </span>
            <button
              onClick={handleLogout}
              className="p-1 text-slate-400 hover:text-red-400 transition-colors"
              title="Logout from Arena"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Viewport */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardSection 
            userProfile={userProfile} 
            schoolMatches={schoolMatches} 
            onStartGame={() => setActiveTab('game')}
            onUpdateProfile={handleUpdateLocalProfile}
          />
        )}
        {activeTab === 'game' && (
          <DigitalGameSection 
            userProfile={userProfile} 
            onGameSaved={() => {
              // trigger points re-sync or similar if desired
            }} 
          />
        )}
        {activeTab === 'league' && (
          <LeagueMatchesSection 
            userProfile={userProfile} 
            schoolMatches={schoolMatches}
            isAdmin={isAdmin}
            onAddMatch={handleAddLocalMatch}
            onDeleteMatch={handleDeleteLocalMatch}
          />
        )}
        {activeTab === 'updates' && (
          <UpdatesSection 
            userProfile={userProfile}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === 'rules' && (
          <RulesSection />
        )}
      </main>

      {/* Responsive Floating Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1A2238]/95 backdrop-blur-md border-t border-slate-700 shadow-lg px-4 py-2.5 flex justify-around md:justify-center md:gap-8 items-center max-w-lg md:max-w-none mx-auto md:rounded-full md:bottom-4 md:border">
        {/* Dashboard Tab */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'dashboard'
              ? 'bg-orange-500/15 text-orange-400 font-bold text-xs md:text-sm border border-orange-500/20 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 text-xs md:text-sm'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span className="font-display">Home</span>
        </button>

        {/* Digital Game Tab */}
        <button
          onClick={() => setActiveTab('game')}
          className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'game'
              ? 'bg-orange-500/15 text-orange-400 font-bold text-xs md:text-sm border border-orange-500/20 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 text-xs md:text-sm'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span className="font-display">Play Game</span>
        </button>

        {/* Updates Tab */}
        <button
          onClick={() => setActiveTab('updates')}
          className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'updates'
              ? 'bg-orange-500/15 text-orange-400 font-bold text-xs md:text-sm border border-orange-500/20 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 text-xs md:text-sm'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span className="font-display">Updates</span>
        </button>

        {/* School yard Leagues Tab */}
        <button
          onClick={() => setActiveTab('league')}
          className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'league'
              ? 'bg-orange-500/15 text-orange-400 font-bold text-xs md:text-sm border border-orange-500/20 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 text-xs md:text-sm'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span className="font-display">Scorecards</span>
        </button>

        {/* Rules & Guide Tab */}
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'rules'
              ? 'bg-orange-500/15 text-orange-400 font-bold text-xs md:text-sm border border-orange-500/20 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 text-xs md:text-sm'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="font-display">HCL Rules</span>
        </button>
      </nav>

    </div>
  );
}
