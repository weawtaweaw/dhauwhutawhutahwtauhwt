import { useState } from 'react';
import { ShieldCheck, Key, ExternalLink, AlertTriangle, Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

interface KeyGateModalProps {
  onVerify: () => void;
  onAdminLogin: () => void;
  onClose?: () => void;
}

export default function KeyGateModal({ onVerify, onAdminLogin, onClose }: KeyGateModalProps) {
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleVerify = async () => {
    const key = inputKey.trim();
    if (!key) return;
    
    setIsChecking(true);
    setError(false);
    setErrorMessage('');
    
    try {
      // Parallelize IP fetch and Firestore check for maximum speed
      const ipPromise = (async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            return data.ip;
          }
        } catch (e) {
          console.warn("IP Fetch optional skip");
        }
        return 'Unknown';
      })();

      // 2. Check Key in Firestore with shorter timeout
      const docRef = doc(db, 'access_keys', key);
      const docSnapPromise = getDoc(docRef);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 6000)
      );

      const [ip, docSnap] = await Promise.all([
        ipPromise,
        Promise.race([docSnapPromise, timeoutPromise]) as Promise<any>
      ]);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const now = Timestamp.now();
        
        // 3. Check expiry
        if (!data.isLifetime && data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
          setError(true);
          setErrorMessage('THIS KEY HAS EXPIRED');
          logAccess(key, ip, 'error', 'Expired key used');
        } 
        else if (data.hwid && data.hwid !== ip && ip !== 'Unknown' && data.hwid !== 'Unknown') {
          setError(true);
          setErrorMessage('HWID MISMATCH - CONTACT SUPPORT');
          logAccess(key, ip, 'error', `HWID Mismatch! Key locked to ${data.hwid}`);
        }
        else {
          // Success! Associate HWID if not set
          if (!data.hwid && ip !== 'Unknown') {
            await updateDoc(docRef, { hwid: ip });
          }

          try {
            logAccess(key, ip, 'success', data.hwid ? 'Returning user' : 'New user associated');
          } catch (logErr) {
            console.warn("Logging failed silently", logErr);
          }
          
          onVerify();
        }
      } else {
        setError(true);
        setErrorMessage('INVALID ACCESS KEY');
        try {
          logAccess(key, ip, 'error', 'Invalid key attempt');
        } catch (logErr) {
          console.warn("Logging failed silently", logErr);
        }
      }
    } catch (e: any) {
      console.error("Verification error:", e);
      setError(true);
      if (e.message === 'TIMEOUT') {
        setErrorMessage('CONNECTION TIMEOUT - TRY AGAIN');
      } else {
        setErrorMessage(e.message?.includes('permission-denied') ? 'FIREBASE ERROR - CHECK RULES' : 'SYSTEM ERROR - TRY AGAIN');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const logAccess = (key: string, ip: string, status: 'success' | 'error', msg: string) => {
    fetch('/api/log-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, ip, status, msg })
    }).catch(err => console.error("Discord logging failed:", err));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#1b1d1f] rounded-[40px] w-full max-w-[440px] shadow-2xl overflow-hidden border border-transparent dark:border-zinc-800"
      >
        <div className="bg-zinc-900 p-8 text-center text-white relative">
          {onClose && (
            <button 
              onClick={onClose}
              className="absolute right-6 top-6 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          )}
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Key size={32} className="text-zinc-800 dark:text-zinc-100" />
          </div>
          <h3 className="text-2xl font-black tracking-tight text-white uppercase">Access Required</h3>
          <p className="text-zinc-500 text-[10px] mt-2 font-bold uppercase tracking-[0.2em]">Enter your key to unlock Robux Gifting</p>
        </div>

        <div className="p-8">
          <div className="mb-6">
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-6 leading-relaxed text-center font-bold uppercase tracking-wider">
              Verification Required
            </p>
            
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => {
                    setInputKey(e.target.value);
                    setError(false);
                  }}
                  className={`w-full px-6 py-5 bg-gray-50 dark:bg-zinc-800/50 border-2 rounded-2xl font-mono text-base font-black text-center focus:outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-zinc-700 dark:text-white ${
                    error ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'border-gray-100 dark:border-zinc-800 focus:border-blue-600 dark:focus:border-blue-500'
                  }`}
                  placeholder="0000-0000-0000"
                />
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-red-500 dark:text-red-400 text-xs font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl"
                >
                  <AlertTriangle size={14} />
                  {errorMessage || 'INVALID OR EXPIRED KEY'}
                </motion.div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleVerify}
              disabled={isChecking || !inputKey.trim()}
              className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 dark:hover:bg-blue-500 transition-all shadow-xl shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isChecking ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  VERIFYING...
                </>
              ) : 'UNLOCK FEATURES'}
            </button>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert("ily.");
              }}
              className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold py-4 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <ExternalLink size={16} />
              GET ACCESS KEY
            </a>
          </div>

          <p className="text-[10px] text-gray-400 dark:text-zinc-500 text-center mt-6 uppercase font-bold tracking-widest">
            Dm corbin to buy key
          </p>

          <button 
            onClick={onAdminLogin}
            disabled={isChecking}
            className="w-full mt-4 text-[10px] text-zinc-300 font-bold uppercase tracking-widest hover:text-white transition-colors disabled:opacity-50"
          >
            {isChecking ? 'Authenticating...' : 'Admin Authorization'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
