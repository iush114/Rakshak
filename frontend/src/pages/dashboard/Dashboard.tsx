import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldAlert, 
  Flame, 
  KeyRound, 
  TrendingUp, 
  ArrowUpRight, 
  Sparkles,
  Zap,
  CheckCircle2,
  FileText,
  ShieldCheck,
  AlertTriangle,
  GitBranch,
  ChevronRight,
  Cpu
} from 'lucide-react';
import { GithubIcon } from '@/components/ui/GithubIcon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from '@/context/SecurityContext';
import { 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';

// Trend telemetry across past 14 days
const trendData = [
  { name: 'Day 1', findings: 110, critical: 16, resolved: 8 },
  { name: 'Day 3', findings: 125, critical: 18, resolved: 14 },
  { name: 'Day 5', findings: 118, critical: 15, resolved: 22 },
  { name: 'Day 7', findings: 142, critical: 20, resolved: 35 },
  { name: 'Day 9', findings: 130, critical: 14, resolved: 48 },
  { name: 'Day 11', findings: 95, critical: 8, resolved: 65 },
  { name: 'Day 14', findings: 77, critical: 4, resolved: 78 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    findings, 
    summary,
    isLoading,
    backendOnline,
    backendError,
    refreshData,
    secrets, 
    repositories, 
    selectedRepo, 
    selectRepository,
    overallRiskScore
  } = useSecurity();

  const [activeTimeframe, setActiveTimeframe] = useState<'14d' | '30d' | '90d'>('14d');

  // Use real backend summary if available, otherwise compute from loaded findings
  const totalFindingsCount = summary?.total_findings ?? findings.length;
  const criticalCount = summary?.critical ?? findings.filter(f => f.severity === 'critical').length;
  const highCount = summary?.high ?? findings.filter(f => f.severity === 'high').length;
  const mediumCount = summary?.medium ?? findings.filter(f => f.severity === 'medium').length;
  const lowCount = summary?.low ?? findings.filter(f => f.severity === 'low').length;
  const prioritizedCount = criticalCount + highCount;
  const currentRiskScore = summary?.overall_risk_score ?? overallRiskScore;
  const healthScore = Math.max(10, Math.min(100, 100 - currentRiskScore));

  // Severity Distribution for Donut Chart
  const severityData = [
    { name: 'Critical', value: criticalCount, color: '#EF4444' },
    { name: 'High', value: highCount, color: '#EC4899' },
    { name: 'Medium', value: mediumCount, color: '#F59E0B' },
    { name: 'Low', value: lowCount, color: '#A855F7' },
  ];

  return (
    <div className="space-y-8 pb-16 font-sans">
      
      {/* Backend Offline / Error Notice */}
      {!backendOnline && backendError && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-400 shrink-0" size={18} />
            <span>
              <strong>FastAPI Backend Notice:</strong> {backendError}. Ensure backend is running at <code className="bg-black/40 px-1.5 py-0.5 rounded font-mono text-amber-300">http://127.0.0.1:8000</code>.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refreshData()}
            className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs shrink-0"
          >
            <span>Retry Connection</span>
          </Button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. TOP BANNER / WELCOME & REPO CONTEXT */}
      {/* ========================================================= */}
      <div className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#12051F]/90 via-[#19072c]/90 to-[#270c44]/90 border border-[#A855F7]/30 shadow-[0_0_35px_rgba(168,85,247,0.15)] flex flex-col lg:flex-row lg:items-center justify-between gap-6 overflow-hidden">
        
        <div className="absolute top-0 right-0 w-80 h-80 bg-neonPurple/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-2 z-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Security Command Center</span>
            </h1>
            {backendOnline ? (
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                FastAPI Connected (127.0.0.1:8000)
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />
                Local Mode
              </Badge>
            )}
            <Badge className="bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30 text-xs px-2.5 py-0.5">
              Cloudflare AI Active
            </Badge>
            {isLoading && (
              <Badge className="bg-neonPurple/20 text-neonPurple border-neonPurple/40 text-xs px-2.5 py-0.5 animate-pulse">
                Syncing Telemetry...
              </Badge>
            )}
          </div>
          
          <p className="text-xs sm:text-sm text-[#C4B5FD]/80 max-w-2xl leading-relaxed">
            Real-time DevSecOps posture, autonomous threat prioritization, and AI remediation intelligence for your software supply chain.
          </p>

          {/* Repository Selector Dropdown / Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <GithubIcon size={14} className="text-zinc-400" />
              <span>Target:</span>
            </span>

            {repositories.slice(0, 3).map((repo) => (
              <button
                key={repo.id}
                onClick={() => selectRepository(repo.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border cursor-pointer ${
                  selectedRepo?.id === repo.id
                    ? 'bg-[#A855F7] text-white border-[#A855F7] shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                    : 'bg-[#090014]/70 text-[#C4B5FD]/70 border-[#2A1240] hover:text-white hover:border-[#A855F7]/40'
                }`}
              >
                <GitBranch size={12} />
                <span>{repo.name}</span>
                <span className="text-[10px] opacity-70">({repo.branch})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 z-10">
          <Button 
            onClick={() => navigate('/repository-scan')}
            className="bg-rakshak-gradient text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.35)] hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
          >
            <GithubIcon size={16} />
            <span>Launch Repo Scan</span>
          </Button>

          <Button 
            variant="outline"
            onClick={() => navigate('/reports')}
            className="bg-[#090014]/80 border-[#2A1240] hover:border-[#A855F7]/60 text-[#C4B5FD] hover:text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileText size={15} />
            <span>Reports</span>
          </Button>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 2. TELEMETRY KPI METRICS ROW (5 CARDS) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            title: 'Security Health Score',
            value: `${healthScore}/100`,
            subtitle: healthScore >= 80 ? 'GRADE A (EXCELLENT)' : healthScore >= 60 ? 'GRADE B (STABLE)' : 'GRADE C (ATTENTION NEEDED)',
            change: '+6% this week',
            isUp: true,
            icon: ShieldCheck,
            color: 'text-emerald-400',
            bgGlow: 'hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]',
            barPercent: healthScore,
            barColor: 'bg-emerald-400'
          },
          {
            title: 'Total Findings',
            value: totalFindingsCount.toString(),
            subtitle: `${prioritizedCount} Prioritized`,
            change: '-14 resolved',
            isUp: false,
            icon: ShieldAlert,
            color: 'text-[#A855F7]',
            bgGlow: 'hover:border-[#A855F7]/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]',
            barPercent: 77,
            barColor: 'bg-[#A855F7]'
          },
          {
            title: 'Critical CVEs',
            value: criticalCount.toString(),
            subtitle: 'Immediate Action Required',
            change: '-2 patched',
            isUp: false,
            icon: Flame,
            color: 'text-red-400',
            bgGlow: 'hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]',
            barPercent: 40,
            barColor: 'bg-red-500'
          },
          {
            title: 'Exposed Secrets',
            value: secrets.length.toString(),
            subtitle: 'Gitleaks AST Flagged',
            change: 'Active Alerts',
            isUp: true,
            icon: KeyRound,
            color: 'text-amber-400',
            bgGlow: 'hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]',
            barPercent: 60,
            barColor: 'bg-amber-400'
          },
          {
            title: 'AI Remediations',
            value: `${findings.length}/${findings.length}`,
            subtitle: 'Rakshak AI Analysis',
            change: '96% Confidence',
            isUp: true,
            icon: Sparkles,
            color: 'text-[#EC4899]',
            bgGlow: 'hover:border-[#EC4899]/50 hover:shadow-[0_0_20px_rgba(236,72,153,0.2)]',
            barPercent: 100,
            barColor: 'bg-rakshak-gradient'
          }
        ].map((kpi, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.06 }}
          >
            <Card className={`bg-[#12051F]/80 border-[#2A1240] ${kpi.bgGlow} transition-all duration-300 relative overflow-hidden`}>
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#C4B5FD]/70 uppercase tracking-wider">{kpi.title}</span>
                  <div className={`p-2 rounded-xl bg-[#090014] border border-[#2A1240] ${kpi.color}`}>
                    <kpi.icon size={16} />
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-white">{kpi.value}</span>
                    <span className={`text-[10px] font-bold ${kpi.isUp ? 'text-emerald-400' : 'text-purple-300'}`}>
                      {kpi.change}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{kpi.subtitle}</p>
                </div>

                <div className="w-full bg-[#090014] h-1.5 rounded-full mt-3 overflow-hidden border border-[#2A1240]/50">
                  <div 
                    className={`h-full ${kpi.barColor} rounded-full transition-all duration-500`} 
                    style={{ width: `${kpi.barPercent}%` }} 
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ========================================================= */}
      {/* 3. INTERACTIVE CHARTS SECTION */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 1. Vulnerability Trend & Ingestion Velocity */}
        <Card className="lg:col-span-8 bg-[#12051F]/80 border-[#2A1240] shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[#2A1240]/50">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-[#A855F7]" />
                <span>Vulnerability Remediation & Threat Trend</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#C4B5FD]/70 mt-0.5">
                Open vs Resolved security vulnerabilities over the selected timeframe
              </CardDescription>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-[#090014] rounded-xl border border-[#2A1240]">
              {(['14d', '30d', '90d'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setActiveTimeframe(period)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    activeTimeframe === period
                      ? 'bg-[#A855F7] text-white shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {period.toUpperCase()}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="findingsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#C4B5FD" opacity={0.4} fontSize={11} tickLine={false} />
                  <YAxis stroke="#C4B5FD" opacity={0.4} fontSize={11} tickLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#12051F', borderColor: '#2A1240', borderRadius: '12px', color: '#FFF', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="findings" stroke="#A855F7" strokeWidth={2.5} fillOpacity={1} fill="url(#findingsGrad)" name="Active Findings" />
                  <Area type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#resolvedGrad)" name="Resolved" />
                  <Line type="monotone" dataKey="critical" stroke="#EF4444" strokeWidth={2} strokeDasharray="3 3" name="Criticals" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#2A1240]/50 text-xs text-zinc-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" /> Active Findings</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Resolved Fixes</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Critical Alert Level</span>
              </div>
              <span className="text-[11px] font-mono text-[#C4B5FD]/70">Mean Resolution Velocity: 1.8 days</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Severity Distribution Donut Chart */}
        <Card className="lg:col-span-4 bg-[#12051F]/80 border-[#2A1240] shadow-xl flex flex-col justify-between">
          <CardHeader className="pb-2 border-b border-[#2A1240]/50">
            <CardTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Flame size={18} className="text-[#EC4899]" />
              <span>Severity Breakdown</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#C4B5FD]/70">
              CVSS v3 normalized distribution
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 flex-1 flex flex-col justify-center items-center">
            <div className="h-52 w-full flex justify-center items-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#12051F', borderColor: '#2A1240', borderRadius: '12px', color: '#FFF', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-white">{totalFindingsCount}</span>
                <span className="text-[10px] text-[#C4B5FD]/70 uppercase font-bold tracking-widest">Total Threats</span>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="grid grid-cols-2 gap-2.5 w-full mt-4 pt-3 border-t border-[#2A1240]/50">
              {severityData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-[#090014]/60 border border-[#2A1240] text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-300 font-medium">{item.name}</span>
                  </div>
                  <span className="font-mono font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ========================================================= */}
      {/* 4. LIVE HIGH-RISK THREAT STREAM & AI INSIGHTS */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 3. Top Critical Threats Table */}
        <Card className="lg:col-span-8 bg-[#12051F]/80 border-[#2A1240] shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-[#2A1240]/50">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" />
                <span>Priority Vulnerability Queue</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#C4B5FD]/70">
                Top threats requiring immediate patching or configuration override
              </CardDescription>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/findings')}
              className="text-xs text-[#A855F7] hover:text-[#EC4899] flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({findings.length})</span>
              <ArrowUpRight size={14} />
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090014]/80 text-[#C4B5FD]/70 uppercase font-semibold text-[11px] border-b border-[#2A1240]">
                  <tr>
                    <th className="px-4 py-3">CVE / Identifier</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Component / File</th>
                    <th className="px-4 py-3">Risk Score</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A1240]/50">
                  {findings.slice(0, 5).map((finding, idx) => (
                    <tr 
                      key={finding.id || idx}
                      onClick={() => navigate('/findings')}
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-[#A855F7] group-hover:text-[#EC4899] transition-colors">
                        {finding.cve}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={finding.severity}>
                          {finding.severity.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-zinc-300">
                        {finding.package}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-extrabold text-white">{finding.riskScore}/100</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); navigate('/findings'); }}
                          className="h-7 px-2.5 text-[11px] bg-[#090014] border-[#2A1240] hover:border-[#A855F7] text-[#C4B5FD] hover:text-white rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles size={12} className="text-[#EC4899]" />
                          <span>AI Fix</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 4. AI Security Executive Summary Card */}
        <Card className="lg:col-span-4 bg-gradient-to-br from-[#12051F] via-[#1a082e] to-[#250b42] border-[#A855F7]/40 shadow-[0_0_30px_rgba(168,85,247,0.2)] flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-[#EC4899]/15 rounded-full blur-2xl pointer-events-none" />

          <CardHeader className="pb-2 border-b border-[#2A1240]/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="text-[#EC4899] animate-pulse" size={18} />
                <span>AI Security Briefing</span>
              </CardTitle>
              <Badge className="bg-[#A855F7]/20 text-[#A855F7] border-[#A855F7]/40 text-[10px]">Rakshak AI</Badge>
            </div>
            <CardDescription className="text-xs text-[#C4B5FD]/70">
              Autonomous threat reduction synthesis
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            <div className="p-4 rounded-2xl bg-[#090014]/80 border border-[#2A1240] text-xs leading-relaxed text-zinc-300 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <Zap size={15} />
                <span>{criticalCount} Critical & {highCount} High CVEs Identified</span>
              </div>
              <p className="text-zinc-400">
                Automated SCA parsing flagged symlink traversal privilege escalation in <code className="text-pink-300 font-mono">libattr1</code> and remote authentication bypass vectors.
              </p>
              <div className="pt-2 border-t border-[#2A1240] flex items-center justify-between text-[11px] text-emerald-400">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  <span>Fix recipes generated for 100% of CVEs</span>
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Button 
                onClick={() => navigate('/ai-analysis-history')}
                className="w-full text-xs font-bold h-10 bg-rakshak-gradient text-white rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Cpu size={14} />
                <span>View Full AI Threat History</span>
                <ChevronRight size={14} />
              </Button>

              <Button 
                variant="outline"
                onClick={() => navigate('/findings')}
                className="w-full text-xs font-semibold h-9 bg-[#090014] border-[#2A1240] hover:border-[#A855F7] text-[#C4B5FD] hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <span>Inspect Vulnerability Matrix</span>
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ========================================================= */}
      {/* 5. CONNECTED REPOSITORIES & CI/CD HEALTH */}
      {/* ========================================================= */}
      <Card className="bg-[#12051F]/80 border-[#2A1240] shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-[#2A1240]/50">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <GithubIcon size={18} className="text-white" />
              <span>Monitored Repositories & CI/CD Pipelines</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#C4B5FD]/70">
              Active GitHub repositories under automated DevSecOps surveillance
            </CardDescription>
          </div>

          <Button
            size="sm"
            onClick={() => navigate('/repository-scan')}
            className="bg-[#A855F7]/20 text-[#A855F7] hover:bg-[#A855F7]/30 border border-[#A855F7]/40 text-xs font-bold rounded-xl cursor-pointer"
          >
            <span>+ Connect Repository</span>
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {repositories.map((repo) => (
              <div 
                key={repo.id}
                onClick={() => { selectRepository(repo.id); navigate('/repository-scan'); }}
                className="p-4 rounded-2xl bg-[#090014]/80 border border-[#2A1240] hover:border-[#A855F7]/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-[#EC4899] transition-colors flex items-center gap-1.5">
                      <GithubIcon size={14} className="text-zinc-400" />
                      <span>{repo.name}</span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5 font-mono">
                      <GitBranch size={11} className="text-[#A855F7]" />
                      <span>{repo.branch}</span>
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                    Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#2A1240] text-[#C4B5FD]/70">
                  <span>{repo.language} ({repo.filesCount} files)</span>
                  <span className="font-mono text-emerald-400 font-bold">{repo.dependenciesCount} deps</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
