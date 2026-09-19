export interface Finding {
  id: string;
  vulnerabilityId?: string;
  cve: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  riskScore: number;
  exploitability: string;
  tool: string;
  package: string;
  version?: string;
  fixedVersion: string;
  productionStatus?: 'Yes' | 'No';
  status: 'Active' | 'Fix Available' | 'Resolved' | 'Ignored';
  affectedFiles: string[];
  lineNumber?: number;
  cvssScore?: number;
  recommendedFix?: string;
  codeSnippet?: string;
  aiExplanation?: string;
  potentialImpact?: string;
  recommendedAction?: string;
  riskSummary?: string;
  lifecycleStatus?: 'new' | 'open' | 'fixed' | 'reopened';
  occurrenceCount?: number;
}

export const mockFindings: Finding[] = [];
export const allMockFindings: Finding[] = [];
