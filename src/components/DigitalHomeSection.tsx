import React, { useState, useEffect } from 'react';
import { Trophy, Star, Shield, Medal, Target } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';

export default function DigitalHomeSection() {
  const [digitalTournamentMatches, setDigitalTournamentMatches] = useState<any[]>([]);

  useEffect(() => {
    const mmQuery = query(collection(db, 'digitalTournamentMatches'), where('status', '==', 'completed'));
    const unsubMm = onSnapshot(mmQuery, (snapshot) => {
      const matches: any[] = [];
      snapshot.forEach((doc) => {
        matches.push({ id: doc.id, ...doc.data() });
      });
      setDigitalTournamentMatches(matches);
    }, (error) => {
      console.error("Error listening to digitalTournamentMatches: ", error);
    });

    return () => {
      unsubMm();
    };
  }, []);

  // Compute standings
  const statsMap: Record<string, {
    name: string;
    teamName: string;
    runs: number;
    runsConceded: number;
    wins: number;
    matches: number;
    group: string;
    runRate: number;
  }> = {};

  digitalTournamentMatches.forEach(m => {
    const p1 = m.player1 || 'Unknown';
    const p2 = m.player2 || 'Unknown';
    if (!statsMap[p1]) statsMap[p1] = { name: p1, teamName: p1, runs: 0, runsConceded: 0, wins: 0, matches: 0, group: m.group || 'Unknown', runRate: 0 };
    if (!statsMap[p2]) statsMap[p2] = { name: p2, teamName: p2, runs: 0, runsConceded: 0, wins: 0, matches: 0, group: m.group || 'Unknown', runRate: 0 };

    // Update group if it was 'Unknown'
    if (m.group) {
      if (statsMap[p1].group === 'Unknown') statsMap[p1].group = m.group;
      if (statsMap[p2].group === 'Unknown') statsMap[p2].group = m.group;
    }

    if (m.status === 'completed') {
      statsMap[p1].runs += (m.player1Runs || 0);
      statsMap[p1].runsConceded += (m.player2Runs || 0);
      statsMap[p2].runs += (m.player2Runs || 0);
      statsMap[p2].runsConceded += (m.player1Runs || 0);
      
      statsMap[p1].matches += 1;
      statsMap[p2].matches += 1;

      // determine winner from score
      if (m.winner === p1 || m.winner === 'player1') {
        statsMap[p1].wins += 1;
      } else if (m.winner === p2 || m.winner === 'player2') {
        statsMap[p2].wins += 1;
      }
    }
  });

  const players = Object.values(statsMap);
  players.forEach(p => p.runRate = p.runs - p.runsConceded);
  
  // Group players by group
  const groupedPlayers = players.reduce((acc, p) => {
    if (!acc[p.group]) acc[p.group] = [];
    acc[p.group].push(p);
    return acc;
  }, {} as Record<string, typeof players>);

  const sortedGroups = Object.keys(groupedPlayers).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB || a.localeCompare(b);
  });
  
  // Orange Band (Most Runs)
  const orangeBandRankings = [...players].sort((a, b) => b.runs - a.runs);
  const orangeHolder = orangeBandRankings.length > 0 ? orangeBandRankings[0] : null;

  // Purple Band (Least Runs Conceded)
  const purpleBandRankings = [...players].sort((a, b) => a.runsConceded - b.runsConceded);
  const purpleHolder = purpleBandRankings.length > 0 ? purpleBandRankings[0] : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="text-center space-y-4">
        <h2 className="font-display font-black text-3xl md:text-4xl text-slate-100 tracking-tight uppercase">
          Digital Tournament Home
        </h2>
        <p className="text-slate-400 text-sm max-w-xl mx-auto">
          Welcome to the official digital arena. Track the top performers, leaderboards, and band holders for the ongoing digital season.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Orange Band */}
        <div className="bg-gradient-to-br from-orange-500/20 to-[#161D2F] border border-orange-500/30 rounded-3xl p-6 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-500/30 mb-4">
                <Star className="w-3.5 h-3.5 fill-current" />
                Orange Band
              </div>
              <h3 className="font-display font-black text-2xl text-white uppercase tracking-tight">
                {orangeHolder?.name || 'TBD'}
              </h3>
              <p className="text-orange-300/80 font-mono text-sm mt-1 uppercase tracking-wider">
                {orangeHolder?.teamName || 'N/A'}
              </p>
            </div>
            <div className="w-16 h-16 bg-orange-500 flex items-center justify-center rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] border-4 border-orange-400">
              <span className="font-display font-black text-xl text-white">{orangeHolder?.runs || 0}</span>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-orange-500/20">
            <h4 className="text-[10px] font-mono text-orange-400/80 uppercase tracking-widest mb-3">Top Run Scorers</h4>
            <div className="space-y-2">
              {orangeBandRankings.slice(0, 5).map((p, i) => (
                <div key={p.name} className="flex justify-between items-center text-sm">
                  <span className="text-slate-300 font-medium flex gap-2">
                    <span className="text-orange-500/50 w-4">{i + 1}.</span> {p.name}
                  </span>
                  <span className="font-mono font-bold text-orange-400">{p.runs} <span className="text-[10px] text-orange-500/50">RUNS</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Purple Band */}
        <div className="bg-gradient-to-br from-purple-500/20 to-[#161D2F] border border-purple-500/30 rounded-3xl p-6 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-500/30 mb-4">
                <Target className="w-3.5 h-3.5" />
                Purple Band
              </div>
              <h3 className="font-display font-black text-2xl text-white uppercase tracking-tight">
                {purpleHolder?.name || 'TBD'}
              </h3>
              <p className="text-purple-300/80 font-mono text-sm mt-1 uppercase tracking-wider">
                {purpleHolder?.teamName || 'N/A'}
              </p>
            </div>
            <div className="w-16 h-16 bg-purple-500 flex items-center justify-center rounded-full shadow-[0_0_20px_rgba(168,85,247,0.4)] border-4 border-purple-400">
              <span className="font-display font-black text-xl text-white">{purpleHolder?.runsConceded || 0}</span>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-purple-500/20">
            <h4 className="text-[10px] font-mono text-purple-400/80 uppercase tracking-widest mb-3">Least Runs Conceded</h4>
            <div className="space-y-2">
              {purpleBandRankings.slice(0, 5).map((p, i) => (
                <div key={p.name} className="flex justify-between items-center text-sm">
                  <span className="text-slate-300 font-medium flex gap-2">
                    <span className="text-purple-500/50 w-4">{i + 1}.</span> {p.name}
                  </span>
                  <span className="font-mono font-bold text-purple-400">{p.runsConceded} <span className="text-[10px] text-purple-500/50">CONCEDED</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Full Leaderboard */}
      <div className="bg-[#161D2F] border border-slate-700 rounded-3xl p-6 mt-8 overflow-hidden">
        <h3 className="font-display font-black text-xl text-slate-100 uppercase tracking-tight mb-6 flex items-center gap-2">
          <Medal className="w-5 h-5 text-orange-500" /> Complete Standings
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-mono text-[10px] uppercase tracking-wider font-bold pl-2">Player</th>
                <th className="pb-3 font-mono text-[10px] uppercase tracking-wider font-bold">Matches</th>
                <th className="pb-3 font-mono text-[10px] uppercase tracking-wider font-bold">Wins</th>
                <th className="pb-3 font-mono text-[10px] uppercase tracking-wider font-bold">Runs</th>
                <th className="pb-3 font-mono text-[10px] uppercase tracking-wider font-bold">Conceded</th>
                <th className="pb-3 font-mono text-[10px] uppercase tracking-wider font-bold text-right pr-2">Run Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedGroups.map((groupName) => {
                const groupPlayers = groupedPlayers[groupName].sort((a, b) => b.wins - a.wins || b.runRate - a.runRate);
                return (
                  <React.Fragment key={groupName}>
                    <tr className="bg-slate-800/30">
                      <td colSpan={6} className="py-2 pl-2 text-[10px] font-mono font-black text-orange-400 uppercase tracking-widest">
                        {groupName}
                      </td>
                    </tr>
                    {groupPlayers.map((p) => (
                      <tr key={p.name} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 pl-2">
                          <div className="font-bold text-slate-200">{p.name}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide">{p.teamName}</div>
                        </td>
                        <td className="py-4 font-mono text-slate-300">{p.matches}</td>
                        <td className="py-4 font-mono text-green-400 font-bold">{p.wins}</td>
                        <td className="py-4 font-mono text-orange-400 font-bold">{p.runs}</td>
                        <td className="py-4 font-mono text-purple-400 font-bold">{p.runsConceded}</td>
                        <td className="py-4 font-mono text-blue-400 font-bold text-right pr-2">{p.runRate}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {sortedGroups.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    No matches played yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
