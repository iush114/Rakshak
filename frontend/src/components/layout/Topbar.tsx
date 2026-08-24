import { useState } from 'react';
import { Bell, Search, User, Menu } from 'lucide-react';
import { GithubIcon as Github } from '@/components/ui/GithubIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSecurity } from '@/context/SecurityContext';
import { useNavigate } from 'react-router-dom';

interface TopbarProps {
  onToggleMobileMenu?: () => void;
}

export default function Topbar({ onToggleMobileMenu }: TopbarProps) {
  const navigate = useNavigate();
  const { selectedRepo, isGithubConnected } = useSecurity();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/findings?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <header className="h-16 shrink-0 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-0">
      
      {/* Left: Mobile Menu Toggle & Search Bar */}
      <div className="flex items-center gap-3 w-full max-w-md">
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
            onClick={() => navigate('/repository-scan')}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background border border-border/80 text-xs hover:border-neonPurple/50 transition-all cursor-pointer"
          >
            <Github size={15} className="text-neonPurple" />
            <span className="font-mono font-bold text-white max-w-[120px] truncate">{selectedRepo.name}</span>
            <Badge variant="outline" className="text-[9px] bg-success/15 text-success border-success/30 px-1.5 py-0">
              Connected
            </Badge>
          </div>
        )}

        <Button variant="outline" size="icon" className="relative bg-background border-border text-textSecondary hover:text-foreground h-9 w-9 rounded-xl">
          <Bell size={16} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full glow-danger" />
        </Button>
        
        <div className="flex items-center gap-2.5 pl-3 border-l border-border/50">
          <div className="text-right hidden lg:block">
            <p className="text-xs font-bold text-foreground">DevSecOps Engineer</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-rakshak-gradient p-[1.5px] shrink-0">
            <div className="w-full h-full bg-card rounded-full flex items-center justify-center">
              <User size={15} className="text-neonPurple" />
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}
