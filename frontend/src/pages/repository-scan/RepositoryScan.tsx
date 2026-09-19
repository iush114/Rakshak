import { useState, useMemo } from 'react';
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
  Check,
  ArrowUpRight,
  ExternalLink,
  Clock,
  FolderGit2,
  AlertCircle,
  Lock,
  Globe,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { GithubIcon as Github } from '@/components/ui/GithubIcon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useSecurity } from '@/context/SecurityContext';
import {
  scanGitHubRepository,
  API_BASE_URL,
  type GitHubRepo,
  type GitHubScanResponse
} from '@/services/api';

export default function RepositoryScan() {
  const navigate = useNavigate();
  const {
    summary,
    findings,
    backendOnline,
    backendError,
    currentUser,
    isAuthChecking,
    isGithubConnected,
    gitHubRepos,
    isLoadingRepos,
    reposError,
    fetchGitHubRepos,
    selectedGitHubRepo,
    setSelectedGitHubRepo,
    refreshData,
    addScanResult
  } = useSecurity();

  // Search & Filter State
  const [repoSearch, setRepoSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');

  // Scan Checkboxes Options State (Default: Code, Dependency, Secret ON; Container OFF)
  const [scanOptions, setScanOptions] = useState({
    codeScanning: true,
    dependencyScanning: true,
    secretDetection: true,
    containerScanning: false,
  });
  const [containerImage, setContainerImage] = useState('');

  // Scan Execution & Animation State
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<GitHubScanResponse | null>(null);
  const [scanDuration, setScanDuration] = useState('0.0s');

  // Filtered GitHub Repositories
  const filteredRepos = useMemo(() => {
    return gitHubRepos.filter(repo => {
      const q = repoSearch.toLowerCase().trim();
      const matchesSearch = !q ||
        repo.name.toLowerCase().includes(q) ||
        repo.owner.toLowerCase().includes(q) ||
        (repo.description && repo.description.toLowerCase().includes(q));

      const matchesLang = languageFilter === 'all' ||
        (repo.language && repo.language.toLowerCase() === languageFilter.toLowerCase());

      return matchesSearch && matchesLang;
    });
  }, [gitHubRepos, repoSearch, languageFilter]);

  // Unique Languages for Filter
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    gitHubRepos.forEach(r => {
      if (r.language) langs.add(r.language);
    });
    return Array.from(langs);
  }, [gitHubRepos]);

  // Handle GitHub OAuth Login Redirect
  const handleConnectGitHub = () => {
    window.location.href = `${API_BASE_URL}/auth/github`;
  };

  // Start Security Scan Handler
  const handleStartScan = async () => {
    if (!selectedGitHubRepo) {
      setScanError('Please select a repository to scan.');
      return;
    }

    // Validate at least one scanner is selected
    if (!scanOptions.codeScanning && !scanOptions.dependencyScanning && !scanOptions.secretDetection && !scanOptions.containerScanning) {
      setScanError('Please select at least one security scan type (Code, Dependency, Secret, or Container).');
      return;
    }

    // Validate container image if container scanning is active
    if (scanOptions.containerScanning && !containerImage.trim()) {
      setScanError('Please provide a container image name (e.g., "python:3.11-slim" or "nginx:alpine") when Container Scanning is enabled.');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanCompleted(false);
    const startTime = performance.now();

    try {
      const response = await scanGitHubRepository({
        owner: selectedGitHubRepo.owner,
        repo: selectedGitHubRepo.name,
        ref: selectedGitHubRepo.default_branch || null,
        code_scanning: scanOptions.codeScanning,
        dependency_scanning: scanOptions.dependencyScanning,
        secret_detection: scanOptions.secretDetection,
        container_scanning: scanOptions.containerScanning,
        container_image: scanOptions.containerScanning ? containerImage.trim() : null,
      });

      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);
      const durationStr = `${elapsedSec}s`;
      setScanDuration(durationStr);
      setLastScanResult(response);
      setScanCompleted(true);

      // Refresh PostgreSQL summary & findings
      await refreshData();

      // Record to scan history
      addScanResult({
        scanId: response.scan_id,
        repoName: response.repository,
        duration: durationStr,
        critical: response.critical,
        high: response.high,
        medium: response.medium,
        low: response.low,
        overall_risk: response.overall_risk,
      });

    } catch (err: any) {
      console.error('[Rakshak] GitHub scan failed:', err);
      const msg = err.message || 'GitHub repository scan failed.';
      setScanError(msg);
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
              <span>GitHub Repositories</span>
            </h1>
            <Badge variant="default" className="bg-rakshak-gradient text-white">DevSecOps Threat Scanner</Badge>
            {backendOnline ? (
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                FastAPI Scanner Ready
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs px-2.5 py-0.5">
                Backend Offline
              </Badge>
            )}
          </div>
          <p className="text-sm text-textSecondary mt-1">
            Scan your GitHub repositories for SAST vulnerabilities, CVE dependencies, hardcoded secrets, and container flaws.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/findings')}
            className="flex items-center gap-2 text-xs border-border/60 hover:border-pinkAccent"
          >
            <ShieldAlert size={15} className="text-pinkAccent" />
            <span>View All Findings ({summary?.total_findings ?? findings.length})</span>
          </Button>

          <Button
            variant="gradient"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-xs"
          >
            <Layers size={15} />
            <span>Dashboard</span>
          </Button>
        </div>
      </div>

      {/* BACKEND NOTICE */}
      {!backendOnline && backendError && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="text-amber-400 shrink-0" size={18} />
            <span>Unable to connect to Rakshak backend (http://127.0.0.1:8000). Please verify the FastAPI server is running.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refreshData()}
            className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* 2. GITHUB AUTHENTICATION STATUS BANNER / PROMPT */}
      {!isAuthChecking && !isGithubConnected && (
        <Card className="border-neonPurple/50 bg-gradient-to-br from-[#12051F] via-[#1a082e] to-[#280940] shadow-2xl glow-neon">
          <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-card border border-border text-white shrink-0 shadow-lg">
                <Github size={40} className="text-neonPurple" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>GitHub Authentication Required</span>
                </h3>
                <p className="text-xs text-[#C4B5FD]/80 max-w-xl leading-relaxed">
                  Authenticate with your GitHub account to access your repositories directly and run automated DevSecOps security vulnerability scans with Rakshak.
                </p>
              </div>
            </div>

            <Button
              variant="gradient"
              onClick={handleConnectGitHub}
              className="h-12 px-7 text-sm font-bold flex items-center gap-2.5 shadow-[0_0_25px_rgba(168,85,247,0.5)] hover:shadow-[0_0_35px_rgba(236,72,153,0.7)] shrink-0 cursor-pointer"
            >
              <Github size={18} />
              <span>Connect with GitHub</span>
              <ExternalLink size={15} />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 3. GITHUB AUTHENTICATED USER BAR */}
      {isGithubConnected && currentUser && (
        <div className="p-4 rounded-2xl bg-[#090014]/90 border border-neonPurple/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={currentUser.avatar_url || 'https://github.com/identicons/user.png'}
              alt={currentUser.login}
              className="w-10 h-10 rounded-full border-2 border-neonPurple/60 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-mono">{currentUser.login}</span>
                {currentUser.name && (
                  <span className="text-xs text-textSecondary font-sans">({currentUser.name})</span>
                )}
                <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/40">
                  GitHub Connected
                </Badge>
              </div>
              <p className="text-[11px] text-textSecondary font-mono mt-0.5">
                {gitHubRepos.length} Repositories Available
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchGitHubRepos()}
              disabled={isLoadingRepos}
              className="text-xs border-border/60 text-textSecondary hover:text-white flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={isLoadingRepos ? 'animate-spin text-neonPurple' : ''} />
              <span>Sync Repositories</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(currentUser.html_url, '_blank')}
              className="text-xs border-border/60 text-textSecondary hover:text-white flex items-center gap-1.5"
            >
              <span>GitHub Profile</span>
              <ExternalLink size={12} />
            </Button>
          </div>
        </div>
      )}

      {/* 4. REPOSITORY SELECTOR & BROWSER */}
      {isGithubConnected && (
        <Card className="border-border bg-card/80">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <FolderGit2 size={22} className="text-neonPurple" />
                  <span>Select GitHub Repository</span>
                </CardTitle>
                <CardDescription className="text-xs text-textSecondary mt-0.5">
                  Choose a repository to configure and scan for security vulnerabilities
                </CardDescription>
              </div>

              {/* Search & Language Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" size={14} />
                  <Input
                    type="text"
                    placeholder="Search repositories..."
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    className="pl-9 h-8 text-xs bg-[#090014] border-border/60 focus-visible:ring-neonPurple"
                  />
                </div>

                {availableLanguages.length > 0 && (
                  <select
                    value={languageFilter}
                    onChange={(e) => setLanguageFilter(e.target.value)}
                    className="h-8 px-3 rounded-lg bg-[#090014] border border-border/60 text-xs text-white focus:outline-none focus:border-neonPurple"
                  >
                    <option value="all">All Languages</option>
                    {availableLanguages.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {isLoadingRepos ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw size={28} className="animate-spin text-neonPurple mx-auto" />
                <p className="text-xs text-textSecondary font-mono">Fetching repositories from GitHub API...</p>
              </div>
            ) : reposError ? (
              <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger flex items-center justify-between">
                <span>{reposError}</span>
                <Button size="sm" variant="outline" onClick={() => fetchGitHubRepos()} className="text-xs border-danger/40 text-danger">
                  Retry
                </Button>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="py-12 text-center text-xs text-textSecondary space-y-2">
                <FolderGit2 size={32} className="mx-auto text-textSecondary/40" />
                <p>No repositories found matching your filter.</p>
                {repoSearch && (
                  <Button size="sm" variant="ghost" onClick={() => setRepoSearch('')} className="text-xs text-neonPurple">
                    Clear Search
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[460px] overflow-y-auto pr-1">
                {filteredRepos.map((repo: GitHubRepo) => {
                  const isSelected = selectedGitHubRepo?.id === repo.id ||
                    (selectedGitHubRepo?.owner === repo.owner && selectedGitHubRepo?.name === repo.name);

                  return (
                    <div
                      key={repo.id}
                      onClick={() => setSelectedGitHubRepo(repo)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex h-full min-w-0 flex-col justify-between gap-3 relative group ${
                        isSelected
                          ? 'border-neonPurple bg-gradient-to-br from-[#1b082e] to-[#2e0b48] shadow-[0_0_25px_rgba(168,85,247,0.3)] glow-neon'
                          : 'border-border/60 bg-[#090014]/70 hover:bg-white/5 hover:border-border'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-rakshak-gradient" />
                      )}

                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Github size={16} className={isSelected ? 'text-pinkAccent shrink-0' : 'text-textSecondary shrink-0'} />
                          <h4 className="min-w-0 truncate text-sm font-bold text-white font-mono">{repo.name}</h4>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {repo.private ? (
                            <Badge variant="outline" className="text-[9px] text-amber-300 border-amber-500/30 bg-amber-500/10 flex items-center gap-1 py-0 px-1.5">
                              <Lock size={10} />
                              <span>Private</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] text-emerald-300 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1 py-0 px-1.5">
                              <Globe size={10} />
                              <span>Public</span>
                            </Badge>
                          )}
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-success/20 text-success flex items-center justify-center border border-success/40">
                              <Check size={12} />
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="min-h-[32px] text-xs text-textSecondary line-clamp-2 leading-relaxed">
                        {repo.description || 'No description provided for this repository.'}
                      </p>

                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border/40 pt-2.5 text-[11px] font-mono text-textSecondary">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {repo.language && (
                            <span className="flex items-center gap-1 text-white">
                              <span className="w-2 h-2 rounded-full bg-neonPurple inline-block" />
                              <span>{repo.language}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-textSecondary">
                            <GitBranch size={11} className="text-pinkAccent" />
                            <span>{repo.default_branch || 'main'}</span>
                          </span>
                        </div>

                        <span className="whitespace-nowrap text-right text-[10px] text-textSecondary/70">
                          {new Date(repo.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. ACTIVE SELECTED REPOSITORY DETAILS BANNER */}
      {selectedGitHubRepo && (
        <Card className="border-neonPurple/40 bg-gradient-to-br from-[#12051F] via-[#1a082e] to-[#250a3e] shadow-xl glow-neon">
          <CardHeader className="border-b border-[#2A1240] pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#090014] border border-[#2A1240] text-white shrink-0">
                  <Github size={26} className="text-neonPurple" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-bold text-white font-mono">
                      {selectedGitHubRepo.owner}/{selectedGitHubRepo.name}
                    </CardTitle>
                    <CheckCircle2 size={18} className="text-success shrink-0" />
                  </div>
                  <CardDescription className="text-xs text-[#C4B5FD]/80 mt-0.5">
                    Configured as the active target for DevSecOps vulnerability analysis.
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedGitHubRepo.html_url, '_blank')}
                  className="h-9 px-4 text-xs font-semibold border-[#2A1240] hover:border-neonPurple text-white hover:bg-neonPurple/10 flex items-center gap-1.5"
                >
                  <Github size={14} />
                  <span>Open on GitHub</span>
                  <ExternalLink size={12} />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-xs bg-[#090014]/90 p-4 rounded-2xl border border-[#2A1240]">
              <div>
                <span className="text-[10px] text-textSecondary uppercase block font-semibold">Repository</span>
                <span className="font-mono font-bold text-white truncate block mt-0.5">{selectedGitHubRepo.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-textSecondary uppercase block font-semibold">Owner</span>
                <span className="font-mono font-bold text-pinkAccent truncate block mt-0.5">{selectedGitHubRepo.owner}</span>
              </div>
              <div>
                <span className="text-[10px] text-textSecondary uppercase block font-semibold">Default Branch</span>
                <span className="font-mono font-bold text-neonPurple block mt-0.5">{selectedGitHubRepo.default_branch || 'main'}</span>
              </div>
              <div>
                <span className="text-[10px] text-textSecondary uppercase block font-semibold">Language</span>
                <span className="font-mono text-white block mt-0.5">{selectedGitHubRepo.language || 'Multi-language'}</span>
              </div>
              <div>
                <span className="text-[10px] text-textSecondary uppercase block font-semibold">Visibility</span>
                <span className="font-mono text-success font-bold block mt-0.5">
                  {selectedGitHubRepo.private ? 'Private' : 'Public'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-textSecondary uppercase block font-semibold">Last Updated</span>
                <span className="font-mono text-white block mt-0.5">
                  {new Date(selectedGitHubRepo.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
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

      {/* 6. SECURITY SCAN OPTIONS & TRIGGER CARD */}
      <Card className="border-border bg-card/80">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Code2 size={20} className="text-neonPurple" />
            <span>Scan Configuration</span>
          </CardTitle>
          <CardDescription className="text-xs text-textSecondary">
            Configure DevSecOps security engines for this scan run.
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
                  AST static code analysis for insecure patterns & vulnerabilities.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-border/30 pt-2">
                <span className="text-[10px] font-mono text-success font-semibold">
                  {scanOptions.codeScanning ? '✓ Enabled' : 'Disabled'}
                </span>
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
                  Trivy SCA scanner detecting known CVEs in libraries & lockfiles.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-border/30 pt-2">
                <span className="text-[10px] font-mono text-success font-semibold">
                  {scanOptions.dependencyScanning ? '✓ Enabled' : 'Disabled'}
                </span>
                <span className="text-[10px] font-mono text-pinkAccent">Trivy SCA</span>
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
                  Gitleaks pattern engine for API keys, tokens, and credentials.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-border/30 pt-2">
                <span className="text-[10px] font-mono text-success font-semibold">
                  {scanOptions.secretDetection ? '✓ Enabled' : 'Disabled'}
                </span>
                <span className="text-[10px] font-mono text-warning">Gitleaks</span>
              </div>
            </div>

            {/* 4. Container Scanning (Default OFF) */}
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
                  Trivy container image analysis for base image vulnerabilities.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-border/30 pt-2">
                <span className="text-[10px] font-mono text-success font-semibold">
                  {scanOptions.containerScanning ? '✓ Enabled' : 'Default OFF'}
                </span>
                <span className="text-[10px] font-mono text-blue-400">Docker SCA</span>
              </div>
            </div>

          </div>

          {/* Optional Container Image Input Field */}
          {scanOptions.containerScanning && (
            <div className="p-4 rounded-xl bg-[#090014] border border-blue-400/40 space-y-2 animate-in fade-in">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Container size={14} className="text-blue-400" />
                <span>Container Image Target (Required for Container Scan)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g., redis:alpine, python:3.11-slim, or nginx:latest"
                value={containerImage}
                onChange={(e) => setContainerImage(e.target.value)}
                className="text-xs font-mono bg-[#12051F] border-border/60 focus-visible:ring-blue-400 text-white"
              />
            </div>
          )}

          {/* SCAN BUTTON */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-border/40">
            <div className="text-xs text-textSecondary font-mono">
              {selectedGitHubRepo ? (
                <span>Target: <strong className="text-white">{selectedGitHubRepo.owner}/{selectedGitHubRepo.name}</strong></span>
              ) : (
                <span className="text-amber-400">Please select a repository above to enable scanning</span>
              )}
            </div>

            <Button
              variant="gradient"
              disabled={isScanning || !selectedGitHubRepo}
              onClick={handleStartScan}
              className="h-12 px-8 text-sm font-bold flex items-center gap-3 shadow-[0_0_30px_rgba(168,85,247,0.5)] hover:shadow-[0_0_40px_rgba(236,72,153,0.7)] cursor-pointer disabled:opacity-50 w-full sm:w-auto"
            >
              {isScanning ? (
                <>
                  <RefreshCw size={18} className="animate-spin text-white" />
                  <span>Scanning Repository...</span>
                </>
              ) : (
                <>
                  <Search size={18} />
                  <span>Scan Repository</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 7. GENUINE SCANNING / LOADING STATE */}
      {isScanning && selectedGitHubRepo && (
        <Card className="bg-[#12051F]/95 border-[#A855F7]/40 shadow-2xl p-8 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="max-w-2xl mx-auto space-y-6 text-center">

            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-neonPurple/40 animate-ping opacity-75" />
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#ec4899] p-[2px] glow-neon">
                <div className="w-full h-full bg-[#12051F] rounded-full flex items-center justify-center">
                  <RefreshCw size={32} className="text-neonPurple animate-spin" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs uppercase font-mono tracking-widest text-pinkAccent font-bold">
                Security Analysis In Progress
              </span>
              <h3 className="text-2xl font-black text-white font-mono">
                Rakshak is analyzing {selectedGitHubRepo.owner}/{selectedGitHubRepo.name}
              </h3>
              <p className="text-xs text-textSecondary font-mono">
                Running static code analyzer, dependency audit, secret checks, and AI threat scoring...
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#090014] p-4 rounded-xl border border-[#2A1240]">
              <div className="p-2.5 rounded-lg bg-card/40 border border-border/30 text-center">
                <span className="text-[10px] text-textSecondary uppercase font-bold block">SAST Engine</span>
                <span className="text-xs font-mono text-neonPurple font-bold mt-1 block">Active</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card/40 border border-border/30 text-center">
                <span className="text-[10px] text-textSecondary uppercase font-bold block">Trivy SCA</span>
                <span className="text-xs font-mono text-pinkAccent font-bold mt-1 block">Active</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card/40 border border-border/30 text-center">
                <span className="text-[10px] text-textSecondary uppercase font-bold block">Gitleaks</span>
                <span className="text-xs font-mono text-warning font-bold mt-1 block">Active</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card/40 border border-border/30 text-center">
                <span className="text-[10px] text-textSecondary uppercase font-bold block">AI Threat Score</span>
                <span className="text-xs font-mono text-success font-bold mt-1 block">Enriching</span>
              </div>
            </div>

          </div>
        </Card>
      )}

      {/* 8. SCAN COMPLETED RESULTS */}
      {scanCompleted && lastScanResult && !isScanning && (
        <Card className="bg-gradient-to-br from-[#12051F] via-[#1a082e] to-[#250a3e] border-success/40 glow-neon p-6 space-y-6 animate-in fade-in duration-300">

          {/* Header Banner */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[#2A1240] pb-6 gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-success/20 text-success border border-success/40 shrink-0">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-2">
                  <span>Scan Completed</span>
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-textSecondary mt-1">
                  <span>Repository: <strong className="text-white">{lastScanResult.repository}</strong></span>
                  <span>•</span>
                  <span>Ref: <strong className="text-neonPurple">{lastScanResult.ref || 'main'}</strong></span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-pinkAccent" />
                    Scan Duration: <strong className="text-white">{scanDuration}</strong>
                  </span>
                  <span>•</span>
                  <span>Scan ID: <strong className="text-[#C4B5FD]">{lastScanResult.scan_id.slice(0, 8)}...</strong></span>
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
                <span>Rescan</span>
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

            {/* Findings Breakdown Card */}
            <div className="lg:col-span-8 bg-[#090014]/90 p-5 rounded-2xl border border-[#2A1240] space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A1240] pb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert size={18} className="text-pinkAccent" />
                  <span>Security Vulnerabilities Breakdown</span>
                </h4>
                <Badge variant="critical" className="font-mono text-xs px-3 py-0.5">
                  {lastScanResult.total_findings} Total Findings
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30">
                  <span className="text-[10px] font-bold uppercase text-danger block">Critical</span>
                  <span className="text-2xl font-black text-danger font-mono mt-0.5 block">
                    {lastScanResult.critical}
                  </span>
                  <span className="text-[10px] text-textSecondary mt-0.5 block">Immediate Action</span>
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
                  <span className="text-[10px] text-textSecondary mt-0.5 block">Medium Risk</span>
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

            {/* Risk Score Card */}
            <div className="lg:col-span-4 bg-[#090014]/90 p-5 rounded-2xl border border-[#2A1240] flex flex-col justify-between text-center">
              <div>
                <span className="text-xs font-bold text-textSecondary uppercase tracking-wider block">
                  Overall Risk Score
                </span>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-4xl font-black text-warning font-mono">
                    {lastScanResult.overall_risk} / 100
                  </span>
                </div>
                <div className="mt-2">
                  <Badge variant="medium" className="text-xs uppercase px-3 py-1 font-bold">
                    {lastScanResult.overall_risk > 70 ? 'High Risk' : lastScanResult.overall_risk > 30 ? 'Medium Risk' : 'Low Risk'}
                  </Badge>
                </div>
              </div>

              <div className="w-full bg-border/40 h-2 rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full bg-warning rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, lastScanResult.overall_risk))}%` }}
                />
              </div>
            </div>

          </div>

        </Card>
      )}

    </div>
  );
}
