import { formatCount } from '@/utils/formatters';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bell,
  Search,
  User,
  Menu,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  SearchCode,
  XCircle,
  Check,
  Loader2,
} from 'lucide-react';
import { GithubIcon as Github } from '@/components/ui/GithubIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSecurity } from '@/context/SecurityContext';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/services/api';

interface TopbarProps {
  onToggleMobileMenu?: () => void;
  isSidebarCollapsed?: boolean;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function getNotificationIcon(type: string, severity?: string | null) {
  switch (type) {
    case 'critical_finding':
      return {
        icon: ShieldAlert,
        colorClass: 'text-red-400 bg-red-500/10 border-red-500/30',
        label: 'Critical Alert',
      };
    case 'high_finding':
      return {
        icon: AlertTriangle,
        colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        label: 'High Severity',
      };
    case 'new_finding':
      return {
        icon: Sparkles,
        colorClass: 'text-neonPurple bg-neonPurple/10 border-neonPurple/30',
        label: 'New Finding',
      };
    case 'fixed_finding':
      return {
        icon: CheckCircle2,
        colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        label: 'Resolved',
      };
    case 'scan_failed':
      return {
        icon: XCircle,
        colorClass: 'text-red-400 bg-red-500/10 border-red-500/30',
        label: 'Scan Failed',
      };
    case 'scan_completed':
    default:
      if (severity === 'critical') {
        return {
          icon: ShieldAlert,
          colorClass: 'text-red-400 bg-red-500/10 border-red-500/30',
          label: 'Scan Alert',
        };
      }
      return {
        icon: SearchCode,
        colorClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
        label: 'Scan Complete',
      };
  }
}

export default function Topbar({ onToggleMobileMenu, isSidebarCollapsed = false }: TopbarProps) {
  const navigate = useNavigate();
  const { selectedGitHubRepo, selectedRepo, isGithubConnected, currentUser } = useSecurity();
  const [searchTerm, setSearchTerm] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Load and apply notification preferences from localStorage
  const filterNotifications = useCallback((rawList: NotificationItem[]) => {
    const inAppAlerts = localStorage.getItem('rakshak_inapp_notifications') !== 'false';
    const criticalOnly = localStorage.getItem('rakshak_notifications_critical_only') === 'true';
    const scanNotices = localStorage.getItem('rakshak_scan_notices') !== 'false';

    return rawList.filter((item) => {
      // Scan failure is always shown
      if (item.notification_type === 'scan_failed') return true;

      // Scan completion notice filtering
      if (item.notification_type === 'scan_completed') {
        return scanNotices;
      }

      // Finding notifications filtering
      if (['critical_finding', 'high_finding', 'new_finding', 'fixed_finding'].includes(item.notification_type)) {
        if (!inAppAlerts) return false;
        if (criticalOnly) {
          return item.severity === 'critical' || item.severity === 'high' || item.notification_type === 'critical_finding' || item.notification_type === 'high_finding';
        }
        return true;
      }

      return true;
    });
  }, []);

  const fetchNotificationData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getNotifications(30);
      setNotifications(data.notifications || []);
    } catch {
      // Graceful degrade if unauthenticated or server unavailable
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and 30-second polling interval
  useEffect(() => {
    fetchNotificationData();

    const interval = setInterval(() => {
      fetchNotificationData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotificationData]);

  // Refresh when notification popover opens
  useEffect(() => {
    if (isNotificationsOpen) {
      fetchNotificationData();
    }
  }, [isNotificationsOpen, fetchNotificationData]);

  // Close notifications dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNotificationsOpen(false);
      }
    };

    if (isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotificationsOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/findings?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch {
        // Continue navigation even if read-mark fails
      }
    }
    setIsNotificationsOpen(false);

    if (notif.scan_id) {
      navigate(`/scan-history/${encodeURIComponent(notif.scan_id)}`);
    } else if (notif.finding_id) {
      navigate(`/findings?search=${encodeURIComponent(notif.finding_id)}`);
    } else {
      navigate('/findings');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Graceful error
    }
  };

  const activeRepoName = selectedGitHubRepo
    ? `${selectedGitHubRepo.owner}/${selectedGitHubRepo.name}`
    : selectedRepo.name;

  const visibleNotifications = filterNotifications(notifications);
  const visibleUnreadCount = visibleNotifications.filter((n) => !n.is_read).length;

  return (
    <header className="h-16 shrink-0 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">

      {/* Left: Mobile Menu Toggle & Search Bar */}
      <div className={`flex items-center gap-3 w-full max-w-md ${isSidebarCollapsed ? 'md:pl-16' : ''}`}>
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-lg bg-background border border-border text-textSecondary hover:text-white"
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

      {/* Right: Active Repository Status, Notification & User Avatar */}
      <div className="flex items-center gap-3 shrink-0">

        {/* Connected Repository Pill */}
        {isGithubConnected && (
          <div
            onClick={() => navigate('/repositories')}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background border border-border/80 text-xs hover:border-neonPurple/50 transition-all cursor-pointer"
          >
            <Github size={15} className="text-neonPurple" />
            <span className="font-mono font-bold text-white max-w-[150px] truncate">{activeRepoName}</span>
            <Badge variant="outline" className="text-[9px] bg-success/15 text-success border-success/30 px-1.5 py-0">
              Active
            </Badge>
          </div>
        )}

        {/* Notification Bell with Popover Dropdown */}
        <div className="relative" ref={notificationRef}>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            aria-expanded={isNotificationsOpen}
            aria-haspopup="true"
            aria-label="Notifications"
            className={`relative bg-background border-border text-textSecondary hover:text-foreground h-9 w-9 rounded-xl cursor-pointer transition-colors ${
              isNotificationsOpen ? 'border-neonPurple text-white' : ''
            }`}
          >
            <Bell size={16} />
            {visibleUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-pinkAccent text-[9px] font-bold text-white ring-2 ring-background animate-in zoom-in-50">
                {visibleUnreadCount > 9 ? '9+' : formatCount(visibleUnreadCount)}
              </span>
            )}
          </Button>

          {isNotificationsOpen && (
            <div className="absolute right-0 top-12 w-80 sm:w-96 rounded-2xl bg-[#12051F] border border-[#2A1240] shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-150 font-sans">
              <div className="flex items-center justify-between pb-3 border-b border-[#2A1240]">
                <div className="flex items-center gap-2">
                  <Bell size={15} className="text-neonPurple" />
                  <span className="font-bold text-white text-xs">Notifications</span>
                  {isLoading && <Loader2 size={12} className="animate-spin text-textSecondary" />}
                </div>
                <div className="flex items-center gap-2">
                  {visibleUnreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] text-neonPurple hover:text-pinkAccent font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Check size={11} />
                      Mark all as read
                    </button>
                  )}
                  <span className="text-[10px] text-textSecondary font-mono px-2 py-0.5 rounded-full bg-[#090014] border border-[#2A1240]">
                    {formatCount(visibleUnreadCount)} unread
                  </span>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-[#2A1240]/60 my-1 -mx-2 px-2 scrollbar-thin">
                {visibleNotifications.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-2.5">
                    <div className="w-10 h-10 rounded-full bg-neonPurple/10 border border-neonPurple/20 flex items-center justify-center text-neonPurple">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-white">No new notifications</p>
                      <p className="text-[11px] text-textSecondary max-w-[220px] leading-relaxed">
                        You&apos;re all caught up. Security alerts and scan events will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  visibleNotifications.map((n) => {
                    const iconConfig = getNotificationIcon(n.notification_type, n.severity);
                    const IconComponent = iconConfig.icon;

                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`py-3 px-2 rounded-xl transition-all cursor-pointer flex items-start gap-3 hover:bg-[#1C0B2E]/60 ${
                          !n.is_read ? 'bg-[#180826]/40 border-l-2 border-l-neonPurple' : 'opacity-85'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center border ${iconConfig.colorClass}`}
                        >
                          <IconComponent size={14} />
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-white truncate">
                              {n.title}
                            </p>
                            <span className="text-[9px] text-textSecondary font-mono shrink-0">
                              {formatRelativeTime(n.created_at)}
                            </span>
                          </div>

                          <p className="text-[11px] text-textSecondary line-clamp-2 leading-tight">
                            {n.message}
                          </p>
                        </div>

                        {!n.is_read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-pinkAccent shrink-0 mt-1.5 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Popover Footer */}
              <div className="pt-3 border-t border-[#2A1240] flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsNotificationsOpen(false);
                    navigate('/settings');
                  }}
                  className="text-textSecondary hover:text-neonPurple transition-colors cursor-pointer"
                >
                  Notification settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsNotificationsOpen(false);
                    navigate('/findings');
                  }}
                  className="text-neonPurple hover:text-pinkAccent font-semibold transition-colors cursor-pointer"
                >
                  View findings &rarr;
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 pl-3 border-l border-border/50">
          <div className="text-right hidden lg:block">
            <p className="text-xs font-bold text-foreground font-mono">
              {currentUser?.login || 'DevSecOps User'}
            </p>
            <p className="text-[10px] text-textSecondary">
              {currentUser ? 'GitHub Authenticated' : 'Rakshak Security'}
            </p>
          </div>

          {currentUser?.avatar_url ? (
            <img
              src={currentUser.avatar_url}
              alt={currentUser.login}
              className="w-8 h-8 rounded-full border border-neonPurple shadow-sm"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-rakshak-gradient p-[1.5px] shrink-0">
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
