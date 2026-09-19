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

export const mockReports: SecurityReport[] = [];
