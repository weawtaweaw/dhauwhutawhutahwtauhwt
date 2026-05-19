import { useState, useEffect } from 'react';
import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import SendModal from './components/SendModal';
import SettingsModal from './components/SettingsModal';
import KeyGateModal from './components/KeyGateModal';
import AdminPanel from './components/AdminPanel';
import ProfileResults from './components/ProfileResults';
import RobuxIcon from './components/RobuxIcon';
import { User, Friend } from './types';
import { BONUS_GAMES } from './constants';
import { Send, CheckCircle2, AlertCircle, Loader2, Shield, Info } from 'lucide-react';
import { auth, googleProvider, isAdmin } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';


export default function App() {
  const [user, setUser] = useState<User>({
    displayName: "kwon",
    username: "kwon",
    robux: 8320,
    avatarUrl: "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-C318C9101602477C9F9A7C91ECEEE44A-Png/150/150/AvatarHeadshot/Webp/noFilter",
    email: "kwon.roblox@gmail.com",
    theme: 'light',
    friends: [],
    selectedBonusGameId: 'adopt-me'
  });

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSeized, setIsSeized] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [searchResults, setSearchResults] = useState<Friend[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'send', friend?: Friend } | null>(null);
  const [preselectedFriend, setPreselectedFriend] = useState<Friend | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' }[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    const isUserVerified = localStorage.getItem("isVerified") === 'true';
    if (isUserVerified) setIsVerified(true);
    
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user.theme]);

  useEffect(() => {
    const stored = localStorage.getItem("robloxUser");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } catch (e) {
        console.error("Failed to load user data", e);
      }
    }
  }, []);

  const saveUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem("robloxUser", JSON.stringify(updatedUser));
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search-roblox?q=${encodeURIComponent(query)}&v=${Date.now()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSearchResults(data);
        if (data.length === 0) {
          addToast("No users found matching that name", "error");
        }
      } else {
        setSearchResults([]);
        addToast(data.error || "Search failed. Try again.", "error");
      }
    } catch (e) {
      console.error("Search failed", e);
      addToast("Failed to search profiles", "error");
    } finally {
      setIsSearching(false);
    }
  };

  const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleSendRobux = (amount: number, friend: Friend) => {
    if (amount > user.robux) {
      addToast("Insufficient balance", "error");
      return;
    }
    const updatedUser = { ...user, robux: user.robux - amount };
    saveUser(updatedUser);
    addToast(`Sent ${amount} Robux to ${friend.display}!`);
  };

  const handleKeyVerified = () => {
    setIsSeized(true);
    
    setTimeout(() => {
      setIsSeized(false);
      setIsVerified(true);
      setIsKeyModalOpen(false); // Close the modal
      localStorage.setItem("isVerified", "true");
      addToast("Security verification successful!");
      
      if (pendingAction?.type === 'send') {
        if (pendingAction.friend) {
          setPreselectedFriend(pendingAction.friend);
        } else {
          setPreselectedFriend(null);
        }
        setIsSendModalOpen(true);
      }
      setPendingAction(null);
    }, 600); // Super fast transition to avoid "stuck" feeling
  };

  const checkVerificationBeforeSend = (friend?: Friend) => {
    if (!isVerified && !isAdmin()) {
      setPendingAction({ type: 'send', friend });
      setIsKeyModalOpen(true);
    } else {
      setPreselectedFriend(friend || null);
      setIsSendModalOpen(true);
    }
  };

  const handleOpenSendToFriend = (friend: Friend) => {
    checkVerificationBeforeSend(friend);
  };

  const PACKAGES = [
    { robux: 26400, original: 25000, more: 1400, price: "$199.99" },
    { robux: 12100, original: 11000, more: 1100, price: "$99.99" },
    { robux: 5800, original: 4950, more: 850, price: "$49.99" },
    { robux: 4000, original: 3470, more: 530, price: "$34.99" },
    { robux: 2200, original: 1870, more: 330, price: "$19.99" },
  ];

  const STANDARD_PACKAGES = [
    { robux: 1500, original: 1200, more: 300, price: "$14.99" },
    { robux: 1000, original: 800, more: 200, price: "$9.99" },
    { robux: 500, original: 400, more: 100, price: "$4.99" },
    { robux: 150, price: "$1.99" },
    { robux: 80, price: "$0.99" },
  ];

  const handleAdminLogin = () => {
    setIsAdminPanelOpen(true);
  };

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
      setIsAdminPanelOpen(false);
      addToast("Logged out from Admin.");
    } catch (e) {
      console.error(e);
    }
  };

  // If Seized screen is active
  if (isSeized) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black">
        <img 
          src="https://media.discordapp.net/attachments/1501019720604844084/1504477501823389756/03956997-b22f-45c1-b678-e1d925baa8aa.png?ex=6a07215c&is=6a05cfdc&hm=5eda681e11986a7e8a0c509a9f84cb863ca3b44e3958dac1fe6bd881850325a3&=&format=webp&quality=lossless" 
          alt="This website has been seized" 
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Shared root wrapper to handle dark mode background across all states
  return (
    <div className={`min-h-screen transition-colors ${user.theme === 'dark' ? 'dark bg-[#0c0d0e]' : 'bg-white'}`}>
      <AnimatePresence mode="wait">
        {isAdminPanelOpen ? (
          <motion.div
            key="admin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AdminPanel onClose={() => setIsAdminPanelOpen(false)} />
          </motion.div>
        ) : (!isVerified && !isAdmin()) ? (
          <motion.div
            key="gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <KeyGateModal
              onVerify={handleKeyVerified}
              onAdminLogin={handleAdminLogin}
            />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col"
          >
            <Topbar 
              user={user} 
              onOpenSettings={() => setIsSettingsOpen(true)} 
              onSearch={handleSearch}
              currentUser={currentUser}
              onOpenAdmin={() => setIsAdminPanelOpen(true)}
              onLogin={handleAdminLogin}
            />
            
            <div className="flex">
              <Sidebar user={user} />
              
              <main className="relative flex-1 p-6 md:p-12 max-w-6xl mx-auto overflow-x-hidden">
                <div className="grid-bg" />
                
                <div className="absolute right-6 top-6 z-10 flex items-center gap-3 bg-white dark:bg-[#1b1d1f] border border-gray-200 dark:border-zinc-800 rounded-full px-4 py-2 shadow-sm transition-colors">
                  <div className="flex items-center gap-1.5 text-sm font-semibold dark:text-zinc-100">
                    <RobuxIcon size={20} className="text-slate-800 dark:brightness-0 dark:invert" />
                    <span className="text-lg">{user.robux.toLocaleString()}</span>
                  </div>
                  <button 
                    onClick={() => checkVerificationBeforeSend()}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold border border-gray-200 dark:border-zinc-700 rounded-full hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors dark:text-zinc-300"
                  >
                    <Send size={12} />
                    Send
                  </button>
                </div>

                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl md:text-6xl font-black text-center leading-[1.05] tracking-tight mb-12 sm:mb-20 font-sans dark:text-white"
                  style={{ fontStyle: 'normal' }}
                >
                  Enjoy up to 25%<br />more Robux
                </motion.h1>

                <AnimatePresence>
                  {isSearching && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-3 py-12 text-blue-600 font-bold"
                    >
                      <Loader2 className="animate-spin" />
                      Fetching Roblox Profiles...
                    </motion.div>
                  )}
                </AnimatePresence>

                {!isSearching && searchResults && (
                  <ProfileResults 
                    results={searchResults}
                    onSendRobux={handleOpenSendToFriend}
                    onClose={() => setSearchResults(null)}
                  />
                )}

                <section className="mt-12 max-w-[713px] mx-auto">
                  <h2 className="text-xl font-bold mb-4 dark:text-white">Bonus item we picked for you</h2>
                  <div className="border border-gray-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-[#1b1d1f] overflow-hidden shadow-sm transition-colors">
                    {(() => {
                      const currentGame = BONUS_GAMES.find(g => g.id === user.selectedBonusGameId) || BONUS_GAMES[0];
                      return (
                        <div 
                          className="relative p-4 px-6 flex items-center gap-5 min-h-[110px]"
                          style={{ 
                            backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${currentGame.banner})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        >
                          <div className="relative z-10 w-20 h-20 rounded-full overflow-hidden flex-shrink-0 bg-transparent flex items-center justify-center">
                            <img 
                              src={currentGame.icon} 
                              alt={currentGame.name} 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                          <div className="relative z-10 text-white">
                            <h3 className="text-2xl font-black drop-shadow-md flex items-center gap-1.5">
                              {currentGame.name}
                              <Info size={18} className="text-white drop-shadow-md cursor-pointer opacity-80 hover:opacity-100 transition-opacity translate-y-[2px]" />
                            </h3>
                            <p className="text-sm font-medium opacity-90 drop-shadow-sm">{currentGame.description}</p>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                      {PACKAGES.map((pkg, i) => (
                        <div key={i} className="flex items-center p-3 px-6 md:px-10 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <div className="flex-1 flex items-center gap-3 relative -left-4">
                            <div className="flex items-center gap-2">
                              <RobuxIcon size={28} className="text-slate-800 dark:brightness-0 dark:invert" />
                              <span className="text-[32px] font-black text-slate-800 dark:text-zinc-100 tabular-nums leading-none tracking-tight">{pkg.robux.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 text-slate-400 dark:text-zinc-500 font-bold relative text-base sm:text-lg">
                                <div className="absolute inset-x-0 h-[1.5px] bg-slate-400 dark:bg-zinc-600 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <RobuxIcon size={20} className="opacity-40 dark:brightness-0 dark:invert" />
                                <span>{pkg.original.toLocaleString()}</span>
                              </div>
                              {pkg.more && (
                                <div className="bg-[#EBEEF5] dark:bg-zinc-800 text-[#7A869A] dark:text-zinc-400 font-black text-[10px] px-2 py-0.5 rounded-full">
                                  + {pkg.more} more
                                </div>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => checkVerificationBeforeSend()}
                            className="bg-[#E8EBF2] dark:bg-zinc-800 hover:bg-[#DEE3ED] dark:hover:bg-zinc-700 transition-all text-slate-800 dark:text-zinc-200 font-black py-2 px-6 rounded-xl min-w-[120px] text-base active:scale-[0.98]"
                          >
                            {pkg.price}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="mt-16 mb-32 max-w-[713px] mx-auto">
                  <h2 className="text-xl font-bold mb-6 dark:text-white">Robux packages</h2>
                  <div className="border border-gray-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-[#1b1d1f] overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-zinc-800 transition-colors">
                    {STANDARD_PACKAGES.map((pkg, i) => (
                      <div key={i} className="flex items-center p-3.5 px-10 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <div className="flex-1 flex items-center gap-3 text-slate-800 dark:text-zinc-100 relative -left-4">
                          <div className="flex items-center gap-3">
                            <RobuxIcon size={32} className="dark:brightness-0 dark:invert" />
                            <span className="text-[34px] font-black tabular-nums leading-none tracking-tight">{pkg.robux.toLocaleString()}</span>
                          </div>
                          {pkg.original && (
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2.5 text-slate-400 dark:text-zinc-500 font-bold relative">
                                <div className="absolute inset-x-0 h-[2px] bg-slate-400 dark:bg-zinc-600 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <RobuxIcon size={26} className="opacity-40 dark:brightness-0 dark:invert" />
                                <span className="text-2xl">{pkg.original.toLocaleString()}</span>
                              </div>
                              {pkg.more && (
                                <div className="bg-[#EBEEF5] dark:bg-zinc-800 text-[#7A869A] dark:text-zinc-400 font-black text-[11px] px-3 py-1 rounded-full">
                                  + {pkg.more} more
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => checkVerificationBeforeSend()}
                          className="bg-[#E8EBF2] dark:bg-zinc-800 hover:bg-[#DEE3ED] dark:hover:bg-zinc-700 transition-all text-slate-800 dark:text-zinc-200 font-black py-2.5 px-8 rounded-xl min-w-[140px] text-lg active:scale-[0.98]"
                        >
                          {pkg.price}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
                
                <div className="fixed bottom-0 right-6 w-64 bg-white dark:bg-[#1b1d1f] border border-gray-200 dark:border-zinc-800 border-b-0 rounded-t-xl py-2.5 px-4 text-sm font-bold shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors hidden sm:block dark:text-zinc-300">
                  Chat
                </div>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSendModalOpen && (
          <SendModal
            isOpen={isSendModalOpen}
            onClose={() => {
              setIsSendModalOpen(false);
              setPreselectedFriend(null);
            }}
            user={user}
            onSend={handleSendRobux}
            initialFriend={preselectedFriend}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            user={user}
            onSave={(updatedUser) => {
              saveUser(updatedUser);
              setIsSettingsOpen(false);
              addToast("Settings saved!");
            }}
            onLogout={async () => {
              try {
                await signOut(auth);
                const defaultUser: User = { 
                  displayName: "kwon", 
                  username: "kwon", 
                  robux: 8320,
                  email: "kwon.roblox@gmail.com",
                  avatarUrl: "https://tr.rbxcdn.com/180DAY-40e9f0d0611c6d1d2b0e6e7c10b64ecc/150/150/AvatarHeadshot/Png/noFilter",
                  theme: 'light'
                };
                saveUser(defaultUser);
                setIsVerified(false);
                localStorage.removeItem("isVerified");
                setIsSettingsOpen(false);
                addToast("Logged out successfully");
              } catch (e) {
                console.error(e);
              }
            }}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`flex items-center gap-3 px-6 py-3 rounded-full text-white text-sm font-semibold shadow-2xl ${
                t.type === 'success' ? 'bg-zinc-800' : 'bg-red-600'
              }`}
            >
              {t.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
