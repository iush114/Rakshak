import { type Finding } from '@/data/findings';

// FastAPI Backend URL configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export interface ApiSummaryResponse {
  total_findings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  overall_risk_score: number;
}

export interface BackendFinding {
  vulnerability_id: string;
  title: string;
  description?: string;
  severity: string;
  priority: string;
  risk_score: number;
  tool: string;
  target?: string;
  affected_packages?: string[];
  affected_package_count?: number;
  fixed_version?: string;
  fix_available?: boolean;
  exploitability?: number | string;
  production?: boolean;
  ai_explanation?: string;
  potential_impact?: string;
  recommended_action?: string;
  risk_summary?: string;
}

export interface ApiFindingsResponse {
  total: number;
  findings: BackendFinding[];
}

export interface ApiScanRequest {
  code_scanning: boolean;
  dependency_scanning: boolean;
  secret_detection: boolean;
  container_scanning: boolean;
}

export interface ApiScanResponse {
  scan_id: string;
  selected_scans: {
    code_scanning: boolean;
    dependency_scanning: boolean;
    secret_detection: boolean;
    container_scanning: boolean;
  };
  status: string;
  findings?: BackendFinding[];
  total_findings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  overall_risk_score: number;
  errors?: Array<{ scanner: string; message: string }>;
}

export interface AIAnalysisResult {
  explanation: string;
  potentialImpact: string;
  recommendedAction: string;
  riskSummary: string;
}

/**
 * Format scanner tool name for presentation
 */
function normalizeToolName(tool?: string): string {
  if (!tool) return 'Trivy SCA';
  const t = tool.toLowerCase();
  if (t.includes('gitleaks') || t.includes('secret')) return 'Secret Detection';
  if (t.includes('container') || t.includes('docker') || t.includes('image')) return 'Container Scan';
  if (t.includes('code') || t.includes('ast') || t.includes('bandit')) return 'Code Scanner';
  if (t.includes('trivy')) return 'Trivy SCA';
  return tool;
}

/**
 * Convert backend finding data structure to frontend Finding model
 */
export function mapBackendFindingToFrontend(bf: BackendFinding, index: number = 0): Finding {
  const sevLower = (bf.severity || 'low').toLowerCase();
  const validSeverity: Finding['severity'] = 
    sevLower === 'critical' || sevLower === 'high' || sevLower === 'medium' ? sevLower : 'low';

  const prioUpper = (bf.priority || 'Low').toLowerCase();
  const validPriority: Finding['priority'] =
    prioUpper === 'critical' ? 'Critical' :
    prioUpper === 'high' ? 'High' :
    prioUpper === 'medium' ? 'Medium' : 'Low';

  const packageNames = bf.affected_packages && bf.affected_packages.length > 0 
    ? bf.affected_packages.join(', ')
    : (bf.target || 'General Package');

  const files = bf.target ? [bf.target] : (bf.affected_packages && bf.affected_packages.length > 0 ? bf.affected_packages : []);

  const hasFix = Boolean(bf.fix_available || (bf.fixed_version && bf.fixed_version.trim() !== '' && bf.fixed_version.toLowerCase() !== 'no fix available'));

  return {
    id: bf.vulnerability_id ? `f-${bf.vulnerability_id}-${index}` : `f-${index}-${Date.now()}`,
    cve: bf.vulnerability_id || 'UNKNOWN',
    title: bf.title || 'Security Vulnerability Finding',
    description: bf.description || bf.title || 'No detailed description provided.',
    severity: validSeverity,
    priority: validPriority,
    riskScore: typeof bf.risk_score === 'number' ? bf.risk_score : 0,
    exploitability: bf.exploitability !== undefined ? String(bf.exploitability) : '0.50',
    tool: normalizeToolName(bf.tool),
    package: packageNames,
    fixedVersion: bf.fixed_version && bf.fixed_version.trim() !== '' ? bf.fixed_version : (hasFix ? 'Fix Available' : 'No fix available'),
    productionStatus: bf.production !== false ? 'Yes' : 'No',
    status: hasFix ? 'Fix Available' : 'Active',
    affectedFiles: files,
    aiExplanation: bf.ai_explanation,
    potentialImpact: bf.potential_impact,
    recommendedAction: bf.recommended_action,
    riskSummary: bf.risk_summary,
    recommendedFix: bf.recommended_action || (hasFix ? `Upgrade ${packageNames} to ${bf.fixed_version || 'latest patch'}.` : undefined),
  };
}

/**
 * Fetch summary statistics from GET /api/summary
 */
export async function getSummary(): Promise<ApiSummaryResponse> {
  const res = await fetch(`${API_BASE_URL}/summary`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch summary: HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch findings from GET /api/findings with optional filters
 */
export async function getFindings(filters?: {
  severity?: string;
  priority?: string;
  tool?: string;
  search?: string;
}): Promise<{ total: number; findings: Finding[] }> {
  const url = new URL(`${API_BASE_URL}/findings`);
  if (filters?.severity && filters.severity !== 'all') {
    url.searchParams.set('severity', filters.severity);
  }
  if (filters?.priority && filters.priority !== 'all') {
    url.searchParams.set('priority', filters.priority);
  }
  if (filters?.tool && filters.tool !== 'all') {
    url.searchParams.set('tool', filters.tool);
  }
  if (filters?.search && filters.search.trim()) {
    url.searchParams.set('search', filters.search.trim());
  }

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch findings: HTTP ${res.status} ${res.statusText}`);
  }

  const data: ApiFindingsResponse = await res.json();
  const mappedFindings = (data.findings || []).map((bf, idx) => mapBackendFindingToFrontend(bf, idx));

  return {
    total: data.total ?? mappedFindings.length,
    findings: mappedFindings,
  };
}

/**
 * Fetch a single finding by vulnerability_id from GET /api/findings/{vulnerability_id}
 */
export async function getFindingDetail(vulnerabilityId: string): Promise<Finding> {
  const res = await fetch(`${API_BASE_URL}/findings/${encodeURIComponent(vulnerabilityId)}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch finding ${vulnerabilityId}: HTTP ${res.status}`);
  }
  const data: BackendFinding = await res.json();
  return mapBackendFindingToFrontend(data, 0);
}

/**
 * Trigger AI analysis for a single finding via GET /api/findings/{vulnerability_id}/analyze
 */
export async function analyzeFindingWithAI(vulnerabilityId: string): Promise<AIAnalysisResult & { fullFinding: Finding }> {
  const res = await fetch(`${API_BASE_URL}/findings/${encodeURIComponent(vulnerabilityId)}/analyze`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`AI Analysis failed for ${vulnerabilityId}: HTTP ${res.status} ${res.statusText}`);
  }
  const data: BackendFinding = await res.json();
  const fullFinding = mapBackendFindingToFrontend(data, 0);

  return {
    explanation: data.ai_explanation || 'AI analysis completed.',
    potentialImpact: data.potential_impact || 'No specific exploit impact specified.',
    recommendedAction: data.recommended_action || 'Follow standard vendor remediation.',
    riskSummary: data.risk_summary || `${data.priority || 'Standard'} priority threat vector.`,
    fullFinding,
  };
}

/**
 * Execute orchestrated security scan via POST /api/scan
 */
export async function performScan(req: ApiScanRequest): Promise<ApiScanResponse & { mappedFindings: Finding[] }> {
  const res = await fetch(`${API_BASE_URL}/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Scan orchestration failed: HTTP ${res.status} - ${errorText || res.statusText}`);
  }

  const data: ApiScanResponse = await res.json();
  const mappedFindings = (data.findings || []).map((bf, idx) => mapBackendFindingToFrontend(bf, idx));

  return {
    ...data,
    mappedFindings,
  };
}

/**
 * Health check to verify FastAPI connection
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL.replace('/api', '')}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
