import { useState, useMemo, useEffect } from 'react';
import { X, Send, Calendar, Users, Info } from 'lucide-react';
import { User, Friend } from '../types';
import RobuxIcon from './RobuxIcon';
import { motion, AnimatePresence } from 'motion/react';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSend: (amount: number, friend: Friend) => void;
  initialFriend?: Friend | null;
}

type ModalStep = 'friends' | 'selection' | 'confirmation' | 'loading' | 'success';

export default function SendModal({ isOpen, onClose, user, onSend, initialFriend }: SendModalProps) {
  const [step, setStep] = useState<ModalStep>(initialFriend ? 'selection' : 'friends');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(initialFriend || null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (initialFriend) {
        setSelectedFriend(initialFriend);
        setStep('selection');
      } else {
        setSelectedFriend(null);
        setStep('friends');
      }
      setAmount(0);
      setSearch('');
      setSearchResults([]);
      setIsLoading(false);
      setIsFetchingProfile(false);
      setProfileData(null);
    }
  }, [isOpen, initialFriend]);

  const combinedResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return user.friends || [];
    
    // Always include local friends that match
    const localMatches = (user.friends || []).filter(f => 
      f.display.toLowerCase().includes(term) || 
      f.username.toLowerCase().includes(term)
    );
    
    // Merge with API results, avoiding duplicates
    const seen = new Set(localMatches.map(f => f.username.toLowerCase()));
    const apiMatches = searchResults.filter(f => !seen.has(f.username.toLowerCase()));
    
    return [...localMatches, ...apiMatches];
  }, [search, searchResults, user.friends]);

  useEffect(() => {
    let isCurrent = true;
    const term = search.trim();

    if (!term) {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    if (term.length >= 2) {
      setIsLoading(true);
      // Clear results immediately when starting a new search for a better loading feel
      setSearchResults([]);
    }

    const controller = new AbortController();
    const safetyTimeout = setTimeout(() => {
      if (isCurrent) setIsLoading(false);
    }, 8000); // 8s safety limit

    const timer = setTimeout(async () => {
      if (!isCurrent) return;
      setIsLoading(true);
      
      try {
        const timestamp = new Date().getTime();
        const res = await fetch(`/api/search-roblox?q=${encodeURIComponent(term)}&v=${timestamp}`, {
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        const data = await res.json();
        
        if (isCurrent && Array.isArray(data)) {
          setSearchResults(data || []);
        }
      } catch (e: any) {
        if (isCurrent && e.name !== 'AbortError') {
          console.warn("Search failed, using fallback:", e);
          setSearchResults([]);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
          clearTimeout(safetyTimeout);
        }
      }
    }, 350);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
      clearTimeout(safetyTimeout);
      controller.abort();
    };
  }, [search]);

  if (!isOpen) return null;

  const resultsEmpty = !combinedResults || combinedResults.length === 0;

  const handleSelectFriend = async (friend: Friend) => {
    setSelectedFriend(friend);
    setIsFetchingProfile(true);
    try {
      const res = await fetch(`/api/user-profile/${encodeURIComponent(friend.username)}`);
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
      }
      // Ensure a minimum loading time for the "authenticity" feel
      await new Promise(resolve => setTimeout(resolve, 1200));
    } catch (e) {
      console.warn("Failed to fetch detailed profile", e);
    } finally {
      setIsFetchingProfile(false);
      setStep('selection');
    }
  };

  const handleConfirmSend = async () => {
    if (selectedFriend && amount > 0 && amount <= user.robux) {
      setStep('loading');
      
      // Reduced delay to prevent "stuck" feeling
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      try {
        await fetch('/api/send-robux', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: user.username, to: selectedFriend.username, amount })
        });
      } catch (e) {
        console.error("Failed to track transaction", e);
      }
      
      onSend(amount, selectedFriend);
      setStep('success');
    }
  };

  const handleClose = () => {
    setSearch('');
    setSearchResults([]);
    setIsLoading(false);
    setIsFetchingProfile(false);

    if (step === 'success') {
      onClose();
      // Only reset locally instead of full reload, unless needed
      setTimeout(() => {
        setStep('friends');
        setSelectedFriend(null);
        setAmount(0);
      }, 300);
      return;
    }
    onClose();
    // Reset after animation
    setTimeout(() => {
      setStep('friends');
      setSelectedFriend(null);
      setAmount(0);
      setIsLoading(false);
      setIsFetchingProfile(false);
      setProfileData(null);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`w-full shadow-2xl overflow-hidden flex flex-col transition-all duration-300 bg-white dark:bg-[#1b1d1f] max-w-[420px] rounded-[32px]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center relative px-6 py-5 justify-between`}>
           <div className="flex items-center gap-0.5 pt-0.5">
             <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <img 
                  src="https://media.discordapp.net/attachments/899166961567678504/1505869983790399519/fJzUBtXeWsAAAAASUVORK5CYII.png?ex=6a0c3235&is=6a0ae0b5&hm=a7d0c4a9a7624e8f05f0c76c33bae2abc783274e489a21f31c0857cf75faeaa7&=&format=webp&quality=lossless" 
                  alt="Roblox Plus" 
                  className="w-full h-full object-contain dark:invert" 
                />
             </div>
             <h3 className="text-[18px] font-black text-slate-800 dark:text-white tracking-tight ml-0.5">Send Robux</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-zinc-200 mr-1">
               <RobuxIcon className="w-4 h-4 dark:brightness-0 dark:invert" />
               <span className="text-sm">{user.robux.toLocaleString()}</span>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className={`px-6 pb-6 pt-2`}>
          <AnimatePresence mode="wait">

            {step === 'friends' && (
              <motion.div
                key="step-friends"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                 <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by username"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-900 border-none rounded-xl text-[13px] focus:ring-0 outline-none transition-all font-medium text-slate-700 dark:text-white dark:placeholder:text-zinc-600"
                  />
                </div>
                
                <div className="max-h-[440px] overflow-y-auto space-y-0.5 scrollbar-hide">
                  {(() => {
                    const seen = new Set();
                    const listItems = combinedResults.map((f) => {
                      if (seen.has(f.username)) return null;
                      seen.add(f.username);
                      return (
                        <button
                          key={f.username}
                          onClick={() => handleSelectFriend(f)}
                          disabled={isFetchingProfile}
                          className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left group disabled:opacity-50"
                        >
                          <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-700 flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-[1.02]">
                            {f.avatarUrl ? (
                              <img src={f.avatarUrl} alt={f.display} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-gray-400 dark:text-zinc-500 text-lg">{f.avatarLetter}</span>
                            )}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="font-bold text-[15px] text-slate-800 dark:text-zinc-100 truncate mb-0.5">{f.display}</div>
                            <div className="text-[13px] text-gray-500 dark:text-zinc-400 truncate font-medium">@{f.username}</div>
                          </div>
                        </button>
                      );
                    }).filter(Boolean);

                    return (
                      <>
                        {listItems}
                        {search.length >= 2 && resultsEmpty && (
                          <div className="py-12 flex flex-col items-center gap-3">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <div className="text-gray-400 font-bold text-[11px] uppercase tracking-widest animate-pulse">
                              Looking for results...
                            </div>
                          </div>
                        )}
                        {!isLoading && !search && resultsEmpty && (
                          <div className="py-12 text-center text-gray-300 dark:text-zinc-700 font-bold text-sm uppercase tracking-widest">Type to find a friend</div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </motion.div>
            )}

            {step === 'selection' && (
              <motion.div
                key="step-selection"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center"
              >
                {/* Recipient info */}
                <div className="w-full bg-gray-50/50 dark:bg-zinc-800/30 rounded-3xl p-6 mb-4 flex flex-col items-center border border-transparent dark:border-zinc-800">
                   <div className="w-20 h-20 rounded-full overflow-hidden mb-4 shadow-lg ring-4 ring-white dark:ring-zinc-800">
                      {selectedFriend?.avatarUrl ? (
                        <img src={selectedFriend.avatarUrl} alt={selectedFriend.display} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-100 dark:bg-zinc-700 flex items-center justify-center font-black text-2xl text-gray-300 dark:text-zinc-500">
                          {selectedFriend?.avatarLetter}
                        </div>
                      )}
                   </div>
                   <div className="font-black text-xl text-slate-800 dark:text-white">{selectedFriend?.display}</div>
                </div>

                {/* Big Amount Overall Display */}
                 <div className="flex items-center justify-center gap-3 mb-6 mt-4">
                    <div className="w-8 h-8 flex items-center justify-center">
                       <RobuxIcon className="w-full h-full dark:brightness-0 dark:invert" />
                    </div>
                   <span className="text-4xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter leading-none">{amount.toLocaleString()}</span>
                 </div>

                {/* Custom Amount Input */}
                <div className="w-full mb-10 px-10">
                  <div className="relative">
                    <input 
                      type="text"
                      value={amount > 0 ? amount.toLocaleString() : ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/,/g, '');
                        if (/^\d*$/.test(val)) {
                          setAmount(Math.max(0, parseInt(val) || 0));
                        }
                      }}
                      placeholder="0"
                      className="w-full bg-transparent border-none text-center py-4 text-4xl font-black text-slate-800 dark:text-white focus:outline-none focus:ring-0 transition-all placeholder:text-gray-100 dark:placeholder:text-zinc-800"
                    />
                  </div>
                  <div className="h-[2px] bg-gray-100 dark:bg-zinc-800 w-full rounded-full" />
                  {amount > user.robux && (
                    <p className="text-red-500 text-[11px] font-black mt-3 text-center uppercase tracking-widest">Balance Exceeded</p>
                  )}
                </div>

                {/* Quick Select */}
                <div className="grid grid-cols-4 gap-2 w-full mb-10">
                   {[25, 50, 100, 200].map(val => (
                     <button
                       key={val}
                       onClick={() => setAmount(val)}
                       className={`flex items-center justify-center gap-1.5 py-3.5 rounded-xl font-bold text-[13px] transition-all ${
                         amount === val 
                           ? 'bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 text-white' 
                           : 'bg-[#E8EBF2] dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-[#DEE3ED] dark:hover:bg-zinc-700'
                       }`}
                     >
                       <RobuxIcon className={`w-3.5 h-3.5 ${amount === val 
                         ? 'brightness-0 invert dark:brightness-0 dark:invert-0' 
                         : 'brightness-0 dark:brightness-0 dark:invert'}`} 
                       />
                       {val}
                     </button>
                   ))}
                </div>

                <div className="w-full space-y-4">
                  <button
                    disabled={amount <= 0 || amount > user.robux}
                    onClick={() => setStep('confirmation')}
                    className="w-full bg-blue-500 text-white font-black py-4 rounded-2xl hover:bg-blue-600 transition-all shadow-xl shadow-blue-200 dark:shadow-none disabled:bg-blue-300 disabled:shadow-none"
                  >
                    Next
                  </button>
                  <p className="text-[11px] text-gray-400 dark:text-zinc-500 text-center font-bold">
                    Robux are sent instantly with no fees
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'loading' && (
              <motion.div
                key="step-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-12"
              >
                <div className="relative w-24 h-24 mb-6">
                   <div className="absolute inset-0 border-4 border-gray-100 dark:border-zinc-800 rounded-full" />
                   <motion.div 
                     className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent"
                     animate={{ rotate: 360 }}
                     transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                   />
                   <div className="absolute inset-0 flex items-center justify-center">
                      <RobuxIcon className="w-10 h-10 animate-pulse dark:brightness-0 dark:invert" />
                   </div>
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white animate-pulse">Processing Transfer...</h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400 font-bold mt-2">Checking security protocols</p>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="step-success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center py-6"
              >
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-100 dark:shadow-none transition-colors duration-500">
                   <motion.div
                     initial={{ scale: 0 }}
                     animate={{ scale: 1 }}
                     transition={{ type: "spring", damping: 12 }}
                   >
                     <Send className="text-white w-10 h-10 -mr-1" />
                   </motion.div>
                </div>
                
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-2">Success!</h3>
                <div className="text-center bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4 mb-8 w-full border border-transparent dark:border-zinc-700 transition-colors">
                  <p className="text-slate-600 dark:text-zinc-400 font-bold">
                    Sent <span className="text-slate-800 dark:text-zinc-100">{amount.toLocaleString()}</span> Robux to <span className="text-slate-800 dark:text-zinc-100">{selectedFriend?.display}</span>
                  </p>
                </div>

                <div className="w-full space-y-4">
                  <button
                    onClick={handleClose}
                    className="w-full bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 text-white font-black py-4 rounded-2xl hover:bg-slate-900 dark:hover:bg-white transition-all shadow-xl shadow-slate-200 dark:shadow-none"
                  >
                    Close
                  </button>
                  <p className="text-[11px] text-gray-400 dark:text-zinc-500 text-center font-bold uppercase tracking-widest">
                    Transaction ID: {Math.random().toString(36).substring(7).toUpperCase()}
                  </p>
                </div>
              </motion.div>
            )}
            {step === 'confirmation' && (
              <motion.div
                key="step-confirmation"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center"
              >
                {/* Detailed Recipient info */}
                <div className="w-full bg-gray-50 dark:bg-zinc-800 rounded-[32px] p-8 mb-4 flex flex-col items-center text-center transition-colors border border-transparent dark:border-zinc-800">
                   <div className="w-24 h-24 rounded-full overflow-hidden mb-4 shadow-xl ring-4 ring-white dark:ring-zinc-700">
                      {selectedFriend?.avatarUrl ? (
                        <img src={selectedFriend.avatarUrl} alt={selectedFriend.display} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center font-black text-3xl text-gray-300 dark:text-zinc-600">
                          {selectedFriend?.avatarLetter}
                        </div>
                      )}
                   </div>
                   <div className="flex items-center gap-1.5 mb-1.5">
                     <div className="font-black text-xl text-slate-800 dark:text-white">{selectedFriend?.display}</div>
                   </div>
                   <div className="text-gray-500 dark:text-zinc-400 font-bold text-sm mb-6">@{selectedFriend?.username}</div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 w-full max-w-[320px]">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 font-bold text-[12px]">
                         <Calendar size={14} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                         {profileData?.isNewFriend ? 'New friend' : 'Old friend'}
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 font-bold text-[12px]">
                         <Users size={14} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                         {profileData?.mutualFriends || 0} mutual Friends
                      </div>
                      <div className="flex items-center justify-center md:col-span-2 gap-2 text-slate-500 dark:text-zinc-400 font-bold text-[12px] mt-1 border-t border-gray-100 dark:border-zinc-700 pt-3">
                         <Calendar size={14} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                         Joined Roblox: {profileData?.joinedDate || profileData?.joinedYear || '2024'}
                      </div>
                   </div>
                </div>

                {/* Amount Box */}
                <div className="w-full bg-[#F2F4F7] dark:bg-zinc-800/80 rounded-3xl py-10 mb-6 flex items-center justify-center gap-4 transition-colors">
                   <div className="w-12 h-12 flex items-center justify-center">
                      <RobuxIcon className="w-full h-full dark:brightness-0 dark:invert" />
                   </div>
                   <span className="text-6xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter leading-none">{amount.toLocaleString()}</span>
                </div>

                <div className="w-full space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleConfirmSend}
                      className="bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 dark:shadow-none"
                    >
                      Send
                    </button>
                    <button
                      onClick={() => setStep('selection')}
                      className="bg-gray-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-black py-4 rounded-2xl hover:bg-gray-300 dark:hover:bg-zinc-700 transition-all font-bold"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex items-start gap-2 px-2">
                    <Info size={14} className="text-gray-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-gray-500 dark:text-zinc-500 font-medium leading-tight">
                      You need an age check or parental consent to send Robux. Once you send, you cannot cancel!
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

