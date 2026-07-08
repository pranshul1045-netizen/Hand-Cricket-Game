export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  role: 'user' | 'admin';
  battingStyle?: 'Right-handed' | 'Left-handed';
  favoriteNumber?: number; // 1-6
  createdAt: any; // Timestamp or date string
  teamName?: string;
}

export interface SchoolMatch {
  id: string;
  player1: string;
  player2: string;
  player1Runs: number;
  player2Runs: number;
  player1Balls?: number;
  player2Balls?: number;
  player1Conceded?: number; // Runs player 1 conceded when player 2 batted
  player2Conceded?: number; // Runs player 2 conceded when player 1 batted
  winner?: string; // Player name or "player1" | "player2"
  status: 'completed' | 'scheduled';
  date?: string; // Date of match e.g. "2026-07-01"
  stage?: 'Group Stage' | 'Round of 32' | 'Round of 16' | 'Quarterfinal' | 'Semifinal' | 'Final' | '3rd-Place Match' | string;
  creatorId: string;
  createdAt: any;
}

export interface DigitalTournamentMatch {
  id: string;
  player1: string;
  player2: string;
  player1Runs: number;
  player2Runs: number;
  player1Balls?: number;
  player2Balls?: number;
  player1Conceded?: number;
  player2Conceded?: number;
  winner?: string;
  status: 'completed' | 'scheduled';
  date?: string;
  time?: string;
  stage?: 'Group Stage' | 'Round of 32' | 'Round of 16' | 'Quarterfinal' | 'Semifinal' | 'Final' | '3rd-Place Match' | string;
  group?: string; // Group 1 to 12
  creatorId: string;
  createdAt: any;
}

export interface DigitalMatch {
  id: string;
  playerUid: string;
  playerName: string;
  playerTeamName?: string;
  opponentName: string; // "CPU (Easy)", "CPU (Hard)", "Local Player"
  opponentTeamName?: string;
  opponentUid?: string;
  playerRuns: number;
  opponentRuns: number;
  winner: 'player' | 'opponent';
  createdAt: any;
}

export interface PlayerStanding {
  id: string;
  playerName: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  totalRunsScored: number;
  totalRunsConceded: number;
  points: number;
  updatedAt: any;
}

// Hand Cricket Game state types
export type TossChoice = 'odd' | 'even';
export type MatchRole = 'batting' | 'bowling';
export type GamePhase = 'toss' | 'role_selection' | 'playing' | 'innings_break' | 'result';

export interface GameState {
  phase: GamePhase;
  tossChoice: TossChoice | null;
  tossPlayerValue: number | null;
  tossCpuValue: number | null;
  tossWinner: 'player' | 'cpu' | null;
  selectedRole: MatchRole | null;
  
  // Innings tracker
  currentInnings: 1 | 2;
  playerRuns: number;
  playerIsOut: boolean;
  cpuRuns: number;
  cpuIsOut: boolean;
  
  // Current active counts
  runs: number; // runs of currently batting player
  wickets: number; // always 0 or 1
  balls: number;
  target: number | null; // runs to win (innings 1 score + 1)
  
  // History of current innings turns
  history: {
    playerValue: number;
    cpuValue: number;
    runsScored: number;
    isOut: boolean;
    batsman: 'player' | 'cpu';
  }[];
  
  commentary: string;
  lastPlayerMove: number | null;
  lastCpuMove: number | null;
}

export interface LeagueUpdate {
  id: string;
  title: string;
  content: string;
  category: 'Announcement' | 'Match Update' | 'Rule Change' | 'General';
  date: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
}
