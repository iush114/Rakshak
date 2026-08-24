import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard,
  ShieldAlert, 
  FileText, 
  BrainCircuit, 
  Settings as SettingsIcon, 
  Info,
  LogOut,
  Shield
} from 'lucide-react';
import { GithubIcon as Github } from '@/components/ui/GithubIcon';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'GitHub / Repository Scan', path: '/repository-scan', icon: Github },
  { name: 'Findings', path: '/findings', icon: ShieldAlert },
  { name: 'Reports', path: '/reports', icon: FileText },
  { name: 'AI Analysis History', path: '/ai-analysis-history', icon: BrainCircuit },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
  { name: 'About', path: '/about', icon: Info },
];

interface SidebarProps {
  onCloseMobile?: () => void;
}

export default function Sidebar({ onCloseMobile }: SidebarProps) {
  const location = useLocation();

  return (
    <aside className="w-64 bg-card border-r border-border h-full flex flex-col justify-between">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border/50">
          <Link to="/dashboard" onClick={onCloseMobile} className="flex items-center gap-3">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <Shield className="w-7 h-7 text-neonPurple" />
              <span className="absolute text-[10px] font-black text-white leading-none">R</span>
            </div>
            <span className="text-xl font-black tracking-wider text-white-pink-gradient">RAKSHAK</span>
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="py-6 flex flex-col gap-1.5 px-3">
          <div className="px-3 pb-2 text-[10px] uppercase font-bold text-textSecondary tracking-wider">
            DevSecOps Platform
          </div>

          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/dashboard' && (location.pathname === '/' || location.pathname === '/dashboard'));
            return (
              <Link key={item.path} to={item.path} onClick={onCloseMobile}>
                <div className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 group relative text-xs font-semibold cursor-pointer",
                  isActive 
                    ? "bg-neonPurple/15 text-white border border-neonPurple/30 glow-neon" 
                    : "text-textSecondary hover:bg-white/5 hover:text-foreground"
                )}>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-rakshak-gradient rounded-r-full"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon size={18} className={cn("transition-colors shrink-0", isActive ? "text-pinkAccent" : "text-textSecondary group-hover:text-foreground")} />
                  <span className="truncate">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Logout Footer */}
      <div className="p-4 border-t border-border/50">
        <Link to="/login" onClick={onCloseMobile}>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-textSecondary hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer text-xs font-semibold">
            <LogOut size={18} />
            <span>Logout</span>
          </div>
        </Link>
      </div>
    </aside>
  );
}
