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

export const INITIAL_RECENT_SCANS: RecentScanRecord[] = [];

export const DEFAULT_SCAN_RESULTS = {
  scanDuration: '0.0s',
  totalFindings: 0,
  severityBreakdown: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  },
  riskScore: 0,
  riskCategory: 'Low Risk',
  filesScanned: 0,
  dependenciesChecked: 0,
  secretsChecked: 0
};
