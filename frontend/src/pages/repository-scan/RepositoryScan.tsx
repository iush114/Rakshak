import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Code2,
  Key,
  Container,
  FileCode2,
  GitBranch,
  FileText,
  Check,
  ArrowUpRight,
  ExternalLink,
  Clock,
  FolderGit2,
  AlertCircle
} from 'lucide-react';
import { GithubIcon as Github } from '@/components/ui/GithubIcon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useSecurity } from '@/context/SecurityContext';
import {
  SCAN_ANIMATED_STEPS,
  INITIAL_RECENT_SCANS,
  DEFAULT_SCAN_RESULTS,
  type RecentScanRecord
} from '@/data/scanResults';
import { performScan } from '@/services/api';

export default function RepositoryScan() {
  const navigate = useNavigate();
  const {
    findings,
    repositories,
    selectedRepo,
    selectRepository,
    updateScanFindings,
    backendOnline
  } = useSecurity();

  // Selection & Modal States
  const [isChangingRepo, setIsChangingRepo] = useState<boolean>(false);

  // Scan Checkboxes Options State (All enabled by default)
  const [scanOptions, setScanOptions] = useState({
    codeScanning: true,
    dependencyScanning: true,
    secretDetection: true,
    containerScanning: true
  });

  // Scan Execution & Animation State
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [scanCompleted, setScanCompleted] = useState(false);

  // Real Scan Results State
  const [lastScanResult, setLastScanResult] = useState<{
    scanId: string;
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    overallRiskScore: number;
    duration: string;
  }>({
    scanId: 'Scan #105',
    totalFindings: DEFAULT_SCAN_RESULTS.totalFindings,
    critical: DEFAULT_SCAN_RESULTS.severityBreakdown.critical,
    high: DEFAULT_SCAN_RESULTS.severityBreakdown.high,
    medium: DEFAULT_SCAN_RESULTS.severityBreakdown.medium,
    low: DEFAULT_SCAN_RESULTS.severityBreakdown.low,
    overallRiskScore: DEFAULT_SCAN_RESULTS.riskScore,
    duration: DEFAULT_SCAN_RESULTS.scanDuration,
  });

  // Dynamic Live Stats Counter States during Scan
  const [counterFiles, setCounterFiles] = useState(0);
  const [counterDeps, setCounterDeps] = useState(0);
  const [counterSecrets, setCounterSecrets] = useState(0);
  const [counterFindings, setCounterFindings] = useState<string | number>('--');

  // History State
  const [recentScans, setRecentScans] = useState<RecentScanRecord[]>(INITIAL_RECENT_SCANS);

  // Handle "Open with GitHub"
  const handleOpenGithub = () => {
    window.open('https://github.com/', '_blank');
  };

  // Start Security Scan Handler with Real Backend Call & Sequential Animations
  const handleStartScan = async () => {
    // Validate at least one scanner is selected
    if (!scanOptions.codeScanning && !scanOptions.dependencyScanning && !scanOptions.secretDetection && !scanOptions.containerScanning) {
      setScanError('Please select at least one security scan type (Code, Dependency, Secret, or Container).');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanCompleted(false);
    setCurrentStepIndex(0);
    setCounterFiles(0);
    setCounterDeps(0);
    setCounterSecrets(0);
    setCounterFindings('--');

    const startTime = performance.now();
    const totalSteps = SCAN_ANIMATED_STEPS.length;
    const targetFiles = selectedRepo ? selectedRepo.filesCount : DEFAULT_SCAN_RESULTS.filesScanned;
    const targetDeps = selectedRepo ? selectedRepo.dependenciesCount : DEFAULT_SCAN_RESULTS.dependenciesChecked;
    const targetSecrets = selectedRepo ? selectedRepo.filesCount : DEFAULT_SCAN_RESULTS.secretsChecked;

    try {
      // Initiate real FastAPI scan request: POST /api/scan
      const scanPromise = performScan({
        code_scanning: scanOptions.codeScanning,
        dependency_scanning: scanOptions.dependencyScanning,
        secret_detection: scanOptions.secretDetection,
        container_scanning: scanOptions.containerScanning,
      });

      // Animate progress steps
      for (let i = 0; i < totalSteps; i++) {
        setCurrentStepIndex(i);
        const progressRatio = (i + 1) / totalSteps;
        setCounterFiles(Math.round(targetFiles * Math.min(1, progressRatio)));
        setCounterDeps(Math.round(targetDeps * Math.min(1, progressRatio)));
        setCounterSecrets(Math.round(targetSecrets * Math.min(1, progressRatio)));

        await new Promise(resolve => setTimeout(resolve, 350));
      }

      // Await real backend scan result
      const scanResult = await scanPromise;
      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);
      const durationStr = `${elapsedSec}s`;

      // Finalize counters
      setCounterFiles(targetFiles);
      setCounterDeps(targetDeps);
      setCounterSecrets(targetSecrets);
      setCounterFindings(scanResult.total_findings);

      const computedResult = {
        scanId: scanResult.scan_id || `Scan #${recentScans.length + 1}`,
        totalFindings: scanResult.total_findings,
        critical: scanResult.critical,
        high: scanResult.high,
        medium: scanResult.medium,
        low: scanResult.low,
        overallRiskScore: scanResult.overall_risk_score,
        duration: durationStr,
      };

      setLastScanResult(computedResult);
      setScanCompleted(true);

      // Update global context findings with real scanned findings
      if (scanResult.mappedFindings && scanResult.mappedFindings.length > 0) {
        updateScanFindings(scanResult.mappedFindings, {
          total_findings: scanResult.total_findings,
          critical: scanResult.critical,
          high: scanResult.high,
          medium: scanResult.medium,
          low: scanResult.low,
          overall_risk_score: scanResult.overall_risk_score,
        });
      }

      // Record new scan entry into local recent scans history
      const newScanEntry: RecentScanRecord = {
        id: `scan-${Date.now()}`,
        repository: selectedRepo.name,
        branch: selectedRepo.branch,
        findingsCount: scanResult.total_findings,
        riskScore: scanResult.overall_risk_score,
        riskLabel: scanResult.overall_risk_score > 70 ? 'High Risk' : scanResult.overall_risk_score > 30 ? 'Medium Risk' : 'Low Risk',
        date: 'Just now',
        duration: durationStr,
      };
      setRecentScans(prev => [newScanEntry, ...prev]);

    } catch (err: any) {
      console.error('[Rakshak] Scan execution failed:', err);
      setScanError(err.message || 'Security scan failed to complete. Please check the backend connection.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">

      {/* 1. PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <Github className="text-neonPurple" size={32} />
              <span>GitHub / Repository Scan</span>
            </h1>
            <Badge variant="default" className="bg-rakshak-gradient text-white">DevSecOps Platform</Badge>
            {backendOnline ? (
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                FastAPI Scanner Ready
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs px-2.5 py-0.5">
                Local Scanner
              </Badge>
            )}
          </div>
          <p className="text-sm text-textSecondary mt-1">
            Connect your GitHub repository and execute end-to-end security analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/findings')}
            className="flex items-center gap-2 text-xs"
          >
            <ShieldAlert size={15} className="text-pinkAccent" />
            <span>View All Findings ({findings.length})</span>
          </Button>

          <Button
            variant="gradient"
            size="sm"
            onClick={() => navigate('/reports')}
            className="flex items-center gap-2 text-xs"
          >
            <FileText size={15} />
            <span>Reports</span>
          </Button>
        </div>
      </div>

      {/* 2. REPOSITORY SELECTION & CONNECTION SECTION */}

      {/* CASE A: No repository selected or user clicked "Change Repository" */}
      {isChangingRepo ? (
        <Card className="border-neonPurple/40 bg-gradient-to-br from-[#12051F] via-[#1a082e] to-[#250a3e] shadow-2xl glow-neon">
          <CardHeader className="border-b border-[#2A1240] pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <FolderGit2 className="text-neonPurple" size={22} />
                  <span>Select Repository</span>
                </CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  Choose a repository to set as the active scan target in Rakshak
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsChangingRepo(false)}
                className="text-xs border-[#2A1240] text-textSecondary hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {repositories.map((repo) => {
                const isSelected = selectedRepo.id === repo.id || selectedRepo.name === repo.name;
                return (
                  <div
                    key={repo.id}
                    onClick={() => {
                      selectRepository(repo.id);
                      setIsChangingRepo(false);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'border-neonPurple bg-neonPurple/20 glow-neon shadow-lg scale-[1.02]'
                        : 'border-border/60 bg-[#090014]/60 hover:bg-white/5 hover:border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Github size={18} className={isSelected ? "text-pinkAccent" : "text-textSecondary"} />
                      {isSelected && <Check size={16} className="text-success font-bold" />}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white font-mono truncate">{repo.name}</h4>
                      <p className="text-[11px] text-textSecondary font-mono mt-0.5">{repo.language}</p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-textSecondary border-t border-border/40 pt-2">
                      <span className="font-mono text-success">{repo.visibility}</span>
                      <span className="font-mono">{repo.branch}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* CASE B: CONNECTED REPOSITORY CARD / MAIN CARD */
        <Card className="border-neonPurple/40 bg-gradient-to-br from-[#12051F] via-[#1a082e] to-[#250a3e] shadow-2xl glow-neon">
          <CardHeader className="border-b border-[#2A1240] pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#090014] border border-[#2A1240] text-white shrink-0">
                  <Github size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-bold text-white">Demo Repository</CardTitle>
                    <CheckCircle2 size={20} className="text-success" />
                  </div>
                  <CardDescription className="text-xs text-[#C4B5FD]/80 mt-0.5">
                    Demo repository is selected and ready for scanning in demo mode.
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangingRepo(true)}
                  className="h-9 px-4 text-xs font-semibold border-[#2A1240] hover:border-neonPurple text-white hover:bg-neonPurple/10"
                >
                  Change Repository
                </Button>

                <Button
                  variant="gradient"
                  size="sm"
                  onClick={handleOpenGithub}
                  className="h-9 px-4 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Github size={15} />
                  <span>Open with GitHub</span>
                  <ExternalLink size={13} />
                </Button>
              </div>

            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">

            {/* INITIAL CONNECT CARD IF NOT CONNECTED YET (OR PROMPT REPOSITORY DISPLAY) */}
            <div className="p-5 rounded-2xl bg-[#090014]/90 border border-[#2A1240] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#2A1240] pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <GitBranch size={16} className="text-neonPurple" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Repository Details
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-textSecondary flex items-center gap-1.5 font-mono">
                    <Github size={14} className="text-white" />
                    GitHub Repository
                  </span>
                  <Badge variant="outline" className="text-[10px] text-success border-success/30 bg-success/10">
                    Active
                  </Badge>
                </div>
              </div>

              {/* Exact Fields required by prompt step 3 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-textSecondary uppercase block font-semibold">Repository</span>
                  <span className="font-mono font-bold text-white truncate block mt-0.5">{selectedRepo.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary uppercase block font-semibold">Owner</span>
                  <span className="font-mono font-bold text-pinkAccent truncate block mt-0.5">{selectedRepo.owner}</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary uppercase block font-semibold">Branch</span>
                  <span className="font-mono font-bold text-neonPurple block mt-0.5">{selectedRepo.branch}</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary uppercase block font-semibold">Language</span>
                  <span className="font-mono text-white block mt-0.5">{selectedRepo.language}</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary uppercase block font-semibold">Files</span>
                  <span className="font-mono font-bold text-white block mt-0.5">{selectedRepo.filesCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary uppercase block font-semibold">Last Updated</span>
                  <span className="font-mono text-white block mt-0.5">{selectedRepo.lastUpdated}</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary uppercase block font-semibold">Visibility</span>
                  <span className="font-mono text-success font-bold block mt-0.5">{selectedRepo.visibility}</span>
                </div>
              </div>
            </div>

            {/* Quick Repository Selector Strip */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                Quick Select Repository:
              </span>
              <div className="flex flex-wrap gap-2">
                {repositories.map((repo) => {
                  const isSelected = selectedRepo.id === repo.id || selectedRepo.name === repo.name;
                  return (
                    <button
                      key={repo.id}
                      onClick={() => selectRepository(repo.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-rakshak-gradient text-white font-bold shadow-md'
                          : 'bg-[#090014] text-textSecondary border border-border/50 hover:text-white hover:border-border'
                      }`}
                    >
                      <Github size={13} />
                      <span>{repo.name}</span>
                      {isSelected && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {/* SCAN ERROR BANNER */}
      {scanError && (
        <div className="p-4 rounded-2xl bg-danger/10 border border-danger/30 text-xs text-danger flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle size={18} className="shrink-0" />
            <span>{scanError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleStartScan}
            className="border-danger/40 text-danger hover:bg-danger/10 text-xs shrink-0"
          >
            Retry Scan
          </Button>
        </div>
      )}

      {/* 3. SECURITY SCAN OPTIONS CARD */}
      <Card className="border-border bg-card/80">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Code2 size={20} className="text-neonPurple" />
            <span>Security Scan</span>
          </CardTitle>
          <CardDescription className="text-xs text-textSecondary">
            Select the security checks you want Rakshak to perform.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* 1. Code Scanning */}
            <div className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
              scanOptions.codeScanning ? 'bg-[#090014] border-neonPurple/60 glow-neon' : 'bg-[#090014]/50 border-border/40 opacity-70'
            }`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode2 size={18} className="text-neonPurple" />
                    <h4 className="text-xs font-bold text-white">Code Scanning</h4>
                  </div>
                  <Checkbox
                    checked={scanOptions.codeScanning}
                    onCheckedChange={(checked) => setScanOptions(prev => ({ ...prev, codeScanning: !!checked }))}
                  />
                </div>
                <p className="text-[11px] text-textSecondary leading-snug">
                  Detect insecure coding patterns.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-border/30 pt-2">
                <span className="text-[10px] font-mono text-success font-semibold">✓ Enabled</span>
                <span className="text-[10px] font-mono text-neonPurple">SAST Engine</span>
              </div>
            </div>

            {/* 2. Dependency Scanning */}
            <div className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
              scanOptions.dependencyScanning ? 'bg-[#090014] border-pinkAccent/60 glow-neon' : 'bg-[#090014]/50 border-border/40 opacity-70'
            }`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={18} className="text-pinkAccent" />
                    <h4 className="text-xs font-bold text-white">Dependency Scanning</h4>
                  </div>
                  <Checkbox
                    checked={scanOptions.dependencyScanning}
                    onCheckedChange={(checked) => setScanOptions(prev => ({ ...prev, dependencyScanning: !!checked }))}
                  />
                </div>
                <p className="text-[11px] text-textSecondary leading-snug">
                  Detect vulnerable dependencies and packages.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-border/30 pt-2">
                <span className="text-[10px] font-mono text-success font-semibold">✓ Enabled</span>
                <span className="text-[10px] font-mono text-pinkAccent">SCA Engine</span>
              </div>
            </div>

            {/* 3. Secret Detection */}
            <div className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
              scanOptions.secretDetection ? 'bg-[#090014] border-warning/60 glow-neon' : 'bg-[#090014]/50 border-border/40 opacity-70'
            }`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key size={18} className="text-warning" />
                    <h4 className="text-xs font-bold text-white">Secret Detection</h4>
                  </div>
                  <Checkbox
                    checked={scanOptions.secretDetection}
                    onCheckedChange={(checked) => setScanOptions(prev => ({ ...prev, secretDetection: !!checked }))}
                  />
                </div>
                <p className="text-[11px] text-textSecondary leading-snug">
                  Detect exposed passwords, API keys and credentials.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-border/30 pt-2">
                <span className="text-[10px] font-mono text-success font-semibold">✓ Enabled</span>
                <span className="text-[10px] font-mono text-warning">Secrets Audit</span>
              </div>
            </div>

            {/* 4. Container Scanning */}
            <div className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
              scanOptions.containerScanning ? 'bg-[#090014] border-blue-400/60 glow-neon' : 'bg-[#090014]/50 border-border/40 opacity-70'
            }`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Container size={18} className="text-blue-400" />
                    <h4 className="text-xs font-bold text-white">Container Scanning</h4>
                  </div>
                  <Checkbox
                    checked={scanOptions.containerScanning}
                    onCheckedChange={(checked) => setScanOptions(prev => ({ ...prev, containerScanning: !!checked }))}
                  />
                </div>
                <p className="text-[11px] text-textSecondary leading-snug">
                  Detect vulnerabilities in container configurations and images.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-border/30 pt-2">
                <span className="text-[10px] font-mono text-success font-semibold">✓ Enabled</span>
                <span className="text-[10px] font-mono text-blue-400">Docker Audit</span>
              </div>
            </div>

          </div>

          {/* START SCAN BUTTON */}
          <div className="flex justify-end pt-2">
            <Button
              variant="gradient"
              disabled={isScanning}
              onClick={handleStartScan}
              className="h-12 px-8 text-base font-bold flex items-center gap-3 shadow-[0_0_30px_rgba(168,85,247,0.5)] hover:shadow-[0_0_40px_rgba(236,72,153,0.7)] cursor-pointer disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <RefreshCw size={20} className="animate-spin text-white" />
                  <span>Scanning Repository with FastAPI...</span>
                </>
              ) : (
                <>
                  <Search size={20} />
                  <span>🔍 Start Security Scan</span>
                </>
              )}
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* 4. SCANNING SCREEN & LIVE STATISTICS */}
      {isScanning && (
        <Card className="bg-[#12051F]/95 border-[#A855F7]/40 shadow-2xl p-8 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="max-w-3xl mx-auto space-y-8">

            {/* Header info */}
            <div className="text-center space-y-2">
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-neonPurple/40 animate-ping opacity-75" />
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#ec4899] p-[2px] glow-neon">
                  <div className="w-full h-full bg-[#12051F] rounded-full flex items-center justify-center">
                    <RefreshCw size={32} className="text-neonPurple animate-spin" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase font-mono tracking-widest text-pinkAccent font-bold">Scanning</span>
                <h3 className="text-2xl font-black text-white font-mono">{selectedRepo.name}</h3>
                <p className="text-xs text-textSecondary font-mono">Branch: {selectedRepo.branch}</p>
              </div>
            </div>

            {/* LIVE STATISTICS COUNTERS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#090014] p-4 rounded-xl border border-[#2A1240]">
              <div className="text-center p-3 rounded-lg bg-card/40 border border-border/30">
                <span className="text-[10px] text-textSecondary uppercase font-bold block">Files Scanned</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">{counterFiles}</span>
              </div>
              <div className="text-center p-3 rounded-lg bg-card/40 border border-border/30">
                <span className="text-[10px] text-textSecondary uppercase font-bold block">Dependencies Checked</span>
                <span className="text-2xl font-black font-mono text-neonPurple mt-1 block">{counterDeps}</span>
              </div>
              <div className="text-center p-3 rounded-lg bg-card/40 border border-border/30">
                <span className="text-[10px] text-textSecondary uppercase font-bold block">Secrets Checked</span>
                <span className="text-2xl font-black font-mono text-warning mt-1 block">{counterSecrets}</span>
              </div>
              <div className="text-center p-3 rounded-lg bg-card/40 border border-border/30">
                <span className="text-[10px] text-textSecondary uppercase font-bold block">Vulnerabilities Found</span>
                <span className="text-2xl font-black font-mono text-pinkAccent mt-1 block">{counterFindings}</span>
              </div>
            </div>

            {/* Step Progress Checklist */}
            <div className="space-y-3 bg-[#090014] p-5 rounded-2xl border border-[#2A1240]">
              {SCAN_ANIMATED_STEPS.map((step, idx) => {
                const isCompleted = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div key={step.id} className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-0">
                    <div className="flex items-center gap-3">
                      {isCompleted ? (
                        <CheckCircle2 size={18} className="text-success shrink-0" />
                      ) : isCurrent ? (
                        <RefreshCw size={18} className="text-neonPurple animate-spin shrink-0" />
                      ) : (
                        <div className="w-4.5 h-4.5 rounded-full border border-border/50 shrink-0" />
                      )}
                      <div>
                        <span className={`block ${
                          isCompleted ? "text-white font-semibold" : isCurrent ? "text-neonPurple font-bold animate-pulse" : "text-textSecondary/60"
                        }`}>
                          {step.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] text-textSecondary font-mono">{step.subtext}</span>
                        )}
                      </div>
                    </div>

                    <span className="font-mono text-[11px]">
                      {isCompleted ? (
                        <span className="text-success font-bold">✓ DONE</span>
                      ) : isCurrent ? (
                        <span className="text-neonPurple font-bold animate-pulse">...</span>
                      ) : (
                        <span className="text-textSecondary/40">WAITING</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Outer Progress Bar */}
            <div className="w-full bg-[#090014] h-2.5 rounded-full overflow-hidden border border-[#2A1240]">
              <div
                className="h-full bg-rakshak-gradient transition-all duration-300 rounded-full"
                style={{ width: `${((currentStepIndex + 1) / SCAN_ANIMATED_STEPS.length) * 100}%` }}
              />
            </div>

          </div>
        </Card>
      )}

      {/* 5. SCAN COMPLETED SCREEN & SUMMARY */}
      {scanCompleted && !isScanning && (
        <Card className="bg-gradient-to-br from-[#12051F] via-[#1a082e] to-[#250a3e] border-success/40 glow-neon p-6 space-y-6 animate-in fade-in duration-300">

          {/* Header Banner */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[#2A1240] pb-6 gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-success/20 text-success border border-success/40 shrink-0">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-2">
                  <span>✓ Scan Completed Successfully</span>
                </h3>
                <div className="flex items-center gap-4 text-xs font-mono text-textSecondary mt-1">
                  <span>Repository: <strong className="text-white">{selectedRepo.name}</strong></span>
                  <span>•</span>
                  <span>Branch: <strong className="text-neonPurple">{selectedRepo.branch}</strong></span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-pinkAccent" />
                    Scan Duration: <strong className="text-white">{lastScanResult.duration}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleStartScan}
                className="h-11 px-5 text-xs font-bold border-[#2A1240] text-white hover:border-neonPurple flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw size={15} />
                <span>Rescan Repository</span>
              </Button>

              <Button
                variant="gradient"
                onClick={() => navigate('/findings')}
                className="h-11 px-6 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <span>View Findings</span>
                <ArrowUpRight size={16} />
              </Button>
            </div>
          </div>

          {/* Security Summary & Risk Score Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Summary Findings Breakdown Card */}
            <div className="lg:col-span-8 bg-[#090014]/90 p-5 rounded-2xl border border-[#2A1240] space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A1240] pb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert size={18} className="text-pinkAccent" />
                  <span>Security Summary</span>
                </h4>
                <Badge variant="critical" className="font-mono text-xs px-3 py-0.5">
                  {lastScanResult.totalFindings} Findings
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30">
                  <span className="text-[10px] font-bold uppercase text-danger block">Critical</span>
                  <span className="text-2xl font-black text-danger font-mono mt-0.5 block">
                    {lastScanResult.critical}
                  </span>
                  <span className="text-[10px] text-textSecondary mt-0.5 block">Immediate Fix</span>
                </div>

                <div className="p-3.5 rounded-xl bg-pinkAccent/10 border border-pinkAccent/30">
                  <span className="text-[10px] font-bold uppercase text-pinkAccent block">High</span>
                  <span className="text-2xl font-black text-pinkAccent font-mono mt-0.5 block">
                    {lastScanResult.high}
                  </span>
                  <span className="text-[10px] text-textSecondary mt-0.5 block">High Priority</span>
                </div>

                <div className="p-3.5 rounded-xl bg-warning/10 border border-warning/30">
                  <span className="text-[10px] font-bold uppercase text-warning block">Medium</span>
                  <span className="text-2xl font-black text-warning font-mono mt-0.5 block">
                    {lastScanResult.medium}
                  </span>
                  <span className="text-[10px] text-textSecondary mt-0.5 block">Moderate Risk</span>
                </div>

                <div className="p-3.5 rounded-xl bg-neonPurple/10 border border-neonPurple/30">
                  <span className="text-[10px] font-bold uppercase text-neonPurple block">Low</span>
                  <span className="text-2xl font-black text-neonPurple font-mono mt-0.5 block">
                    {lastScanResult.low}
                  </span>
                  <span className="text-[10px] text-textSecondary mt-0.5 block">Low Impact</span>
                </div>
              </div>
            </div>

            {/* Risk Score Gauge Card */}
            <div className="lg:col-span-4 bg-[#090014]/90 p-5 rounded-2xl border border-[#2A1240] flex flex-col justify-between text-center">
              <div>
                <span className="text-xs font-bold text-textSecondary uppercase tracking-wider block">
                  Overall Risk Score
                </span>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-4xl font-black text-warning font-mono">{lastScanResult.overallRiskScore} / 100</span>
                </div>
                <div className="mt-2">
                  <Badge variant="medium" className="text-xs uppercase px-3 py-1 font-bold">
                    {lastScanResult.overallRiskScore > 70 ? 'High Risk' : lastScanResult.overallRiskScore > 30 ? 'Medium Risk' : 'Low Risk'}
                  </Badge>
                </div>
              </div>

              <div className="w-full bg-border/40 h-2 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-warning rounded-full" style={{ width: `${Math.min(100, Math.max(5, lastScanResult.overallRiskScore))}%` }} />
              </div>
            </div>

          </div>

        </Card>
      )}

      {/* 6. SCAN HISTORY TABLE (DISPLAYED INSIDE THE PAGE) */}
      <Card className="border-border bg-card/80">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Clock size={20} className="text-neonPurple" />
                <span>Recent Scans</span>
              </CardTitle>
              <CardDescription className="text-xs text-textSecondary">
                Historical record of security scans performed on this platform
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {recentScans.length} Scans Recorded
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#090014] text-textSecondary border-b border-border/50 uppercase font-mono text-[10px]">
              <tr>
                <th className="p-4">Repository</th>
                <th className="p-4">Branch</th>
                <th className="p-4">Findings</th>
                <th className="p-4">Risk Score</th>
                <th className="p-4">Duration</th>
                <th className="p-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {recentScans.map((scan) => (
                <tr key={scan.id} className="hover:bg-white/5 transition-all font-mono">
                  <td className="p-4 font-bold text-white flex items-center gap-2">
                    <Github size={14} className="text-pinkAccent" />
                    <span>{scan.repository}</span>
                  </td>
                  <td className="p-4 text-neonPurple">{scan.branch}</td>
                  <td className="p-4 font-bold text-pinkAccent">{scan.findingsCount} Findings</td>
                  <td className="p-4">
                    <span className="text-warning font-bold">{scan.riskScore} / 100</span>
                    <span className="text-[10px] text-textSecondary ml-2">({scan.riskLabel})</span>
                  </td>
                  <td className="p-4 text-textSecondary">{scan.duration}</td>
                  <td className="p-4 text-right text-textSecondary">{scan.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

    </div>
  );
}
