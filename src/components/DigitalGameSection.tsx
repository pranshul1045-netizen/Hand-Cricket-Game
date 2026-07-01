import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Share2, HelpCircle, Trophy, Sparkles, User, Shield, ArrowRight, Zap, Play, RotateCcw } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { DigitalMatch, UserProfile } from '../types';

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

export default function DigitalGameSection({ userProfile, onGameSaved }: DigitalGameProps) {
  // Game Setup States
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'hard'>('easy');
  const [gameMode, setGameMode] = useState<'pve' | 'local'>('pve'); // Player vs Environment or Local PvP
  const [localPvpRole, setLocalPvpRole] = useState<'player1' | 'player2'>('player1'); // For local pass & play
  const [player1Name, setPlayer1Name] = useState('Player 1');
  const [player2Name, setPlayer2Name] = useState('Player 2');

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

  // Trigger setup
  const startToss = () => {
    setMatchStartTime(Date.now());
    setPhase('toss');
    setTossStep('choice');
    setTossP1Val(null);
    setTossP2Val(null);
    setTossWinner(null);
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
    setCommentary(`CPU won the toss & chose to ${chosen.toUpperCase()} first!`);
    setTimeout(() => {
      selectRole(playerRole);
    }, 1500);
  };

  // Get batsman & bowler details based on current innings
  const getMatchRoles = (): { batsman: string; bowler: string; isP1Batting: boolean } => {
    if (gameMode === 'pve') {
      const isPlayerBattingFirst = selectedRole === 'batting';
      if (currentInnings === 1) {
        return {
          batsman: isPlayerBattingFirst ? 'Player' : 'CPU',
          bowler: isPlayerBattingFirst ? 'CPU' : 'Player',
          isP1Batting: isPlayerBattingFirst
        };
      } else {
        return {
          batsman: isPlayerBattingFirst ? 'CPU' : 'Player',
          bowler: isPlayerBattingFirst ? 'Player' : 'CPU',
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
    if (isRevealing) return;
    setIsRevealing(true);
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
    const playerRuns = selectedRole === 'batting' ? p1Runs : p2Runs;
    const cpuRuns = selectedRole === 'batting' ? p2Runs : p1Runs;
    const didPlayerWin = playerRuns > cpuRuns;

    const matchId = `digital_${Date.now()}`;
    const digitalMatchPayload: DigitalMatch = {
      id: matchId,
      playerUid: auth.currentUser!.uid,
      playerName: userProfile?.displayName || 'Player',
      opponentName: gameMode === 'pve' ? `CPU (${aiDifficulty.toUpperCase()})` : 'Local PvP',
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

  return (
    <div id="digital-game-arena" className="max-w-5xl mx-auto space-y-6 pb-12">
      
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
              Step onto the virtual pitch! Select your difficulty and start your Hand Cricket League campaign.
            </p>
          </div>

          <div className="space-y-4 pt-4 text-left">
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
          </div>

          <button
            onClick={startToss}
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-sm uppercase py-4 rounded-xl shadow-[0_4px_0_0_#9a3412] active:translate-y-1 active:shadow-none transition-all duration-100 flex items-center justify-center gap-2 cursor-pointer"
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
                    <p className="text-sm font-bold text-red-400">😢 CPU won the Toss!</p>
                    <button
                      onClick={handleCpuRoleSelection}
                      className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-bold text-xs uppercase py-2 rounded-lg cursor-pointer"
                    >
                      Wait for CPU Decision <ArrowRight className="inline w-3 h-3 ml-1" />
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
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                    Current Score ({currentBatsman} Batting)
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display font-black text-5xl md:text-6xl text-slate-100 leading-none">{currentBatterScore}</span>
                    <span className="text-lg font-bold text-slate-500">/ 0 (Wkts)</span>
                  </div>
                </div>

                {target !== null && (
                  <div className="text-right space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                      Target to Win
                    </span>
                    <div className="font-display font-black text-3xl text-purple-400">
                      {target}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-4 z-10">
                <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold">
                  <Zap className="w-3.5 h-3.5 fill-current text-orange-400 animate-pulse" />
                  <span className="font-mono tracking-wider uppercase">
                    INNINGS {currentInnings} ({selectedRole?.toUpperCase() === 'batting' && currentInnings === 1 ? 'YOU BATTING' : selectedRole?.toUpperCase() === 'bowling' && currentInnings === 1 ? 'YOU BOWLING' : currentInnings === 2 && selectedRole?.toUpperCase() === 'batting' ? 'YOU BOWLING' : 'YOU BATTING'})
                  </span>
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

          {/* The Pitch (Visual Action Area) */}
          <div className="relative bg-gradient-to-b from-orange-500/5 via-[#161D2F] to-[#1A2238] rounded-3xl p-6 md:p-8 border border-slate-700 shadow-xl min-h-[300px] flex flex-col justify-between">
            <div className="grid grid-cols-3 items-center gap-4 py-6">
              {/* Bowler Hand Gesture */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                  {currentBowler}
                </span>
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-purple-500/5 border-4 border-[#1A2238] flex items-center justify-center text-4xl shadow-lg shadow-purple-500/5">
                  {lastP2Move ? handGestures[lastP2Move]?.icon : '❓'}
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {lastP2Move ? `Played ${lastP2Move}` : 'Ready...'}
                </span>
              </div>

              {/* Central VS */}
              <div className="text-center">
                <span className="font-display font-black text-3xl text-slate-800 select-none">
                  VS
                </span>
              </div>

              {/* Batter Hand Gesture */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest">
                  {currentBatsman}
                </span>
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-orange-500/5 border-4 border-[#1A2238] flex items-center justify-center text-4xl shadow-lg shadow-orange-500/5">
                  {lastP1Move ? handGestures[lastP1Move]?.icon : '👋'}
                </div>
                <span className="text-xs font-mono font-bold text-orange-400">
                  {lastP1Move ? `Played ${lastP1Move}` : 'Ready...'}
                </span>
              </div>
            </div>

            {/* Commentary Overlay */}
            <div className="bg-[#1A2238]/90 backdrop-blur-md px-6 py-3 rounded-full border border-slate-700 text-center max-w-md mx-auto shadow-xl">
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
              const playerRuns = selectedRole === 'batting' ? p1Runs : p2Runs;
              const cpuRuns = selectedRole === 'batting' ? p2Runs : p1Runs;
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
              <div className="relative z-10">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-100 block">My Runs Scored</span>
                <div className="font-display font-black text-5xl md:text-6xl flex items-baseline gap-1">
                  {selectedRole === 'batting' ? p1Runs : p2Runs}
                  <span className="text-base text-orange-200 font-bold">Runs</span>
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
            <button
              onClick={startToss}
              className="flex-grow py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white hover:brightness-105 active:translate-y-0.5 transition-all duration-100 rounded-xl font-display font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-[0_3px_0_0_#9a3412] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Rematch
            </button>
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
    </div>
  );
}

interface DigitalGameProps {
  userProfile: UserProfile | null;
  onGameSaved: () => void;
}
