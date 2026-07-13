import React, { useState, useEffect } from 'react';
import { Megaphone, Search, Plus, Trash2, Calendar, FileText, Newspaper, Info, HelpCircle } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { LeagueUpdate, UserProfile } from '../types';

interface UpdatesSectionProps {
  userProfile: UserProfile | null;
  isAdmin: boolean;
}

const CATEGORIES = ['Announcement', 'Match Update', 'Rule Change', 'General'] as const;

export default function UpdatesSection({ userProfile, isAdmin }: UpdatesSectionProps) {
  const [updates, setUpdates] = useState<LeagueUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Announcement');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  // Load Updates from Firestore in real-time
  useEffect(() => {
    const updatesQuery = query(
      collection(db, 'leagueUpdates'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(updatesQuery, (snapshot) => {
      const list: LeagueUpdate[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as LeagueUpdate);
      });
      setUpdates(list);
      setLoading(false);
    }, (err) => {
      console.error("Error loading league updates:", err);
      handleFirestoreError(err, OperationType.LIST, 'leagueUpdates');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSaving(true);
    const updateId = `update_${Date.now()}`;
    const newUpdate: LeagueUpdate = {
      id: updateId,
      title: title.trim(),
      content: content.trim(),
      category,
      date: customDate,
      creatorId: userProfile?.uid || auth.currentUser?.uid || 'guest_local',
      creatorName: userProfile?.displayName || 'Admin',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'leagueUpdates', updateId), newUpdate);
      // Reset form
      setTitle('');
      setContent('');
      setCategory('Announcement');
      setCustomDate(new Date().toISOString().split('T')[0]);
      setShowAddForm(false);
    } catch (err) {
      console.error("Error writing league update:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    try {
      await deleteDoc(doc(db, 'leagueUpdates', updateId));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("Error deleting league update:", err);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Announcement':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Match Update':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'Rule Change':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Announcement':
        return <Megaphone className="w-4 h-4 text-purple-400" />;
      case 'Match Update':
        return <Newspaper className="w-4 h-4 text-orange-400" />;
      case 'Rule Change':
        return <Info className="w-4 h-4 text-red-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const filteredUpdates = updates.filter(up => {
    const matchesSearch = 
      up.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      up.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      up.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || up.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div id="updates-section" className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Hero Header */}
      <div className="text-center bg-gradient-to-br from-[#161D2F] to-[#1A2238] border border-slate-700 rounded-2xl p-6 md:p-8 shadow-xl">
        <h2 className="font-display text-2xl md:text-3xl font-black text-orange-400 tracking-tight mb-2 uppercase flex items-center justify-center gap-3">
          <Megaphone className="w-7 h-7 text-orange-400 animate-bounce" />
          HCL League Updates
        </h2>
        <p className="text-slate-400 font-medium text-sm md:text-base max-w-2xl mx-auto">
          Stay tuned with the official announcements, rule updates, tournament news, and highlights of the Hand Cricket League!
        </p>
      </div>

      {/* Admin Action Bar */}
      {isAdmin && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 hover:brightness-110 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all duration-200 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? 'Close Posting Box' : 'Publish New Update'}
          </button>
        </div>
      )}

      {/* Posting Form */}
      {isAdmin && showAddForm && (
        <div className="bg-[#161D2F] border border-slate-700 rounded-2xl p-6 shadow-xl animate-in slide-in-from-top-4 duration-200">
          <h3 className="font-display font-bold text-base text-slate-100 uppercase tracking-tight mb-4 border-b border-slate-800 pb-2">
            Compose Announcement
          </h3>
          <form onSubmit={handlePostUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
                  className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-slate-100 font-bold"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  Publication Date
                </label>
                <input
                  type="date"
                  required
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-slate-100 font-bold font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Update Title
              </label>
              <input
                type="text"
                required
                placeholder="E.g. Tournament Finals Schedule Announced!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-slate-100 font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Update Content (Markdown or plain text supported)
              </label>
              <textarea
                required
                rows={5}
                placeholder="Write the full update/announcement details here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={2000}
                className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-slate-100 leading-relaxed font-sans"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wide rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:brightness-110 text-white font-bold text-xs uppercase tracking-wide rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Publishing...' : 'Publish Board'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-[#161D2F] border border-slate-700 rounded-2xl p-4 md:p-6 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {['All', ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-all duration-150 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-inner'
                    : 'bg-[#1A2238] text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search updates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1A2238] border border-slate-700 pl-9 pr-4 py-2.5 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Main Updates Stream */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-mono text-xs text-slate-500">Loading bulletins...</p>
        </div>
      ) : filteredUpdates.length === 0 ? (
        <div className="text-center py-16 bg-[#161D2F] border border-slate-700 border-dashed rounded-2xl space-y-3">
          <div className="w-12 h-12 bg-slate-800 text-slate-500 rounded-full flex items-center justify-center mx-auto">
            <Info className="w-6 h-6" />
          </div>
          <p className="font-display font-bold text-sm text-slate-400">No updates found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are no updates posted matching your selection. Check back later or adjust filters!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredUpdates.map((item) => (
            <div
              key={item.id}
              className="group relative bg-[#161D2F] border border-slate-700 hover:border-slate-600 rounded-2xl p-5 md:p-6 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                {/* Meta details */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded border ${getCategoryColor(item.category)}`}>
                    {getCategoryIcon(item.category)}
                    <span>{item.category}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{item.date}</span>
                  </div>
                </div>

                {/* Admin Deletion Action */}
                {isAdmin && (
                  <div className="self-end sm:self-auto flex items-center gap-1.5">
                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150">
                        <button
                          type="button"
                          onClick={() => handleDeleteUpdate(item.id)}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-[9px] uppercase rounded transition-all duration-150 cursor-pointer"
                        >
                          Sure?
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-mono font-bold text-[9px] uppercase rounded transition-all duration-150 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-all duration-200 cursor-pointer"
                        title="Delete update"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Update Heading */}
              <h3 className="font-display font-black text-lg md:text-xl text-slate-100 tracking-tight leading-snug mb-3">
                {item.title}
              </h3>

              {/* Update Body content */}
              <div className="text-slate-300 text-xs md:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {item.content}
              </div>

              {/* Publisher Credits */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                <span>Published by: <strong className="text-orange-400 font-bold">{item.creatorName}</strong></span>
                <span>ID: {item.id.replace('update_', '')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
