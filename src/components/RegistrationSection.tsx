import React, { useState, useEffect } from 'react';
import { 
  User, School, BookOpen, Phone, CheckCircle2, CheckCircle, MessageSquare, ExternalLink,
  Trash2, ShieldAlert, Search, RefreshCw, Sparkles, Loader2, Lock
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, doc, setDoc, onSnapshot, query, orderBy, deleteDoc, updateDoc
} from 'firebase/firestore';

interface RegistrationSectionProps {
  userProfile: any;
  isAdmin: boolean;
  schoolyardLocked?: boolean;
}

export default function RegistrationSection({ userProfile, isAdmin, schoolyardLocked }: RegistrationSectionProps) {
  // Form states
  const [name, setName] = useState('');
  const [classSec, setClassSec] = useState('');
  const [school, setSchool] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Admin view states
  const [adminTab, setAdminTab] = useState<'form' | 'list'>(isAdmin ? 'list' : 'form');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegForMsg, setSelectedRegForMsg] = useState<any | null>(null);
  const [regToDelete, setRegToDelete] = useState<any | null>(null);
  const [actionError, setActionError] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Listen to registrations (Real-time sync)
  useEffect(() => {
    if (!isAdmin) return;

    setLoadingRegs(true);
    const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRegistrations(list);
      setLoadingRegs(false);
    }, (err) => {
      setLoadingRegs(false);
      handleFirestoreError(err, OperationType.GET, 'registrations');
    });

    return () => unsub();
  }, [isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !classSec.trim() || !school.trim() || !whatsapp.trim() || !pin.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (whatsapp.length < 10) {
      setError('Please enter a valid WhatsApp number (at least 10 digits including country code).');
      return;
    }

    if (pin.trim().length < 4) {
      setError('Please enter a password/PIN of at least 4 characters.');
      return;
    }

    setSubmitting(true);
    setError('');

    const regId = `reg_${Date.now()}`;
    try {
      await setDoc(doc(db, 'registrations', regId), {
        id: regId,
        name: name.trim(),
        classSec: classSec.trim(),
        school: school.trim(),
        whatsapp: whatsapp.trim(),
        pin: pin.trim(),
        createdAt: new Date().toISOString(),
        registeredBy: userProfile?.displayName || 'Anonymous',
        status: 'pending'
      });

      setSubmitted(true);
      setName('');
      setClassSec('');
      setSchool('');
      setWhatsapp('');
      setPin('');
    } catch (err: any) {
      setError('Could not submit registration. Please check your network and try again.');
      handleFirestoreError(err, OperationType.WRITE, `registrations/${regId}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (reg: any) => {
    setRegToDelete(reg);
  };

  const handleConfirmClick = async (reg: any) => {
    try {
      setActionError('');
      
      // 1. Create/Update player login profile in 'playerProfiles'
      const docId = reg.name.toLowerCase();
      await setDoc(doc(db, 'playerProfiles', docId), {
        name: reg.name,
        pin: reg.pin || 'password', // use their registered custom PIN or fallback to 'password'
        classSec: reg.classSec,
        school: reg.school,
        whatsapp: reg.whatsapp,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Update status in registrations
      const regRef = doc(db, 'registrations', reg.id);
      await updateDoc(regRef, { status: 'confirmed' });

      // Open the message popup
      setSelectedRegForMsg({ ...reg, status: 'confirmed' });
    } catch (err) {
      setActionError("Failed to confirm registration. Please try again.");
      handleFirestoreError(err, OperationType.WRITE, `registrations/${reg.id}`);
    }
  };

  // Filtered registrations
  const filteredRegs = registrations.filter(reg => 
    reg.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reg.classSec?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reg.school?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reg.whatsapp?.includes(searchQuery)
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Title Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3.5 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase">
          <Sparkles className="w-3.5 h-3.5 fill-current" /> Tournament Registration
        </div>
        <h2 className="font-display font-black text-3xl md:text-4xl text-slate-100 tracking-tight leading-none uppercase">
          Digital Arena Sign-Up
        </h2>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Register your details below to secure your spot in the official HCL Digital Tournament bracket!
        </p>
      </div>

      {/* Admin Panel Toggle */}
      {isAdmin && (
        <div className="flex border border-slate-700 p-1 bg-[#161D2F] rounded-xl max-w-sm mx-auto">
          <button
            onClick={() => setAdminTab('form')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              adminTab === 'form'
                ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Registration Form
          </button>
          <button
            onClick={() => setAdminTab('list')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              adminTab === 'list'
                ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Registered Names ({registrations.length})
          </button>
        </div>
      )}

      {/* RENDER VIEW */}
      {adminTab === 'form' ? (
        <div className="bg-[#161D2F] border border-slate-700 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden max-w-lg mx-auto">
          <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12"></div>
          
          {submitted ? (
            <div className="text-center space-y-6 py-6 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-green-500/10 border-2 border-green-500/30 rounded-full flex items-center justify-center mx-auto text-green-400 shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-black text-2xl text-slate-100 uppercase tracking-tight">Registration Submitted!</h3>
                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                  Your registration details have been sent safely to the tournament administrators. Get ready for action!
                </p>
              </div>
              <button
                onClick={() => setSubmitted(false)}
                className="px-6 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase hover:bg-slate-700 transition-all cursor-pointer"
              >
                Register Another Player
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 relative z-10 text-left">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3.5 py-2.5 rounded-xl text-center font-bold">
                  {error}
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-orange-400" /> Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  maxLength={40}
                  className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-100 font-semibold placeholder:text-slate-500"
                />
              </div>

              {/* Class & Section */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-orange-400" /> Class & Section
                </label>
                <input
                  type="text"
                  required
                  value={classSec}
                  onChange={(e) => setClassSec(e.target.value)}
                  placeholder="E.g. Class 10-A, 12th Commerce"
                  maxLength={25}
                  className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-100 font-semibold placeholder:text-slate-500"
                />
              </div>

              {/* School Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-orange-400" /> School Name
                </label>
                <input
                  type="text"
                  required
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Enter your school name"
                  maxLength={60}
                  className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-100 font-semibold placeholder:text-slate-500"
                />
              </div>

              {/* WhatsApp Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-orange-400" /> WhatsApp Number
                </label>
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                  placeholder="E.g. 919876543210 (with country code)"
                  maxLength={15}
                  className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-100 font-semibold placeholder:text-slate-500"
                />
                <p className="text-[10px] text-slate-500 font-mono">
                  Digits only. Include country code (e.g., 91 for India), no spaces or special characters.
                </p>
              </div>

              {/* Create Password / PIN */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-400" /> Create Login Password / PIN
                </label>
                <input
                  type="text"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Create your custom password or PIN"
                  maxLength={15}
                  className="w-full bg-[#1A2238] border border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-slate-100 font-semibold placeholder:text-slate-500"
                />
                <p className="text-[10px] text-slate-500 font-mono">
                  Minimum 4 characters. Keep this safe! You will use it to log in to the match center.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-display font-black text-xs uppercase tracking-wide py-3.5 rounded-xl shadow-[0_3.5px_0_0_#9a3412] hover:brightness-105 active:translate-y-0.5 active:shadow-none transition-all duration-100 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit Registration'}
              </button>
            </form>
          )}
        </div>
      ) : (
        /* ADMIN LIST PANEL */
        <div className="bg-[#161D2F] border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6 animate-in fade-in duration-300 text-left">
          {actionError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3.5 py-2.5 rounded-xl text-center font-bold relative pr-10">
              {actionError}
              <button 
                onClick={() => setActionError('')}
                className="absolute right-3 top-2 text-red-400 hover:text-red-200 text-sm font-bold font-mono"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
            <div>
              <h3 className="font-display font-black text-xl text-slate-200 uppercase flex items-center gap-2">
                <User className="w-5 h-5 text-orange-400" /> Registered Participants
              </h3>
              <p className="text-xs text-slate-400">Manage digital tournament registrations in real-time</p>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-slate-500" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search registered names..."
                className="w-full bg-[#1A2238] border border-slate-700 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {loadingRegs ? (
            <div className="py-12 flex flex-col justify-center items-center gap-2">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              <p className="text-xs font-mono font-semibold text-slate-400">Loading registrations...</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#121824]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1A2238] text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Class & Sec</th>
                    <th className="py-3 px-4">School</th>
                    <th className="py-3 px-4">WhatsApp No</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">PIN/Password</th>
                    <th className="py-3 px-4">Date Registered</th>
                    <th className="py-3 px-4 w-24 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs md:text-sm">
                  {filteredRegs.map((reg, index) => (
                    <tr key={reg.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-4 text-center font-semibold text-slate-500 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-200">
                        {reg.name}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono">
                        {reg.classSec}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {reg.school}
                      </td>
                      <td className="py-3 px-4 text-orange-400 font-semibold font-mono">
                        {reg.whatsapp}
                      </td>
                      <td className="py-3 px-4">
                        {reg.status === 'confirmed' ? (
                          <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase">
                            <CheckCircle className="w-3 h-3 text-green-400" /> Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {reg.pin || 'password'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {reg.createdAt ? new Date(reg.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {reg.status !== 'confirmed' ? (
                            <button
                              onClick={() => handleConfirmClick(reg)}
                              className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded transition-all cursor-pointer"
                              title="Confirm Registration"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedRegForMsg(reg)}
                              className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-all cursor-pointer"
                              title="Send Message"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClick(reg)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                            title="Delete Registration"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredRegs.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 text-xs font-mono">
                        No matches found. Ensure players fill and submit the registration form.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* WhatsApp Message Confirmation Modal */}
      {selectedRegForMsg && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#161D2F] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display font-black text-lg text-slate-200 uppercase flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-orange-400" /> Send Confirmation Message
              </h3>
              <button 
                onClick={() => {
                  setSelectedRegForMsg(null);
                  setCopiedText(false);
                  setCopiedLink(false);
                }}
                className="text-slate-400 hover:text-slate-200 text-sm font-mono font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                You have confirmed the registration for <strong className="text-slate-100">{selectedRegForMsg.name}</strong>. You can send a direct WhatsApp message, or copy the text/link if the popup is blocked in this browser frame.
              </p>

              <div className="bg-[#121824] border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                    Message Preview
                  </div>
                  <button
                    onClick={() => {
                      const msg = `Hello *${selectedRegForMsg.name}*,\n\nYour registration for the official *HCL Digital Tournament* has been successfully *CONFIRMED*! 🎉🔥\n\n*Your Login Details:*\n• Username/Name: ${selectedRegForMsg.name}\n• Password/PIN: ${selectedRegForMsg.pin || 'password'}\n\n*Details:*\n• Class & Sec: ${selectedRegForMsg.classSec}\n• School: ${selectedRegForMsg.school}\n\nGet ready for the matches! 🎮✨`;
                      navigator.clipboard.writeText(msg);
                      setCopiedText(true);
                      setTimeout(() => setCopiedText(false), 2000);
                    }}
                    className="text-[10px] font-mono text-orange-400 hover:text-orange-300 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText ? "✓ Copied" : "Copy Message Text"}
                  </button>
                </div>
                <div className="text-xs text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                  {`Hello *${selectedRegForMsg.name}*,\n\nYour registration for the official *HCL Digital Tournament* has been successfully *CONFIRMED*! 🎉🔥\n\n*Your Login Details:*\n• Username/Name: ${selectedRegForMsg.name}\n• Password/PIN: ${selectedRegForMsg.pin || 'password'}\n\n*Details:*\n• Class & Sec: ${selectedRegForMsg.classSec}\n• School: ${selectedRegForMsg.school}\n\nGet ready for the matches! 🎮✨`}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <a
                href={`https://wa.me/${selectedRegForMsg.whatsapp.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(
                  `Hello *${selectedRegForMsg.name}*,\n\nYour registration for the official *HCL Digital Tournament* has been successfully *CONFIRMED*! 🎉🔥\n\n*Your Login Details:*\n• Username/Name: ${selectedRegForMsg.name}\n• Password/PIN: ${selectedRegForMsg.pin || 'password'}\n\n*Details:*\n• Class & Sec: ${selectedRegForMsg.classSec}\n• School: ${selectedRegForMsg.school}\n\nGet ready for the matches! 🎮✨`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-display font-black uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center shadow-lg shadow-green-600/20"
              >
                Open in WhatsApp <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const waLink = `https://wa.me/${selectedRegForMsg.whatsapp.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(
                      `Hello *${selectedRegForMsg.name}*,\n\nYour registration for the official *HCL Digital Tournament* has been successfully *CONFIRMED*! 🎉🔥\n\n*Your Login Details:*\n• Username/Name: ${selectedRegForMsg.name}\n• Password/PIN: ${selectedRegForMsg.pin || 'password'}\n\n*Details:*\n• Class & Sec: ${selectedRegForMsg.classSec}\n• School: ${selectedRegForMsg.school}\n\nGet ready for the matches! 🎮✨`
                    )}`;
                    navigator.clipboard.writeText(waLink);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="flex-1 py-2 bg-[#1A2238] hover:bg-[#202b46] text-slate-300 border border-slate-700 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer text-center"
                >
                  {copiedLink ? "✓ Link Copied" : "Copy WhatsApp Link"}
                </button>
                <button
                  onClick={() => {
                    setSelectedRegForMsg(null);
                    setCopiedText(false);
                    setCopiedLink(false);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {regToDelete && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#161D2F] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display font-black text-lg text-slate-200 uppercase flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" /> Confirm Deletion
              </h3>
              <button 
                onClick={() => setRegToDelete(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-mono font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete the registration for <strong className="text-slate-100">{regToDelete.name}</strong> ({regToDelete.classSec})? This action is permanent and cannot be undone.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setRegToDelete(null)}
                className="flex-1 py-2.5 bg-[#1A2238] hover:bg-[#202b46] text-slate-300 border border-slate-700 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = regToDelete.id;
                  setRegToDelete(null);
                  try {
                    setActionError('');
                    await deleteDoc(doc(db, 'registrations', id));
                  } catch (err) {
                    setActionError("Failed to delete registration. Please try again.");
                    handleFirestoreError(err, OperationType.DELETE, `registrations/${id}`);
                  }
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-display font-black uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center shadow-lg shadow-red-600/20"
              >
                Delete <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
