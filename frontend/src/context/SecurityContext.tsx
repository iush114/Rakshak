import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { type Finding } from '@/data/findings';
import { type SecurityReport } from '@/data/reports';
import { type AIAnalysisRecord } from '@/data/aiAnalysisHistory';
import { type Repository } from '@/data/repositories';
import {
  getSummary,
  getFindings,
  getAuthMe,
  logoutAuth,
  disconnectGitHub as apiDisconnectGitHub,
  getGitHubRepos,
  checkBackendHealth,
  type ApiSummaryResponse,
  type AuthUser,
  type GitHubUser,
  type GitHubRepo
} from '@/services/api';

export type FindingItem = Finding;

export interface SecretItem {
  id: string;
  type: string;
  maskedSecret: string;
  rawSecret: string;
  filePath: string;
  line: number;
  confidence: string;
  status: string;
  timestamp: string;
  repo: string;
}

export interface ScanItem {
  id: string;
  scanId: string;
  date: string;
  repo: string;
  duration: string;
  findingsCount: number;
  prioritizedCount: number;
  riskScore: number;
  status: string;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  secretsCount?: number;
}

export function mapGitHubRepoToRepository(ghRepo: GitHubRepo): Repository {
  return {
    id: String(ghRepo.id),
    name: ghRepo.name,
    owner: ghRepo.owner,
    branch: ghRepo.default_branch || 'main',
    lastUpdated: ghRepo.updated_at ? new Date(ghRepo.updated_at).toLocaleDateString() : 'Recently',
    filesCount: 0,
    dependenciesCount: 0,
    language: ghRepo.language || 'Unknown',
    visibility: ghRepo.private ? 'Private' : 'Public',
    starsCount: 0,
    forksCount: 0,
    githubUrl: ghRepo.html_url || `https://github.com/${ghRepo.owner}/${ghRepo.name}`,
    targetPath: ghRepo.full_name || `${ghRepo.owner}/${ghRepo.name}`,
  };
}

interface SecurityContextType {
  findings: Finding[];
  summary: ApiSummaryResponse | null;
  isLoading: boolean;
  backendOnline: boolean;
  backendError: string | null;
  currentUser: AuthUser | null;
  gitHubUser: GitHubUser | null;
  isAuthChecking: boolean;
  checkAuthStatus: () => Promise<void>;
  logout: () => Promise<void>;
  disconnectGitHub: () => Promise<void>;
  gitHubRepos: GitHubRepo[];
  isLoadingRepos: boolean;
  reposError: string | null;
  fetchGitHubRepos: () => Promise<void>;
  selectedGitHubRepo: GitHubRepo | null;
  setSelectedGitHubRepo: (repo: GitHubRepo | null) => void;
  selectGitHubRepoByName: (owner: string, name: string) => void;
  secrets: SecretItem[];
  scanHistory: ScanItem[];
  reports: SecurityReport[];
  aiHistory: AIAnalysisRecord[];
  repositories: Repository[];
  selectedRepo: Repository | null;
  isGithubConnected: boolean;
  overallRiskScore: number;
  refreshData: () => Promise<void>;
  connectGithub: () => void;
  selectRepository: (repoId: string) => void;
  addAIAnalysis: (analysis: Omit<AIAnalysisRecord, 'id' | 'analyzedOn'>) => AIAnalysisRecord;
  addReport: (report: Omit<SecurityReport, 'id' | 'generatedOn'>) => SecurityReport;
  deleteReport: (reportId: string) => void;
  resolveFinding: (findingId: string) => void;
  resolveSecret: (secretId: string) => void;
  addScanResult: (scan: any) => void;
  updateScanFindings: (newFindings: Finding[], scanSummary?: Partial<ApiSummaryResponse>) => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [summary, setSummary] = useState<ApiSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // GitHub Auth State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [gitHubUser, setGitHubUser] = useState<GitHubUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // GitHub Repositories State
  const [gitHubRepos, setGitHubRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState<GitHubRepo | null>(null);

  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [scanHistory, setScanHistory] = useState<ScanItem[]>([]);
  const [reports, setReports] = useState<SecurityReport[]>([]);
  const [aiHistory, setAiHistory] = useState<AIAnalysisRecord[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [isGithubConnected, setIsGithubConnected] = useState<boolean>(false);
  const [overallRiskScore, setOverallRiskScore] = useState<number>(0);

  // Load telemetry data from FastAPI PostgreSQL Backend.
  // Phase 11A: these endpoints are workspace-scoped server-side, so this must
  // only ever run for an authenticated session.
  const loadDataFromBackend = useCallback(async () => {
    setIsLoading(true);
    setBackendError(null);
    try {
      const [summaryRes, findingsRes] = await Promise.all([
        getSummary(),
        getFindings()
      ]);

      setSummary(summaryRes);
      setFindings(findingsRes.findings);
      setOverallRiskScore(summaryRes.overall_risk ?? summaryRes.overall_risk_score ?? 0);
      setBackendOnline(true);
      setBackendError(null);
    } catch (err: any) {
      console.warn('[Rakshak] Backend API connection failed:', err);
      setFindings([]);
      setSummary(null);
      setOverallRiskScore(0);

      if (err?.status === 401) {
        // 401 = authentication/session required; backend is reachable and online.
        setBackendOnline(true);
        setBackendError('Authentication required. Please sign in with GitHub.');
        setCurrentUser(null);
        setGitHubUser(null);
        setIsGithubConnected(false);
        setGitHubRepos([]);
        setSelectedGitHubRepo(null);
        setRepositories([]);
        setSelectedRepo(null);
      } else if (err?.status === 403) {
        setBackendOnline(true);
        setBackendError('Access denied: insufficient workspace permissions.');
      } else if (err?.status && err.status >= 500) {
        setBackendOnline(true);
        setBackendError(`Backend server error (HTTP ${err.status}).`);
      } else {
        const isHealthy = await checkBackendHealth();
        setBackendOnline(isHealthy);
        if (!isHealthy) {
          setBackendError('Unable to connect to the Rakshak backend.');
        } else {
          setBackendError('Failed to load telemetry data.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check GitHub Auth from GET /api/auth/me
  // Independent backend health check runs first so connectivity is never conflated with auth.
  const checkAuthStatus = useCallback(async () => {
    setIsAuthChecking(true);
    try {
      // 1. Independent backend connectivity check
      const isHealthy = await checkBackendHealth();
      setBackendOnline(isHealthy);

      if (!isHealthy) {
        setBackendError('Unable to connect to the Rakshak backend.');
        setCurrentUser(null);
        setGitHubUser(null);
        setIsGithubConnected(false);
        setGitHubRepos([]);
        setSelectedGitHubRepo(null);
        setRepositories([]);
        setSelectedRepo(null);
        setFindings([]);
        setSummary(null);
        setOverallRiskScore(0);
        setScanHistory([]);
        setSecrets([]);
        setReports([]);
        setAiHistory([]);
        return;
      }

      setBackendError(null);

      // 2. Resolve authentication status
      const authRes = await getAuthMe();
      if (authRes.authenticated && authRes.user) {
        setCurrentUser(authRes.user);
        setGitHubUser(authRes.github_user || null);
        const hasGithub = Boolean(authRes.github_connected);
        setIsGithubConnected(hasGithub);
        if (!hasGithub) {
          setGitHubRepos([]);
          setSelectedGitHubRepo(null);
          setRepositories([]);
          setSelectedRepo(null);
        }
        // Authenticated -> load workspace-scoped data
        await loadDataFromBackend();
      } else {
        // Unauthenticated session (valid state: backend is online, no user session)
        setCurrentUser(null);
        setGitHubUser(null);
        setIsGithubConnected(false);
        setGitHubRepos([]);
        setSelectedGitHubRepo(null);
        setRepositories([]);
        setSelectedRepo(null);
        setFindings([]);
        setSummary(null);
        setOverallRiskScore(0);
        setScanHistory([]);
        setSecrets([]);
        setReports([]);
        setAiHistory([]);
        setBackendOnline(true);
        setBackendError(null);
      }
    } catch (err: any) {
      if (err?.status === 401) {
        setCurrentUser(null);
        setGitHubUser(null);
        setIsGithubConnected(false);
        setGitHubRepos([]);
        setSelectedGitHubRepo(null);
        setRepositories([]);
        setSelectedRepo(null);
        setFindings([]);
        setSummary(null);
        setOverallRiskScore(0);
        setScanHistory([]);
        setSecrets([]);
        setReports([]);
        setAiHistory([]);
        setBackendOnline(true);
        setBackendError(null);
      } else {
        const isHealthy = await checkBackendHealth();
        setBackendOnline(isHealthy);
        setCurrentUser(null);
        setGitHubUser(null);
        setIsGithubConnected(false);
        setGitHubRepos([]);
        setSelectedGitHubRepo(null);
        setRepositories([]);
        setSelectedRepo(null);
        setFindings([]);
        setSummary(null);
        setOverallRiskScore(0);
        setScanHistory([]);
        setSecrets([]);
        setReports([]);
        setAiHistory([]);
        setBackendError(isHealthy ? null : 'Unable to connect to the Rakshak backend.');
      }
    } finally {
      setIsAuthChecking(false);
    }
  }, [loadDataFromBackend]);

  // Fetch GitHub Repositories from GET /api/github/repos
  const fetchGitHubRepos = useCallback(async () => {
    if (!isGithubConnected) {
      setGitHubRepos([]);
      setSelectedGitHubRepo(null);
      setRepositories([]);
      setSelectedRepo(null);
      setReposError(null);
      return;
    }
    setIsLoadingRepos(true);
    setReposError(null);
    try {
      const res = await getGitHubRepos();
      const fetchedRepos = res.repositories || [];
      const mapped = fetchedRepos.map(mapGitHubRepoToRepository);
      setGitHubRepos(fetchedRepos);
      setRepositories(mapped);

      if (fetchedRepos.length > 0) {
        setSelectedGitHubRepo(prev => {
          if (prev && fetchedRepos.some(r => r.owner === prev.owner && r.name === prev.name)) {
            return prev;
          }
          return fetchedRepos[0];
        });

        setSelectedRepo(prev => {
          if (prev && mapped.some(r => r.id === prev.id || (r.owner === prev.owner && r.name === prev.name))) {
            return prev;
          }
          return mapped[0];
        });
      } else {
        setSelectedGitHubRepo(null);
        setSelectedRepo(null);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to load GitHub repositories';
      if (err?.status === 401 || msg.includes('authentication required') || msg.includes('not connected')) {
        setIsGithubConnected(false);
        setGitHubRepos([]);
        setSelectedGitHubRepo(null);
        setRepositories([]);
        setSelectedRepo(null);
        setReposError(null);
      } else {
        setReposError(msg);
      }
    } finally {
      setIsLoadingRepos(false);
    }
  }, [isGithubConnected]);

  // Disconnect GitHub Account
  const disconnectGitHub = useCallback(async () => {
    try {
      await apiDisconnectGitHub();
    } catch (e) {
      console.warn('Disconnect API error:', e);
    } finally {
      setGitHubUser(null);
      setIsGithubConnected(false);
      setGitHubRepos([]);
      setSelectedGitHubRepo(null);
      setRepositories([]);
      setSelectedRepo(null);
      setReposError(null);
      await checkAuthStatus();
    }
  }, [checkAuthStatus]);

  // Logout Handler via POST /api/auth/logout
  const logout = useCallback(async () => {
    try {
      await logoutAuth();
    } catch (e) {
      console.warn('Logout API error:', e);
    } finally {
      setCurrentUser(null);
      setGitHubUser(null);
      setIsGithubConnected(false);
      setGitHubRepos([]);
      setSelectedGitHubRepo(null);
      setRepositories([]);
      setSelectedRepo(null);
      setReposError(null);
      setFindings([]);
      setSummary(null);
      setOverallRiskScore(0);
      setScanHistory([]);
      setSecrets([]);
      setReports([]);
      setAiHistory([]);
      setBackendOnline(false);
      setBackendError(null);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // When auth succeeds, fetch repositories automatically
  useEffect(() => {
    if (isGithubConnected) {
      fetchGitHubRepos();
    } else {
      setGitHubRepos([]);
      setSelectedGitHubRepo(null);
      setRepositories([]);
      setSelectedRepo(null);
    }
  }, [isGithubConnected, fetchGitHubRepos]);

  const refreshData = async () => {
    await checkAuthStatus();
  };

  const connectGithub = () => {
    checkAuthStatus();
  };

  const selectGitHubRepoByName = (owner: string, name: string) => {
    const found = gitHubRepos.find(r => r.owner === owner && r.name === name);
    if (found) {
      setSelectedGitHubRepo(found);
      const mappedFound = repositories.find(r => r.owner === owner && r.name === name);
      if (mappedFound) {
        setSelectedRepo(mappedFound);
      }
    }
  };

  const selectRepository = (repoId: string) => {
    const found = repositories.find(r => r.id === repoId || r.name === repoId);
    if (found) {
      setSelectedRepo(found);
      const matchingGh = gitHubRepos.find(r => String(r.id) === found.id || (r.owner === found.owner && r.name === found.name));
      if (matchingGh) {
        setSelectedGitHubRepo(matchingGh);
      }
    }
  };

  const addAIAnalysis = (analysis: Omit<AIAnalysisRecord, 'id' | 'analyzedOn'>): AIAnalysisRecord => {
    const newRecord: AIAnalysisRecord = {
      ...analysis,
      id: `ai-${Date.now()}`,
      analyzedOn: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    setAiHistory(prev => [newRecord, ...prev]);
    return newRecord;
  };

  const addReport = (rep: Omit<SecurityReport, 'id' | 'generatedOn'>): SecurityReport => {
    const newReport: SecurityReport = {
      ...rep,
      id: `rep-${Date.now()}`,
      generatedOn: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    setReports(prev => [newReport, ...prev]);
    return newReport;
  };

  const deleteReport = (reportId: string) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
  };

  const resolveFinding = (findingId: string) => {
    setFindings(prev => prev.map(f => f.id === findingId ? { ...f, status: 'Resolved' } : f));
  };

  const resolveSecret = (secretId: string) => {
    setSecrets(prev => prev.map(s => s.id === secretId ? { ...s, status: 'Resolved' } : s));
  };

  const addScanResult = (scan: any) => {
    if (scan.findings && scan.findings.length > 0) {
      setFindings(prev => [...scan.findings, ...prev]);
    }
    if (scan.secrets && scan.secrets.length > 0) {
      setSecrets(prev => [...scan.secrets, ...prev]);
    }
    const newScan: ScanItem = {
      id: `scan-${Date.now()}`,
      scanId: scan.scanId || `Scan #${scanHistory.length + 1}`,
      date: new Date().toLocaleString(),
      repo: scan.repoName || (selectedGitHubRepo ? `${selectedGitHubRepo.owner}/${selectedGitHubRepo.name}` : (selectedRepo?.name || 'Local Scan')),
      duration: scan.duration || '1.2s',
      findingsCount: scan.findings ? scan.findings.length : 0,
      prioritizedCount: (scan.critical || 0) + (scan.high || 0),
      riskScore: scan.score || scan.overall_risk || scan.overall_risk_score || 0,
      status: 'Completed'
    };
    setScanHistory(prev => [newScan, ...prev]);
  };

  const updateScanFindings = (newFindings: Finding[], scanSummary?: Partial<ApiSummaryResponse>) => {
    setFindings(newFindings);
    setBackendOnline(true);
    setBackendError(null);

    if (scanSummary) {
      const summaryObj: ApiSummaryResponse = {
        total_findings: scanSummary.total_findings ?? newFindings.length,
        critical: scanSummary.critical ?? newFindings.filter(f => f.severity === 'critical').length,
        high: scanSummary.high ?? newFindings.filter(f => f.severity === 'high').length,
        medium: scanSummary.medium ?? newFindings.filter(f => f.severity === 'medium').length,
        low: scanSummary.low ?? newFindings.filter(f => f.severity === 'low').length,
        overall_risk_score: scanSummary.overall_risk_score ?? scanSummary.overall_risk ?? 0,
        overall_risk: scanSummary.overall_risk ?? scanSummary.overall_risk_score ?? 0,
      };
      setSummary(summaryObj);
      setOverallRiskScore(summaryObj.overall_risk ?? summaryObj.overall_risk_score ?? 0);
    } else {
      const crit = newFindings.filter(f => f.severity === 'critical').length;
      const high = newFindings.filter(f => f.severity === 'high').length;
      const med = newFindings.filter(f => f.severity === 'medium').length;
      const low = newFindings.filter(f => f.severity === 'low').length;
      const score = newFindings.length > 0
        ? Math.round(newFindings.reduce((acc, curr) => acc + (curr.riskScore || 0), 0) / newFindings.length)
        : 0;

      const summaryObj: ApiSummaryResponse = {
        total_findings: newFindings.length,
        critical: crit,
        high: high,
        medium: med,
        low: low,
        overall_risk_score: score,
        overall_risk: score,
      };
      setSummary(summaryObj);
      setOverallRiskScore(score);
    }
  };

  return (
    <SecurityContext.Provider value={{
      findings,
      summary,
      isLoading,
      backendOnline,
      backendError,
      currentUser,
      gitHubUser,
      isAuthChecking,
      checkAuthStatus,
      logout,
      disconnectGitHub,
      gitHubRepos,
      isLoadingRepos,
      reposError,
      fetchGitHubRepos,
      selectedGitHubRepo,
      setSelectedGitHubRepo,
      selectGitHubRepoByName,
      secrets,
      scanHistory,
      reports,
      aiHistory,
      repositories,
      selectedRepo,
      isGithubConnected,
      overallRiskScore,
      refreshData,
      connectGithub,
      selectRepository,
      addAIAnalysis,
      addReport,
      deleteReport,
      resolveFinding,
      resolveSecret,
      addScanResult,
      updateScanFindings
    }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
