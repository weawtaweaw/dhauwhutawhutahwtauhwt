import { Friend } from '../types';
import { motion } from 'motion/react';
import { User, ShieldCheck, Upload } from 'lucide-react';
import RobuxIcon from './RobuxIcon';

interface ProfileResultsProps {
  results: Friend[];
  onSendRobux: (friend: Friend) => void;
  onClose: () => void;
}

export default function ProfileResults({ results, onSendRobux, onClose }: ProfileResultsProps) {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
          Search Results 
          <span className="text-xs font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 px-2 py-0.5 rounded-full">
            {results.length} Profiles Found
          </span>
        </h2>
        <button 
          onClick={onClose}
          className="text-sm font-semibold text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          Clear Results
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(() => {
          const seen = new Set();
          return results.map((profile, i) => {
            if (seen.has(profile.username)) return null;
            seen.add(profile.username);
            return (
              <motion.div
                key={profile.username}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group relative border border-gray-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-[#1b1d1f] p-5 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="relative w-20 h-20 rounded-2xl bg-gray-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0 border-2 border-gray-50 dark:border-zinc-700">
                    {profile.avatarUrl ? (
                      <img 
                        src={profile.avatarUrl} 
                        alt={profile.display} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display)}&background=random&color=fff&size=150`;
                          if (target.src !== fallback) {
                            target.src = fallback;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 font-bold text-2xl">
                        {profile.avatarLetter}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-slate-800 dark:text-zinc-100">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-lg truncate">{profile.display}</h3>
                      <img 
                        src="https://en.help.roblox.com/hc/article_attachments/41933934939156" 
                        alt="Verified" 
                        className="w-4 h-4 object-contain shrink-0"
                      />
                    </div>
                    <div className="mb-3">
                      <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">@{profile.username}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 bg-gray-50 dark:bg-zinc-800/30 p-1.5 pl-3 rounded-full border border-gray-100 dark:border-zinc-700/50">
                      <div className="flex items-center gap-1.5 flex-1">
                        <RobuxIcon className="w-5 h-5" />
                        <span className="font-black text-slate-800 dark:text-white text-base">0</span>
                      </div>
                      <button
                        onClick={() => onSendRobux(profile)}
                        className="flex items-center gap-1.5 bg-[#e8eaed] dark:bg-zinc-700 hover:bg-[#dadce0] dark:hover:bg-zinc-600 text-[#191b1c] dark:text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all"
                      >
                        <Upload size={14} className="stroke-[2.5]" />
                        Send
                      </button>
                    </div>
                  </div>
                </div>
                <div className="absolute top-4 right-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
                </div>
              </motion.div>
            );
          });
        })()}
      </div>
    </div>
  );
}
