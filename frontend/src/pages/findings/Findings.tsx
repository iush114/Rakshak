import { useState, useMemo } from 'react';
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
  AlertCircle
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
  const { findings, resolveFinding, addAIAnalysis, isLoading, backendOnline } = useSecurity();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [toolFilter, setToolFilter] = useState<string>('all');
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

        return matchesSearch && matchesSeverity && matchesPriority && matchesTool;
      })
      .sort((a, b) => (sortByRisk ? b.riskScore - a.riskScore : a.riskScore - b.riskScore));
  }, [findings, searchTerm, severityFilter, priorityFilter, toolFilter, sortByRisk]);

  const clearFilters = () => {
    setSearchTerm('');
    setSeverityFilter('all');
    setPriorityFilter('all');
    setToolFilter('all');
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
    setIsAiAnalyzing(true);
    setAiError(null);
    setAiResult(null);

    try {
      // Call FastAPI endpoint: GET /api/findings/{vulnerability_id}/analyze
      const result = await analyzeFindingWithAI(selectedFinding.cve);
      
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
      // If backend fails, use existing finding attributes if available or show informative error
      if (selectedFinding.aiExplanation) {
        setAiResult({
          explanation: selectedFinding.aiExplanation,
          potentialImpact: selectedFinding.potentialImpact || 'Potential security degradation.',
          recommendedAction: selectedFinding.recommendedAction || 'Apply vendor updates.',
          riskSummary: selectedFinding.riskSummary || 'Action required.'
        });
      } else {
        setAiError(err.message || 'Failed to complete AI analysis from FastAPI backend.');
      }
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Vulnerability Findings
            </h1>
            <Badge variant="default" className="text-xs bg-rakshak-gradient text-white">
              {filteredFindings.length} Items
            </Badge>
            {backendOnline && (
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                FastAPI Connected
              </Badge>
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
          className="flex items-center gap-2 text-xs shrink-0"
        >
          <Download size={14} />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* SEARCH AND FILTERS BAR */}
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
              className="bg-background border border-border text-white text-xs rounded-xl px-3 py-2 focus:border-neonPurple focus:outline-none"
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
              className="bg-background border border-border text-white text-xs rounded-xl px-3 py-2 focus:border-neonPurple focus:outline-none"
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
              className="bg-background border border-border text-white text-xs rounded-xl px-3 py-2 focus:border-neonPurple focus:outline-none"
            >
              <option value="all">Tool: All</option>
              <option value="Trivy SCA">Trivy SCA</option>
              <option value="Code Scanner">Code Scanner</option>
              <option value="Secret Detection">Secret Detection</option>
              <option value="Container Scan">Container Scan</option>
              <option value="Bandit SAST">Bandit SAST</option>
            </select>

            {/* Clear Filters */}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs text-textSecondary hover:text-white border border-border/50 h-9"
            >
              Clear Filters
            </Button>

            {/* Sort Risk */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSortByRisk(!sortByRisk)}
              className="text-xs text-textSecondary hover:text-white flex items-center gap-1.5 border border-border h-9"
            >
              <ArrowUpDown size={14} />
              <span>Risk: {sortByRisk ? 'High → Low' : 'Low → High'}</span>
            </Button>

          </div>

        </div>
      </Card>

      {/* FINDINGS TABLE */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#090014] border-b border-border/80 text-textSecondary uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3.5">CVE ID</th>
                  <th className="px-4 py-3.5">Title</th>
                  <th className="px-4 py-3.5">Severity</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Risk Score</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Tool</th>
                  <th className="px-4 py-3.5">Package</th>
                  <th className="px-4 py-3.5">Fix Available</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-sans">
                {filteredFindings.map((finding) => (
                  <tr 
                    key={finding.id}
                    onClick={() => { setSelectedFinding(finding); setAiResult(null); }}
                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    {/* CVE ID */}
                    <td className="px-4 py-3.5 font-mono font-bold text-neonPurple whitespace-nowrap">
                      {finding.cve}
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3.5 font-medium text-white max-w-xs truncate" title={finding.title}>
                      {finding.title}
                    </td>

                    {/* Severity */}
                    <td className="px-4 py-3.5">
                      <Badge variant={finding.severity}>
                        {finding.severity.toUpperCase()}
                      </Badge>
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3.5">
                      <span className={`font-semibold ${
                        finding.priority === 'Critical' ? 'text-danger' : finding.priority === 'High' ? 'text-pinkAccent' : 'text-warning'
                      }`}>
                        {finding.priority}
                      </span>
                    </td>

                    {/* Risk Score */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white">{finding.riskScore}/100</span>
                        <div className="w-12 h-1.5 bg-border rounded-full overflow-hidden hidden sm:block">
                          <div 
                            className={`h-full rounded-full ${finding.riskScore > 80 ? 'bg-danger' : finding.riskScore > 50 ? 'bg-warning' : 'bg-neonPurple'}`} 
                            style={{ width: `${finding.riskScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <Badge variant="outline" className={`text-[10px] whitespace-nowrap ${
                        finding.status === 'Active' ? 'border-danger/30 bg-danger/15 text-danger' :
                        finding.status === 'Resolved' ? 'border-success/30 bg-success/15 text-success' :
                        finding.status === 'Fix Available' ? 'border-warning/30 bg-warning/15 text-warning' :
                        'border-border text-textSecondary'
                      }`}>
                        {finding.status === 'Active' && '● Active'}
                        {finding.status === 'Resolved' && '✓ Resolved'}
                        {finding.status === 'Fix Available' && '⚠ Fix Available'}
                        {finding.status === 'Ignored' && '⊘ Ignored'}
                      </Badge>
                    </td>

                    {/* Tool */}
                    <td className="px-4 py-3.5">
                      <Badge variant="outline" className="text-[10px] border-border text-textSecondary whitespace-nowrap">
                        {finding.tool}
                      </Badge>
                    </td>

                    {/* Package */}
                    <td className="px-4 py-3.5 font-mono text-pinkAccent whitespace-nowrap">
                      {finding.package}
                    </td>

                    {/* Fix Available */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        finding.fixedVersion && finding.fixedVersion !== 'No fix available'
                          ? 'bg-success/15 text-success border-success/30'
                          : 'bg-danger/15 text-danger border-danger/30'
                      }`}>
                        {finding.fixedVersion && finding.fixedVersion !== 'No fix available' ? 'Yes' : 'No'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedFinding(finding); setAiResult(null); }}
                        className="p-1.5 rounded-lg bg-card border border-border text-textSecondary hover:text-white hover:border-neonPurple transition-all font-semibold text-xs flex items-center gap-1 ml-auto"
                        title="View Finding Details"
                      >
                        <Eye size={16} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* FINDING DETAILS SIDE PANEL / MODAL */}
      <AnimatePresence>
        {selectedFinding && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-md">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-2xl bg-[#12051F] border-l border-[#2A1240] h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl"
            >
              <div className="space-y-6">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-[#2A1240] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-neonPurple/20 text-neonPurple border border-neonPurple/30">
                      <ShieldAlert size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white font-mono">{selectedFinding.cve}</h2>
                      <p className="text-xs text-textSecondary max-w-md truncate">{selectedFinding.title}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFinding(null)}
                    className="p-2 rounded-lg bg-card/60 text-textSecondary hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Key Attributes Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] text-center">
                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Severity</span>
                    <Badge variant={selectedFinding.severity} className="mt-1">
                      {selectedFinding.severity.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] text-center">
                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Priority</span>
                    <span className="text-sm font-bold text-pinkAccent mt-1 block">{selectedFinding.priority}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] text-center">
                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Risk Score</span>
                    <span className="text-base font-black text-warning mt-1 block">{selectedFinding.riskScore}/100</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] text-center">
                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Exploitability</span>
                    <span className="text-xs font-mono font-bold text-neonPurple mt-1.5 block">
                      {selectedFinding.exploitability ? `${Math.round(parseFloat(selectedFinding.exploitability) * 100)}%` : 'N/A'}
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
                  <p className="text-xs text-textSecondary leading-relaxed">{selectedFinding.description}</p>
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

                {/* 🤖 ANALYZE WITH AI SECTION */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12051F] to-[#22093e] border border-[#A855F7]/40 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={18} className="text-neonPurple animate-pulse" />
                      <h3 className="text-sm font-bold text-white">AI Vulnerability Intelligence</h3>
                    </div>

                    <Button
                      variant="gradient"
                      size="sm"
                      disabled={isAiAnalyzing}
                      onClick={handleAnalyzeWithAI}
                      className="text-xs h-9 flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      {isAiAnalyzing ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Analyzing vulnerability...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          <span>Analyze with AI</span>
                        </>
                      )}
                    </Button>
                  </div>

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
                        className="mt-2 text-xs border-danger/40 text-danger hover:bg-danger/10"
                      >
                        Retry AI Analysis
                      </Button>
                    </div>
                  )}

                  {/* AI Response Output */}
                  {aiResult && !isAiAnalyzing && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl bg-[#090014] border border-[#2A1240] space-y-3 text-xs leading-relaxed"
                    >
                      <div>
                        <span className="font-bold text-neonPurple uppercase tracking-wider text-[10px] block">AI Explanation</span>
                        <p className="text-white mt-0.5">{aiResult.explanation}</p>
                      </div>

                      <div className="border-t border-[#2A1240] pt-2">
                        <span className="font-bold text-pinkAccent uppercase tracking-wider text-[10px] block">Potential Impact</span>
                        <p className="text-textSecondary mt-0.5">{aiResult.potentialImpact}</p>
                      </div>

                      <div className="border-t border-[#2A1240] pt-2">
                        <span className="font-bold text-success uppercase tracking-wider text-[10px] block">Recommended Action</span>
                        <p className="text-white font-medium mt-0.5">{aiResult.recommendedAction}</p>
                      </div>

                      <div className="border-t border-[#2A1240] pt-2">
                        <span className="font-bold text-warning uppercase tracking-wider text-[10px] block">Risk Summary</span>
                        <p className="text-textSecondary mt-0.5">{aiResult.riskSummary}</p>
                      </div>
                    </motion.div>
                  )}
                </div>

              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-6 border-t border-[#2A1240] flex items-center gap-3">
                <Button 
                  variant="gradient" 
                  className="flex-1 text-xs"
                  onClick={() => {
                    resolveFinding(selectedFinding.id);
                    setSelectedFinding(null);
                  }}
                >
                  Mark as Resolved
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 text-xs"
                  onClick={() => setSelectedFinding(null)}
                >
                  Close
                </Button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
