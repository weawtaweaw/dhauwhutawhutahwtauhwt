import { X, Sun, Moon } from 'lucide-react';
import { User } from '../types';
import { BONUS_GAMES } from '../constants';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSave: (updatedUser: User) => void;
  onLogout: () => void;
}

export default function SettingsModal({ isOpen, onClose, user, onSave, onLogout }: SettingsModalProps) {
  const [formData, setFormData] = useState<User>(formDataFromProps(user));

  useEffect(() => {
    if (formData.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (formData.theme === 'light') {
      document.documentElement.classList.remove('dark');
    }
  }, [formData.theme, isOpen]);

  function formDataFromProps(u: User): User {
    return { ...u, theme: u.theme || 'light' };
  }

  const handleSave = () => {
    onSave(formData);
  };

  const handleClose = () => {
    // Revert to original theme if closing without saving
    if (user.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm ${formData.theme === 'dark' ? 'dark' : ''}`}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-[#1b1d1f] rounded-[28px] w-full max-w-[460px] shadow-2xl overflow-hidden transition-colors"
      >
        <div className="flex justify-between items-center px-6 py-4.5 border-b border-gray-100 dark:border-zinc-800">
          <h3 className="text-xl font-bold dark:text-white">Settings</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <X size={28} />
          </button>
        </div>

        <div className="p-6">
            <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-black dark:border-white shadow-lg bg-black relative">
              <img 
                src={formData.avatarUrl || "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-C318C9101602477C9F9A7C91ECEEE44A-Png/150/150/AvatarHeadshot/Webp/noFilter"} 
                alt="Preview"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-C318C9101602477C9F9A7C91ECEEE44A-Png/150/150/AvatarHeadshot/Webp/noFilter") {
                    target.src = "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-C318C9101602477C9F9A7C91ECEEE44A-Png/150/150/AvatarHeadshot/Webp/noFilter";
                  }
                }}
              />
            </div>
            <p className="mt-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              Avatar Preview
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-500 dark:text-zinc-400">Display Name</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-zinc-700 bg-transparent dark:text-white rounded-2xl text-base focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Display Name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-500 dark:text-zinc-400">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-zinc-700 bg-transparent dark:text-white rounded-2xl text-base focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Username"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-500 dark:text-zinc-400">Robux Balance</label>
              <input
                type="text"
                value={formData.robux.toLocaleString()}
                onChange={(e) => {
                  const val = e.target.value.replace(/,/g, '');
                  if (/^\d*$/.test(val)) {
                    setFormData({ ...formData, robux: Number(val) });
                  }
                }}
                className="w-full px-4 py-3 border border-gray-200 dark:border-zinc-700 bg-transparent dark:text-white rounded-2xl text-base focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Balance"
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[51712215, 126191501, 12215621, 21571219].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFormData({ ...formData, robux: val })}
                    className="px-3 py-2 text-[10px] font-black bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all text-slate-700 dark:text-zinc-400"
                  >
                    {val.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-zinc-400">Bonus Item Game</label>
              <div className="grid grid-cols-2 gap-3">
                {BONUS_GAMES.map((game) => (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, selectedBonusGameId: game.id })}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl border transition-all ${
                      formData.selectedBonusGameId === game.id || (!formData.selectedBonusGameId && game.id === 'adopt-me')
                        ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400' 
                        : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="font-bold text-xs truncate">{game.name.replace('[🍣] ', '')}</span>
                  </button>
                ))}
              </div>
            </div>


            <div className="space-y-1.5 pt-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-zinc-400">Application Theme</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, theme: 'light' })}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border transition-all ${
                    formData.theme === 'light' 
                      ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400' 
                      : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Sun size={18} />
                  <span className="font-bold">Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, theme: 'dark' })}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border transition-all ${
                    formData.theme === 'dark' 
                      ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400' 
                      : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Moon size={18} />
                  <span className="font-bold">Dark</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={handleSave}
              className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 dark:shadow-none"
            >
              Save Changes
            </button>
            <button
              onClick={onLogout}
              className="w-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-semibold py-3 px-6 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Log Out
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
