import { useState } from 'react';
import { 
  History, 
  Clock, 
  TrendingDown, 
  ArrowRight,
  SlidersHorizontal
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSecurity } from '@/context/SecurityContext';

export default function ScanHistory() {
  const { scanHistory } = useSecurity();
  const [compareMode, setCompareMode] = useState(false);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <History className="text-neonPurple" size={28} />
            <span>Scan History & Timeline</span>
            <Badge variant="default" className="text-xs">{scanHistory.length} Total Runs</Badge>
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Historical CI/CD pipeline security execution logs and prioritization trends.
          </p>
        </div>

        <Button 
          variant={compareMode ? "gradient" : "outline"}
          onClick={() => setCompareMode(!compareMode)}
          className="flex items-center gap-2 text-xs"
        >
          <SlidersHorizontal size={14} />
          <span>{compareMode ? 'Exit Comparison Mode' : 'Enable Comparison Mode'}</span>
        </Button>
      </div>

      {/* Comparison Mode Banner */}
      {compareMode && scanHistory.length >= 2 && (
        <Card className="bg-gradient-to-r from-neonPurple/20 via-pinkAccent/20 to-purple-900/20 border-neonPurple/40 p-5 glow-neon">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-neonPurple uppercase tracking-wider block">Comparison Engine Active</span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{scanHistory[1].scanId} ({scanHistory[1].date})</span>
                <ArrowRight size={16} className="text-pinkAccent" />
                <span>{scanHistory[0].scanId} ({scanHistory[0].date})</span>
              </h3>
            </div>

            <div className="flex items-center gap-6 bg-[#090014]/80 px-5 py-3 rounded-xl border border-[#2A1240]">
              <div className="text-center">
                <span className="text-[10px] text-textSecondary uppercase block font-semibold">Previous Scan</span>
                <span className="text-lg font-black text-danger">{scanHistory[1].findingsCount} findings</span>
              </div>

              <div className="text-center border-x border-[#2A1240] px-4">
                <span className="text-[10px] text-textSecondary uppercase block font-semibold">Current Scan</span>
                <span className="text-lg font-black text-warning">{scanHistory[0].findingsCount} findings</span>
              </div>

              <div className="text-center flex items-center gap-1.5 text-success">
                <TrendingDown size={20} />
                <div>
                  <span className="text-lg font-black block">
                    ↓ {Math.max(0, scanHistory[1].findingsCount - scanHistory[0].findingsCount)} Reduced
                  </span>
                  <span className="text-[10px] uppercase font-bold">Posture Improvement</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Timeline List */}
      <div className="relative pl-6 md:pl-8 space-y-6 before:absolute before:left-2.5 md:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#2A1240]">
        {scanHistory.map((scan) => (
          <div key={scan.id} className="relative group">
            {/* Timeline Dot */}
            <div className="absolute -left-6 md:-left-8 top-4 w-4 h-4 rounded-full bg-[#12051F] border-2 border-neonPurple glow-neon flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-pinkAccent" />
            </div>

            {/* Scan Card */}
            <Card className="hover:border-neonPurple/50 transition-all duration-300">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-extrabold text-white">{scan.scanId}</span>
                    <Badge variant={scan.status === 'Passed' ? 'success' : scan.status === 'Failed' ? 'critical' : 'medium'}>
                      {scan.status.toUpperCase()}
                    </Badge>
                  </div>

                  <p className="text-xs text-textSecondary font-mono flex items-center gap-2">
                    <span>Target: {scan.repo}</span>
                  </p>
                </div>

                <div className="flex items-center gap-6 text-xs border-t md:border-t-0 md:border-l border-border/60 pt-3 md:pt-0 md:pl-6">
                  <div className="text-center">
                    <span className="text-textSecondary text-[10px] uppercase block font-semibold">Duration</span>
                    <span className="font-mono font-bold text-white flex items-center gap-1 mt-0.5">
                      <Clock size={12} className="text-neonPurple" />
                      {scan.duration}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-textSecondary text-[10px] uppercase block font-semibold">Total Findings</span>
                    <span className="font-bold text-white mt-0.5 block">{scan.findingsCount}</span>
                  </div>

                  <div className="text-center">
                    <span className="text-textSecondary text-[10px] uppercase block font-semibold">Risk Score</span>
                    <span className="font-black text-danger mt-0.5 block">{scan.riskScore} / 100</span>
                  </div>

                  <div className="text-right pl-2">
                    <span className="text-textSecondary text-[10px] block">{scan.date}</span>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
