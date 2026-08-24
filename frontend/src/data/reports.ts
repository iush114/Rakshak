export interface SecurityReport {
  id: string;
  name: string;
  type: string;
  generatedOn: string;
  totalFindings: number;
  riskScore: number;
  status: 'Completed' | 'Processing' | 'Failed';
  actions: string[];
  size?: string;
  format?: string;
}

export const mockReports: SecurityReport[] = [
  {
    id: 'rep-1',
    name: 'Security Report — May 19, 2025',
    type: 'Full Report',
    generatedOn: '19 May 2025',
    totalFindings: 77,
    riskScore: 36,
    status: 'Completed',
    actions: ['View', 'Download', 'Delete'],
    size: '3.2 MB',
    format: 'PDF'
  },
  {
    id: 'rep-2',
    name: 'Executive Security Summary',
    type: 'Executive Summary',
    generatedOn: '15 May 2025',
    totalFindings: 77,
    riskScore: 36,
    status: 'Completed',
    actions: ['View', 'Download', 'Delete'],
    size: '1.8 MB',
    format: 'PDF'
  },
  {
    id: 'rep-3',
    name: 'Container & Dependency Audit',
    type: 'Dependency Report',
    generatedOn: '10 May 2025',
    totalFindings: 41,
    riskScore: 28,
    status: 'Completed',
    actions: ['View', 'Download', 'Delete'],
    size: '2.4 MB',
    format: 'PDF'
  },
  {
    id: 'rep-4',
    name: 'Gitleaks Secrets Incident Audit',
    type: 'Secret Detection Report',
    generatedOn: '05 May 2025',
    totalFindings: 12,
    riskScore: 18,
    status: 'Completed',
    actions: ['View', 'Download', 'Delete'],
    size: '1.2 MB',
    format: 'PDF'
  }
];
