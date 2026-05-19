import { useState, useEffect, FormEvent } from 'react';
import { db, auth, isAdmin } from '../lib/firebase';
import { collection, setDoc, getDocs, query, orderBy, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Key, Plus, Trash2, Calendar, Infinity, LogOut, Loader2, Copy, Check, X } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  const errorJson = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorJson);
  throw new Error(errorJson);
}

interface KeyRecord {
  id: string;
  key: string;
  expiresAt: Timestamp | null;
  isLifetime: boolean;
  createdAt: Timestamp;
  hwid?: string | null;
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [expiryType, setExpiryType] = useState<'lifetime' | '7days' | '30days'>('7days');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'keys' | 'settings'>('keys');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passMessage, setPassMessage] = useState('');

  useEffect(() => {
    const isAuth = isAdmin();
    setAuthenticated(isAuth);
    if (isAuth) {
      fetchKeys();
    } else {
      setLoading(false);
    }
  }, []);

  const handleAdminAuth = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');
    
    // Artificial delay for "security" feel
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Call server-side admin login
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem("isAdminAuthenticated", "true");
        localStorage.setItem("adminUser", username);
        setAuthenticated(true);
        fetchKeys();
      } else {
        setError(data.error || "Invalid Administrative Credentials.");
      }
    } catch (e) {
      console.error(e);
      setError("Server connection error. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogoutAction = () => {
    localStorage.removeItem("isAdminAuthenticated");
    setAuthenticated(false);
    setKeys([]);
    setLoading(false);
  };

  const fetchKeys = async () => {
    setLoading(true);
    setError('');
    const path = 'access_keys';
    
    // Safety timeout to prevent infinite loading state
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Request timed out")), 10000)
    );

    try {
      console.log("Fetching keys from path:", path);
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      
      // Race the query against the timeout
      const snapshot = await Promise.race([
        getDocs(q),
        timeoutPromise
      ]) as any;

      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as KeyRecord));
      console.log("Keys fetched:", data.length);
      setKeys(data);
    } catch (e: any) {
      console.error("Fetch Keys Error:", e);
      setError("Failed to fetch keys. " + (e.message || ""));
      try {
        handleFirestoreError(e, OperationType.LIST, path);
      } catch (err) {}
    } finally {
      setLoading(false);
    }
  };

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = () => Array.from({ length: 3 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    return `Larp-${segment()}-${segment()}-${segment()}`;
  };

  const handleCreateKey = async () => {
    setGenerating(true);
    const newKey = generateRandomKey();
    let expiresAt: Date | null = null;

    if (expiryType === '7days') {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
    } else if (expiryType === '30days') {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
    }

        const path = `access_keys/${newKey}`;
    try {
      await setDoc(doc(db, 'access_keys', newKey), {
        key: newKey,
        isLifetime: expiryType === 'lifetime',
        expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
        createdAt: Timestamp.now(),
        createdBy: 'Admin', // Generic as we don't have the user name in context easily
        isUsed: false
      });
      await fetchKeys();
    } catch (e: any) {
      console.error("Create Key Error:", e);
      setError("Failed to generate key. Check console for details.");
      // Even if handleFirestoreError throws, we want to set local error state if possible
      try {
        handleFirestoreError(e, OperationType.WRITE, path);
      } catch (err) {}
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Delete this key?")) return;
    try {
      await deleteDoc(doc(db, 'access_keys', id));
      setKeys(keys.filter(k => k.id !== id));
    } catch (e) {
      console.error("Delete Key Error:", e);
      setError("Failed to delete key.");
    }
  };

  const handleResetHWID = async (id: string) => {
    setResettingId(id);
    setError('');
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'access_keys', id), { hwid: null });
      setKeys(keys.map(k => k.id === id ? { ...k, hwid: null } : k));
    } catch (e) {
      console.error("Reset HWID Error:", e);
      setError("Failed to reset HWID");
    } finally {
      setResettingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      setPassMessage("Passwords do not match.");
      return;
    }
    if (newPass.length < 6) {
      setPassMessage("New password must be at least 6 characters.");
      return;
    }

    setIsChangingPass(true);
    setPassMessage('');
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: localStorage.getItem("adminUser") || "rattpoor", // Use stored username or default
          currentPassword: currentPass, 
          newPassword: newPass 
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPassMessage("Password updated successfully!");
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
        // Update local default if needed or just let them re-login
      } else {
        setPassMessage(data.error || "Failed to update password.");
      }
    } catch (e) {
      setPassMessage("Server error. Try again.");
    } finally {
      setIsChangingPass(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="fixed inset-0 z-[300] bg-black flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 rounded-[40px] w-full max-w-[440px] shadow-2xl overflow-hidden border border-white/5"
        >
          <div className="p-8 text-center bg-zinc-800/50">
            <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/40">
              <ShieldCheck size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-black tracking-tight text-white uppercase">Admin Login</h3>
            <p className="text-zinc-500 text-[10px] mt-2 font-bold uppercase tracking-[0.2em]">Authorized Personnel Only</p>
          </div>
          
          <form onSubmit={handleAdminAuth} className="p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-2 block">Admin Username</label>
                <input 
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Username"
                />
              </div>
              <div>
                <label className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-2 block">Admin Password</label>
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-red-500 text-xs font-bold text-center uppercase tracking-tight">{error}</p>}
            </div>

            <div className="space-y-3">
              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-white text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoggingIn ? <Loader2 className="animate-spin text-black" /> : "AUTHENTICATE"}
              </button>
              
              <button 
                type="button"
                onClick={onClose}
                className="w-full text-zinc-500 hover:text-white font-bold py-3 transition-colors text-sm uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] bg-zinc-950/90 backdrop-blur-md flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-zinc-900 border-r border-white/5 p-8 flex flex-col">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-white font-black text-xl tracking-tight">Admin Console</h1>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Control Center</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="md:hidden text-zinc-500 hover:text-white p-2"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6 flex-1">
          <button
            onClick={onClose}
            className="hidden md:flex w-full items-center justify-center gap-2 text-zinc-400 hover:text-white font-bold py-3 mb-4 rounded-xl border border-white/5 hover:bg-white/5 transition-all text-sm uppercase tracking-widest"
          >
            <X size={16} />
            Back to App
          </button>

          <div className="flex flex-col gap-2 mb-6">
            <button
              onClick={() => setActiveTab('keys')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'keys' 
                ? 'bg-zinc-800 text-white border border-white/10' 
                : 'text-zinc-500 hover:text-white'
              }`}
            >
              <Key size={18} />
              Access Keys
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'settings' 
                ? 'bg-zinc-800 text-white border border-white/10' 
                : 'text-zinc-500 hover:text-white'
              }`}
            >
              <ShieldCheck size={18} />
              Security Settings
            </button>
          </div>

          {activeTab === 'keys' ? (
            <>
              <div>
                <label className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-3 block">Key Duration</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: '7days', label: '7 Days', icon: Calendar },
                    { id: '30days', label: '30 Days', icon: Calendar },
                    { id: 'lifetime', label: 'Lifetime', icon: Infinity },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setExpiryType(opt.id as any)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                        expiryType === opt.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      <opt.icon size={18} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateKey}
                disabled={generating}
                className="w-full bg-white text-black font-black py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-2xl"
              >
                {generating ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
                GENERATE NEW KEY
              </button>
            </>
          ) : (
            <div className="text-zinc-500 text-xs italic p-4 bg-zinc-800/30 rounded-xl border border-white/5">
              Select "Security Settings" to change your administrator password.
            </div>
          )}
          
          {error && !isLoggingIn && (
            <p className="mt-4 text-red-500 text-[10px] font-black uppercase text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
              {error}
            </p>
          )}
        </div>

        <button 
          onClick={handleAdminLogoutAction}
          className="mt-8 flex items-center justify-center gap-2 text-zinc-500 hover:text-white font-bold py-4 rounded-xl border border-white/5 hover:bg-white/5 transition-all"
        >
          <LogOut size={18} />
          LOGOUT
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 md:p-12">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'keys' ? (
            <>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-white text-3xl font-black tracking-tight">Active Access Keys</h2>
                <div className="bg-zinc-900 border border-white/5 px-4 py-2 rounded-full">
                  <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Total: {keys.length}</span>
                </div>
              </div>

              <div className="grid gap-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                    <Loader2 className="animate-spin mb-4" size={40} />
                    <span className="font-bold uppercase tracking-widest text-xs">Loading Keys...</span>
                  </div>
                ) : keys.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[40px]">
                    <Key className="mx-auto text-zinc-800 mb-4" size={48} />
                    <p className="text-zinc-500 font-bold">No active keys generated yet.</p>
                  </div>
                ) : (
                  keys.map((k) => (
                    <motion.div
                      key={k.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-zinc-900 border border-white/5 p-6 rounded-[32px] flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-6">
                        <button
                          onClick={() => handleResetHWID(k.id)}
                          disabled={resettingId === k.id || !k.hwid}
                          className={`text-[10px] font-black px-4 py-2 rounded-xl transition-all uppercase tracking-tighter ${
                            k.hwid 
                              ? 'bg-zinc-700 text-white hover:bg-zinc-600 shadow-lg' 
                              : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                          }`}
                        >
                          {resettingId === k.id ? <Loader2 size={12} className="animate-spin" /> : "HWID RESET"}
                        </button>
                        <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-blue-500">
                          <Key size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <code className="text-white font-mono font-black text-lg">{k.key}</code>
                            <button 
                              onClick={() => copyToClipboard(k.key, k.id)}
                              className="text-zinc-500 hover:text-white transition-colors"
                            >
                              {copiedId === k.id ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                            </button>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${k.isLifetime ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                              {k.isLifetime ? 'Lifetime Access' : 'Temporary'}
                            </span>
                            <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                              {k.isLifetime ? 'Never Expires' : `Expires: ${k.expiresAt?.toDate().toLocaleDateString()}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteKey(k.id)}
                        className="flex flex-col items-center gap-1 p-3 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all min-w-[80px]"
                        title="Revoke Access"
                      >
                        <Trash2 size={20} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">Revoke</span>
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="max-w-2xl">
              <h2 className="text-white text-3xl font-black tracking-tight mb-8">Security & Password</h2>
              
              <div className="bg-zinc-900 border border-white/5 rounded-[40px] p-8 md:p-12">
                <form onSubmit={handleChangePassword} className="space-y-6">
                  <div>
                    <label className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-3 block">Current Admin Password</label>
                    <input 
                      type="password"
                      required
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-3 block">New Password</label>
                      <input 
                        type="password"
                        required
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="New password"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-3 block">Confirm New Password</label>
                      <input 
                        type="password"
                        required
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="Repeat new password"
                      />
                    </div>
                  </div>

                  {passMessage && (
                    <p className={`text-xs font-bold uppercase tracking-tight ${passMessage.includes('success') ? 'text-green-500' : 'text-red-500'}`}>
                      {passMessage}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isChangingPass}
                    className="bg-white text-black font-black px-10 py-4 rounded-2xl md:w-auto w-full hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isChangingPass ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
                    UPDATE PASSWORD
                  </button>
                </form>
              </div>

              <div className="mt-8 p-6 bg-blue-500/5 rounded-[32px] border border-blue-500/10">
                <p className="text-blue-400 text-xs leading-relaxed">
                  <span className="font-black uppercase mr-2">[Security Tip]</span>
                  Changing your password will update the administrative credentials required for this console. 
                  Please store your new password safely. If you lose it, you may need to reset it via server environment variables.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
