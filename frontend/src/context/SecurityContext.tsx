import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { allMockFindings, type Finding } from '@/data/findings';
import { mockReports, type SecurityReport } from '@/data/reports';
import { mockAIAnalysisHistory, type AIAnalysisRecord } from '@/data/aiAnalysisHistory';
import { mockRepositories, type Repository } from '@/data/repositories';
import { getSummary, getFindings, type ApiSummaryResponse } from '@/services/api';

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

const initialSecrets: SecretItem[] = [
  {
    id: 'sec-1',
    type: 'AWS_ACCESS_KEY_ID',
    maskedSecret: 'EXAMPLE_AWS_KEY_*******',
    rawSecret: 'EXAMPLE_AWS_KEY_REDACTED',
    filePath: 'config/.env',
    line: 12,
    confidence: 'HIGH',
    status: 'Active',
    timestamp: '12 Aug 2026, 14:32',
    repo: 'backend-api'
  },
  {
    id: 'sec-2',
    type: 'STRIPE_SECRET_KEY',
    maskedSecret: 'EXAMPLE_STRIPE_SECRET_*******',
    rawSecret: 'EXAMPLE_STRIPE_SECRET_REDACTED',
    filePath: 'services/payment.ts',
    line: 45,
    confidence: 'HIGH',
    status: 'Active',
    timestamp: '11 Aug 2026, 18:10',
    repo: 'payment-gateway'
  }
];

const initialScanHistory: ScanItem[] = [
  {
    id: 's-104',
    scanId: 'Scan #104',
    date: '19 May 2025, 18:45',
    repo: 'rakshak-security',
    duration: '42s',
    findingsCount: 77,
    prioritizedCount: 32,
    riskScore: 36,
    status: 'Passed',
    criticalCount: 4,
    highCount: 8,
    mediumCount: 29,
    lowCount: 36,
    secretsCount: 2
  }
];

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [summary, setSummary] = useState<ApiSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const [secrets, setSecrets] = useState<SecretItem[]>(initialSecrets);
  const [scanHistory, setScanHistory] = useState<ScanItem[]>(initialScanHistory);
  const [reports, setReports] = useState<SecurityReport[]>(mockReports);
  const [aiHistory, setAiHistory] = useState<AIAnalysisRecord[]>(mockAIAnalysisHistory);
  const [repositories] = useState<Repository[]>(mockRepositories);
  const [selectedRepo, setSelectedRepo] = useState<Repository>(mockRepositories[0]);
  const [isGithubConnected, setIsGithubConnected] = useState<boolean>(true);
  const [overallRiskScore, setOverallRiskScore] = useState<number>(36);

  const loadDataFromBackend = useCallback(async () => {
    setIsLoading(true);
    setBackendError(null);
    try {
      // Fetch summary and findings in parallel
      const [summaryRes, findingsRes] = await Promise.all([
        getSummary(),
        getFindings()
      ]);

      setSummary(summaryRes);
      setFindings(findingsRes.findings);
      setOverallRiskScore(summaryRes.overall_risk_score ?? 36);
      setBackendOnline(true);
    } catch (err: any) {
      console.warn('[Rakshak] Backend API unavailable or connection failed:', err);
      setBackendOnline(false);
      setBackendError(err.message || 'Unable to connect to FastAPI backend at http://127.0.0.1:8000');
      // If backend fails, fallback to local dataset so UI remains interactive
      setFindings(allMockFindings);
      setOverallRiskScore(36);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDataFromBackend();
  }, [loadDataFromBackend]);

  const refreshData = async () => {
    await loadDataFromBackend();
  };

  const connectGithub = () => {
    setIsGithubConnected(true);
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
      repo: scan.repoName || selectedRepo.name,
      duration: scan.duration || '1.2s',
      findingsCount: scan.findings ? scan.findings.length : 0,
      prioritizedCount: 12,
      riskScore: scan.score || 36,
      status: 'Passed'
    };
    setScanHistory(prev => [newScan, ...prev]);
  };

  const updateScanFindings = (newFindings: Finding[], scanSummary?: Partial<ApiSummaryResponse>) => {
    setFindings(newFindings);
    if (scanSummary && scanSummary.overall_risk_score !== undefined) {
      setOverallRiskScore(scanSummary.overall_risk_score);
      if (summary) {
        setSummary(prev => prev ? ({ ...prev, ...scanSummary }) : null);
      }
    } else {
      const crit = newFindings.filter(f => f.severity === 'critical').length;
      const high = newFindings.filter(f => f.severity === 'high').length;
      const score = Math.max(10, Math.min(95, 30 + crit * 10 + high * 4));
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
