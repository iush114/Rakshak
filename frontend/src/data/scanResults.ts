export interface ScanStep {
  id: number;
  label: string;
  subtext?: string;
}

export interface ScanStatCounter {
  filesScanned: number;
  dependenciesChecked: number;
  secretsChecked: number;
  vulnerabilitiesFound: number | string;
}

export interface RecentScanRecord {
  id: string;
  repository: string;
  branch: string;
  findingsCount: number;
  riskScore: number;
  riskLabel: string;
  date: string;
  duration: string;
}

export const SCAN_ANIMATED_STEPS: ScanStep[] = [
  { id: 1, label: 'Repository Connected', subtext: 'Established secure link with GitHub API' },
  { id: 2, label: 'Source Code Analysis', subtext: 'Scanning AST for SAST vulnerabilities & insecure patterns' },
  { id: 3, label: 'Dependency Analysis', subtext: 'Auditing third-party packages & CVE databases' },
  { id: 4, label: 'Secret Detection', subtext: 'Searching for exposed API keys, SSH keys & tokens' },
  { id: 5, label: 'Container Security', subtext: 'Inspecting Dockerfile, manifests & image layers' },
  { id: 6, label: 'Vulnerability Correlation', subtext: 'Aggregating CVE severity & exploitability vectors' },
  { id: 7, label: 'Risk Calculation', subtext: 'Computing overall security posture score' },
  { id: 8, label: 'AI Security Analysis', subtext: 'Generating AI remediation insights' }
];

export const INITIAL_RECENT_SCANS: RecentScanRecord[] = [
  {
    id: 'scan-101',
    repository: 'rakshak-security',
    branch: 'main',
    findingsCount: 77,
    riskScore: 36,
    riskLabel: 'Medium Risk',
    date: 'Today, 15:42',
    duration: '24 seconds'
  },
  {
    id: 'scan-100',
    repository: 'devsecops-demo',
    branch: 'main',
    findingsCount: 24,
    riskScore: 18,
    riskLabel: 'Low Risk',
    date: 'Yesterday, 18:10',
    duration: '18 seconds'
  },
  {
    id: 'scan-099',
    repository: 'ecommerce-app',
    branch: 'main',
    findingsCount: 45,
    riskScore: 52,
    riskLabel: 'High Risk',
    date: '20 Aug 2026',
    duration: '31 seconds'
  }
];

export const DEFAULT_SCAN_RESULTS = {
  scanDuration: '24 seconds',
  totalFindings: 77,
  severityBreakdown: {
    critical: 4,
    high: 8,
    medium: 29,
    low: 36
  },
  riskScore: 36,
  riskCategory: 'Medium Risk',
  filesScanned: 128,
  dependenciesChecked: 47,
  secretsChecked: 128
};
