import React, { useState } from 'react';
import { Search, Bell, Settings, Shield } from 'lucide-react';
import { User } from '../types';
import RobuxIcon from './RobuxIcon';
import { User as FirebaseUser } from 'firebase/auth';
import { isAdmin } from '../lib/firebase';

interface TopbarProps {
  user: User;
  onOpenSettings: () => void;
  onSearch: (query: string) => void;
  currentUser: FirebaseUser | null;
  onOpenAdmin: () => void;
  onLogin: () => void;
}

export default function Topbar({ 
  user, 
  onOpenSettings, 
  onSearch, 
  currentUser, 
  onOpenAdmin,
  onLogin
}: TopbarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <header className="sticky top-0 z-50 flex items-center gap-6 h-14 px-6 border-b border-gray-200 bg-white dark:bg-[#0c0d0e] dark:border-zinc-800 transition-colors">
      <a href="#" className="text-xl font-black tracking-[-0.08em] flex items-center gap-0.5 dark:text-white">
        <span>R</span>
        <span className="inline-block transform rotate-12 -mt-0.5">O</span>
        <span>BLOX</span>
      </a>
      <nav className="hidden lg:flex items-center gap-14 ml-16">
        {['Charts', 'Marketplace', 'Create', 'Robux'].map((item) => (
          <a
            key={item}
            href="#"
            className="text-[13px] font-bold text-[#232527] dark:text-zinc-300 hover:text-[#0074BD] dark:hover:text-[#00A2FF] transition-all uppercase tracking-[0.08em] opacity-90 hover:opacity-100"
          >
            {item}
          </a>
        ))}
      </nav>
      <form 
        onSubmit={handleSubmit}
        className="max-w-[440px] hidden lg:flex flex-1 items-center gap-2 bg-[#EBEDF0] dark:bg-zinc-800 border border-[#DEE1E5] dark:border-zinc-700 px-3 py-1.5 rounded-md text-[#616A72] dark:text-zinc-400 group focus-within:border-zinc-400 dark:focus-within:border-zinc-500 focus-within:bg-white dark:focus-within:bg-zinc-700 transition-all relative ml-12"
      >
        <Search size={16} strokeWidth={2.5} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="bg-transparent border-none outline-none text-[13px] w-full text-zinc-900 dark:text-zinc-100 placeholder:text-[#8D949A] dark:placeholder:text-zinc-500"
        />
      </form>
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[13px] font-bold text-[#393B3D] dark:text-zinc-200">
          <div className="w-[30px] h-[30px] rounded-full overflow-hidden border border-[#BDC3C7] dark:border-zinc-700 bg-white">
            <img 
              src={user.avatarUrl || "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-C318C9101602477C9F9A7C91ECEEE44A-Png/150/150/AvatarHeadshot/Webp/noFilter"} 
              alt="User Avatar"
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
          <div className="hidden lg:flex items-center gap-1">
            <span>{user.displayName}</span>
          </div>
        </div>
        <button className="relative flex text-[#393B3D] dark:text-zinc-300 hover:text-black dark:hover:text-white">
          <Bell size={20} />
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E2231A] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-zinc-800">
            4
          </span>
        </button>
        <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#393B3D] dark:text-zinc-200">
          <RobuxIcon size={20} className="dark:brightness-0 dark:invert" />
          <span>{user.robux.toLocaleString()}</span>
        </div>
        <button 
          onClick={onOpenSettings}
          className="text-[#616A72] dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
        >
          <Settings size={20} />
        </button>
        {isAdmin() && (
          <button 
            onClick={onOpenAdmin}
            className="flex items-center gap-1 bg-zinc-800 text-white text-[10px] font-black px-3 py-1.5 rounded-full hover:bg-black transition-all uppercase tracking-tighter shadow-lg shadow-black/10"
          >
            <Shield size={12} />
            Admin
          </button>
        )}
      </div>
    </header>
  );
}
