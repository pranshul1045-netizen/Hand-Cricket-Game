import React, { useState, useEffect } from 'react';
import { 
  Trophy, Gamepad2, BookOpen, Sparkles, LogIn, LogOut, 
  User, Loader2, Calendar, ShieldAlert, CheckCircle2, Megaphone, Lock,
  Settings, X, Edit3, Save
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  onAuthStateChanged, signInAnonymously, signInWithPopup, 
  GoogleAuthProvider, signOut 
} from 'firebase/auth';
import { 
  doc, onSnapshot, setDoc, getDoc, getDocs, collection, query, orderBy, where 
} from 'firebase/firestore';
import { UserProfile, SchoolMatch, DigitalTournamentMatch } from './types';

// Importing sub-sections
import DashboardSection from './components/DashboardSection';
import DigitalGameSection from './components/DigitalGameSection';
import DigitalHomeSection from './components/DigitalHomeSection';
import DigitalLeagueSection from './components/DigitalLeagueSection';
import LeagueMatchesSection from './components/LeagueMatchesSection';
import RulesSection from './components/RulesSection';
import UpdatesSection from './components/UpdatesSection';
import RegistrationSection from './components/RegistrationSection';

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

function LockedTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-xl mx-auto bg-[#161D2F] border border-slate-700 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden py-16">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl"></div>
      <div className="w-16 h-16 bg-orange-500/10 border-2 border-orange-500/20 rounded-full flex items-center justify-center mx-auto text-orange-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </div>
      <div className="space-y-2">
        <h3 className="font-display font-black text-2xl text-slate-100 uppercase tracking-tight">{title}</h3>
        <p className="text-slate-400 text-sm font-medium">
          {description}
        </p>
      </div>
      <div className="bg-[#1A2238] border border-slate-800 px-4 py-2 rounded-xl inline-block">
        <span className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest">
          🔐 Locked by Administrator
        </span>
      </div>
    </div>
  );
}

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
  const [digitalTournamentMatches, setDigitalTournamentMatches] = useState<DigitalTournamentMatch[]>([]);
  const [schoolyardLocked, setSchoolyardLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'game' | 'league' | 'rules' | 'updates' | 'digital_home' | 'digital_league'>('dashboard');
  const [tournamentType, setTournamentType] = useState<'schoolyard' | 'digital' | 'registration'>('schoolyard');

  // Login states
  const [loginMode, setLoginMode] = useState<'guest' | 'admin'>('guest');
  const [guestName, setGuestName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  // Player Team Name states for Digital Tournament
  const [playerTeamName, setPlayerTeamName] = useState<string | null>(null);
  const [loadingTeamName, setLoadingTeamName] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');

  // Real-time Multiplayer states
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<any>(null);

  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [editBattingStyle, setEditBattingStyle] = useState<'Right-handed' | 'Left-handed'>('Right-handed');
  const [editFavoriteNumber, setEditFavoriteNumber] = useState<number>(6);
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const handleOpenProfileModal = () => {
    if (!userProfile) return;
    setEditDisplayName(userProfile.displayName || '');
    setEditTeamName(userProfile.teamName || playerTeamName || '');
    setEditBattingStyle(userProfile.battingStyle || 'Right-handed');
    setEditFavoriteNumber(userProfile.favoriteNumber || 6);
    setEditPhotoURL(userProfile.photoURL || '');
    setProfileError('');
    setIsProfileModalOpen(true);
  };

  const handleSaveProfileChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDisplayName.trim()) {
      setProfileError('Display Name is required');
      return;
    }
    setIsSavingProfile(true);
    setProfileError('');

    try {
      const updatedProfile: UserProfile = {
        ...userProfile,
        uid: userProfile?.uid || 'guest_local',
        displayName: editDisplayName.trim(),
        teamName: editTeamName.trim(),
        battingStyle: editBattingStyle,
        favoriteNumber: editFavoriteNumber,
        photoURL: editPhotoURL.trim(),
        role: userProfile?.role || 'user'
      };

      if (isPlayerLogin && playerDocId) {
        const docRef = doc(db, 'playerProfiles', playerDocId);
        await setDoc(docRef, {
          name: editDisplayName.trim(),
          teamName: editTeamName.trim(),
          photoURL: editPhotoURL.trim(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        setPlayerTeamName(editTeamName.trim());
      }

      setUserProfile(updatedProfile);
      localStorage.setItem('hcl_local_guest_profile', JSON.stringify(updatedProfile));
      setIsProfileModalOpen(false);
    } catch (err: any) {
      console.error("Error updating profile settings: ", err);
      setProfileError(err.message || 'Failed to update profile settings.');
    } finally {
      setIsSavingProfile(false);
    }
  };

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
              setUser({ uid: profile.uid || 'guest_local', isAnonymous: true, displayName: profile.displayName });
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

    const dtMatchesQuery = query(
      collection(db, 'digitalTournamentMatches'),
      orderBy('createdAt', 'desc')
    );
    const unsubDtMatches = onSnapshot(dtMatchesQuery, (snapshot) => {
      const dtMatchesList: DigitalTournamentMatch[] = [];
      snapshot.forEach((docSnap) => {
        dtMatchesList.push({ id: docSnap.id, ...docSnap.data() } as DigitalTournamentMatch);
      });
      setDigitalTournamentMatches(dtMatchesList);
    }, (error) => {
      console.error("Failed to query digital tournament matches: ", error);
    });

    return () => {
      unsubMatches();
      unsubDtMatches();
    };
  }, []);

  // Synchronize schoolyard tournament lock state in real-time
  useEffect(() => {
    const unsubLock = onSnapshot(doc(db, 'settings', 'tournament'), (docSnap) => {
      if (docSnap.exists()) {
        setSchoolyardLocked(docSnap.data().schoolyardLocked || false);
      }
    }, (err) => {
      console.error("Failed to load settings: ", err);
    });
    return () => unsubLock();
  }, []);

  const isPlayerLogin = userProfile?.uid && userProfile.uid.startsWith('player_');
  const playerDocId = isPlayerLogin ? userProfile.uid.replace('player_', '').toLowerCase() : '';

  useEffect(() => {
    if (!isPlayerLogin || !playerDocId) {
      setPlayerTeamName(null);
      setLoadingTeamName(false);
      return;
    }
    setLoadingTeamName(true);
    const docRef = doc(db, 'playerProfiles', playerDocId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      setLoadingTeamName(false);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const dbTeamName = data.teamName || '';
        const dbGroup = data.group || 'Unknown';
        
        setPlayerTeamName(dbTeamName);
        
        setUserProfile((prev) => {
          if (!prev) return null;
          
          // Only update if there is a genuine change to avoid React trigger cascades
          if (
            prev.teamName === dbTeamName &&
            prev.group === dbGroup &&
            prev.displayName === (data.name || prev.displayName) &&
            prev.battingStyle === (data.battingStyle || prev.battingStyle) &&
            prev.favoriteNumber === (data.favoriteNumber || prev.favoriteNumber)
          ) {
            return prev;
          }
          
          const updatedProfile = {
            ...prev,
            displayName: data.name || prev.displayName,
            battingStyle: data.battingStyle || prev.battingStyle,
            favoriteNumber: data.favoriteNumber || prev.favoriteNumber,
            teamName: dbTeamName || prev.teamName || `${data.name || prev.displayName} XI`,
            group: dbGroup,
          };
          
          localStorage.setItem('hcl_local_guest_profile', JSON.stringify(updatedProfile));
          return updatedProfile;
        });
      } else {
        setPlayerTeamName('');
      }
    }, (err) => {
      console.error("Error fetching/syncing player profile:", err);
      setLoadingTeamName(false);
    });
    return () => unsub();
  }, [isPlayerLogin, playerDocId]);

  // Online Presence Heartbeat
  useEffect(() => {
    if (!isPlayerLogin || !playerDocId) return;
    const updatePresence = async () => {
      try {
        const docRef = doc(db, 'playerProfiles', playerDocId);
        await setDoc(docRef, {
          lastActive: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Error updating presence:", err);
      }
    };
    updatePresence();
    const interval = setInterval(updatePresence, 10000);
    return () => clearInterval(interval);
  }, [isPlayerLogin, playerDocId]);

  // Listen to Incoming Game Challenges
  useEffect(() => {
    if (!isPlayerLogin || !playerDocId) {
      setIncomingChallenge(null);
      return;
    }
    const challengesQuery = query(
      collection(db, 'gameChallenges'),
      where('targetId', '==', playerDocId),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(challengesQuery, (snapshot) => {
      if (!snapshot.empty) {
        const firstDoc = snapshot.docs[0];
        setIncomingChallenge({ id: firstDoc.id, ...firstDoc.data() });
      } else {
        setIncomingChallenge(null);
      }
    }, (error) => {
      console.error("Error listening to challenges:", error);
    });
    return () => unsub();
  }, [isPlayerLogin, playerDocId]);

  const handleAcceptChallenge = async (challengeId: string) => {
    try {
      const docRef = doc(db, 'gameChallenges', challengeId);
      await setDoc(docRef, {
        status: 'accepted',
        updatedAt: new Date().toISOString(),
        lastTurnTime: new Date().toISOString()
      }, { merge: true });
      setIncomingChallenge(null);
      setActiveChallengeId(challengeId);
      setActiveTab('game');
    } catch (err) {
      console.error("Error accepting challenge:", err);
    }
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    try {
      const docRef = doc(db, 'gameChallenges', challengeId);
      await setDoc(docRef, {
        status: 'declined',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setIncomingChallenge(null);
    } catch (err) {
      console.error("Error declining challenge:", err);
    }
  };

  const handleSaveTeamName = async (nameInput: string) => {
    if (!nameInput.trim() || !playerDocId) return;
    try {
      const docRef = doc(db, 'playerProfiles', playerDocId);
      
      // Let's get the existing document snapshot first to check if they already have a group
      const docSnap = await getDoc(docRef);
      let assignedGroup = 'Unknown';
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.group && data.group !== 'Unknown') {
          assignedGroup = data.group;
        }
      }
      
      // If no valid group is assigned yet, calculate and assign a random group out of 12 (max 4 per group)
      if (assignedGroup === 'Unknown' || !assignedGroup) {
        // Fetch all existing playerProfiles to calculate group counts
        const profilesSnap = await getDocs(collection(db, 'playerProfiles'));
        const groupCounts: Record<number, number> = {};
        for (let i = 1; i <= 12; i++) {
          groupCounts[i] = 0;
        }
        
        profilesSnap.forEach((profileDoc) => {
          const profileData = profileDoc.data();
          if (profileData.group) {
            const num = parseInt(profileData.group.replace(/\D/g, ''), 10);
            if (num >= 1 && num <= 12) {
              groupCounts[num] = (groupCounts[num] || 0) + 1;
            }
          }
        });
        
        // Find groups with fewer than 4 players
        const availableGroups = Object.keys(groupCounts)
          .map(Number)
          .filter(gNum => groupCounts[gNum] < 4);
          
        if (availableGroups.length > 0) {
          const randomIdx = Math.floor(Math.random() * availableGroups.length);
          assignedGroup = `Group ${availableGroups[randomIdx]}`;
        } else {
          // If all groups are full, find the group(s) with the minimum number of players
          let minCount = Infinity;
          let minGroups: number[] = [];
          for (let i = 1; i <= 12; i++) {
            const cnt = groupCounts[i] || 0;
            if (cnt < minCount) {
              minCount = cnt;
              minGroups = [i];
            } else if (cnt === minCount) {
              minGroups.push(i);
            }
          }
          const randomIdx = Math.floor(Math.random() * minGroups.length);
          assignedGroup = `Group ${minGroups[randomIdx]}`;
        }
      }

      await setDoc(docRef, {
        teamName: nameInput.trim(),
        group: assignedGroup,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      if (userProfile) {
        const updatedProfile = { 
          ...userProfile, 
          teamName: nameInput.trim(),
          group: assignedGroup
        };
        setUserProfile(updatedProfile);
        localStorage.setItem('hcl_local_guest_profile', JSON.stringify(updatedProfile));
      }
    } catch (err) {
      console.error("Failed to save team name and assign group: ", err);
      throw err;
    }
  };

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
      const lowerUsername = username.toLowerCase();
      if (
        (lowerUsername === 'pranshul' || lowerUsername === 'quantum society' || lowerUsername === 'admin') &&
        (password === 'admin' || password === 'pranshul1045')
      ) {
        const displayNameMap: Record<string, string> = {
          'pranshul': 'Pranshul (Admin)',
          'quantum society': 'Quantum Society (Admin)',
          'admin': 'Admin'
        };
        const initialProfile: UserProfile = {
          uid: 'admin_local',
          displayName: displayNameMap[lowerUsername] || 'Admin',
          role: 'admin',
          battingStyle: 'Right-handed',
          favoriteNumber: 10,
          createdAt: new Date().toISOString()
        };
        localStorage.setItem('hcl_local_guest_active', 'true');
        localStorage.setItem('hcl_local_guest_profile', JSON.stringify(initialProfile));
        
        setUser({ uid: 'admin_local', isAnonymous: true, displayName: initialProfile.displayName });
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
        
        const isSelfAdmin = docId === 'quantum society' || docId === 'pranshul' || docId === 'admin';
        const isValidPassword = password === 'password' || 
                                (isSelfAdmin && password === 'admin') || 
                                (storedPin && password === storedPin);
        
        if (isValidPassword) {
          // Log in successfully as Player!
          const initialProfile: UserProfile = {
            uid: `player_${docId}`,
            displayName: data.name || username,
            role: isSelfAdmin ? 'admin' : 'user',
            battingStyle: (data.battingStyle || 'Right-handed') as 'Right-handed' | 'Left-handed',
            favoriteNumber: data.favoriteNumber || 6,
            teamName: data.teamName || `${data.name || username} XI`,
            group: data.group || 'Unknown',
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
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 bg-[#161D2F] px-3 py-1.5 rounded-lg border border-slate-700">
              {userProfile && (
                <button
                  onClick={handleOpenProfileModal}
                  className="p-1 text-slate-400 hover:text-orange-400 transition-colors cursor-pointer mr-0.5 flex items-center gap-1"
                  title="Edit Profile & Team Name"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="text-xs font-bold text-slate-300">
                {userProfile?.displayName || 'Player'}
              </span>
              <button
                onClick={handleLogout}
                className="p-1 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                title="Logout from Arena"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
            {playerTeamName && (
              <span className="text-[9px] font-mono font-bold text-orange-400 uppercase tracking-wider mt-1 mr-1">
                🛡️ Team: {playerTeamName}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Category/Tournament Switcher */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 pb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#161D2F] border border-slate-700/80 p-2 rounded-2xl shadow-md">
          <div className="flex flex-wrap gap-1 w-full sm:w-auto">
            <button
              onClick={() => {
                setTournamentType('schoolyard');
                setActiveTab('dashboard');
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all cursor-pointer ${
                tournamentType === 'schoolyard'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1A2238]'
              }`}
            >
              🏫 Schoolyard Tournament
            </button>
            <button
              onClick={() => {
                setTournamentType('digital');
                setActiveTab('digital_home');
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all cursor-pointer ${
                tournamentType === 'digital'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1A2238]'
              }`}
            >
              🎮 Digital Tournament
            </button>
            <button
              onClick={() => {
                setTournamentType('registration');
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all cursor-pointer ${
                tournamentType === 'registration'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1A2238]'
              }`}
            >
              📝 Register Name
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
            <div className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1.5 bg-[#1A2238]/60 px-3 py-1.5 rounded-lg border border-slate-700/40">
              {tournamentType === 'schoolyard' && <span>🏆 Active schoolyard points table & matches</span>}
              {tournamentType === 'digital' && <span>⚡ Play hand-cricket vs Computer</span>}
              {tournamentType === 'registration' && <span>✍️ Sign up for the Digital Tournament</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Main Container Viewport */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {tournamentType === 'registration' ? (
          <RegistrationSection userProfile={userProfile} isAdmin={isAdmin} schoolyardLocked={schoolyardLocked} />
        ) : tournamentType === 'schoolyard' ? (
          schoolyardLocked ? (
            <div className="max-w-xl mx-auto my-12 bg-[#161D2F] border-2 border-red-500/30 rounded-3xl p-8 md:p-12 shadow-2xl text-center space-y-8 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl transform translate-x-20 -translate-y-20"></div>
              
              <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-400 shadow-lg">
                <Lock className="w-10 h-10" />
              </div>

              <div className="space-y-4">
                <h2 className="font-display font-black text-3xl text-white uppercase tracking-tight leading-tight">
                  Schoolyard Tournament Locked
                </h2>
                <div className="inline-block bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                  LOCKED BY ADMIN
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>

              <div className="space-y-6 text-slate-300">
                <p className="font-display font-bold text-xl text-orange-400 uppercase tracking-wide">
                  tournament finished
                </p>
                <div className="space-y-4">
                  <p className="font-display font-black text-lg text-white uppercase tracking-tight">
                    focus on digital tournament
                  </p>
                  <p className="text-orange-500/90 font-mono text-xs font-semibold bg-[#1A2238] border border-slate-700/50 rounded-xl px-5 py-3.5 inline-block">
                    📅 starting on next monday( 19 july 2026)
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardSection 
                  userProfile={userProfile} 
                  schoolMatches={schoolMatches} 
                  schoolyardLocked={schoolyardLocked}
                  onStartGame={() => {
                    setTournamentType('digital');
                    setActiveTab('digital_home');
                  }}
                  onUpdateProfile={handleUpdateLocalProfile}
                />
              )}
              {activeTab === 'league' && (
                <LeagueMatchesSection 
                  userProfile={userProfile} 
                  schoolMatches={schoolMatches}
                  isAdmin={isAdmin}
                  schoolyardLocked={schoolyardLocked}
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
            </>
          )
        ) : (
          /* DIGITAL TOURNAMENT MODES */
          isPlayerLogin && playerTeamName === '' ? (
            <div className="max-w-xl mx-auto my-12 bg-[#161D2F] border-2 border-orange-500/30 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300 text-center">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl transform translate-x-20 -translate-y-20"></div>
              
              <div className="w-20 h-20 bg-orange-500/10 border-2 border-orange-500/30 rounded-full flex items-center justify-center mx-auto text-orange-400 shadow-lg">
                <Trophy className="w-10 h-10" />
              </div>

              <div className="space-y-4 mt-6">
                <h2 className="font-display font-black text-3xl text-white uppercase tracking-tight leading-tight">
                  Choose Your Team Name
                </h2>
                <div className="inline-block bg-orange-500/20 border border-orange-500/40 text-orange-400 font-mono text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                  Digital Arena Entrance
                </div>
                <p className="text-slate-400 text-sm font-sans max-w-sm mx-auto leading-relaxed">
                  Welcome, <span className="text-slate-200 font-bold">{userProfile?.displayName}</span>! To begin participating in the HCL Digital Tournament, you must declare your official Team Name.
                </p>
                <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-left">
                  <p className="text-[11px] font-mono font-bold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" /> Critical Rule
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Once written and locked, your team name <strong className="text-white">cannot be changed</strong>. It will be permanently fixed for all matches, points tables, and seedings in this tournament.
                  </p>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent my-6"></div>

              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!teamNameInput.trim()) {
                    setTeamError('Please enter a team name');
                    return;
                  }
                  if (teamNameInput.trim().length < 3) {
                    setTeamError('Team name must be at least 3 characters');
                    return;
                  }
                  setTeamError('');
                  setIsSavingTeam(true);
                  try {
                    await handleSaveTeamName(teamNameInput.trim());
                  } catch (err) {
                    setTeamError('Failed to lock team name. Please try again.');
                  } finally {
                    setIsSavingTeam(false);
                  }
                }} 
                className="space-y-5 text-left"
              >
                {teamError && (
                  <div className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs py-2.5 px-3.5 rounded-xl text-center font-bold">
                    {teamError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Your Official Team Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    value={teamNameInput}
                    onChange={(e) => setTeamNameInput(e.target.value)}
                    placeholder="E.g. Royal Strikers, Mumbai Rockets"
                    className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3.5 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-100 font-bold tracking-wide"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingTeam || !teamNameInput.trim()}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-xs uppercase tracking-wide py-4 rounded-xl shadow-[0_3.5px_0_0_#9a3412] hover:brightness-105 active:translate-y-0.5 active:shadow-none transition-all duration-100 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingTeam ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Locking Team Name...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-current" />
                      Lock Team Name & Enter Tournament
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <>
              {activeTab === 'digital_home' && (
                <DigitalHomeSection />
              )}
              {activeTab === 'game' && (
                <DigitalGameSection 
                  userProfile={userProfile} 
                  playerTeamName={playerTeamName}
                  digitalTournamentMatches={digitalTournamentMatches}
                  activeChallengeId={activeChallengeId}
                  setActiveChallengeId={setActiveChallengeId}
                  onGameSaved={() => {
                    // trigger points re-sync if desired
                  }} 
                />
              )}
              {activeTab === 'digital_league' && (
                <DigitalLeagueSection
                  userProfile={userProfile}
                  digitalTournamentMatches={digitalTournamentMatches}
                  isAdmin={isAdmin}
                />
              )}
              {activeTab === 'rules' && (
                <RulesSection />
              )}
            </>
          )
        )}
      </main>

      {/* Responsive Floating Bottom Navigation Bar */}
      {tournamentType !== 'registration' && !(tournamentType === 'schoolyard' && schoolyardLocked) && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#1A2238]/95 backdrop-blur-md border-t border-slate-700 shadow-lg px-4 py-2.5 flex justify-around md:justify-center md:gap-8 items-center max-w-lg md:max-w-none mx-auto md:rounded-full md:bottom-4 md:border">
          {tournamentType === 'schoolyard' ? (
            <>
              {/* Dashboard Tab */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-orange-500/15 text-orange-400 font-bold text-xs md:text-sm border border-orange-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 text-xs md:text-sm'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span className="font-display">Home</span>
              </button>

              {/* Updates Tab */}
              <button
                onClick={() => setActiveTab('updates')}
                className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
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
                className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
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
                className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'rules'
                    ? 'bg-orange-500/15 text-orange-400 font-bold text-xs md:text-sm border border-orange-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 text-xs md:text-sm'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span className="font-display">HCL Rules</span>
              </button>
            </>
          ) : (
            <>
              {/* Digital Home Tab */}
              <button
                onClick={() => setActiveTab('digital_home')}
                className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'digital_home'
                    ? 'bg-orange-500/15 text-orange-400 font-bold text-xs md:text-sm border border-orange-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 text-xs md:text-sm'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4" />
                </div>
                <span className="font-display">Home</span>
              </button>

              {/* Play Game Tab */}
              <button
                onClick={() => setActiveTab('game')}
                className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'game'
                    ? 'bg-orange-500/15 text-orange-400 font-bold text-xs md:text-sm border border-orange-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 text-xs md:text-sm'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                <span className="font-display">Play Game</span>
              </button>

              {/* Digital Scorecards Tab */}
              <button
                onClick={() => setActiveTab('digital_league')}
                className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'digital_league'
                    ? 'bg-orange-500/15 text-orange-400 font-bold text-xs md:text-sm border border-orange-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 text-xs md:text-sm'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                </div>
                <span className="font-display">Scorecards</span>
              </button>

              {/* Rules & Guide Tab */}
              <button
                onClick={() => setActiveTab('rules')}
                className={`flex flex-col md:flex-row items-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'rules'
                    ? 'bg-orange-500/15 text-orange-400 font-bold text-xs md:text-sm border border-orange-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 text-xs md:text-sm'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span className="font-display">HCL Rules</span>
              </button>
            </>
          )}
        </nav>
      )}

      {/* Real-time Game Challenge Notification Modal */}
      {incomingChallenge && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0F172A] border border-orange-500/40 rounded-2xl max-w-md w-full p-6 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-orange-500 to-red-500" />
            
            <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/30 rounded-full flex items-center justify-center mx-auto text-orange-400">
              <Gamepad2 className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-black text-2xl text-slate-100 tracking-tight uppercase">
                ⚔️ LIVE CHALLENGE RECEIVED!
              </h3>
              <p className="text-sm text-slate-400">
                You have been challenged to an online real-time Hand Cricket duel!
              </p>
            </div>

            <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl space-y-1">
              <p className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">Opponent</p>
              <h4 className="text-lg font-black text-slate-200">{incomingChallenge.challengerName}</h4>
              <p className="text-xs font-semibold text-slate-500">🛡️ Team: {incomingChallenge.challengerTeamName || 'Unnamed'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleDeclineChallenge(incomingChallenge.id)}
                className="py-3 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 font-display font-black text-sm uppercase rounded-xl transition-all cursor-pointer"
              >
                Decline
              </button>
              <button
                onClick={() => handleAcceptChallenge(incomingChallenge.id)}
                className="py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-sm uppercase rounded-xl shadow-lg hover:shadow-orange-500/20 active:translate-y-0.5 transition-all cursor-pointer animate-bounce"
              >
                Accept & Play!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Profile Customization & Team Name Settings Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#161D2F] border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden space-y-6">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-orange-500 to-red-600" />
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-orange-400" />
                <h3 className="font-display font-black text-lg text-slate-100 uppercase tracking-tight">
                  Edit Profile & Team
                </h3>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {profileError && (
              <div className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs py-2 px-3 rounded-xl font-bold text-center">
                {profileError}
              </div>
            )}

            <form onSubmit={handleSaveProfileChanges} className="space-y-4">
              {/* Profile Group Badge if available */}
              {userProfile?.group && userProfile.group !== 'Unknown' && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs font-mono text-slate-400 font-bold uppercase">Assigned Bracket</span>
                  <span className="bg-orange-500 text-white font-display font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-full">
                    {userProfile.group}
                  </span>
                </div>
              )}

              {/* Player Display Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  Player Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={15}
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-100 font-bold tracking-wide"
                  placeholder="Enter player name"
                />
              </div>

              {/* My Team Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  My Team Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={25}
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-100 font-bold tracking-wide"
                  placeholder="E.g. Royal Gladiators"
                />
              </div>

              {/* Batting Stance */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  Batting Stance
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditBattingStyle('Right-handed')}
                    className={`px-4 py-3 rounded-xl text-center font-bold border text-xs tracking-wider uppercase transition-all cursor-pointer ${
                      editBattingStyle === 'Right-handed'
                        ? 'bg-orange-500/15 border-orange-500 text-orange-400'
                        : 'bg-[#1A2238] border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Right-handed
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditBattingStyle('Left-handed')}
                    className={`px-4 py-3 rounded-xl text-center font-bold border text-xs tracking-wider uppercase transition-all cursor-pointer ${
                      editBattingStyle === 'Left-handed'
                        ? 'bg-orange-500/15 border-orange-500 text-orange-400'
                        : 'bg-[#1A2238] border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Left-handed
                  </button>
                </div>
              </div>

              {/* Favorite Number Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  Favorite Prediction Number (1-6)
                </label>
                <div className="grid grid-cols-6 gap-1.5 font-mono">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setEditFavoriteNumber(num)}
                      className={`py-2.5 rounded-xl text-center font-black transition-all border cursor-pointer text-xs ${
                        editFavoriteNumber === num
                          ? 'bg-orange-500/15 border-orange-500 text-orange-400'
                          : 'bg-[#1A2238] border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-800 my-4"></div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={isSavingProfile || !editDisplayName.trim()}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-xs uppercase tracking-wide py-4 rounded-xl shadow-[0_3.5px_0_0_#9a3412] hover:brightness-105 active:translate-y-0.5 active:shadow-none transition-all duration-100 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
