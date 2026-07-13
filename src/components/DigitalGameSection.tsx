import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Share2, HelpCircle, Trophy, Sparkles, User, Shield, ArrowRight, Zap, Play, RotateCcw } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { DigitalMatch, UserProfile, formatGroupName } from '../types';
import { motion, AnimatePresence } from 'motion/react';

// Hand Cricket gestures mapped to emojis & descriptive terms - high density styled
const handGestures: Record<number, { label: string; icon: string; style: string }> = {
  1: { label: 'Single', icon: '☝️', style: 'border-slate-700 text-slate-100 bg-[#1A2238]/40 hover:border-orange-500/50 hover:bg-orange-500/5' },
  2: { label: 'Double', icon: '✌️', style: 'border-slate-700 text-slate-100 bg-[#1A2238]/40 hover:border-orange-500/50 hover:bg-orange-500/5' },
  3: { label: 'Triple', icon: '🤟', style: 'border-slate-700 text-slate-100 bg-[#1A2238]/40 hover:border-orange-500/50 hover:bg-orange-500/5' },
  4: { label: 'Boundary', icon: '🖐️', style: 'border-orange-500/30 text-orange-400 font-bold bg-orange-500/10 hover:border-orange-500/60' },
  5: { label: 'Power', icon: '✋', style: 'border-slate-700 text-slate-100 bg-[#1A2238]/40 hover:border-orange-500/50 hover:bg-orange-500/5' },
  6: { label: 'Sixer', icon: '👍', style: 'border-purple-500/30 text-purple-400 font-bold bg-purple-500/10 hover:border-purple-500/60' },
};

const comments = {
  out: [
    "Oh no! Clean bowled!",
    "Out! Caught in the slips!",
    "Matched! Snatched right out of the air!",
    "Silly mistake! The bowler read your mind!",
    "WICKET! Absolute schoolyard heartbreak!"
  ],
  score: [
    "Smashed for a maximum! 6 runs!",
    "Glorious boundary! Cracking shot for 4!",
    "Nicely timed double.",
    "Just a quick single to rotate the strike.",
    "Squeezed for a triple! Terrific running!",
    "Power shot! 5 runs registered!"
  ]
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

const isPlayerOnline = (lastActive: string | null) => {
  if (!lastActive) return false;
  try {
    const activeTime = new Date(lastActive).getTime();
    const now = Date.now();
    return (now - activeTime) < 30000;
  } catch (e) {
    return false;
  }
};

export default function DigitalGameSection({ 
  userProfile, 
  playerTeamName, 
  digitalTournamentMatches,
  activeChallengeId, 
  setActiveChallengeId, 
  onGameSaved 
}: DigitalGameProps) {
  const hasRegisteredTeam = !!(playerTeamName && playerTeamName.trim() !== '');

  // Game Setup States
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'hard'>('easy');
  const [gameMode, setGameMode] = useState<'pve' | 'local'>('pve'); // Player vs Environment or Local PvP
  const [localPvpRole, setLocalPvpRole] = useState<'player1' | 'player2'>('player1'); // For local pass & play
  const [player1Name, setPlayer1Name] = useState('Player 1');
  const [player2Name, setPlayer2Name] = useState('Player 2');

  const [opponentType, setOpponentType] = useState<'cpu' | 'registered' | 'tournament'>('cpu');
  const [registeredPlayers, setRegisteredPlayers] = useState<any[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<any | null>(null);
  const [selectedTournamentMatch, setSelectedTournamentMatch] = useState<any | null>(null);

  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const myScheduledMatches = (digitalTournamentMatches || []).filter(match => {
    if (match.status !== 'scheduled') return false;
    const myTeam = playerTeamName || '';
    const myName = userProfile?.displayName || '';
    
    const p1Low = match.player1.toLowerCase().trim();
    const p2Low = match.player2.toLowerCase().trim();
    const myTeamLow = myTeam.toLowerCase().trim();
    const myNameLow = myName.toLowerCase().trim();
    
    return (
      (myTeamLow && (p1Low === myTeamLow || p2Low === myTeamLow)) ||
      (myNameLow && (p1Low === myNameLow || p2Low === myNameLow))
    );
  });

  const getTournamentOpponentName = (match: any) => {
    const myTeam = playerTeamName || '';
    const myName = userProfile?.displayName || '';
    
    const p1Low = match.player1.toLowerCase().trim();
    const myTeamLow = myTeam.toLowerCase().trim();
    const myNameLow = myName.toLowerCase().trim();
    
    if (p1Low === myTeamLow || p1Low === myNameLow) {
      return match.player2;
    }
    return match.player1;
  };

  const upcomingTournamentMatches = (digitalTournamentMatches || []).filter(match => {
    if (match.status !== 'scheduled') return false;
    
    const myTeam = playerTeamName || '';
    const myName = userProfile?.displayName || '';
    
    const p1Low = match.player1.toLowerCase().trim();
    const p2Low = match.player2.toLowerCase().trim();
    const myTeamLow = myTeam.toLowerCase().trim();
    const myNameLow = myName.toLowerCase().trim();
    
    const isMyMatch = (
      (myTeamLow && (p1Low === myTeamLow || p2Low === myTeamLow)) ||
      (myNameLow && (p1Low === myNameLow || p2Low === myNameLow))
    );
    if (!isMyMatch) return false;
    if (!match.date || !match.time) return false;
    
    const matchTimeMs = new Date(`${match.date}T${match.time}:00`).getTime();
    if (isNaN(matchTimeMs)) return false;
    
    // Show match if it's within 5 minutes of starting, or up to 60 minutes after start time
    return nowMs >= matchTimeMs - 5 * 60 * 1000 && nowMs <= matchTimeMs + 60 * 60 * 1000;
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'playerProfiles'), (snapshot) => {
      const players: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const currentUserId = (userProfile?.uid || '').replace('player_', '').toLowerCase();
        // Include other players who have a non-empty teamName and are not ourselves
        if (data.teamName && data.name && docId !== currentUserId) {
          players.push({
            id: docId,
            name: data.name,
            teamName: data.teamName,
            photoURL: data.photoURL || '',
            lastActive: data.lastActive || null
          });
        }
      });
      setRegisteredPlayers(players);
    }, (err) => {
      console.error("Error loading registered players:", err);
    });
    return () => unsub();
  }, [userProfile]);

  // Update player2Name based on opponentType, selectedOpponent, and difficulty
  useEffect(() => {
    if (opponentType === 'registered' && selectedOpponent) {
      setPlayer2Name(`${selectedOpponent.name} (${selectedOpponent.teamName})`);
    } else if (opponentType === 'tournament' && selectedTournamentMatch) {
      const oppName = getTournamentOpponentName(selectedTournamentMatch);
      setPlayer2Name(oppName);
    } else {
      setPlayer2Name(`CPU (${aiDifficulty.toUpperCase()})`);
    }
  }, [opponentType, selectedOpponent, selectedTournamentMatch, aiDifficulty]);

  // Auto-select tournament match if none is selected
  useEffect(() => {
    if (opponentType === 'tournament') {
      if (myScheduledMatches.length > 0 && !selectedTournamentMatch) {
        setSelectedTournamentMatch(myScheduledMatches[0]);
      }
    } else {
      setSelectedTournamentMatch(null);
    }
  }, [opponentType, myScheduledMatches, selectedTournamentMatch]);

  useEffect(() => {
    if (userProfile) {
      const baseName = userProfile.displayName || 'Player';
      const teamSuffix = playerTeamName ? ` (${playerTeamName})` : '';
      setPlayer1Name(baseName + teamSuffix);
    }
  }, [userProfile, playerTeamName]);

  // Core Game Loop State
  const [phase, setPhase] = useState<'setup' | 'toss' | 'role_selection' | 'playing' | 'innings_break' | 'result'>('setup');
  const [tossChoice, setTossChoice] = useState<'odd' | 'even' | null>(null);
  const [tossWinner, setTossWinner] = useState<'player' | 'cpu' | 'player1' | 'player2' | null>(null);
  const [selectedRole, setSelectedRole] = useState<'batting' | 'bowling' | null>(null); // Batter or Bowler in Innings 1

  // Dynamic game values
  const [currentInnings, setCurrentInnings] = useState<1 | 2>(1);
  const [p1Runs, setP1Runs] = useState(0);
  const [p2Runs, setP2Runs] = useState(0);
  const [ballsFaced, setBallsFaced] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [lastP1Move, setLastP1Move] = useState<number | null>(null);
  const [lastP2Move, setLastP2Move] = useState<number | null>(null);
  const [commentary, setCommentary] = useState('Waiting for your move...');
  const [commentaryColor, setCommentaryColor] = useState('text-slate-400');
  const [gameHistory, setGameHistory] = useState<{ p1: number; p2: number; score: number; isOut: boolean; batsman: string }[]>([]);

  // State for visual gesture reveal animations
  const [isRevealing, setIsRevealing] = useState(false);
  const [tossStep, setTossStep] = useState<'choice' | 'number' | 'reveal'>('choice');
  const [tossP1Val, setTossP1Val] = useState<number | null>(null);
  const [tossP2Val, setTossP2Val] = useState<number | null>(null);

  // Stats for the Result screen
  const [luckIndex, setLuckIndex] = useState(75);
  const [highestBall, setHighestBall] = useState(1);
  const [matchStartTime, setMatchStartTime] = useState<number>(Date.now());
  const [matchDuration, setMatchDuration] = useState('00:00');

  // Countdown state for Play vs Computer
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setCountdown(null);
        startActualGameAfterCountdown();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);
  
  // Turn countdown for choosing a number in match
  const [turnCountdown, setTurnCountdown] = useState<number | null>(null);
  const [pendingP1Move, setPendingP1Move] = useState<number | null>(null);

  useEffect(() => {
    if (turnCountdown === null) return;
    if (turnCountdown > 0) {
      const timer = setTimeout(() => {
        setTurnCountdown(turnCountdown - 1);
      }, 700);
      return () => clearTimeout(timer);
    } else {
      setTurnCountdown(null);
      if (pendingP1Move !== null) {
        executeActualTurn(pendingP1Move);
        setPendingP1Move(null);
      }
    }
  }, [turnCountdown, pendingP1Move]);

  // --- MULTIPLAYER REAL-TIME DUELS ---
  const [sendingChallenge, setSendingChallenge] = useState<boolean>(false);
  const [challengeStatusMessage, setChallengeStatusMessage] = useState<string>('');
  const [challengeTimeout, setChallengeTimeout] = useState<number | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const [activeChallengeData, setActiveChallengeData] = useState<any>(null);
  const [isMyTurnSubmitted, setIsMyTurnSubmitted] = useState<boolean>(false);
  const [multiplayerTurnSeconds, setMultiplayerTurnSeconds] = useState<number>(15);

  const myPlayerRole: 'p1' | 'p2' | null = activeChallengeData
    ? (activeChallengeData.challengerId === (userProfile?.uid || '').replace('player_', '').toLowerCase() ? 'p1' : 'p2')
    : null;

  // Challenge Timeout Countdown
  useEffect(() => {
    if (challengeTimeout === null) return;
    if (challengeTimeout > 0) {
      const timer = setTimeout(() => {
        setChallengeTimeout(challengeTimeout - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setChallengeTimeout(null);
      setSendingChallenge(false);
      setChallengeError("Challenge request timed out. Opponent is away or offline.");
    }
  }, [challengeTimeout]);

  // Subscribe to the active challenge doc
  useEffect(() => {
    if (!activeChallengeId) {
      setActiveChallengeData(null);
      return;
    }
    const docRef = doc(db, 'gameChallenges', activeChallengeId);
    const unsub = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveChallengeData(data);
        
        // Determine if I have submitted my move for this turn
        const isChallenger = data.challengerId === (userProfile?.uid || '').replace('player_', '').toLowerCase();
        const mySubmitted = isChallenger ? data.p1MoveSubmitted : data.p2MoveSubmitted;
        setIsMyTurnSubmitted(!!mySubmitted);

        // Process turn resolution on Challenger (p1) side if both moves are submitted
        if (data.p1MoveSubmitted && data.p2MoveSubmitted && isChallenger && !data.isResolvingTurn) {
          const docRef = doc(db, 'gameChallenges', activeChallengeId);
          setDoc(docRef, { isResolvingTurn: true }, { merge: true });
          setTimeout(() => {
            resolveMultiplayerTurn(data);
          }, 2500);
        }
      }
    });
    return () => unsub();
  }, [activeChallengeId, userProfile]);

  // Turn-based real-time match countdown timer
  useEffect(() => {
    if (!activeChallengeData || activeChallengeData.status !== 'accepted' || activeChallengeData.gameEnded) {
      setMultiplayerTurnSeconds(15);
      return;
    }
    
    const interval = setInterval(() => {
      const lastTime = new Date(activeChallengeData.lastTurnTime || activeChallengeData.updatedAt).getTime();
      const now = Date.now();
      const diff = Math.floor((now - lastTime) / 1000);
      const remaining = Math.max(0, 15 - diff);
      setMultiplayerTurnSeconds(remaining);
      
      // Auto-submit if countdown reaches 0 and player hasn't submitted yet
      if (remaining === 0 && !isMyTurnSubmitted && myPlayerRole) {
        clearInterval(interval);
        const autoMove = Math.floor(Math.random() * 6) + 1;
        submitMultiplayerMove(autoMove, true);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [activeChallengeData, isMyTurnSubmitted, myPlayerRole]);

  // Determine coin flip tossCaller on Challenger's side
  useEffect(() => {
    if (activeChallengeData && activeChallengeData.status === 'accepted' && !activeChallengeData.tossCaller && myPlayerRole === 'p1') {
      const caller = Math.random() < 0.5 ? 'p1' : 'p2';
      const docRef = doc(db, 'gameChallenges', activeChallengeId!);
      setDoc(docRef, {
        tossCaller: caller,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(console.error);
    }
  }, [activeChallengeData, myPlayerRole, activeChallengeId]);

  // Determine toss winner after both play their toss move
  useEffect(() => {
    if (activeChallengeData && activeChallengeData.status === 'accepted' && activeChallengeData.tossOddEvenChoice && activeChallengeData.tossP1Move && activeChallengeData.tossP2Move && !activeChallengeData.tossWinner && myPlayerRole === 'p1' && !activeChallengeData.isResolvingToss) {
      
      const docRef = doc(db, 'gameChallenges', activeChallengeId!);
      setDoc(docRef, { isResolvingToss: true }, { merge: true });
      
      setTimeout(() => {
        const sum = activeChallengeData.tossP1Move + activeChallengeData.tossP2Move;
        const sumIsEven = sum % 2 === 0;
        const callerChoseEven = activeChallengeData.tossOddEvenChoice === 'even';
        const callerWon = (callerChoseEven && sumIsEven) || (!callerChoseEven && !sumIsEven);
        
        const winner = callerWon ? activeChallengeData.tossCaller : (activeChallengeData.tossCaller === 'p1' ? 'p2' : 'p1');
        
        setDoc(docRef, {
          tossWinner: winner,
          isResolvingToss: false,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(console.error);
      }, 2500);
    }
  }, [activeChallengeData, myPlayerRole, activeChallengeId]);

  const selectMultiplayerTossOddEven = async (choice: 'odd' | 'even') => {
    if (!activeChallengeId) return;
    try {
      const docRef = doc(db, 'gameChallenges', activeChallengeId);
      await setDoc(docRef, { tossOddEvenChoice: choice }, { merge: true });
    } catch (err) {
      console.error(err);
    }
  };

  const submitMultiplayerTossMove = async (move: number) => {
    if (!activeChallengeId || !myPlayerRole) return;
    try {
      const docRef = doc(db, 'gameChallenges', activeChallengeId);
      const updates: any = {};
      if (myPlayerRole === 'p1') {
        updates.tossP1Move = move;
      } else {
        updates.tossP2Move = move;
      }
      await setDoc(docRef, updates, { merge: true });
    } catch (err) {
      console.error(err);
    }
  };

  const submitMultiplayerMove = async (move: number, isAuto = false) => {
    if (!activeChallengeId || !myPlayerRole) return;
    try {
      const docRef = doc(db, 'gameChallenges', activeChallengeId);
      const updates: any = {};
      if (myPlayerRole === 'p1') {
        updates.p1LastMove = move;
        updates.p1MoveSubmitted = true;
      } else {
        updates.p2LastMove = move;
        updates.p2MoveSubmitted = true;
      }
      if (isAuto) {
        updates.commentary = `Auto-submitted for player due to turn timeout!`;
      }
      await setDoc(docRef, updates, { merge: true });
    } catch (err) {
      console.error("Error submitting move:", err);
    }
  };

  const chooseMultiplayerRole = async (choice: 'batting' | 'bowling') => {
    if (!activeChallengeId) return;
    try {
      const docRef = doc(db, 'gameChallenges', activeChallengeId);
      await setDoc(docRef, {
        tossChoice: choice,
        currentInnings: 1,
        p1Score: 0,
        p2Score: 0,
        currentTurn: 0,
        p1MoveSubmitted: false,
        p2MoveSubmitted: false,
        gameEnded: false,
        commentary: "Match started! Submit your first move.",
        lastTurnTime: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Error setting role:", err);
    }
  };

  const resolveMultiplayerTurn = async (data: any) => {
    const p1Move = data.p1LastMove;
    const p2Move = data.p2LastMove;
    
    const isP1BatsmanIn1 = (data.tossWinner === 'p1' && data.tossChoice === 'batting') || 
                           (data.tossWinner === 'p2' && data.tossChoice === 'bowling');
    const isP1Batsman = data.currentInnings === 1 ? isP1BatsmanIn1 : !isP1BatsmanIn1;
    
    let nextInnings = data.currentInnings;
    let p1Score = data.p1Score ?? 0;
    let p2Score = data.p2Score ?? 0;
    let gameEnded = data.gameEnded ?? false;
    let status = data.status;
    let commentary = '';
    
    const batsmanName = isP1Batsman ? data.challengerName : data.targetName;
    const bowlerName = isP1Batsman ? data.targetName : data.challengerName;
    
    if (p1Move === p2Move) {
      // OUT!
      commentary = `OUT! ${batsmanName} is out for ${isP1Batsman ? p1Score : p2Score} runs! Both players played ${p1Move}.`;
      
      if (data.currentInnings === 1) {
        nextInnings = 2;
        commentary += ` Target for ${bowlerName} is ${(isP1Batsman ? p1Score : p2Score) + 1} runs.`;
      } else {
        gameEnded = true;
        status = 'completed';
        
        const targetRuns = (isP1BatsmanIn1 ? p1Score : p2Score) + 1;
        const chasingScore = isP1Batsman ? p1Score : p2Score;
        
        if (chasingScore >= targetRuns) {
          commentary = `Match over! ${batsmanName} wins by wickets!`;
        } else if (chasingScore === targetRuns - 1) {
          commentary = `Match tied! Both teams scored ${chasingScore} runs!`;
        } else {
          commentary = `Match over! ${bowlerName} wins by ${targetRuns - 1 - chasingScore} runs!`;
        }
      }
    } else {
      const runs = isP1Batsman ? p1Move : p2Move;
      if (isP1Batsman) {
        p1Score += runs;
      } else {
        p2Score += runs;
      }
      commentary = `${batsmanName} scores ${runs} runs. (${p1Move} vs ${p2Move})`;
      
      if (data.currentInnings === 2) {
        const firstInningsScore = isP1BatsmanIn1 ? p1Score : p2Score;
        const currentChasingScore = isP1Batsman ? p1Score : p2Score;
        if (currentChasingScore > firstInningsScore) {
          gameEnded = true;
          status = 'completed';
          commentary = `Match over! ${batsmanName} chased down the target successfully!`;
        }
      }
    }
    
    try {
      const docRef = doc(db, 'gameChallenges', data.id);
      await setDoc(docRef, {
        p1Score,
        p2Score,
        currentInnings: nextInnings,
        currentTurn: (data.currentTurn ?? 0) + 1,
        p1MoveSubmitted: false,
        p2MoveSubmitted: false,
        isResolvingTurn: false,
        gameEnded,
        status,
        commentary,
        lastTurnTime: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Error writing resolved multiplayer turn:", err);
    }
  };
  // --------------------------------------

  const startActualGameAfterCountdown = () => {
    setMatchStartTime(Date.now());
    setPhase('toss');
    setTossStep('choice');
    setTossP1Val(null);
    setTossP2Val(null);
    setTossWinner(null);
  };

  // Trigger setup with 3-second countdown or initiate real-time challenge
  const startToss = async () => {
    if (opponentType === 'registered') {
      if (!selectedOpponent) return;
      if (!isPlayerOnline(selectedOpponent.lastActive)) {
        setChallengeError("Opponent is offline. Please choose an online player (indicated by a green dot) or play with the CPU.");
        return;
      }

      setSendingChallenge(true);
      setChallengeError(null);
      setChallengeStatusMessage(`Challenging ${selectedOpponent.name} to a real-time Hand Cricket duel...`);

      const challengerId = (userProfile?.uid || 'guest_local').replace('player_', '').toLowerCase();
      const targetId = selectedOpponent.id.toLowerCase();
      const challengeId = `${challengerId}_${targetId}_${Date.now()}`;

      try {
        const challengeDocRef = doc(db, 'gameChallenges', challengeId);
        await setDoc(challengeDocRef, {
          id: challengeId,
          challengerId,
          challengerName: userProfile?.displayName || 'Challenger',
          challengerTeamName: playerTeamName || 'Unnamed Team',
          targetId,
          targetName: selectedOpponent.name,
          targetTeamName: selectedOpponent.teamName,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        setChallengeTimeout(25);

        const unsubChallenge = onSnapshot(challengeDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.status === 'accepted') {
              unsubChallenge();
              setSendingChallenge(false);
              setChallengeTimeout(null);
              if (setActiveChallengeId) {
                setActiveChallengeId(challengeId);
              }
            } else if (data.status === 'declined') {
              unsubChallenge();
              setSendingChallenge(false);
              setChallengeTimeout(null);
              setChallengeError(`${selectedOpponent.name} declined your challenge.`);
            }
          }
        });
      } catch (err) {
        console.error("Error creating challenge:", err);
        setSendingChallenge(false);
        setChallengeError("Failed to send challenge. Please try again.");
      }
    } else {
      setCountdown(3);
    }
  };

  const handleTossChoice = (choice: 'odd' | 'even') => {
    setTossChoice(choice);
    setTossStep('number');
  };

  const playToss = (p1Value: number) => {
    setTossP1Val(p1Value);
    setIsRevealing(true);

    // Calculate Opponent Move
    let p2Value = Math.floor(Math.random() * 6) + 1;
    setTossP2Val(p2Value);

    setTimeout(() => {
      const sum = p1Value + p2Value;
      const sumIsEven = sum % 2 === 0;
      const p1Won = (tossChoice === 'even' && sumIsEven) || (tossChoice === 'odd' && !sumIsEven);

      if (gameMode === 'pve') {
        setTossWinner(p1Won ? 'player' : 'cpu');
      } else {
        setTossWinner(p1Won ? 'player1' : 'player2');
      }

      setTossStep('reveal');
      setIsRevealing(false);
    }, 1000);
  };

  const selectRole = (role: 'batting' | 'bowling') => {
    setSelectedRole(role);
    setCurrentInnings(1);
    setP1Runs(0);
    setP2Runs(0);
    setBallsFaced(0);
    setTarget(null);
    setLastP1Move(null);
    setLastP2Move(null);
    setGameHistory([]);
    setCommentary("Let's play! Pick your first gesture.");
    setCommentaryColor('text-slate-400');
    setPhase('playing');
  };

  const handleCpuRoleSelection = () => {
    // CPU chooses randomly
    const roles: ('batting' | 'bowling')[] = ['batting', 'bowling'];
    const chosen = roles[Math.floor(Math.random() * 2)];
    // If CPU chooses batting, Player is bowling (first innings role)
    const playerRole = chosen === 'batting' ? 'bowling' : 'batting';
    setCommentary(`${player2Name} won the toss & chose to ${chosen.toUpperCase()} first!`);
    setTimeout(() => {
      selectRole(playerRole);
    }, 1500);
  };

  // Get batsman & bowler details based on current innings
  const getMatchRoles = (): { batsman: string; bowler: string; isP1Batting: boolean } => {
    if (gameMode === 'pve') {
      const isPlayerBattingFirst = selectedRole === 'batting';
      const p1Disp = player1Name || 'Player';
      const p2Disp = player2Name || 'CPU';
      if (currentInnings === 1) {
        return {
          batsman: isPlayerBattingFirst ? p1Disp : p2Disp,
          bowler: isPlayerBattingFirst ? p2Disp : p1Disp,
          isP1Batting: isPlayerBattingFirst
        };
      } else {
        return {
          batsman: isPlayerBattingFirst ? p2Disp : p1Disp,
          bowler: isPlayerBattingFirst ? p1Disp : p2Disp,
          isP1Batting: !isPlayerBattingFirst
        };
      }
    } else {
      const isP1BattingFirst = selectedRole === 'batting';
      if (currentInnings === 1) {
        return {
          batsman: isP1BattingFirst ? player1Name : player2Name,
          bowler: isP1BattingFirst ? player2Name : player1Name,
          isP1Batting: isP1BattingFirst
        };
      } else {
        return {
          batsman: isP1BattingFirst ? player2Name : player1Name,
          bowler: isP1BattingFirst ? player1Name : player2Name,
          isP1Batting: !isP1BattingFirst
        };
      }
    }
  };

  const playTurn = (p1Move: number) => {
    if (isRevealing || turnCountdown !== null) return;
    setIsRevealing(true);
    setLastP1Move(null);
    setLastP2Move(null);
    setPendingP1Move(p1Move);
    setTurnCountdown(3);
    setCommentary("Get ready... 1, 2, 3... SHOOT!");
    setCommentaryColor("text-yellow-400 font-bold animate-pulse");
  };

  const executeActualTurn = (p1Move: number) => {
    setBallsFaced(prev => prev + 1);

    // Track highest gesture played
    if (p1Move > highestBall) {
      setHighestBall(p1Move);
    }

    // Determine Opponent / CPU Move
    let p2Move = 1;
    if (gameMode === 'pve') {
      if (aiDifficulty === 'hard') {
        // Smart AI: anticipates player favorites or averages
        const playerFavorite = userProfile?.favoriteNumber || 6;
        const weights = [0.15, 0.15, 0.15, 0.20, 0.15, 0.20]; // higher chance on 4 and 6
        const rand = Math.random();
        if (rand < 0.3) {
          p2Move = playerFavorite; // 30% chance to target player's favorite number
        } else {
          p2Move = Math.floor(Math.random() * 6) + 1;
        }
      } else {
        p2Move = Math.floor(Math.random() * 6) + 1;
      }
    } else {
      p2Move = Math.floor(Math.random() * 6) + 1;
    }

    setLastP1Move(p1Move);
    setLastP2Move(p2Move);

    setTimeout(() => {
      const { isP1Batting } = getMatchRoles();
      const currentBatterRuns = isP1Batting ? p1Runs : p2Runs;
      const isMatched = p1Move === p2Move;

      if (isMatched) {
        // OUT!
        const randomOutComment = comments.out[Math.floor(Math.random() * comments.out.length)];
        setCommentary(randomOutComment);
        setCommentaryColor('text-red-400 font-bold');

        setGameHistory(prev => [...prev, { p1: p1Move, p2: p2Move, score: 0, isOut: true, batsman: isP1Batting ? 'p1' : 'p2' }]);

        // Handle end of innings
        if (currentInnings === 1) {
          // Setting the target for Innings 2
          const firstInningsScore = isP1Batting ? p1Runs : p2Runs;
          setTarget(firstInningsScore + 1);
          setPhase('innings_break');
        } else {
          // Innings 2 batter is out -> End of Match!
          triggerMatchEnd();
        }
      } else {
        // Scores Runs!
        const runsAdded = isP1Batting ? p1Move : p2Move;
        const scoreComment = comments.score[Math.floor(Math.random() * comments.score.length)];
        setCommentary(scoreComment);
        setCommentaryColor('text-orange-400 font-semibold');

        let updatedP1Runs = p1Runs;
        let updatedP2Runs = p2Runs;

        if (isP1Batting) {
          updatedP1Runs += runsAdded;
          setP1Runs(updatedP1Runs);
        } else {
          updatedP2Runs += runsAdded;
          setP2Runs(updatedP2Runs);
        }

        setGameHistory(prev => [...prev, { p1: p1Move, p2: p2Move, score: runsAdded, isOut: false, batsman: isP1Batting ? 'p1' : 'p2' }]);

        // Check Chasing Win Condition (Innings 2)
        if (currentInnings === 2 && target !== null) {
          const secondInningsScore = isP1Batting ? updatedP1Runs : updatedP2Runs;
          if (secondInningsScore >= target) {
            // Chase Successful! batsman wins instantly
            triggerMatchEnd(true);
          }
        }
      }

      setIsRevealing(false);
    }, 1000);
  };

  const startSecondInnings = () => {
    setCurrentInnings(2);
    setLastP1Move(null);
    setLastP2Move(null);
    setCommentary(`Target is ${target} runs. Let's begin the chase!`);
    setPhase('playing');
  };

  const triggerMatchEnd = (chaseSuccess = false) => {
    setPhase('result');
    // Calculate match duration
    const diffMs = Date.now() - matchStartTime;
    const mins = Math.floor(diffMs / 60000).toString().padStart(2, '0');
    const secs = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
    setMatchDuration(`${mins}:${secs}`);

    // Compute dynamic Luck Index (how well player avoided match moves or guessed CPU moves)
    let perfectAvoidances = 0;
    gameHistory.forEach(turn => {
      const diff = Math.abs(turn.p1 - turn.p2);
      if (diff > 1) perfectAvoidances++;
    });
    const calculatedLuck = gameHistory.length > 0 ? Math.round((perfectAvoidances / gameHistory.length) * 100) : 80;
    setLuckIndex(Math.max(30, Math.min(100, calculatedLuck)));

    // Save digital match results to Firestore!
    saveDigitalMatchToCloud();
  };

  const saveDigitalMatchToCloud = async () => {
    const isGuest = !auth.currentUser || auth.currentUser.uid === 'guest_local' || userProfile?.uid === 'guest_local';
    if (isGuest) {
      onGameSaved();
      return;
    }

    const { batsman, isP1Batting } = getMatchRoles();
    const playerRuns = p1Runs;
    const cpuRuns = p2Runs;
    const didPlayerWin = playerRuns > cpuRuns;

    if (opponentType === 'tournament' && selectedTournamentMatch) {
      const matchId = selectedTournamentMatch.id;
      const myTeam = playerTeamName || '';
      const myName = userProfile?.displayName || '';
      
      const p1Low = selectedTournamentMatch.player1.toLowerCase().trim();
      const myTeamLow = myTeam.toLowerCase().trim();
      const myNameLow = myName.toLowerCase().trim();
      
      const isMyTeamPlayer1 = (p1Low === myTeamLow || p1Low === myNameLow);
      
      let tournamentWinner: string;
      if (playerRuns > cpuRuns) {
        tournamentWinner = isMyTeamPlayer1 ? selectedTournamentMatch.player1 : selectedTournamentMatch.player2;
      } else if (cpuRuns > playerRuns) {
        tournamentWinner = isMyTeamPlayer1 ? selectedTournamentMatch.player2 : selectedTournamentMatch.player1;
      } else {
        tournamentWinner = 'Tie';
      }

      const updatedMatchPayload: any = {
        ...selectedTournamentMatch,
        status: 'completed',
        player1Runs: isMyTeamPlayer1 ? playerRuns : cpuRuns,
        player2Runs: isMyTeamPlayer1 ? cpuRuns : playerRuns,
        player1Conceded: isMyTeamPlayer1 ? cpuRuns : playerRuns,
        player2Conceded: isMyTeamPlayer1 ? playerRuns : cpuRuns,
        winner: tournamentWinner,
        creatorId: selectedTournamentMatch.creatorId || 'admin_local',
        createdAt: selectedTournamentMatch.createdAt || new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'digitalTournamentMatches', matchId), updatedMatchPayload);
        onGameSaved();
      } catch (err) {
        console.error("Error saving official digital tournament match scorecard: ", err);
      }
      return;
    }

    const matchId = `digital_${Date.now()}`;
    const digitalMatchPayload: DigitalMatch = {
      id: matchId,
      playerUid: auth.currentUser?.uid || userProfile?.uid || 'guest_local',
      playerName: userProfile?.displayName || 'Player',
      playerTeamName: playerTeamName || undefined,
      opponentName: opponentType === 'registered' && selectedOpponent 
        ? selectedOpponent.name 
        : `CPU (${aiDifficulty.toUpperCase()})`,
      opponentTeamName: opponentType === 'registered' && selectedOpponent
        ? selectedOpponent.teamName
        : undefined,
      opponentUid: opponentType === 'registered' && selectedOpponent
        ? selectedOpponent.id
        : undefined,
      playerRuns,
      opponentRuns: cpuRuns,
      winner: didPlayerWin ? 'player' : 'opponent',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'digitalMatches', matchId), digitalMatchPayload);
      onGameSaved();
    } catch (err) {
      console.error("Error saving digital match to Firestore: ", err);
    }
  };

  // Helper variables for live game UI
  const { batsman: currentBatsman, bowler: currentBowler, isP1Batting: isPlayerBattingNow } = getMatchRoles();
  const currentBatterScore = isPlayerBattingNow ? p1Runs : p2Runs;
  const currentBowlerScore = isPlayerBattingNow ? p2Runs : p1Runs;
  const bowlerMove = isPlayerBattingNow ? lastP2Move : lastP1Move;
  const batsmanMove = isPlayerBattingNow ? lastP1Move : lastP2Move;

  // Win Probability calculation
  const getWinProbability = () => {
    if (phase !== 'playing') return 50;
    if (currentInnings === 1) {
      // 1st Innings: base prob around runs scored
      return Math.min(95, Math.max(5, 50 + Math.round(currentBatterScore * 1.5)));
    } else {
      // 2nd Innings: Chasing
      if (!target) return 50;
      const pctToTarget = (currentBatterScore / target) * 100;
      return Math.min(99, Math.max(1, Math.round(pctToTarget)));
    }
  };

  const renderMultiplayerArena = () => {
    if (!activeChallengeData) {
      return (
        <div className="bg-[#161D2F] border border-slate-700 rounded-3xl p-12 text-center space-y-6 max-w-lg mx-auto shadow-xl">
          <RefreshCw className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
          <p className="text-slate-300 font-medium">Synchronizing live duel session...</p>
        </div>
      );
    }

    // 1. Toss Role Selection Phase
    if (!activeChallengeData.tossChoice) {
      const isWinnerMe = activeChallengeData.tossWinner === myPlayerRole;
      const winnerName = activeChallengeData.tossWinner === 'p1' ? activeChallengeData.challengerName : activeChallengeData.targetName;
      
      const isCallerMe = activeChallengeData.tossCaller === myPlayerRole;
      const callerName = activeChallengeData.tossCaller === 'p1' ? activeChallengeData.challengerName : activeChallengeData.targetName;

      return (
        <div className="bg-[#161D2F] border border-slate-700 rounded-3xl p-8 max-w-xl mx-auto shadow-2xl space-y-8 text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-orange-500 to-purple-600 animate-pulse" />
          
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full uppercase tracking-widest">
              🪙 Real-time Coin Flip
            </span>
            <h2 className="font-display font-black text-3xl text-slate-100 tracking-tight uppercase">
              {activeChallengeData.tossWinner ? "TOSS DECIDED!" : "THE TOSS"}
            </h2>
          </div>

          {!activeChallengeData.tossCaller ? (
            <div className="py-6 space-y-4">
              <RefreshCw className="w-12 h-12 animate-spin text-orange-400 mx-auto" />
              <p className="text-sm font-medium text-slate-400">Initializing toss...</p>
            </div>
          ) : !activeChallengeData.tossOddEvenChoice ? (
            <div className="space-y-6">
              {isCallerMe ? (
                <>
                  <p className="text-slate-300 font-bold">You were chosen to call the toss!</p>
                  <div className="flex gap-4 justify-center">
                    <button onClick={() => selectMultiplayerTossOddEven('odd')} className="px-6 py-3 bg-purple-500/20 text-purple-300 border border-purple-500/50 rounded-xl hover:bg-purple-500/30 transition-colors font-bold uppercase tracking-wider">ODD</button>
                    <button onClick={() => selectMultiplayerTossOddEven('even')} className="px-6 py-3 bg-orange-500/20 text-orange-300 border border-orange-500/50 rounded-xl hover:bg-orange-500/30 transition-colors font-bold uppercase tracking-wider">EVEN</button>
                  </div>
                </>
              ) : (
                <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-4 max-w-md mx-auto">
                  <p className="text-sm text-slate-300 font-medium">
                    Waiting for <strong>{callerName}</strong> to pick Odd or Even...
                  </p>
                  <RefreshCw className="w-6 h-6 animate-spin text-orange-500 mx-auto" />
                </div>
              )}
            </div>
          ) : !activeChallengeData.tossWinner ? (
            <div className="space-y-6">
              <p className="text-slate-300 text-sm">
                <strong>{callerName}</strong> chose <span className="font-bold text-orange-400 uppercase">{activeChallengeData.tossOddEvenChoice}</span>.
              </p>
              
              {((myPlayerRole === 'p1' && activeChallengeData.tossP1Move) || (myPlayerRole === 'p2' && activeChallengeData.tossP2Move)) ? (
                <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-4 max-w-md mx-auto">
                  {activeChallengeData.isResolvingToss ? (
                    <div>
                      <p className="text-sm text-slate-300 font-medium mb-2">Resolving Toss...</p>
                      <div className="flex items-center justify-center gap-4 text-3xl">
                        <span>{handGestures[activeChallengeData.tossP1Move]?.icon}</span>
                        <span className="text-sm font-bold text-slate-500">vs</span>
                        <span>{handGestures[activeChallengeData.tossP2Move]?.icon}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-slate-300 font-medium">Move locked in!</p>
                      <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                        <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
                        Waiting for opponent...
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-slate-400 font-bold mb-4">Pick a number (1-6) for the toss!</p>
                  <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        onClick={() => submitMultiplayerTossMove(num)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${handGestures[num].style}`}
                      >
                        <span className="text-2xl mb-1">{handGestures[num].icon}</span>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider">{num}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : isWinnerMe ? (
            <div className="space-y-6">
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl max-w-md mx-auto">
                <span className="text-2xl">🎉</span>
                <p className="text-sm font-bold text-orange-400 mt-2">
                  CONGRATULATIONS! YOU WON THE TOSS!
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Choose whether you want to bat or bowl first.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <button
                  onClick={() => chooseMultiplayerRole('batting')}
                  className="py-4 bg-gradient-to-br from-orange-500 to-red-600 hover:brightness-105 active:translate-y-0.5 transition-all text-white font-display font-black text-sm uppercase rounded-2xl shadow-lg cursor-pointer"
                >
                  🏏 Bat First
                </button>
                <button
                  onClick={() => chooseMultiplayerRole('bowling')}
                  className="py-4 bg-[#1A2238] border border-slate-700 text-slate-200 hover:bg-slate-800 active:translate-y-0.5 transition-all font-display font-black text-sm uppercase rounded-2xl cursor-pointer"
                >
                  🥎 Bowl First
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-4 max-w-md mx-auto">
              <p className="text-sm text-slate-300 font-medium">
                🛡️ <strong>{winnerName}</strong> won the toss!
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
                Waiting for opponent to choose Batting/Bowling...
              </div>
            </div>
          )}
        </div>
      );
    }

    // 3. Match Finished / Results Screen
    if (activeChallengeData.status === 'completed' || activeChallengeData.gameEnded) {
      const isWinnerMe = (activeChallengeData.p1Score > activeChallengeData.p2Score && myPlayerRole === 'p1') ||
                         (activeChallengeData.p2Score > activeChallengeData.p1Score && myPlayerRole === 'p2');
      const isTie = activeChallengeData.p1Score === activeChallengeData.p2Score;
      
      return (
        <div className="bg-[#161D2F] border border-slate-700 rounded-3xl p-8 max-w-xl mx-auto shadow-2xl space-y-8 text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-orange-500 to-red-500" />
          
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full uppercase tracking-widest">
              🏆 Match Completed
            </span>
            <h2 className="font-display font-black text-3xl text-slate-100 tracking-tight uppercase">
              {isTie ? "⚔️ IT'S A TIE DUEL!" : isWinnerMe ? "🎉 YOU ARE VICTORIOUS!" : "🛡️ OPPONENT VICTORIOUS!"}
            </h2>
          </div>

          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl max-w-md mx-auto space-y-4">
            <p className="text-sm font-sans font-medium text-slate-300 leading-relaxed">
              {activeChallengeData.commentary}
            </p>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-left">
              <div>
                <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">Your score</p>
                <p className="font-display font-black text-2xl text-orange-400">
                  {myPlayerRole === 'p1' ? activeChallengeData.p1Score : activeChallengeData.p2Score}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">Opponent score</p>
                <p className="font-display font-black text-2xl text-slate-100">
                  {myPlayerRole === 'p1' ? activeChallengeData.p2Score : activeChallengeData.p1Score}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (setActiveChallengeId) setActiveChallengeId(null);
            }}
            className="w-full max-w-md mx-auto py-3.5 bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-sm uppercase rounded-xl shadow-lg hover:brightness-105 active:translate-y-0.5 transition-all cursor-pointer"
          >
            Quit to Digital Home
          </button>
        </div>
      );
    }

    // 2. Playing Phase
    const isP1BatsmanIn1 = (activeChallengeData.tossWinner === 'p1' && activeChallengeData.tossChoice === 'batting') || 
                           (activeChallengeData.tossWinner === 'p2' && activeChallengeData.tossChoice === 'bowling');
    const isP1Batsman = activeChallengeData.currentInnings === 1 ? isP1BatsmanIn1 : !isP1BatsmanIn1;
    const isMyBattingNow = (myPlayerRole === 'p1' && isP1Batsman) || (myPlayerRole === 'p2' && !isP1Batsman);

    const firstInningsScore = isP1BatsmanIn1 ? activeChallengeData.p1Score : activeChallengeData.p2Score;
    const targetScore = activeChallengeData.currentInnings === 2 ? firstInningsScore + 1 : null;

    const batsmanName = isP1Batsman ? activeChallengeData.challengerName : activeChallengeData.targetName;
    const bowlerName = isP1Batsman ? activeChallengeData.targetName : activeChallengeData.challengerName;
    
    const batsmanScore = isP1Batsman ? activeChallengeData.p1Score : activeChallengeData.p2Score;

    // Moves representation
    const revealMoves = activeChallengeData.isResolvingTurn || (activeChallengeData.p1MoveSubmitted && activeChallengeData.p2MoveSubmitted);
    const mySubmittedMove = myPlayerRole === 'p1' ? activeChallengeData.p1LastMove : activeChallengeData.p2LastMove;
    
    const displayBatsmanMove = revealMoves 
      ? (isP1Batsman ? activeChallengeData.p1LastMove : activeChallengeData.p2LastMove)
      : (isMyBattingNow && isMyTurnSubmitted ? mySubmittedMove : null);

    const displayBowlerMove = revealMoves
      ? (isP1Batsman ? activeChallengeData.p2LastMove : activeChallengeData.p1LastMove)
      : (!isMyBattingNow && isMyTurnSubmitted ? mySubmittedMove : null);

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Match Header with Live Scorecards */}
        <div className="bg-[#161D2F] border border-slate-700 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 to-purple-600" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                  LIVE MULTIPLAYER DUEL
                </span>
              </div>
              <h2 className="font-display font-black text-2xl text-slate-100 tracking-tight uppercase pt-0.5">
                🏏 {activeChallengeData.challengerName} vs {activeChallengeData.targetName}
              </h2>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider">
              Innings {activeChallengeData.currentInnings} • {isMyBattingNow ? 'YOU BATTING' : 'YOU BOWLING'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 items-center">
            {/* Challenger Score */}
            <div className="text-center md:text-left space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                {activeChallengeData.challengerName} (Team: {activeChallengeData.challengerTeamName})
              </span>
              <div className="flex justify-center md:justify-start items-baseline gap-1.5">
                <span className="font-display font-black text-3xl text-slate-100">
                  {activeChallengeData.p1Score}
                </span>
                <span className="text-xs text-slate-400 font-mono">runs</span>
              </div>
            </div>

            {/* Target Display */}
            <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-2xl text-center space-y-1">
              {activeChallengeData.currentInnings === 2 ? (
                <>
                  <span className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-wider block">
                    Runs Needed to Win
                  </span>
                  <p className="font-display font-black text-2xl text-slate-100 leading-none">
                    {Math.max(0, targetScore! - batsmanScore)}
                  </p>
                  <span className="text-[10px] text-slate-500 font-medium block">
                    Target: {targetScore} runs
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider block">
                    Current Innings
                  </span>
                  <p className="font-display font-black text-xl text-slate-300 leading-none">
                    Setting Target
                  </p>
                </>
              )}
            </div>

            {/* Target Score */}
            <div className="text-center md:text-right space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                {activeChallengeData.targetName} (Team: {activeChallengeData.targetTeamName})
              </span>
              <div className="flex justify-center md:justify-end items-baseline gap-1.5">
                <span className="font-display font-black text-3xl text-slate-100">
                  {activeChallengeData.p2Score}
                </span>
                <span className="text-xs text-slate-400 font-mono">runs</span>
              </div>
            </div>
          </div>
        </div>

        {/* The Pitch (Visual Action Area) */}
        <div className="relative bg-gradient-to-b from-[#121824] to-[#1A2238] rounded-3xl p-6 md:p-8 border border-slate-700 shadow-xl min-h-[320px] flex flex-col justify-between overflow-hidden">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-800/50" />
          <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-800/50 -translate-x-1/2 border-dashed border-r border-slate-700/30" />
          
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-7 items-center gap-6 py-4">
            {/* Bowler Card */}
            <div className={`md:col-span-3 flex flex-col items-center p-6 rounded-2xl border transition-all ${
              !isMyBattingNow 
                ? 'bg-purple-950/15 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.12)]' 
                : 'bg-[#161D2F]/80 border-slate-700/60'
            }`}>
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase flex items-center gap-1.5 mb-3">
                🥎 BOWLING
              </span>
              
              <h4 className="font-display font-black text-xl text-slate-100 uppercase tracking-tight">
                {bowlerName}
              </h4>
              <p className="text-[10px] font-mono text-slate-400 mb-4 font-bold tracking-wider">
                {!isMyBattingNow ? '👤 (YOU)' : '🛡️ (OPPONENT)'}
              </p>

              <div className={`w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center text-4xl shadow-lg border-4 transition-all duration-300 ${
                displayBowlerMove 
                  ? 'bg-purple-500/15 border-purple-500/40 scale-105' 
                  : 'bg-slate-800/50 border-slate-700'
              }`}>
                {displayBowlerMove ? handGestures[displayBowlerMove]?.icon : (
                  (!isMyBattingNow && isMyTurnSubmitted) ? '✔️' : (isMyBattingNow && activeChallengeData.p2MoveSubmitted && myPlayerRole === 'p1') || (isMyBattingNow && activeChallengeData.p1MoveSubmitted && myPlayerRole === 'p2') ? '⚡' : '❓'
                )}
              </div>

              <span className="text-xs font-mono font-bold text-purple-300 mt-4 h-5">
                {displayBowlerMove ? `Played Gesture ${displayBowlerMove}` : (
                  (!isMyBattingNow && isMyTurnSubmitted) ? 'Locked in!' : 'Bowl first...'
                )}
              </span>
            </div>

            {/* Central Countdown */}
            <div className="md:col-span-1 flex flex-col items-center justify-center py-4 md:py-0">
              <motion.div 
                key={multiplayerTurnSeconds}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className={`w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center font-display font-black text-white select-none shadow-xl transition-all duration-300 ${
                  multiplayerTurnSeconds <= 4 
                    ? 'bg-red-600 border-red-400 animate-pulse' 
                    : 'bg-slate-900 border-slate-700'
                }`}
              >
                <span className="text-[9px] font-mono text-slate-400 uppercase leading-none font-bold font-bold">Turn</span>
                <span className="text-xl leading-none pt-0.5">{multiplayerTurnSeconds}s</span>
              </motion.div>
              <span className="text-[10px] font-mono font-bold text-slate-500 mt-2 uppercase tracking-wide">
                Time Limit
              </span>
            </div>

            {/* Batter Card */}
            <div className={`md:col-span-3 flex flex-col items-center p-6 rounded-2xl border transition-all ${
              isMyBattingNow 
                ? 'bg-orange-950/15 border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.12)]' 
                : 'bg-[#161D2F]/80 border-slate-700/60'
            }`}>
              <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 px-3.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase flex items-center gap-1.5 mb-3">
                🏏 BATTING
              </span>

              <h4 className="font-display font-black text-xl text-slate-100 uppercase tracking-tight">
                {batsmanName}
              </h4>
              <p className="text-[10px] font-mono text-slate-400 mb-4 font-bold tracking-wider">
                {isMyBattingNow ? '👤 (YOU)' : '🛡️ (OPPONENT)'}
              </p>

              <div className={`w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center text-4xl shadow-lg border-4 transition-all duration-300 ${
                displayBatsmanMove 
                  ? 'bg-orange-500/15 border-orange-500/40 scale-105' 
                  : 'bg-slate-800/50 border-slate-700'
              }`}>
                {displayBatsmanMove ? handGestures[displayBatsmanMove]?.icon : (
                  (isMyBattingNow && isMyTurnSubmitted) ? '✔️' : (!isMyBattingNow && activeChallengeData.p1MoveSubmitted && myPlayerRole === 'p2') || (!isMyBattingNow && activeChallengeData.p2MoveSubmitted && myPlayerRole === 'p1') ? '⚡' : '👋'
                )}
              </div>

              <span className="text-xs font-mono font-bold text-orange-300 mt-4 h-5">
                {displayBatsmanMove ? `Played Gesture ${displayBatsmanMove}` : (
                  (isMyBattingNow && isMyTurnSubmitted) ? 'Locked in!' : 'Bat first...'
                )}
              </span>
            </div>
          </div>

          {/* Commentary Overlay */}
          <div className="relative z-10 bg-[#1A2238]/95 backdrop-blur-md px-6 py-3 rounded-full border border-slate-700 text-center max-w-md mx-auto shadow-2xl mt-4">
            <p className="font-sans text-xs md:text-sm italic font-bold text-orange-400">
              {activeChallengeData.commentary}
            </p>
          </div>
        </div>

        {/* Gesture Controller */}
        <div className="space-y-3">
          <p className="text-center text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            {isMyTurnSubmitted ? 'WAITING FOR OPPONENT...' : 'SELECT YOUR GESTURE'}
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((num) => {
              const gesture = handGestures[num];
              const isSelected = mySubmittedMove === num;
              return (
                <button
                  key={num}
                  disabled={isMyTurnSubmitted}
                  onClick={() => submitMultiplayerMove(num)}
                  className={`relative p-4 md:p-5 border-2 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all duration-100 ${
                    isMyTurnSubmitted
                      ? isSelected
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 cursor-not-allowed'
                        : 'bg-slate-900/40 border-slate-900 text-slate-600 cursor-not-allowed opacity-40'
                      : 'bg-[#161D2F] text-slate-200 border-slate-800 hover:scale-105 active:scale-95 cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5'
                  }`}
                >
                  <span className="text-3xl md:text-4xl">{gesture.icon}</span>
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider">{gesture.label}</span>
                  <div className="absolute top-1.5 right-2 w-4 h-4 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center font-display font-black text-[9px] text-slate-300">
                    {num}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="digital-game-arena" className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Upcoming Official Digital Matches Alert */}
      {!activeChallengeId && phase === 'setup' && upcomingTournamentMatches.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500/20 to-purple-600/20 border border-orange-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden animate-pulse-slow">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
          <div className="relative z-10 space-y-4">
            <h3 className="font-display font-black text-xl text-orange-400 uppercase tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5" /> Official Match Starting Soon!
            </h3>
            {upcomingTournamentMatches.map(match => (
              <div key={match.id} className="bg-[#1A2238]/80 border border-slate-700 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                    {match.stage} {match.group ? `- ${formatGroupName(match.group)}` : ''} | {formatTimeTo12Hour(match.time)}
                  </div>
                  <div className="font-bold text-slate-200">
                    <span className={match.player1 === playerTeamName ? 'text-orange-400 font-black' : ''}>{match.player1}</span>
                    <span className="mx-2 text-slate-500 font-mono text-[10px]">VS</span>
                    <span className={match.player2 === playerTeamName ? 'text-orange-400 font-black' : ''}>{match.player2}</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const opponentTeam = match.player1 === playerTeamName ? match.player2 : match.player1;
                    const opp = registeredPlayers.find(p => p.teamName === opponentTeam);
                    if (opp) {
                      setOpponentType('registered');
                      setSelectedOpponent(opp);
                    }
                  }}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors"
                >
                  Prepare
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeChallengeId && activeChallengeData ? (
        renderMultiplayerArena()
      ) : (
        <>
      
      {/* 3, 2, 1 Countdown Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F1423]/95 backdrop-blur-md"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-center gap-6 text-center"
            >
              <span className="text-[12px] font-mono font-bold tracking-widest text-orange-400 uppercase">
                Match Commencing In...
              </span>
              <h1 className="font-display font-black text-8xl md:text-9xl text-white">
                {countdown === 0 ? "PLAY!" : countdown}
              </h1>
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full text-xs font-mono font-bold text-orange-400 uppercase">
                <Zap className="w-4 h-4 animate-bounce" /> Get Ready to Bat & Bowl!
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sending Challenge Overlay */}
      <AnimatePresence>
        {sendingChallenge && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F1423]/95 backdrop-blur-md p-6"
          >
            <div className="max-w-md w-full bg-[#161D2F] border border-orange-500/30 rounded-2xl p-6 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 to-red-500" />
              <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto text-orange-400">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-black text-xl text-slate-100 uppercase tracking-tight">
                  Sending Live Challenge
                </h3>
                <p className="text-sm text-slate-400">
                  {challengeStatusMessage}
                </p>
              </div>

              {challengeTimeout !== null && (
                <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    Waiting for Response
                  </span>
                  <span className="font-display font-black text-3xl text-orange-400">
                    {challengeTimeout}s
                  </span>
                </div>
              )}

              <button
                onClick={async () => {
                  setSendingChallenge(false);
                  setChallengeTimeout(null);
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 font-display font-black text-xs uppercase rounded-xl transition-all cursor-pointer"
              >
                Cancel Challenge
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Challenge Error Overlay */}
      <AnimatePresence>
        {challengeError && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm"
          >
            <div className="max-w-md w-full bg-[#161D2F] border border-red-500/30 rounded-2xl p-6 text-center space-y-6 shadow-2xl">
              <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-400">
                <span className="text-xl">⚠️</span>
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-black text-lg text-slate-100 uppercase">
                  Challenge Request Notice
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {challengeError}
                </p>
              </div>
              <button
                onClick={() => setChallengeError(null)}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-display font-black text-xs uppercase rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. SETUP PHASE */}
      {phase === 'setup' && (
        <div className="bg-[#161D2F] border border-slate-700 rounded-2xl p-6 md:p-8 text-center space-y-6 max-w-lg mx-auto shadow-xl">
          <div className="relative inline-block group">
            <div className="absolute inset-0 bg-orange-500 rounded-full blur-xl opacity-20 scale-110"></div>
            <div className="relative w-24 h-24 bg-gradient-to-tr from-orange-500 to-purple-600 rounded-full flex items-center justify-center border-2 border-slate-500 shadow-xl">
              <Zap className="w-12 h-12 text-white fill-current animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-black text-2xl text-orange-400 tracking-tight uppercase">HCL Digital Arena</h3>
            <p className="text-slate-400 text-sm font-medium">
              Step onto the virtual pitch! Choose to play against the computer, select another registered player for a friendly, or compete in an official tournament match.
            </p>
          </div>

          <div className="space-y-4 pt-4 text-left">
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Opponent Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpponentType('cpu');
                    setSelectedOpponent(null);
                  }}
                  className={`py-3 rounded-xl text-xs md:text-sm font-semibold border text-center transition-all cursor-pointer ${
                    opponentType === 'cpu'
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-400 font-black shadow-lg'
                      : 'bg-[#1A2238] border-slate-700 text-slate-400'
                  }`}
                >
                  🤖 Play vs CPU
                </button>
                <button
                  type="button"
                  disabled={!hasRegisteredTeam}
                  onClick={() => {
                    if (!hasRegisteredTeam) return;
                    setOpponentType('registered');
                    if (registeredPlayers.length > 0 && !selectedOpponent) {
                      setSelectedOpponent(registeredPlayers[0]);
                    }
                  }}
                  className={`py-3 rounded-xl text-xs md:text-sm font-semibold border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    !hasRegisteredTeam
                      ? 'bg-slate-800/20 border-slate-800 text-slate-600 cursor-not-allowed'
                      : opponentType === 'registered'
                        ? 'bg-orange-500/20 border-orange-500/40 text-orange-400 font-black shadow-lg'
                        : 'bg-[#1A2238] border-slate-700 text-slate-400 hover:border-orange-500/30'
                  }`}
                  title={!hasRegisteredTeam ? "Register your team name under the Dashboard to unlock!" : "Play against other registered players"}
                >
                  {hasRegisteredTeam ? '🛡️ Friendly' : '🔒 Friendly'}
                </button>
                <button
                  type="button"
                  disabled={!hasRegisteredTeam || myScheduledMatches.length === 0}
                  onClick={() => {
                    if (!hasRegisteredTeam || myScheduledMatches.length === 0) return;
                    setOpponentType('tournament');
                  }}
                  className={`py-3 rounded-xl text-xs md:text-sm font-semibold border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    !hasRegisteredTeam || myScheduledMatches.length === 0
                      ? 'bg-slate-800/20 border-slate-800 text-slate-600 cursor-not-allowed'
                      : opponentType === 'tournament'
                        ? 'bg-orange-500/20 border-orange-500/40 text-orange-400 font-black shadow-lg'
                        : 'bg-[#1A2238] border-slate-700 text-slate-400 hover:border-orange-500/30'
                  }`}
                  title={
                    !hasRegisteredTeam 
                      ? "Register your team name under the Dashboard to unlock!" 
                      : myScheduledMatches.length === 0 
                        ? "No scheduled digital tournament matches found for your team" 
                        : "Play an official scheduled tournament match"
                  }
                >
                  {hasRegisteredTeam && myScheduledMatches.length > 0 ? '🏆 Tournament' : '🔒 Tournament'}
                </button>
              </div>

              {!hasRegisteredTeam && (
                <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 font-medium leading-relaxed">
                  ⚠️ <strong>Feature Locked</strong>: The option to play against other registered players is only available once you declare your team name. Please register your team name first!
                </div>
              )}

              {hasRegisteredTeam && myScheduledMatches.length === 0 && (
                <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 font-medium leading-relaxed">
                  📢 <strong>No Scheduled Matches</strong>: You don't have any scheduled digital tournament matches right now. Ask an admin to schedule a match for you to play in the official tournament!
                </div>
              )}
            </div>

            {opponentType === 'cpu' && (
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">AI Difficulty</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAiDifficulty('easy')}
                    className={`py-3 rounded-xl text-sm font-semibold border text-center transition-all cursor-pointer ${
                      aiDifficulty === 'easy'
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-400 font-black shadow-lg'
                        : 'bg-[#1A2238] border-slate-700 text-slate-400'
                    }`}
                  >
                    Easy CPU
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiDifficulty('hard')}
                    className={`py-3 rounded-xl text-sm font-semibold border text-center transition-all cursor-pointer ${
                      aiDifficulty === 'hard'
                        ? 'bg-orange-500/20 border-orange-500/40 text-orange-400 font-black shadow-lg'
                        : 'bg-[#1A2238] border-slate-700 text-slate-400'
                    }`}
                  >
                    Hard Core CPU
                  </button>
                </div>
              </div>
            )}

            {opponentType === 'registered' && (
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Select Registered Opponent</label>
                {registeredPlayers.length === 0 ? (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-xs text-orange-300 text-center font-medium leading-relaxed">
                    No other registered teams found yet. Encourage other players to register their team names to compete against them!
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <select
                        value={selectedOpponent?.id || ''}
                        onChange={(e) => {
                          const opp = registeredPlayers.find(p => p.id === e.target.value);
                          if (opp) setSelectedOpponent(opp);
                        }}
                        className="w-full bg-[#1A2238] border border-slate-700 text-slate-200 py-3.5 px-4 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none cursor-pointer"
                      >
                        {registeredPlayers.map((player) => {
                          const online = isPlayerOnline(player.lastActive);
                          return (
                            <option key={player.id} value={player.id}>
                              {player.name} ({player.teamName}) {online ? '● ONLINE' : '(Offline)'}
                            </option>
                          );
                        })}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                        ▼
                      </div>
                    </div>

                    {selectedOpponent && (
                      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 font-mono">
                        <span className="text-slate-400">Opponent Availability:</span>
                        {isPlayerOnline(selectedOpponent.lastActive) ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                            ● Online & Ready to Play
                          </span>
                        ) : (
                          <span className="text-rose-400 font-bold flex items-center gap-1">
                            ● Offline (Wait for them to open the app)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {opponentType === 'tournament' && (
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Select Scheduled Tournament Match</label>
                {myScheduledMatches.length === 0 ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 text-center font-medium leading-relaxed">
                    No scheduled digital tournament matches found for your team ({playerTeamName || userProfile?.displayName}). Admins must schedule a match for you first.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <select
                        value={selectedTournamentMatch?.id || ''}
                        onChange={(e) => {
                          const match = myScheduledMatches.find(m => m.id === e.target.value);
                          if (match) setSelectedTournamentMatch(match);
                        }}
                        className="w-full bg-[#1A2238] border border-slate-700 text-slate-200 py-3.5 px-4 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none cursor-pointer"
                      >
                        {myScheduledMatches.map((match) => {
                          const oppName = getTournamentOpponentName(match);
                          return (
                            <option key={match.id} value={match.id}>
                              {match.stage} {match.group ? `- ${formatGroupName(match.group)}` : ''}: vs {oppName}
                            </option>
                          );
                        })}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                        ▼
                      </div>
                    </div>

                    {selectedTournamentMatch && (
                      <div className="p-3.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-xs space-y-1.5 text-slate-300">
                        <div className="flex justify-between">
                          <span className="font-mono text-orange-400">Tournament Stage:</span>
                          <span className="font-semibold">{selectedTournamentMatch.stage}</span>
                        </div>
                        {selectedTournamentMatch.group && (
                          <div className="flex justify-between">
                            <span className="font-mono text-orange-400">Group:</span>
                            <span className="font-semibold">{formatGroupName(selectedTournamentMatch.group)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="font-mono text-orange-400">Match Date & Time:</span>
                          <span className="font-semibold">{selectedTournamentMatch.date} | {formatTimeTo12Hour(selectedTournamentMatch.time)}</span>
                        </div>
                        <p className="text-[10px] text-orange-300/80 italic mt-2 border-t border-orange-500/10 pt-1.5">
                          ⚠️ This is an official tournament match. Once completed, your scores will be saved, and tournament standings, Orange Band, and Purple Band will be updated.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={startToss}
            disabled={
              (opponentType === 'registered' && registeredPlayers.length === 0) ||
              (opponentType === 'tournament' && myScheduledMatches.length === 0)
            }
            className={`w-full text-white font-display font-black text-sm uppercase py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-100 cursor-pointer ${
              (opponentType === 'registered' && registeredPlayers.length === 0) ||
              (opponentType === 'tournament' && myScheduledMatches.length === 0)
                ? 'bg-slate-700/50 border border-slate-700 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-orange-500 to-red-600 shadow-[0_4px_0_0_#9a3412] active:translate-y-1 active:shadow-none'
            }`}
          >
            <Play className="w-4 h-4 fill-current" /> Start Toss
          </button>
        </div>
      )}

      {/* 2. TOSS PHASE */}
      {phase === 'toss' && (
        <div className="bg-[#161D2F] border border-slate-700 rounded-2xl p-6 md:p-8 space-y-6 max-w-xl mx-auto shadow-xl">
          <div className="text-center space-y-2">
            <h3 className="font-display font-black text-2xl text-orange-400 tracking-tight uppercase">Toss Time!</h3>
            <p className="text-slate-400 text-xs md:text-sm font-medium max-w-xs mx-auto">
              The schoolyard toss determines who bats first. Choose ODD or EVEN!
            </p>
          </div>

          {/* Step A: Choose Odd/Even */}
          {tossStep === 'choice' && (
            <div className="grid grid-cols-2 gap-4 pt-4">
              <button
                onClick={() => handleTossChoice('odd')}
                className="p-6 bg-[#1A2238] hover:bg-orange-500/5 border-2 border-slate-700 hover:border-orange-500/40 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all cursor-pointer"
              >
                <span className="font-display font-black text-2xl text-orange-400">ODD</span>
                <span className="text-xs font-mono text-slate-500">1, 3, 5</span>
              </button>
              <button
                onClick={() => handleTossChoice('even')}
                className="p-6 bg-[#1A2238] hover:bg-purple-500/5 border-2 border-slate-700 hover:border-purple-500/40 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all cursor-pointer"
              >
                <span className="font-display font-black text-2xl text-purple-400">EVEN</span>
                <span className="text-xs font-mono text-slate-500">2, 4, 6</span>
              </button>
            </div>
          )}

          {/* Step B: Choose number (1-6) */}
          {tossStep === 'number' && (
            <div className="space-y-4">
              <p className="text-xs font-mono text-center text-orange-400 font-bold uppercase tracking-wider">
                Choice: {tossChoice?.toUpperCase()} - Select gesture number
              </p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    onClick={() => playToss(num)}
                    disabled={isRevealing}
                    className="py-4 bg-[#1A2238] hover:bg-orange-500/10 border-b-4 border-slate-700 hover:border-orange-500 text-xl font-mono font-bold text-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step C: Reveal Toss Sum & Result */}
          {tossStep === 'reveal' && (
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <div className="flex justify-around items-center max-w-md mx-auto pt-4">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Your Gesture</span>
                  <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center text-3xl font-mono font-bold text-orange-400 shadow-md">
                    {tossP1Val}
                  </div>
                </div>
                <span className="text-2xl font-black text-slate-600">+</span>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">CPU Gesture</span>
                  <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center text-3xl font-mono font-bold text-purple-400 shadow-md">
                    {tossP2Val}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-display font-black text-5xl text-orange-400 font-mono">
                  {(tossP1Val || 0) + (tossP2Val || 0)}
                </p>
                <p className="text-xs font-mono font-bold text-slate-400">
                  Sum is {((tossP1Val || 0) + (tossP2Val || 0)) % 2 === 0 ? 'EVEN' : 'ODD'}
                </p>
              </div>

              <div className="bg-[#1A2238] border border-slate-800 p-4 rounded-xl max-w-sm mx-auto">
                {tossWinner === 'player' ? (
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-orange-400">🎉 You won the Toss!</p>
                    <p className="text-xs text-slate-400">Select your first innings role:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => selectRole('batting')}
                        className="py-2.5 bg-orange-500 text-white font-display font-black text-xs uppercase tracking-wide rounded-lg shadow-[0_3px_0_0_#9a3412] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                      >
                        🏏 BAT
                      </button>
                      <button
                        onClick={() => selectRole('bowling')}
                        className="py-2.5 bg-purple-600 text-white font-display font-black text-xs uppercase tracking-wide rounded-lg shadow-[0_3px_0_0_#581c87] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                      >
                        🥎 BOWL
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-red-400">😢 {player2Name} won the Toss!</p>
                    <button
                      onClick={handleCpuRoleSelection}
                      className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-bold text-xs uppercase py-2 rounded-lg cursor-pointer"
                    >
                      Wait for {opponentType === 'registered' ? 'Opponent' : 'CPU'} Decision <ArrowRight className="inline w-3 h-3 ml-1" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. ACTIVE PLAY PITCH */}
      {phase === 'playing' && (
        <div className="space-y-6">
          {/* Bento Scoreboard Banner */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 bg-gradient-to-br from-[#161D2F] to-[#1A2238] border border-slate-700 text-slate-100 rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-10 -top-10 opacity-5">
                <Shield className="w-52 h-52 text-white" />
              </div>
              <div className="relative z-10 flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      Live Broadcast • {currentBatsman} is Batting
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display font-black text-5xl md:text-6xl text-slate-100 leading-none">{currentBatterScore}</span>
                    <span className="text-xl font-bold text-slate-500">/ 0 (Wickets)</span>
                  </div>
                </div>

                {target !== null && (
                  <div className="text-right space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-400 block">
                      Target to Win
                    </span>
                    <div className="font-display font-black text-3xl text-purple-400 font-mono">
                      {target}
                    </div>
                  </div>
                )}
              </div>

              {/* Roles Summary Badges */}
              <div className="mt-6 flex flex-wrap gap-2.5 z-10 items-center">
                <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold">
                  <span className="font-mono tracking-wider uppercase">
                    🏏 {currentBatsman} (Batting)
                  </span>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold">
                  <span className="font-mono tracking-wider uppercase">
                    🥎 {currentBowler} (Bowling)
                  </span>
                </div>
                <div className="bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold font-mono uppercase tracking-wider ml-auto">
                  Innings {currentInnings} • {isPlayerBattingNow ? 'YOU BATTING' : 'YOU BOWLING'}
                </div>
              </div>
            </div>

            {/* Live Stats side grid */}
            <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-4">
              <div className="bg-[#161D2F] border border-slate-700 rounded-2xl p-4 flex flex-col justify-center items-center text-center shadow-xl">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Win Probability</span>
                <span className="font-display font-black text-3xl md:text-4xl text-orange-400 leading-none pt-1">
                  {getWinProbability()}%
                </span>
              </div>
              <div className="bg-[#161D2F] border border-slate-700 rounded-2xl p-4 flex flex-col justify-center items-center text-center shadow-xl">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  {currentInnings === 2 ? "Runs Needed" : "Innings Goal"}
                </span>
                <span className="font-display font-black text-3xl md:text-4xl text-slate-100 leading-none pt-1">
                  {currentInnings === 2 
                    ? (target !== null ? Math.max(0, target - currentBatterScore) : 'N/A') 
                    : "Set Target"}
                </span>
              </div>
            </div>
          </div>

          {/* The Pitch (Visual Action Area) - High Contrast Battle Arena */}
          <div className="relative bg-gradient-to-b from-[#121824] to-[#1A2238] rounded-3xl p-6 md:p-8 border border-slate-700 shadow-xl min-h-[320px] flex flex-col justify-between overflow-hidden">
            {/* Ambient Grass Pitch Lines decoration */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-800/50"></div>
            <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-800/50 -translate-x-1/2 border-dashed border-r border-slate-700/30"></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-slate-800/50"></div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-7 items-center gap-6 py-4">
              {/* Bowler Card - Left Side (Blue/Purple Theme) */}
              <div className={`md:col-span-3 flex flex-col items-center p-6 rounded-2xl border transition-all ${
                !isPlayerBattingNow 
                  ? 'bg-purple-950/15 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.12)] ring-1 ring-purple-500/30' 
                  : 'bg-[#161D2F]/80 border-slate-700/60'
              }`}>
                {/* Bowler Role Badge */}
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase flex items-center gap-1.5 mb-3">
                  🥎 BOWLING
                </span>
                
                {/* Bowler Name */}
                <h4 className="font-display font-black text-xl text-slate-100 uppercase tracking-tight">
                  {currentBowler}
                </h4>
                <p className="text-[10px] font-mono text-slate-400 mb-4 font-bold tracking-wider">
                  {!isPlayerBattingNow 
                    ? '👤 (YOU)' 
                    : (opponentType === 'registered' && selectedOpponent 
                        ? `🛡️ (${selectedOpponent.teamName})` 
                        : opponentType === 'tournament' && selectedTournamentMatch
                          ? `🏆 (TOURNAMENT)`
                          : '🤖 (CPU)')}
                </p>

                {/* Bowler Gesture Circle */}
                <div className={`w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center text-4xl shadow-lg border-4 transition-all duration-300 ${
                  bowlerMove 
                    ? 'bg-purple-500/15 border-purple-500/40 scale-105 shadow-purple-500/15' 
                    : 'bg-slate-800/50 border-slate-700'
                }`}>
                  {bowlerMove ? handGestures[bowlerMove]?.icon : '❓'}
                </div>

                <span className="text-xs font-mono font-bold text-purple-300 mt-4 h-5">
                  {bowlerMove ? `Played Gesture ${bowlerMove}` : 'Ready to bowl...'}
                </span>
              </div>

              {/* Central VS Badge */}
              <div className="md:col-span-1 flex flex-col items-center justify-center py-4 md:py-0">
                {turnCountdown !== null ? (
                  <motion.div 
                    key={turnCountdown}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-red-600 border-2 border-orange-400 flex items-center justify-center font-display font-black text-xl text-white select-none shadow-[0_0_20px_rgba(249,115,22,0.5)]"
                  >
                    {turnCountdown}
                  </motion.div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center font-display font-black text-xs text-orange-400 select-none shadow-xl">
                    VS
                  </div>
                )}
              </div>

              {/* Batter Card - Right Side (Orange/Gold Theme) */}
              <div className={`md:col-span-3 flex flex-col items-center p-6 rounded-2xl border transition-all ${
                isPlayerBattingNow 
                  ? 'bg-orange-950/15 border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.12)] ring-1 ring-orange-500/30' 
                  : 'bg-[#161D2F]/80 border-slate-700/60'
              }`}>
                {/* Batter Role Badge */}
                <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 px-3.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase flex items-center gap-1.5 mb-3">
                  🏏 BATTING
                </span>

                {/* Batter Name */}
                <h4 className="font-display font-black text-xl text-slate-100 uppercase tracking-tight">
                  {currentBatsman}
                </h4>
                <p className="text-[10px] font-mono text-slate-400 mb-4 font-bold tracking-wider">
                  {isPlayerBattingNow 
                    ? '👤 (YOU)' 
                    : (opponentType === 'registered' && selectedOpponent 
                        ? `🛡️ (${selectedOpponent.teamName})` 
                        : opponentType === 'tournament' && selectedTournamentMatch
                          ? `🏆 (TOURNAMENT)`
                          : '🤖 (CPU)')}
                </p>

                {/* Batter Gesture Circle */}
                <div className={`w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center text-4xl shadow-lg border-4 transition-all duration-300 ${
                  batsmanMove 
                    ? 'bg-orange-500/15 border-orange-500/40 scale-105 shadow-orange-500/15' 
                    : 'bg-slate-800/50 border-slate-700'
                }`}>
                  {batsmanMove ? handGestures[batsmanMove]?.icon : '👋'}
                </div>

                <span className="text-xs font-mono font-bold text-orange-300 mt-4 h-5">
                  {batsmanMove ? `Played Gesture ${batsmanMove}` : 'Ready to bat...'}
                </span>
              </div>
            </div>

            {/* Commentary Overlay */}
            <div className="relative z-10 bg-[#1A2238]/95 backdrop-blur-md px-6 py-3 rounded-full border border-slate-700 text-center max-w-md mx-auto shadow-2xl mt-4">
              <p className={`font-sans text-xs md:text-sm italic font-bold ${commentaryColor}`} id="commentary-text">
                {commentary}
              </p>
            </div>
          </div>

          {/* Gesture Controller (The bottom selection keys) */}
          <div className="space-y-3">
            <p className="text-center text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              Select Your Gesture
            </p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const config = handGestures[num];
                return (
                  <button
                    key={num}
                    onClick={() => playTurn(num)}
                    disabled={isRevealing}
                    className={`p-4 bg-[#161D2F] border rounded-2xl flex flex-col items-center gap-1.5 transition-all shadow-xl hover:translate-y-[-2px] active:translate-y-0.5 active:shadow-none disabled:opacity-50 cursor-pointer ${config.style}`}
                  >
                    <span className="text-2xl">{config.icon}</span>
                    <span className="font-display font-black text-xl leading-none text-slate-200">{num}</span>
                    <span className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider">
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. INNINGS BREAK OVERLAY */}
      {phase === 'innings_break' && (
        <div className="bg-[#161D2F] border border-slate-700 rounded-2xl p-6 md:p-8 text-center space-y-6 max-w-lg mx-auto shadow-xl">
          <div className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase">
            🏏 Innings 1 Concluded
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-black text-2xl text-orange-400 tracking-tight uppercase">OUT! Innings Break</h3>
            <p className="text-slate-300 text-sm font-medium">
              The first innings ends with a score of <span className="font-bold font-mono text-orange-400 text-base">{target ? target - 1 : 0} Runs</span>.
            </p>
          </div>

          <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4 max-w-sm mx-auto">
            <p className="text-xs font-mono font-bold text-slate-400 uppercase">Required runs to win</p>
            <p className="font-display font-black text-4xl text-orange-400 font-mono py-1">{target}</p>
            <p className="text-xs text-slate-400">The roles now swap. Time to defend or chase!</p>
          </div>

          <button
            onClick={startSecondInnings}
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-sm uppercase py-4 rounded-xl shadow-[0_4px_0_0_#9a3412] active:translate-y-1 active:shadow-none transition-all duration-100 flex items-center justify-center gap-2 cursor-pointer"
          >
            Start Chase Innings <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5. GAME RESULT SCORECARD */}
      {phase === 'result' && (
        <div className="bg-[#161D2F] border border-slate-700 rounded-2xl p-6 md:p-8 space-y-8 max-w-2xl mx-auto shadow-xl">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase shadow-sm">
              <Sparkles className="w-3.5 h-3.5 fill-current text-orange-400" /> Match Concluded!
            </div>
            
            {/* Display Victory or Defeat based on runs */}
            {(() => {
              const playerRuns = p1Runs;
              const cpuRuns = p2Runs;
              const playerWin = playerRuns > cpuRuns;

              return (
                <div className="space-y-1">
                  <h2 className={`font-display font-black text-4xl md:text-5xl tracking-tight leading-none uppercase ${playerWin ? 'text-orange-400' : 'text-purple-400'}`}>
                    {playerWin ? 'VICTORY!' : 'DEFEAT'}
                  </h2>
                  <p className="text-slate-400 font-medium text-sm max-w-sm mx-auto">
                    {playerWin 
                      ? 'You absolutely crushed the computer! Time for a schoolyard celebratory dance!' 
                      : 'The computer outplayed you on this occasion! Practice makes perfect.'}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Core Scorecard Bento card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-xl p-5 shadow-xl space-y-4 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
                <Trophy className="w-32 h-32 text-white" />
              </div>
              <div className="relative z-10 flex justify-between items-end">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-100 block">My Runs Scored</span>
                  <div className="font-display font-black text-5xl md:text-6xl flex items-baseline gap-1">
                    {p1Runs}
                    <span className="text-base text-orange-200 font-bold">Runs</span>
                  </div>
                </div>
                <div className="text-right border-l border-white/20 pl-4">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-200 block">Opponent Runs</span>
                  <div className="font-display font-black text-2xl md:text-3xl text-orange-100 font-mono">
                    {p2Runs}
                  </div>
                </div>
              </div>
              <div className="relative z-10 flex gap-4 text-xs">
                <div>
                  <span className="font-mono text-[9px] uppercase text-orange-200 block">Match Time</span>
                  <span className="font-bold font-mono text-sm">{matchDuration}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Highest Gesture Card */}
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-4 flex items-center justify-between shadow-lg">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider block">Highest Gesture</span>
                  <span className="font-display font-black text-2xl text-purple-300 leading-none block py-1">Played {highestBall}</span>
                  <span className="text-[10px] text-slate-500 block font-sans">Smashed consistently!</span>
                </div>
                <span className="text-3xl">{handGestures[highestBall]?.icon || '👍'}</span>
              </div>

              {/* Luck Index Progress Card */}
              <div className="bg-[#1A2238] border border-slate-700 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Mind-Reading Index</span>
                  <span className="font-display font-bold text-sm text-orange-400">{luckIndex}%</span>
                </div>
                <div className="bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 h-full transition-all duration-500" style={{ width: `${luckIndex}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Rematch / Home controls */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {opponentType !== 'tournament' && (
              <button
                onClick={startToss}
                className="flex-grow py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white hover:brightness-105 active:translate-y-0.5 transition-all duration-100 rounded-xl font-display font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-[0_3px_0_0_#9a3412] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Rematch
              </button>
            )}
            <button
              onClick={() => {
                setPhase('setup');
              }}
              className="flex-grow py-3 bg-[#1A2238] border border-slate-700 text-slate-300 hover:bg-slate-800 active:translate-y-0.5 transition-all duration-100 rounded-xl font-display font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Quit to Home
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

interface DigitalGameProps {
  userProfile: UserProfile | null;
  playerTeamName?: string | null;
  digitalTournamentMatches?: import('../types').DigitalTournamentMatch[];
  activeChallengeId?: string | null;
  setActiveChallengeId?: (id: string | null) => void;
  onGameSaved: () => void;
}
