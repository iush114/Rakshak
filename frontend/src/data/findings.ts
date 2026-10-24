export interface Finding {
  id: string;
  /** Exact backend Finding.id. The same vulnerabilityId occurs in many files,
   *  so this is what identifies a single finding for AI analysis. */
  backendId?: number;
  scanId?: string;
  target?: string;
  vulnerabilityId?: string;
  cve: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  riskScore: number;
  exploitability: string;
  tool: string;
  scannerType?: string;
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
