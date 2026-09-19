import { formatCount } from '@/utils/formatters';
import { useState } from 'react';
import { 
  Key, 
  Eye, 
  EyeOff, 
  Copy, 
  CheckCircle, 
  ShieldAlert, 
  FileCode, 
  SlidersHorizontal,
  Clock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSecurity } from '@/context/SecurityContext';

export default function Secrets() {
  const { secrets, resolveSecret } = useSecurity();
  const [unmasked, setUnmasked] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const toggleUnmask = (id: string) => {
    setUnmasked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const filteredSecrets = secrets.filter(s => {
    const matchesSearch = s.type.toLowerCase().includes(searchTerm.toLowerCase()) || s.filePath.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || s.status.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const activeCount = secrets.filter(s => s.status === 'Active').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Key className="text-warning" size={28} />
            <span>Secrets Detection (Gitleaks)</span>
            <Badge className="bg-danger/20 text-danger border-danger/40">{formatCount(activeCount)} Active Exposed Secrets</Badge>
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Real-time regex & entropy analysis scanning for API keys, passwords, and private tokens.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setFilterStatus(filterStatus === 'active' ? 'all' : 'active')}
            className="text-xs"
          >
            <SlidersHorizontal size={14} className="mr-1.5" />
            <span>{filterStatus === 'active' ? 'Show All Secrets' : 'Filter Active Secrets'}</span>
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <Card className="p-4 bg-card/80 border-border">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Input 
              type="text" 
              placeholder="Search secret type or file path..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-background text-xs h-10 border-border"
            />
          </div>

          <div className="flex items-center gap-2">
            {['all', 'active', 'resolved'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  filterStatus === st 
                    ? 'bg-warning text-black font-bold shadow-md' 
                    : 'bg-card/60 border border-border text-textSecondary hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Secret Incident Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredSecrets.map((secret) => {
          const isActive = secret.status === 'Active';
          const isShow = unmasked[secret.id];

          return (
            <Card 
              key={secret.id} 
              className={`relative overflow-hidden border transition-all duration-300 ${
                isActive 
                  ? 'border-danger/50 bg-gradient-to-br from-[#12051F] via-[#1a051d] to-[#25081c] glow-danger' 
                  : 'border-border/60 bg-card/40 opacity-80'
              }`}
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-3">
                  <div>
                    <span className="font-mono text-sm font-extrabold text-white flex items-center gap-2">
                      <ShieldAlert size={16} className={isActive ? "text-danger animate-pulse" : "text-textSecondary"} />
                      {secret.type}
                    </span>
                    <span className="text-[11px] text-textSecondary flex items-center gap-1 mt-1">
                      <Clock size={12} />
                      {secret.timestamp} • {secret.repo}
                    </span>
                  </div>

                  <Badge variant={isActive ? 'critical' : 'success'}>
                    {secret.status.toUpperCase()}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[#090014] border border-[#2A1240]">
                  <div className="flex items-center gap-2 font-mono text-xs text-textSecondary overflow-hidden">
                    <FileCode size={14} className="text-neonPurple shrink-0" />
                    <span className="truncate text-white">{secret.filePath}</span>
                    <span className="text-pinkAccent font-bold">Line {secret.line}</span>
                  </div>

                  <button
                    onClick={() => copyPath(secret.filePath)}
                    className="text-xs text-textSecondary hover:text-white flex items-center gap-1 shrink-0 ml-2"
                  >
                    <Copy size={13} />
                    <span>{copiedPath === secret.filePath ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-[#090014]/90 border border-border flex items-center justify-between font-mono text-xs">
                  <span className={isShow ? "text-danger font-bold" : "text-textSecondary"}>
                    {isShow ? secret.rawSecret : secret.maskedSecret}
                  </span>

                  <button
                    onClick={() => toggleUnmask(secret.id)}
                    className="p-1 rounded text-textSecondary hover:text-white transition-colors"
                  >
                    {isShow ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-textSecondary">Confidence:</span>
                    <Badge variant="outline" className="text-[10px] text-warning border-warning/40">
                      {secret.confidence}
                    </Badge>
                  </div>

                  <Button
                    variant={isActive ? "gradient" : "outline"}
                    size="sm"
                    onClick={() => resolveSecret(secret.id)}
                    className="text-xs h-8"
                  >
                    {isActive ? (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle size={13} />
                        Mark Resolved
                      </span>
                    ) : (
                      <span>Re-open Incident</span>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
