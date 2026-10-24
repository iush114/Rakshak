import { formatScore, formatCount, formatDuration } from '@/utils/formatters';
import { useEffect, useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  History, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  KeyRound, 
  Boxes, 
  Code2, 
  PackageCheck,
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  GitBranch,
  Layers,
  Activity,
  Play
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getScan, getScans, type ScanDetail, type ScanHistoryItem } from '@/services/api';

const PAGE_SIZE = 20;

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'In progress';
}

function statusVariant(status: string): 'success' | 'critical' | 'medium' | 'info' {
  const value = status.toLowerCase();
  if (value === 'completed' || value === 'passed') return 'success';
  if (value === 'failed') return 'critical';
  if (value === 'running' || value === 'queued') return 'medium';
  return 'info';
}

function gateVariant(status: string | null): 'success' | 'critical' | 'medium' | 'info' {
  if (status === 'PASS') return 'success';
  if (status === 'FAIL') return 'critical';
  if (status === 'ERROR') return 'critical';
  return 'medium';
}

function duration(scan: ScanHistoryItem) {
  if (!scan.started_at || !scan.completed_at) return 'In progress';
  const seconds = Math.max(0, (new Date(scan.completed_at).getTime() - new Date(scan.started_at).getTime()) / 1000);
  return formatDuration(seconds, 2);
}

function SeverityCounts({ scan }: { scan: ScanHistoryItem }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px]">
      <Badge variant="critical" className="px-2 py-0.5 font-bold">C {formatCount(scan.critical)}</Badge>
      <Badge variant="high" className="px-2 py-0.5 font-bold">H {formatCount(scan.high)}</Badge>
      <Badge variant="medium" className="px-2 py-0.5 font-bold">M {formatCount(scan.medium)}</Badge>
      <Badge variant="low" className="px-2 py-0.5 font-bold">L {formatCount(scan.low)}</Badge>
    </div>
  );
}

export default function ScanHistory() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<ScanHistoryItem[]>([]);
  const [detail, setDetail] = useState<ScanDetail | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [repository, setRepository] = useState('');
  const [status, setStatus] = useState('');
  const [eventType, setEventType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scan Details view state
  const [copiedId, setCopiedId] = useState(false);
  const [findingSearch, setFindingSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [toolFilter, setToolFilter] = useState('all');
  const [lifecycleFilter, setLifecycleFilter] = useState('all');
  const [expandedFindings, setExpandedFindings] = useState<Record<string | number, boolean>>({});

  const toggleExpand = (id: string | number) => {
    setExpandedFindings(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyScanId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  useEffect(() => {
    if (!scanId) return;
    setLoading(true);
    setError(null);
    getScan(scanId).then(setDetail).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, [scanId]);

  useEffect(() => {
    if (scanId) return;
    setLoading(true);
    setError(null);
    getScans({ repository: repository || undefined, status: status || undefined, event_type: eventType || undefined, limit: PAGE_SIZE, offset })
      .then((data) => { setItems(data.items); setTotal(data.total); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [scanId, repository, status, eventType, offset]);

  // Filtered findings for Scan Details view
  const filteredFindings = useMemo(() => {
    if (!detail || !detail.findings) return [];
    return detail.findings.filter(f => {
      const matchSearch = findingSearch === '' || 
        (f.title && f.title.toLowerCase().includes(findingSearch.toLowerCase())) ||
        (f.vulnerability_id && f.vulnerability_id.toLowerCase().includes(findingSearch.toLowerCase())) ||
        (f.tool && f.tool.toLowerCase().includes(findingSearch.toLowerCase())) ||
        (f.target && f.target.toLowerCase().includes(findingSearch.toLowerCase())) ||
        (f.description && f.description.toLowerCase().includes(findingSearch.toLowerCase()));

      const matchSeverity = severityFilter === 'all' || (f.severity && f.severity.toLowerCase() === severityFilter.toLowerCase());
      const matchTool = toolFilter === 'all' || (f.tool && f.tool.toLowerCase() === toolFilter.toLowerCase());
      const matchLifecycle = lifecycleFilter === 'all' || (f.lifecycle_status && f.lifecycle_status.toLowerCase() === lifecycleFilter.toLowerCase());

      return matchSearch && matchSeverity && matchTool && matchLifecycle;
    });
  }, [detail, findingSearch, severityFilter, toolFilter, lifecycleFilter]);

  // Unique tools for filter dropdown
  const uniqueTools = useMemo(() => {
    if (!detail || !detail.findings) return [];
    const set = new Set<string>();
    detail.findings.forEach(f => { if (f.tool) set.add(f.tool); });
    return Array.from(set);
  }, [detail]);

  // ==========================================
  // VIEW: SCAN DETAILS
  // ==========================================
  if (scanId) {
    if (loading) {
      return (
        <div className="space-y-6 pb-12 flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-10 h-10 border-3 border-neonPurple/30 border-t-neonPurple rounded-full animate-spin" />
          <p className="text-sm text-textSecondary font-medium animate-pulse">Loading scan details & security report...</p>
        </div>
      );
    }

    if (error || !detail) {
      return (
        <div className="space-y-6 pb-12">
          <Button variant="ghost" onClick={() => navigate('/scan-history')} className="gap-2">
            <ArrowLeft size={16} /> Back to Scan History
          </Button>
          <Card className="border-danger/40 bg-danger/5">
            <CardContent className="p-8 text-center space-y-4">
              <AlertTriangle className="mx-auto text-danger" size={40} />
              <div>
                <h3 className="text-base font-bold text-white">Failed to Load Scan Details</h3>
                <p className="text-sm text-danger mt-1">{error || 'Scan record could not be found.'}</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/scan-history')}>
                Return to Scan History
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    const totalFindingsCount = detail.total_findings || 0;
    const criticalCount = detail.critical || 0;
    const highCount = detail.high || 0;
    const mediumCount = detail.medium || 0;
    const lowCount = detail.low || 0;
    const riskScoreVal = detail.overall_risk ?? detail.risk_score ?? 0;

    const denominator = Math.max(1, totalFindingsCount);
    const critPct = Math.round((criticalCount / denominator) * 100);
    const highPct = Math.round((highCount / denominator) * 100);
    const medPct = Math.round((mediumCount / denominator) * 100);
    const lowPct = Math.round((lowCount / denominator) * 100);

    return (
      <div className="space-y-6 pb-16 max-w-7xl mx-auto">
        
        {/* 1. HEADER */}
        <div className="space-y-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/scan-history')} 
            className="gap-2 text-textSecondary hover:text-white -ml-2 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft size={15} /> Back to Scan History
          </Button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-neonPurple/15 text-neonPurple border border-neonPurple/30 shrink-0">
                  <Shield size={24} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                    <span>Scan Details</span>
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-textSecondary font-sans">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <GitBranch size={13} className="text-neonPurple" />
                      {detail.repository || detail.target_path || 'Local Workspace'}
                    </span>
                    <span>•</span>
                    <button 
                      onClick={() => handleCopyScanId(detail.scan_id)}
                      className="font-mono text-textSecondary hover:text-white flex items-center gap-1 bg-card/60 px-2 py-0.5 rounded border border-border/60 transition-colors cursor-pointer"
                      title="Click to copy full Scan ID"
                    >
                      <span>ID: {detail.scan_id.slice(0, 12)}...</span>
                      {copiedId ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                    </button>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(detail.started_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Badges on the right */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Badge variant={statusVariant(detail.status)} className="px-3 py-1 text-xs uppercase font-bold tracking-wider">
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${detail.status === 'running' ? 'bg-amber-400 animate-pulse' : detail.status === 'completed' ? 'bg-emerald-400' : 'bg-danger'}`} />
                {detail.status}
              </Badge>

              {detail.security_gate_status && (
                <Badge variant={gateVariant(detail.security_gate_status)} className="px-3 py-1 text-xs font-bold" title={detail.security_gate_reason || undefined}>
                  Gate: {detail.security_gate_status}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* 2. EXECUTIVE SUMMARY METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          
          {/* Overall Risk Card */}
          <Card className="border-neonPurple/40 bg-gradient-to-br from-[#12051F] to-[#200836] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-neonPurple/10 rounded-full blur-xl pointer-events-none" />
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neonPurple">Overall Risk</span>
                <Activity size={14} className="text-neonPurple" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-warning">
                  {formatScore(riskScoreVal)}
                </span>
                <span className="text-xs text-textSecondary font-semibold">/100</span>
              </div>
              <p className="text-[10px] text-textSecondary font-medium">
                {riskScoreVal >= 80 ? 'Critical Threat Level' : riskScoreVal >= 50 ? 'High Threat Level' : riskScoreVal >= 25 ? 'Medium Threat Level' : 'Low Threat Level'}
              </p>
            </CardContent>
          </Card>

          {/* Total Findings */}
          <Card className="border-border/80 bg-card/60">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary">Total Findings</span>
                <ShieldAlert size={14} className="text-textSecondary" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-white block">
                {formatCount(totalFindingsCount)}
              </span>
              <p className="text-[10px] text-textSecondary font-medium">Security vulnerabilities</p>
            </CardContent>
          </Card>

          {/* Critical */}
          <Card className="border-danger/40 bg-danger/5">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-danger">Critical</span>
                <span className="w-2 h-2 rounded-full bg-danger" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-danger block">
                {formatCount(criticalCount)}
              </span>
              <p className="text-[10px] text-danger/80 font-medium">Requires immediate fix</p>
            </CardContent>
          </Card>

          {/* High */}
          <Card className="border-pinkAccent/40 bg-pinkAccent/5">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-pinkAccent">High</span>
                <span className="w-2 h-2 rounded-full bg-pinkAccent" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-pinkAccent block">
                {formatCount(highCount)}
              </span>
              <p className="text-[10px] text-pinkAccent/80 font-medium">Priority remediation</p>
            </CardContent>
          </Card>

          {/* Medium */}
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-warning">Medium</span>
                <span className="w-2 h-2 rounded-full bg-warning" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-warning block">
                {formatCount(mediumCount)}
              </span>
              <p className="text-[10px] text-warning/80 font-medium">Elevated risk profile</p>
            </CardContent>
          </Card>

          {/* Low */}
          <Card className="border-neonPurple/40 bg-neonPurple/5">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neonPurple">Low</span>
                <span className="w-2 h-2 rounded-full bg-neonPurple" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-neonPurple block">
                {formatCount(lowCount)}
              </span>
              <p className="text-[10px] text-neonPurple/80 font-medium">Informational / Minor</p>
            </CardContent>
          </Card>

        </div>

        {/* 3 & 4. SEVERITY BREAKDOWN & SCANNERS EXECUTED */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          
          {/* Severity Distribution Card */}
          <Card className="border-border/80 bg-card/60">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers size={16} className="text-neonPurple" />
                  <span>Severity Distribution</span>
                </h2>
                <span className="text-xs text-textSecondary font-mono">{formatCount(totalFindingsCount)} Total</span>
              </div>

              {/* Segmented Distribution Bar */}
              {totalFindingsCount > 0 ? (
                <div className="space-y-4">
                  <div className="h-3 w-full rounded-full bg-[#090014] overflow-hidden flex border border-[#2A1240]">
                    {criticalCount > 0 && <div style={{ width: `${(criticalCount / totalFindingsCount) * 100}%` }} className="bg-danger" title={`Critical: ${criticalCount}`} />}
                    {highCount > 0 && <div style={{ width: `${(highCount / totalFindingsCount) * 100}%` }} className="bg-pinkAccent" title={`High: ${highCount}`} />}
                    {mediumCount > 0 && <div style={{ width: `${(mediumCount / totalFindingsCount) * 100}%` }} className="bg-warning" title={`Medium: ${mediumCount}`} />}
                    {lowCount > 0 && <div style={{ width: `${(lowCount / totalFindingsCount) * 100}%` }} className="bg-neonPurple" title={`Low: ${lowCount}`} />}
                  </div>

                  {/* Proportional Rows */}
                  <div className="space-y-2.5 text-xs font-sans">
                    
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-textSecondary font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-danger shrink-0" />
                        Critical Severity
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-textSecondary font-mono text-[11px]">{critPct}%</span>
                        <Badge variant="critical" className="font-mono text-xs">{formatCount(criticalCount)}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-textSecondary font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-pinkAccent shrink-0" />
                        High Severity
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-textSecondary font-mono text-[11px]">{highPct}%</span>
                        <Badge variant="high" className="font-mono text-xs">{formatCount(highCount)}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-textSecondary font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-warning shrink-0" />
                        Medium Severity
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-textSecondary font-mono text-[11px]">{medPct}%</span>
                        <Badge variant="medium" className="font-mono text-xs">{formatCount(mediumCount)}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-textSecondary font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-neonPurple shrink-0" />
                        Low Severity
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-textSecondary font-mono text-[11px]">{lowPct}%</span>
                        <Badge variant="low" className="font-mono text-xs">{formatCount(lowCount)}</Badge>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-[#090014] text-center space-y-2 border border-[#2A1240]">
                  <CheckCircle2 size={28} className="mx-auto text-success" />
                  <p className="text-xs font-semibold text-white">Clean Severity Profile</p>
                  <p className="text-[11px] text-textSecondary">Zero vulnerabilities recorded across all severity tiers.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Scanners Card */}
          <Card className="border-border/80 bg-card/60">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck size={16} className="text-neonPurple" />
                  <span>Security Scanners</span>
                </h2>
                <span className="text-xs text-textSecondary font-sans">Pipeline execution status</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* 1. Code Scanner */}
                <div className={`p-3.5 rounded-xl border transition-all ${detail.code_scanning ? 'bg-success/5 border-success/30' : 'bg-[#090014] border-border/50 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${detail.code_scanning ? 'bg-success/20 text-success' : 'bg-card text-textSecondary'}`}>
                        <Code2 size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">Code Scanning</h3>
                        <p className="text-[10px] text-textSecondary">SAST & AST Security</p>
                      </div>
                    </div>
                    {detail.code_scanning ? (
                      <Badge variant="success" className="text-[10px] px-2 py-0.5">Executed</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">Skipped</Badge>
                    )}
                  </div>
                </div>

                {/* 2. Dependency Scanning */}
                <div className={`p-3.5 rounded-xl border transition-all ${detail.dependency_scanning ? 'bg-success/5 border-success/30' : 'bg-[#090014] border-border/50 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${detail.dependency_scanning ? 'bg-success/20 text-success' : 'bg-card text-textSecondary'}`}>
                        <PackageCheck size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">Dependency Scanning</h3>
                        <p className="text-[10px] text-textSecondary">SCA & CVE Matching</p>
                      </div>
                    </div>
                    {detail.dependency_scanning ? (
                      <Badge variant="success" className="text-[10px] px-2 py-0.5">Executed</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">Skipped</Badge>
                    )}
                  </div>
                </div>

                {/* 3. Secret Detection */}
                <div className={`p-3.5 rounded-xl border transition-all ${detail.secret_detection ? 'bg-success/5 border-success/30' : 'bg-[#090014] border-border/50 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${detail.secret_detection ? 'bg-success/20 text-success' : 'bg-card text-textSecondary'}`}>
                        <KeyRound size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">Secret Detection</h3>
                        <p className="text-[10px] text-textSecondary">Keys & Token Leakage</p>
                      </div>
                    </div>
                    {detail.secret_detection ? (
                      <Badge variant="success" className="text-[10px] px-2 py-0.5">Executed</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">Skipped</Badge>
                    )}
                  </div>
                </div>

                {/* 4. Container Scanning */}
                <div className={`p-3.5 rounded-xl border transition-all ${detail.container_scanning ? 'bg-success/5 border-success/30' : 'bg-[#090014] border-border/50 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${detail.container_scanning ? 'bg-success/20 text-success' : 'bg-card text-textSecondary'}`}>
                        <Boxes size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">Container Scanning</h3>
                        <p className="text-[10px] text-textSecondary">Docker & Image Vulns</p>
                      </div>
                    </div>
                    {detail.container_scanning ? (
                      <Badge variant="success" className="text-[10px] px-2 py-0.5">Executed</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">Skipped</Badge>
                    )}
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>

        </div>

        {/* 5. SCAN INFORMATION METADATA */}
        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock size={16} className="text-neonPurple" />
                <span>Scan Information</span>
              </h2>
              <span className="text-xs text-textSecondary font-mono">{detail.scan_id}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans">
              
              <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                <span className="text-[10px] text-textSecondary uppercase font-semibold block">Repository</span>
                <span className="font-bold text-white block truncate" title={detail.repository || detail.target_path || 'Local Workspace'}>
                  {detail.repository || detail.target_path || 'Local Workspace'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                <span className="text-[10px] text-textSecondary uppercase font-semibold block">Target Path</span>
                <span className="font-mono text-neonPurple font-bold block truncate" title={detail.target_path}>
                  {detail.target_path || '.'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                <span className="text-[10px] text-textSecondary uppercase font-semibold block">Event Trigger</span>
                <span className="font-bold text-white uppercase block">
                  {detail.event_type || 'manual'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                <span className="text-[10px] text-textSecondary uppercase font-semibold block">Branch / Ref</span>
                <span className="font-mono text-white block truncate">
                  {detail.ref || 'default'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                <span className="text-[10px] text-textSecondary uppercase font-semibold block">Commit SHA</span>
                <span className="font-mono text-pinkAccent block font-bold">
                  {detail.commit_sha ? detail.commit_sha.slice(0, 12) : 'Not specified'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                <span className="text-[10px] text-textSecondary uppercase font-semibold block">Started At</span>
                <span className="text-white block font-medium">
                  {formatDate(detail.started_at)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                <span className="text-[10px] text-textSecondary uppercase font-semibold block">Completed At</span>
                <span className="text-white block font-medium">
                  {formatDate(detail.completed_at)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                <span className="text-[10px] text-textSecondary uppercase font-semibold block">Total Duration</span>
                <span className="font-mono text-success font-bold block">
                  {duration(detail)}
                </span>
              </div>

            </div>

            {/* Security Gate Reason Notice if present */}
            {detail.security_gate_reason && (
              <div className="p-3 rounded-xl bg-card border border-border/80 text-xs flex items-center justify-between gap-3">
                <span className="text-textSecondary font-medium">Security Gate Evaluation:</span>
                <span className="text-white font-medium text-right">{detail.security_gate_reason}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6. SECURITY FINDINGS SECTION */}
        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-5 space-y-4">
            
            {/* Header and Filter Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert size={18} className="text-neonPurple" />
                  <span>Security Findings</span>
                  <Badge variant="default" className="text-xs font-mono ml-1">
                    {filteredFindings.length} / {totalFindingsCount}
                  </Badge>
                </h2>
                <p className="text-xs text-textSecondary mt-0.5">
                  Detailed vulnerability findings detected during this scan execution.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" size={14} />
                  <Input 
                    type="text"
                    placeholder="Search findings..."
                    value={findingSearch}
                    onChange={(e) => setFindingSearch(e.target.value)}
                    className="pl-8 text-xs bg-background h-8 border-border rounded-lg w-full"
                  />
                </div>

                {/* Severity */}
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-background border border-border text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-neonPurple focus:outline-none cursor-pointer"
                >
                  <option value="all">Severity: All</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                {/* Tool */}
                {uniqueTools.length > 1 && (
                  <select
                    value={toolFilter}
                    onChange={(e) => setToolFilter(e.target.value)}
                    className="bg-background border border-border text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-neonPurple focus:outline-none cursor-pointer"
                  >
                    <option value="all">Scanner: All</option>
                    {uniqueTools.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}

                {/* Lifecycle */}
                <select
                  value={lifecycleFilter}
                  onChange={(e) => setLifecycleFilter(e.target.value)}
                  className="bg-background border border-border text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-neonPurple focus:outline-none cursor-pointer"
                >
                  <option value="all">Lifecycle: All</option>
                  <option value="new">New</option>
                  <option value="open">Open</option>
                  <option value="fixed">Fixed</option>
                  <option value="reopened">Reopened</option>
                </select>
              </div>
            </div>

            {/* Findings Table or Empty States */}
            {totalFindingsCount === 0 ? (
              <div className="p-10 rounded-2xl bg-[#090014] border border-[#2A1240] text-center space-y-3">
                <CheckCircle2 size={44} className="mx-auto text-success" />
                <h3 className="text-base font-bold text-white">No security findings detected</h3>
                <p className="text-xs text-textSecondary max-w-md mx-auto leading-relaxed">
                  All active security scanners completed successfully without detecting any known vulnerabilities, hardcoded secrets, or dependency flaws in this scan.
                </p>
              </div>
            ) : filteredFindings.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#090014] border border-[#2A1240] text-center space-y-2">
                <AlertTriangle size={28} className="mx-auto text-warning" />
                <p className="text-sm font-semibold text-white">No findings match the selected filters.</p>
                <p className="text-xs text-textSecondary">Try adjusting your search query or severity/tool filters.</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => { setFindingSearch(''); setSeverityFilter('all'); setToolFilter('all'); setLifecycleFilter('all'); }}
                  className="mt-2 text-xs cursor-pointer"
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#090014] text-textSecondary uppercase font-semibold border-b border-border/80">
                    <tr>
                      <th className="px-4 py-3">Severity</th>
                      <th className="px-4 py-3">Vulnerability ID</th>
                      <th className="px-4 py-3">Title & Target</th>
                      <th className="px-4 py-3">Scanner</th>
                      <th className="px-4 py-3">Lifecycle</th>
                      <th className="px-4 py-3 text-right">Risk Score</th>
                      <th className="px-4 py-3 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-sans">
                    {filteredFindings.map((finding) => {
                      const idKey = finding.id || finding.vulnerability_id || Math.random();
                      const isExpanded = !!expandedFindings[idKey];

                      return (
                        <tr key={idKey} className="group hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3.5 align-top whitespace-nowrap">
                            <Badge variant={statusVariant(finding.severity)} className="font-bold uppercase text-[10px]">
                              {finding.severity}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5 align-top font-mono font-bold text-neonPurple whitespace-nowrap">
                            {finding.vulnerability_id || 'N/A'}
                          </td>

                          <td className="px-4 py-3.5 align-top max-w-md">
                            <p className="font-medium text-white">{finding.title}</p>
                            {(finding.target || (finding.affected_packages && finding.affected_packages.length > 0)) && (
                              <p className="text-[11px] text-textSecondary font-mono mt-0.5 truncate">
                                {finding.target || finding.affected_packages?.join(', ')}
                              </p>
                            )}

                            {/* Accordion / Expanded Details */}
                            {isExpanded && (
                              <div className="mt-3 p-3.5 rounded-xl bg-[#090014] border border-[#2A1240] space-y-2 text-xs">
                                {finding.description && (
                                  <div>
                                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Description</span>
                                    <p className="text-white leading-relaxed mt-0.5">{finding.description}</p>
                                  </div>
                                )}
                                
                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#2A1240]">
                                  <div>
                                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Fixed Version</span>
                                    <span className="font-mono text-success font-bold block mt-0.5">
                                      {finding.fixed_version || 'No fix version listed'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Priority Tier</span>
                                    <span className="text-pinkAccent font-bold block mt-0.5">
                                      {finding.priority || 'Standard'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px] text-textSecondary border-border">
                              {finding.tool || 'Code Scanner'}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5 align-top whitespace-nowrap">
                            <Badge variant={finding.lifecycle_status === 'fixed' ? 'success' : finding.lifecycle_status === 'reopened' ? 'high' : finding.lifecycle_status === 'new' ? 'info' : 'outline'} className="text-[10px] uppercase font-semibold">
                              {(finding.lifecycle_status || 'open').toUpperCase()}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5 align-top text-right whitespace-nowrap font-mono font-bold text-warning">
                            {formatScore(finding.risk_score)}/100
                          </td>

                          <td className="px-4 py-3.5 align-top text-center whitespace-nowrap">
                            <button
                              onClick={() => toggleExpand(idKey)}
                              className="p-1 rounded text-textSecondary hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                              title={isExpanded ? 'Collapse details' : 'Expand details'}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </CardContent>
        </Card>

        {/* 8. FOOTER ACTIONS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <Button 
            variant="outline" 
            onClick={() => navigate('/scan-history')} 
            className="w-full sm:w-auto text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Scan History
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => navigate('/findings')} 
              className="flex-1 sm:flex-initial text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink size={14} /> View All Findings
            </Button>

            <Button 
              variant="gradient" 
              onClick={() => navigate('/repository-scan')} 
              className="flex-1 sm:flex-initial text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Play size={14} /> Run New Scan
            </Button>
          </div>
        </div>

      </div>
    );
  }

  // ==========================================
  // VIEW: SCAN HISTORY LIST
  // ==========================================
  const hasPrevious = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold flex items-center gap-3">
          <History className="text-neonPurple" size={28} /> 
          <span>Scan History</span>
        </h1>
        <p className="text-sm text-textSecondary mt-1">
          Review completed and in-progress DevSecOps security scans.
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <label className="text-xs text-textSecondary font-semibold">
            Repository
            <input 
              value={repository} 
              onChange={(e) => { setRepository(e.target.value); setOffset(0); }} 
              placeholder="owner/repository" 
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-neonPurple" 
            />
          </label>

          <label className="text-xs text-textSecondary font-semibold">
            Status
            <select 
              value={status} 
              onChange={(e) => { setStatus(e.target.value); setOffset(0); }} 
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-neonPurple focus:outline-none cursor-pointer"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="running">Running</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
            </select>
          </label>

          <label className="text-xs text-textSecondary font-semibold">
            Event type
            <select 
              value={eventType} 
              onChange={(e) => { setEventType(e.target.value); setOffset(0); }} 
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-neonPurple focus:outline-none cursor-pointer"
            >
              <option value="">All events</option>
              <option value="manual">Manual</option>
              <option value="push">Push</option>
              <option value="pull_request">Pull request</option>
            </select>
          </label>

          <div className="flex items-end text-xs text-textSecondary font-semibold pb-2">
            <Clock size={15} className="mr-2 text-neonPurple" />
            <span>{formatCount(total)} total scans</span>
          </div>
        </CardContent>
      </Card>

      {/* Scans Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-textSecondary">
          <div className="w-8 h-8 border-2 border-neonPurple/30 border-t-neonPurple rounded-full animate-spin mx-auto mb-3" />
          <p className="animate-pulse">Loading scan history...</p>
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-textSecondary">
            No scans match the selected filters.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-textSecondary bg-[#090014] border-b border-border/80 font-semibold">
                <tr>
                  <th className="p-4">Scan</th>
                  <th className="p-4">Repository</th>
                  <th className="p-4">Event</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Findings</th>
                  <th className="p-4">Risk</th>
                  <th className="p-4">Started</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-sans">
                {items.map((scan) => (
                  <tr key={scan.scan_id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-mono text-xs font-bold text-neonPurple">
                      {scan.scan_id.slice(0, 8)}
                    </td>
                    <td className="p-4 font-medium text-white">
                      {scan.repository || scan.target_path}
                    </td>
                    <td className="p-4 uppercase text-xs font-medium text-textSecondary">
                      {scan.event_type}
                    </td>
                    <td className="p-4">
                      <Badge variant={statusVariant(scan.status)} className="text-[10px] font-bold uppercase">
                        {scan.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1.5">
                        <strong className="text-white text-xs block">{formatCount(scan.total_findings)} Total</strong>
                        <SeverityCounts scan={scan} />
                      </div>
                    </td>
                    <td className="p-4 font-mono font-black text-warning">
                      {formatScore(scan.risk_score)}
                    </td>
                    <td className="p-4 whitespace-nowrap text-textSecondary text-xs">
                      <Clock size={13} className="inline mr-1" />
                      {formatDate(scan.started_at)}
                    </td>
                    <td className="p-4 text-right">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => navigate(`/scan-history/${scan.scan_id}`)}
                        className="text-xs font-semibold hover:border-neonPurple/50 cursor-pointer"
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-textSecondary">
          Showing {total === 0 ? 0 : formatCount(offset + 1)}-{formatCount(Math.min(offset + PAGE_SIZE, total))} of {formatCount(total)}
        </span>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            disabled={!hasPrevious} 
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="text-xs cursor-pointer"
          >
            <ChevronLeft size={15} /> Previous
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            disabled={!hasNext} 
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="text-xs cursor-pointer"
          >
            Next <ChevronRight size={15} />
          </Button>
        </div>
      </div>

    </div>
  );
}
