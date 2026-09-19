import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { type Finding } from '@/data/findings';
import { mockReports, type SecurityReport } from '@/data/reports';
import { mockAIAnalysisHistory, type AIAnalysisRecord } from '@/data/aiAnalysisHistory';
import { mockRepositories, type Repository } from '@/data/repositories';
import {
  getSummary,
  getFindings,
  getAuthMe,
  logoutAuth,
  getGitHubRepos,
  type ApiSummaryResponse,
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

interface SecurityContextType {
  findings: Finding[];
  summary: ApiSummaryResponse | null;
  isLoading: boolean;
  backendOnline: boolean;
  backendError: string | null;
  currentUser: GitHubUser | null;
  isAuthChecking: boolean;
  checkAuthStatus: () => Promise<void>;
  logout: () => Promise<void>;
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
  selectedRepo: Repository;
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
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // GitHub Repositories State
  const [gitHubRepos, setGitHubRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState<GitHubRepo | null>(null);

  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [scanHistory, setScanHistory] = useState<ScanItem[]>([]);
  const [reports, setReports] = useState<SecurityReport[]>(mockReports);
  const [aiHistory, setAiHistory] = useState<AIAnalysisRecord[]>(mockAIAnalysisHistory);
  const [repositories] = useState<Repository[]>(mockRepositories);
  const [selectedRepo, setSelectedRepo] = useState<Repository>(mockRepositories[0]);
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
        // 401 = authentication/session failure, NOT an empty workspace.
        setBackendOnline(false);
        setBackendError('Session expired. Please sign in with GitHub again.');
        setCurrentUser(null);
        setIsGithubConnected(false);
      } else {
        setBackendOnline(false);
        setBackendError('Unable to connect to the Rakshak backend.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check GitHub Auth from GET /api/auth/me
  // Phase 11A: workspace data is loaded ONLY after authentication succeeds.
  // Unauthenticated users never trigger protected data requests, and 401s are
  // treated as session failures (not as an empty/global dataset).
  const checkAuthStatus = useCallback(async () => {
    setIsAuthChecking(true);
    try {
      const authRes = await getAuthMe();
      if (authRes.authenticated && authRes.user) {
        setCurrentUser(authRes.user);
        setIsGithubConnected(true);
        // Authenticated -> load workspace-scoped data (backend enforces scoping)
        await loadDataFromBackend();
      } else {
        setCurrentUser(null);
        setIsGithubConnected(false);
        // No session -> clear any stale protected data from state
        setFindings([]);
        setSummary(null);
        setOverallRiskScore(0);
        setBackendOnline(false);
        setBackendError(null);
      }
    } catch {
      setCurrentUser(null);
      setIsGithubConnected(false);
      setFindings([]);
      setSummary(null);
      setBackendOnline(false);
      setBackendError(null);
    } finally {
      setIsAuthChecking(false);
    }
  }, [loadDataFromBackend]);

  // Fetch GitHub Repositories from GET /api/github/repos
  const fetchGitHubRepos = useCallback(async () => {
    setIsLoadingRepos(true);
    setReposError(null);
    try {
      const res = await getGitHubRepos();
      setGitHubRepos(res.repositories || []);
      if (res.repositories && res.repositories.length > 0) {
        setSelectedGitHubRepo(prev => prev || res.repositories[0]);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to load GitHub repositories';
      setReposError(msg);
      if (msg.includes('authentication required')) {
        setIsGithubConnected(false);
        setCurrentUser(null);
      }
    } finally {
      setIsLoadingRepos(false);
    }
  }, []);

  // Logout Handler via POST /api/auth/logout
  const logout = useCallback(async () => {
    try {
      await logoutAuth();
    } catch (e) {
      console.warn('Logout API error:', e);
    } finally {
      setCurrentUser(null);
      setIsGithubConnected(false);
      setGitHubRepos([]);
      setSelectedGitHubRepo(null);
    }
  }, []);

  // Phase 11A: mount effect only checks authentication. Protected workspace
  // data (summary/findings) is fetched exclusively after auth succeeds inside
  // checkAuthStatus(); GitHub repositories load via the isGithubConnected
  // effect below. No global/unauthenticated data fetches.
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // When auth succeeds, fetch repositories automatically
  useEffect(() => {
    if (isGithubConnected) {
      fetchGitHubRepos();
    }
  }, [isGithubConnected, fetchGitHubRepos]);

  const refreshData = async () => {
    await loadDataFromBackend();
  };

  const connectGithub = () => {
    setIsGithubConnected(true);
    checkAuthStatus();
    fetchGitHubRepos();
  };

  const selectGitHubRepoByName = (owner: string, name: string) => {
    const found = gitHubRepos.find(r => r.owner === owner && r.name === name);
    if (found) {
      setSelectedGitHubRepo(found);
    }
  };

  const selectRepository = (repoId: string) => {
    const found = repositories.find(r => r.id === repoId || r.name === repoId);
    if (found) {
      setSelectedRepo(found);
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
      repo: scan.repoName || (selectedGitHubRepo ? `${selectedGitHubRepo.owner}/${selectedGitHubRepo.name}` : selectedRepo.name),
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
      isAuthChecking,
      checkAuthStatus,
      logout,
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
