import { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Search,
  User,
  Menu,
  CheckCheck,
  AlertTriangle,
  ShieldAlert,
  Info,
  Sparkles,
  Loader2,
  X
} from 'lucide-react';
import { GithubIcon as Github } from '@/components/ui/GithubIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSecurity } from '@/context/SecurityContext';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationItem
} from '@/services/api';

interface TopbarProps {
  onToggleMobileMenu?: () => void;
  isSidebarCollapsed?: boolean;
}

export default function Topbar({ onToggleMobileMenu, isSidebarCollapsed = false }: TopbarProps) {
  const navigate = useNavigate();
  const { selectedGitHubRepo, selectedRepo, isGithubConnected, currentUser } = useSecurity();
  const [searchTerm, setSearchTerm] = useState('');

  // Notification Bell States
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Neon Effect Toggle State (synchronized with localStorage and Settings)
  const [isNeonEnabled, setIsNeonEnabled] = useState<boolean>(() => {
    return localStorage.getItem('rakshak_glow_effects') !== 'false';
  });

  // Listen for neon changes from Settings page or elsewhere
  useEffect(() => {
    const handleGlowChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        setIsNeonEnabled(customEvent.detail.enabled);
      } else {
        setIsNeonEnabled(localStorage.getItem('rakshak_glow_effects') !== 'false');
      }
    };

    window.addEventListener('rakshak-glow-changed', handleGlowChange);
    return () => window.removeEventListener('rakshak-glow-changed', handleGlowChange);
  }, []);

  // Quick Neon Toggle Handler
  const handleToggleNeon = () => {
    const nextState = !isNeonEnabled;
    setIsNeonEnabled(nextState);
    localStorage.setItem('rakshak_glow_effects', String(nextState));
    document.documentElement.setAttribute('data-glow', nextState ? 'true' : 'false');
    document.documentElement.setAttribute('data-neon', nextState ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('rakshak-glow-changed', { detail: { enabled: nextState } }));
  };

  // Fetch Notifications from Backend
  const fetchNotifications = async () => {
    try {
      setIsLoadingNotifications(true);
      const res = await getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count ?? 0);
    } catch (err) {
      console.warn('[Rakshak Topbar] Failed to fetch notifications:', err);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  // Initial fetch on mount & poll every 60s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle Mark Single Notification as Read
  const handleMarkRead = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      const res = await markNotificationAsRead(id);
      setUnreadCount(res.unread_count);
    } catch (err) {
      console.warn('[Rakshak Topbar] Failed to mark read:', err);
      fetchNotifications();
    }
  };

  // Handle Mark All as Read
  const handleMarkAllRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      await markAllNotificationsAsRead();
    } catch (err) {
      console.warn('[Rakshak Topbar] Failed to mark all read:', err);
      fetchNotifications();
    }
  };

  // Close notification popover on outside click and Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false);
      }
    };

    if (isNotificationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotificationOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/findings?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const activeRepoName = selectedGitHubRepo
    ? `${selectedGitHubRepo.owner}/${selectedGitHubRepo.name}`
    : (selectedRepo?.name || 'No Repository');

  // Severity Icon Helper
  const getSeverityIcon = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case 'critical':
        return <ShieldAlert size={16} className="text-red-400 shrink-0" />;
      case 'high':
        return <AlertTriangle size={16} className="text-amber-400 shrink-0" />;
      case 'medium':
        return <Info size={16} className="text-cyan-400 shrink-0" />;
      default:
        return <Bell size={16} className="text-[#A855F7] shrink-0" />;
    }
  };

  return (
    <header className="h-16 shrink-0 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 font-sans">

      {/* Left: Mobile Menu Toggle & Search Bar */}
      <div className={`flex items-center gap-3 w-full max-w-md ${isSidebarCollapsed ? 'md:pl-16' : ''}`}>
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-lg bg-background border border-border text-textSecondary hover:text-white cursor-pointer"
          aria-label="Toggle mobile navigation"
        >
          <Menu size={20} />
        </button>

        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary" size={16} />
          <Input
            type="text"
            placeholder="Search vulnerabilities, CVEs, or packages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-xs bg-background border-border focus-visible:ring-neonPurple w-full h-9 rounded-xl"
          />
        </form>
      </div>

      {/* Right Controls: Connected Repo, Neon Toggle, Notifications, User */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">

        {/* Connected Repository Pill */}
        {isGithubConnected && (
          <div
            onClick={() => navigate('/repositories')}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background border border-border/80 text-xs hover:border-neonPurple/50 transition-all cursor-pointer"
            title="Active Repository Workspace"
          >
            <Github size={15} className="text-neonPurple" />
            <span className="font-mono font-bold text-white max-w-[150px] truncate">{activeRepoName}</span>
            <Badge variant="outline" className="text-[9px] bg-success/15 text-success border-success/30 px-1.5 py-0">
              Active
            </Badge>
          </div>
        )}

        {/* Neon Effect ON/OFF Toggle */}
        <button
          type="button"
          onClick={handleToggleNeon}
          className={`h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
            isNeonEnabled
              ? 'bg-[#12051F] border-[#A855F7]/60 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)]'
              : 'bg-background border-border text-zinc-400 hover:text-zinc-200'
          }`}
          title={`Neon Glow Effects: ${isNeonEnabled ? 'ON (Click to turn OFF)' : 'OFF (Click to turn ON)'}`}
          aria-label="Toggle Neon Glow Effects"
        >
          <Sparkles size={14} className={isNeonEnabled ? 'text-[#00f2fe] animate-pulse' : 'text-zinc-500'} />
          <span className="hidden sm:inline text-[11px] font-mono">
            NEON: {isNeonEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Notification Bell Dropdown Container */}
        <div className="relative" ref={notificationRef}>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIsNotificationOpen(prev => !prev);
              if (!isNotificationOpen) fetchNotifications();
            }}
            className={`relative bg-background border-border hover:text-foreground h-9 w-9 rounded-xl transition-all cursor-pointer ${
              isNotificationOpen ? 'border-neonPurple text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'text-textSecondary'
            }`}
            aria-label="Security notifications"
            aria-expanded={isNotificationOpen}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] h-[18px] bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>

          {/* Notification Popover Panel */}
          {isNotificationOpen && (
            <div className="absolute right-0 top-12 w-80 sm:w-96 rounded-2xl bg-[#090014]/95 border border-[#2A1240] backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">

              {/* Header */}
              <div className="p-4 border-b border-[#2A1240] flex items-center justify-between bg-[#12051F]/80">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-[#A855F7]" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Notifications
                  </h4>
                  {unreadCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#A855F7]/20 border border-[#A855F7]/40 text-[#C4B5FD] font-mono font-bold">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-[#A855F7] hover:text-[#EC4899] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Mark all notifications as read"
                    >
                      <CheckCheck size={14} />
                      <span className="hidden sm:inline">Mark all read</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsNotificationOpen(false)}
                    className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                    aria-label="Close notifications"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Body: List or Empty State */}
              <div className="max-h-80 overflow-y-auto divide-y divide-[#2A1240]/40">
                {isLoadingNotifications && notifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-[#A855F7]" />
                    <span>Loading security alerts...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400 flex flex-col items-center justify-center">
                    <div className="p-3 rounded-full bg-[#12051F] border border-[#2A1240] mb-2.5 text-zinc-500">
                      <Bell size={22} />
                    </div>
                    <p className="font-bold text-white text-xs">No Notifications</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      You're all caught up with workspace security events.
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={(e) => !n.is_read && handleMarkRead(n.id, e)}
                      className={`p-3.5 transition-colors flex items-start gap-3 cursor-pointer ${
                        n.is_read
                          ? 'bg-transparent hover:bg-[#12051F]/40 opacity-70'
                          : 'bg-[#12051F]/70 hover:bg-[#1A072E] border-l-2 border-l-[#A855F7]'
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-[#06000E] border border-[#2A1240] shrink-0 mt-0.5">
                        {getSeverityIcon(n.severity)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className={`text-xs font-bold truncate ${n.is_read ? 'text-zinc-300' : 'text-white'}`}>
                            {n.title}
                          </h5>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-[#00f2fe] shrink-0 shadow-[0_0_6px_#00f2fe]" title="Unread" />
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                          {n.message}
                        </p>
                        <div className="flex items-center justify-between mt-1.5 text-[10px] text-zinc-500">
                          <span className="uppercase font-mono tracking-wider text-[9px] text-zinc-400">
                            {n.severity}
                          </span>
                          {n.created_at && (
                            <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-2.5 bg-[#12051F]/80 border-t border-[#2A1240] text-center">
                <button
                  onClick={() => {
                    setIsNotificationOpen(false);
                    navigate('/findings');
                  }}
                  className="text-[11px] font-bold text-[#A855F7] hover:text-[#EC4899] transition-colors cursor-pointer"
                >
                  View All Findings & Alerts &rarr;
                </button>
              </div>

            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2.5 pl-3 border-l border-border/50 cursor-pointer group"
          title="User Profile & Settings"
        >
          <div className="text-right hidden lg:block">
            <p className="text-xs font-bold text-foreground font-mono group-hover:text-[#A855F7] transition-colors">
              {currentUser?.name || currentUser?.login || 'DevSecOps User'}
            </p>
            <p className="text-[10px] text-textSecondary">
              {currentUser?.email || (currentUser ? 'Authenticated' : 'Rakshak Security')}
            </p>
          </div>

          {currentUser?.avatar_url ? (
            <img
              src={currentUser.avatar_url}
              alt={currentUser.name || currentUser.login || 'User avatar'}
              className="w-8 h-8 rounded-full border border-neonPurple shadow-sm group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-rakshak-gradient p-[1.5px] shrink-0 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-card rounded-full flex items-center justify-center">
                <User size={15} className="text-neonPurple" />
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
