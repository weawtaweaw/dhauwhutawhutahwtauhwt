import { Home, User as UserIcon, Plus, MessageSquare, Users, UserCircle, Package, RefreshCw, Globe, FileText, ShoppingCart, Gift } from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  user: User;
}

export default function Sidebar({ user }: SidebarProps) {
  const navItems = [
    { icon: Home, label: 'Home' },
    { icon: UserCircle, label: 'Profile' },
    { 
      label: 'Roblox Plus', 
      customIcon: (
        <div className="w-[18px] h-[18px] flex items-center justify-center -ml-0.5">
          <img 
            src="https://media.discordapp.net/attachments/899166961567678504/1505869983790399519/fJzUBtXeWsAAAAASUVORK5CYII.png?ex=6a0c3235&is=6a0ae0b5&hm=a7d0c4a9a7624e8f05f0c76c33bae2abc783274e489a21f31c0857cf75faeaa7&=&format=webp&quality=lossless" 
            alt="Roblox Plus" 
            className="w-full h-full object-contain dark:invert" 
          />
        </div>
      )
    },
    { icon: MessageSquare, label: 'Messages', badge: 76 },
    { icon: Users, label: 'Friends', badge: 63 },
    { icon: UserIcon, label: 'Avatar' },
    { icon: Package, label: 'Inventory' },
    { icon: RefreshCw, label: 'Trade' },
    { icon: Globe, label: 'Communities' },
    { icon: FileText, label: 'Blog' },
    { icon: ShoppingCart, label: 'Official Store' },
    { icon: Gift, label: 'Buy Gift Cards' },
  ];

  return (
    <aside className="w-[240px] shrink-0 p-3 border-r border-gray-200 bg-white dark:bg-[#0c0d0e] dark:border-zinc-800 hidden lg:flex flex-col gap-1 overflow-y-auto h-[calc(100vh-56px)] transition-colors">
      <div className="flex items-center gap-3 p-2.5 rounded-lg text-sm font-bold text-slate-800 dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
        <div className="w-6 h-6 rounded-full overflow-hidden border border-[#BDC3C7] dark:border-zinc-700">
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
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="truncate">{user.displayName}</span>
          <img 
            src="https://en.help.roblox.com/hc/article_attachments/41933934939156" 
            alt="Verified" 
            className="w-3.5 h-3.5 object-contain shrink-0"
          />
        </div>
      </div>
      {navItems.map((item) => (
        <a
          key={item.label}
          href="#"
          className="flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {item.customIcon ? item.customIcon : <item.icon size={18} className="text-gray-400 dark:text-zinc-500" />}
          <span>{item.label}</span>
          {item.badge && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-gray-900 dark:bg-zinc-700 text-white text-[10px] font-bold">
              {item.badge}
            </span>
          )}
        </a>
      ))}
    </aside>
  );
}
