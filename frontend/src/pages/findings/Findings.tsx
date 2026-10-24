import { formatScore, formatCount, formatPercentage } from '@/utils/formatters';
import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Download,
  SlidersHorizontal,
  ArrowUpDown,
  Eye,
  X,
  ShieldAlert,
  Sparkles,
  FileCode,
  Loader2,
  AlertCircle,
  Activity
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useSecurity } from '@/context/SecurityContext';
import { type Finding } from '@/data/findings';
import { analyzeFindingWithAI } from '@/services/api';

export default function Findings() {
  const { findings, resolveFinding, addAIAnalysis, isLoading, backendOnline, currentUser } = useSecurity();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [toolFilter, setToolFilter] = useState<string>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<string>('all');
  const [sortByRisk, setSortByRisk] = useState<boolean>(true);

  // Modal / Drawer Selection
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{
    explanation: string;
    potentialImpact: string;
    recommendedAction: string;
    riskSummary: string;
  } | null>(null);

  // Body Scroll Locking & Escape Key listener for Drawer
  useEffect(() => {
    if (selectedFinding) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setSelectedFinding(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [selectedFinding]);

  // Compute Metrics
  const totalCount = findings.length;
  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;
  const mediumCount = findings.filter(f => f.severity === 'medium').length;
  const lowCount = findings.filter(f => f.severity === 'low').length;
  const avgRisk = totalCount > 0 
    ? Math.round(findings.reduce((acc, f) => acc + (f.riskScore || 0), 0) / totalCount)
    : 0;

  // Filter & Sort Findings
  const filteredFindings = useMemo(() => {
    return findings
      .filter((item) => {
        const query = searchTerm.toLowerCase();
        const matchesSearch =
          item.cve.toLowerCase().includes(query) ||
          item.title.toLowerCase().includes(query) ||
          item.package.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query);

        const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter;
        const matchesPriority = priorityFilter === 'all' || (item.priority && item.priority.toLowerCase() === priorityFilter.toLowerCase());
        const matchesTool = toolFilter === 'all' || item.tool === toolFilter;
        const matchesLifecycle = lifecycleFilter === 'all' || item.lifecycleStatus === lifecycleFilter;

        return matchesSearch && matchesSeverity && matchesPriority && matchesTool && matchesLifecycle;
      })
      .sort((a, b) => (sortByRisk ? b.riskScore - a.riskScore : a.riskScore - b.riskScore));
  }, [findings, searchTerm, severityFilter, priorityFilter, toolFilter, lifecycleFilter, sortByRisk]);

  const clearFilters = () => {
    setSearchTerm('');
    setSeverityFilter('all');
    setPriorityFilter('all');
    setToolFilter('all');
    setLifecycleFilter('all');
  };

  const openFinding = (finding: Finding) => {
    setSelectedFinding(finding);
    setAiResult(null);
    setAiError(null);
  };

  const exportCSV = () => {
    const headers = ['CVE ID,Title,Severity,Priority,Risk Score,Tool,Package,Fixed Version,Status\n'];
    const rows = filteredFindings.map(f =>
      `"${f.cve}","${f.title.replace(/"/g, '""')}","${f.severity}","${f.priority}",${f.riskScore},"${f.tool}","${f.package}","${f.fixedVersion}","${f.status}"\n`
    );
    const blob = new Blob([...headers, ...rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rakshak_Findings_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // AI Analysis Trigger - Real Backend FastAPI endpoint
  const handleAnalyzeWithAI = async () => {
    if (!selectedFinding) return;
    if (!selectedFinding.vulnerabilityId) {
      setAiError('AI analysis is unavailable because this finding has no vulnerability ID.');
      return;
    }
    setIsAiAnalyzing(true);
    setAiError(null);
    setAiResult(null);

    try {
      const result = await analyzeFindingWithAI(selectedFinding.vulnerabilityId);

      setAiResult({
        explanation: result.explanation,
        potentialImpact: result.potentialImpact,
        recommendedAction: result.recommendedAction,
        riskSummary: result.riskSummary,
      });

      // Save to AI Analysis History
      addAIAnalysis({
        cve: selectedFinding.cve,
        title: selectedFinding.title,
        riskScore: selectedFinding.riskScore,
        aiModel: 'Cloudflare AI (Llama 3.1 8B)',
        explanation: result.explanation,
        potentialImpact: result.potentialImpact,
        recommendedAction: result.recommendedAction,
        riskSummary: result.riskSummary,
      });
    } catch (err: any) {
      console.error('[Rakshak] AI Analysis error:', err);
      setAiError(err.message || 'Failed to complete AI analysis from FastAPI backend.');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">

      {/* 1. STANDARDIZED PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <ShieldAlert className="text-neonPurple" size={28} />
              <span>Security Findings</span>
            </h1>
            <Badge variant="default" className="text-xs bg-rakshak-gradient text-white">
              {formatCount(filteredFindings.length)} Items
            </Badge>
            {backendOnline && (
              currentUser ? (
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs px-2.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                  FastAPI Connected
                </Badge>
              ) : (
                <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-xs px-2.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5 animate-pulse" />
                  FastAPI Online
                </Badge>
              )
            )}
            {isLoading && (
              <Badge className="bg-neonPurple/20 text-neonPurple border-neonPurple/40 text-xs px-2.5 py-0.5 animate-pulse">
                Syncing Findings...
              </Badge>
            )}
          </div>
          <p className="text-sm text-textSecondary mt-1">
            Prioritized DevSecOps security threats across code, dependencies, secrets, and containers.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={exportCSV}
          className="flex items-center gap-2 text-xs shrink-0 cursor-pointer"
        >
          <Download size={14} />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* 2. EXECUTIVE SUMMARY METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary">Total Findings</span>
              <ShieldAlert size={14} className="text-neonPurple" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-white block">{formatCount(totalCount)}</span>
            <p className="text-[10px] text-textSecondary font-medium">All active detections</p>
          </CardContent>
        </Card>

        <Card className="border-danger/40 bg-danger/5">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-danger">Critical</span>
              <span className="w-2 h-2 rounded-full bg-danger" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-danger block">{formatCount(criticalCount)}</span>
            <p className="text-[10px] text-danger/80 font-medium">Immediate remediation</p>
          </CardContent>
        </Card>

        <Card className="border-pinkAccent/40 bg-pinkAccent/5">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-pinkAccent">High</span>
              <span className="w-2 h-2 rounded-full bg-pinkAccent" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-pinkAccent block">{formatCount(highCount)}</span>
            <p className="text-[10px] text-pinkAccent/80 font-medium">Priority triage</p>
          </CardContent>
        </Card>

        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-warning">Medium</span>
              <span className="w-2 h-2 rounded-full bg-warning" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-warning block">{formatCount(mediumCount)}</span>
            <p className="text-[10px] text-warning/80 font-medium">Elevated risk profile</p>
          </CardContent>
        </Card>

        <Card className="border-neonPurple/40 bg-neonPurple/5">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neonPurple">Low</span>
              <span className="w-2 h-2 rounded-full bg-neonPurple" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-neonPurple block">{formatCount(lowCount)}</span>
            <p className="text-[10px] text-neonPurple/80 font-medium">Informational / Minor</p>
          </CardContent>
        </Card>

        <Card className="border-neonPurple/40 bg-gradient-to-br from-[#12051F] to-[#200836]">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neonPurple">Average Risk</span>
              <Activity size={14} className="text-warning" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-warning">{formatScore(avgRisk)}</span>
              <span className="text-xs text-textSecondary font-semibold">/100</span>
            </div>
            <p className="text-[10px] text-textSecondary font-medium">Aggregated severity index</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. SEARCH AND FILTERS BAR */}
      <Card className="p-4 bg-card/80 border-border space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary" size={16} />
            <Input
              type="text"
              placeholder="Search by CVE ID, Title, Package, Description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-xs bg-background h-10 border-border rounded-xl"
            />
          </div>

          {/* Filter Selects & Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-textSecondary font-semibold flex items-center gap-1">
              <SlidersHorizontal size={14} />
              Filters:
            </span>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-background border border-border text-white text-xs rounded-xl px-3 py-2 focus:border-neonPurple focus:outline-none cursor-pointer"
            >
              <option value="all">Severity: All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-background border border-border text-white text-xs rounded-xl px-3 py-2 focus:border-neonPurple focus:outline-none cursor-pointer"
            >
              <option value="all">Priority: All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Tool Filter */}
            <select
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              className="bg-background border border-border text-white text-xs rounded-xl px-3 py-2 focus:border-neonPurple focus:outline-none cursor-pointer"
            >
              <option value="all">Tool: All</option>
              <option value="Code Scanner">Code Scanner</option>
              <option value="Trivy SCA">Trivy SCA</option>
              <option value="Secret Detection">Secret Detection</option>
              <option value="Container Scan">Container Scan</option>
            </select>

            {/* Lifecycle Filter */}
            <select
              value={lifecycleFilter}
              onChange={(e) => setLifecycleFilter(e.target.value)}
              className="bg-background border border-border text-white text-xs rounded-xl px-3 py-2 focus:border-neonPurple focus:outline-none cursor-pointer"
            >
              <option value="all">Status: All</option>
              <option value="open">Open</option>
              <option value="new">New</option>
              <option value="fixed">Fixed</option>
              <option value="reopened">Reopened</option>
            </select>

            {/* Sort Toggle Button */}
            <button
              onClick={() => setSortByRisk(!sortByRisk)}
              className="px-3 py-2 rounded-xl bg-card border border-border text-xs text-textSecondary hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Toggle Risk Score sorting"
            >
              <ArrowUpDown size={14} />
              <span>{sortByRisk ? 'Highest Risk' : 'Lowest Risk'}</span>
            </button>

            {/* Clear Filters */}
            {(searchTerm || severityFilter !== 'all' || priorityFilter !== 'all' || toolFilter !== 'all' || lifecycleFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-neonPurple hover:text-white cursor-pointer"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 4. FINDINGS TABLE */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#090014] border-b border-border/80 text-textSecondary uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Severity</th>
                  <th className="px-5 py-3.5">Vulnerability ID</th>
                  <th className="px-5 py-3.5">Title</th>
                  <th className="px-5 py-3.5">Package / Target</th>
                  <th className="px-5 py-3.5">Tool</th>
                  <th className="px-5 py-3.5">Risk</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-sans">
                {filteredFindings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-14 text-center text-textSecondary font-sans">
                      <ShieldAlert size={40} className="mx-auto text-neonPurple/40 mb-3" />
                      <p className="font-bold text-white text-sm">No security findings found.</p>
                      <p className="text-xs text-textSecondary mt-1">Try resetting your filters or run a new scan from Repository Scan.</p>
                    </td>
                  </tr>
                ) : (
                  filteredFindings.map((finding) => (
                    <tr
                      key={finding.id}
                      onClick={() => openFinding(finding)}
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      {/* Severity */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge variant={finding.severity} className="font-bold uppercase text-[10px]">
                          {finding.severity}
                        </Badge>
                      </td>

                      {/* CVE ID */}
                      <td className="px-5 py-4 font-mono font-bold text-neonPurple whitespace-nowrap">
                        {finding.cve}
                      </td>

                      {/* Title */}
                      <td className="px-5 py-4 font-medium text-white max-w-xs truncate" title={finding.title}>
                        {finding.title}
                      </td>

                      {/* Package */}
                      <td className="px-5 py-4 font-mono text-pinkAccent whitespace-nowrap max-w-xs truncate" title={finding.package}>
                        {finding.package}
                      </td>

                      {/* Detection Tool */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] text-textSecondary">
                          {finding.tool}
                        </Badge>
                      </td>

                      {/* Risk Score */}
                      <td className="px-5 py-4 font-mono font-black text-warning whitespace-nowrap">
                        {formatScore(finding.riskScore)}/100
                      </td>

                      {/* Lifecycle Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge
                          variant={finding.lifecycleStatus === 'fixed' ? 'success' : finding.lifecycleStatus === 'reopened' ? 'high' : finding.lifecycleStatus === 'new' ? 'info' : 'outline'}
                          className="text-[10px] uppercase font-semibold"
                        >
                          {finding.lifecycleStatus || 'OPEN'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openFinding(finding);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-neonPurple/10 border border-neonPurple/30 text-neonPurple hover:bg-neonPurple hover:text-white transition-all flex items-center gap-1.5 ml-auto cursor-pointer text-xs font-semibold"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 5. FINDING DETAILS SIDE PANEL / MODAL */}
      <AnimatePresence>
        {selectedFinding && (
          <div 
            onClick={() => setSelectedFinding(null)}
            className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-md overflow-hidden"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#12051F] border-l border-[#2A1240] h-full flex flex-col justify-between shadow-2xl overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-4 sm:p-6 border-b border-[#2A1240] flex items-center justify-between shrink-0 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-neonPurple/20 text-neonPurple border border-neonPurple/30 shrink-0">
                    <ShieldAlert size={24} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-white font-mono truncate">{selectedFinding.cve}</h2>
                    <p className="text-xs text-textSecondary truncate max-w-md">{selectedFinding.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFinding(null)}
                  className="p-1.5 sm:p-2 rounded-lg text-textSecondary hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                  aria-label="Close details"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Drawer Content */}
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs font-sans">
                
                {/* Key Attributes Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] text-center">
                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Severity</span>
                    <Badge variant={selectedFinding.severity} className="mt-1 font-bold">
                      {selectedFinding.severity.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] text-center">
                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Priority</span>
                    <span className="text-sm font-bold text-pinkAccent mt-1 block">{selectedFinding.priority}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] text-center">
                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Risk Score</span>
                    <span className="text-base font-black text-warning mt-1 block">{formatScore(selectedFinding.riskScore)}/100</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] text-center">
                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Exploitability</span>
                    <span className="text-xs font-mono font-bold text-neonPurple mt-1.5 block">
                      {selectedFinding.exploitability ? formatPercentage(parseFloat(selectedFinding.exploitability) * 100) : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Detailed Information List */}
                <div className="space-y-3 p-4 rounded-2xl bg-[#090014] border border-[#2A1240] text-xs">
                  <div className="flex justify-between border-b border-[#2A1240] pb-2">
                    <span className="text-textSecondary font-semibold">Detection Tool</span>
                    <span className="font-mono text-white font-bold">{selectedFinding.tool}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#2A1240] pb-2">
                    <span className="text-textSecondary font-semibold">Affected Package</span>
                    <span className="font-mono text-pinkAccent font-bold">{selectedFinding.package}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#2A1240] pb-2">
                    <span className="text-textSecondary font-semibold">Fixed Version</span>
                    <span className="font-mono text-success font-bold">{selectedFinding.fixedVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textSecondary font-semibold">Production Status</span>
                    <span className="font-bold text-white">{selectedFinding.productionStatus}</span>
                  </div>
                </div>

                {/* Description */}
                <div className="p-4 rounded-2xl bg-[#090014]/60 border border-[#2A1240] space-y-1.5">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">Description</span>
                  <p className="text-xs text-textSecondary leading-relaxed" title={selectedFinding.description}>
                    {selectedFinding.description}
                  </p>
                </div>

                {/* Affected Files */}
                {selectedFinding.affectedFiles && selectedFinding.affectedFiles.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#090014]/60 border border-[#2A1240] space-y-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block flex items-center gap-1.5">
                      <FileCode size={14} className="text-neonPurple" />
                      Affected Files
                    </span>
                    <div className="space-y-1">
                      {selectedFinding.affectedFiles.map((file, idx) => (
                        <div key={idx} className="p-2 rounded bg-card font-mono text-xs text-pinkAccent border border-border/40">
                          {file}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ANALYZE WITH AI SECTION */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12051F] to-[#22093e] border border-[#A855F7]/40 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={18} className="text-neonPurple" />
                      <h3 className="text-sm font-bold text-white">AI Vulnerability Intelligence</h3>
                    </div>

                    <Button
                      variant="gradient"
                      size="sm"
                      disabled={isAiAnalyzing || !selectedFinding.vulnerabilityId}
                      onClick={handleAnalyzeWithAI}
                      className="text-xs h-9 flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      {isAiAnalyzing ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          <span>Analyze with AI</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {!selectedFinding.vulnerabilityId && (
                    <p className="text-[11px] text-warning">
                      AI analysis is unavailable because this finding has no vulnerability ID.
                    </p>
                  )}

                  {/* AI Loading State Animation */}
                  {isAiAnalyzing && (
                    <div className="p-4 rounded-xl bg-[#090014] border border-[#2A1240] text-center space-y-2 py-6">
                      <Loader2 size={24} className="animate-spin text-neonPurple mx-auto" />
                      <p className="text-xs text-neonPurple font-bold animate-pulse">
                        Querying FastAPI AI Engine (Cloudflare Workers AI)...
                      </p>
                      <p className="text-[11px] text-textSecondary">
                        Evaluating exploitability, blast radius & recommended mitigation.
                      </p>
                    </div>
                  )}

                  {/* AI Error Alert */}
                  {aiError && !isAiAnalyzing && (
                    <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger space-y-2">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertCircle size={16} />
                        <span>AI Analysis Request Failed</span>
                      </div>
                      <p className="text-[11px] text-textSecondary">{aiError}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAnalyzeWithAI}
                        className="text-xs border-danger/40 text-danger hover:bg-danger/10 cursor-pointer"
                      >
                        Retry Analysis
                      </Button>
                    </div>
                  )}

                  {/* AI Analysis Results Card */}
                  {(aiResult || selectedFinding.aiExplanation) && !isAiAnalyzing && (
                    <div className="space-y-3 pt-2 text-xs">
                      {/* Explanation */}
                      <div className="p-3.5 rounded-xl bg-[#090014] border border-neonPurple/30 space-y-1">
                        <span className="font-bold text-neonPurple uppercase tracking-wider text-[10px] block">
                          AI Threat Explanation
                        </span>
                        <p className="text-white leading-relaxed">
                          {aiResult?.explanation || selectedFinding.aiExplanation}
                        </p>
                      </div>

                      {/* Potential Impact */}
                      {(aiResult?.potentialImpact || selectedFinding.potentialImpact) && (
                        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 space-y-1">
                          <span className="font-bold text-danger uppercase tracking-wider text-[10px] block">
                            Potential Impact
                          </span>
                          <p className="text-foreground leading-relaxed">
                            {aiResult?.potentialImpact || selectedFinding.potentialImpact}
                          </p>
                        </div>
                      )}

                      {/* Recommended Action */}
                      {(aiResult?.recommendedAction || selectedFinding.recommendedFix) && (
                        <div className="p-3.5 rounded-xl bg-success/10 border border-success/30 space-y-1">
                          <span className="font-bold text-success uppercase tracking-wider text-[10px] block">
                            Recommended Mitigation
                          </span>
                          <p className="text-white font-medium leading-relaxed">
                            {aiResult?.recommendedAction || selectedFinding.recommendedFix}
                          </p>
                        </div>
                      )}

                      {/* Risk Summary */}
                      {(aiResult?.riskSummary || selectedFinding.riskSummary) && (
                        <div className="p-3.5 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                          <span className="font-bold text-warning uppercase tracking-wider text-[10px] block">
                            Risk Summary
                          </span>
                          <p className="text-textSecondary leading-relaxed">
                            {aiResult?.riskSummary || selectedFinding.riskSummary}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 sm:p-6 border-t border-[#2A1240] flex items-center justify-between shrink-0 bg-[#12051F]">
                <Button
                  variant="outline"
                  onClick={() => setSelectedFinding(null)}
                  className="text-xs cursor-pointer"
                >
                  Close
                </Button>

                <Button
                  variant="gradient"
                  onClick={() => {
                    resolveFinding(selectedFinding.id);
                    setSelectedFinding(null);
                  }}
                  className="text-xs cursor-pointer"
                >
                  Mark as Resolved
                </Button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
