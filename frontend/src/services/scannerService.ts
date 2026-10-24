import type { FindingItem, SecretItem } from '@/context/SecurityContext';
import { performScan, type ApiScanRequest } from '@/services/api';

/**
 * Scanner service.
 *
 * This module used to POST FormData to /api/scan without `credentials`, which
 * the session-cookie backend could never accept, and then silently fell back to
 * a client-side "scanner" that fabricated findings, secrets and AI text. Those
 * results looked real but described nothing that was ever scanned.
 *
 * It now calls the real backend through the shared API client: JSON body,
 * `credentials: 'include'`, real findings, and a thrown error when the scan
 * fails. There is no fabricated fallback anywhere in the product UI.
 *
 * Note: the backend scans a PATH on the machine running Rakshak
 * (POST /api/scan takes `target_path`). It has no endpoint that accepts pasted
 * source text or uploaded files, so callers must supply a target path.
 */

export interface CodeScanRequest {
  /** Path the backend should scan, e.g. "." for the configured scan root. */
  targetPath?: string;
  codeScanning?: boolean;
  dependencyScanning?: boolean;
  secretDetection?: boolean;
  containerScanning?: boolean;
  /** Retained for display only — never sent, the backend scans paths. */
  language?: string;
  projectName?: string;
}

export interface CodeScanResponse {
  scanId: string;
  targetPath: string;
  score: number;
  riskLevel: 'EXCELLENT' | 'GOOD' | 'MODERATE RISK' | 'HIGH RISK' | 'CRITICAL RISK';
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  secretsCount: number;
  vulnerableDependenciesCount: number;
  findings: FindingItem[];
  secrets: SecretItem[];
}

function riskLevelFor(score: number): CodeScanResponse['riskLevel'] {
  if (score >= 85) return 'CRITICAL RISK';
  if (score >= 70) return 'HIGH RISK';
  if (score >= 40) return 'MODERATE RISK';
  if (score >= 20) return 'GOOD';
  return 'EXCELLENT';
}

/**
 * Run a real backend security scan.
 *
 * Throws on any backend/authentication failure — callers must surface the
 * error rather than display invented results.
 */
export async function performSecurityScan(req: CodeScanRequest): Promise<CodeScanResponse> {
  const targetPath = (req.targetPath || '').trim();

  if (!targetPath) {
    throw new Error(
      'A scan target path is required. Enter the path Rakshak should scan (for example ".").'
    );
  }

  const payload: ApiScanRequest = {
    target_path: targetPath,
    code_scanning: req.codeScanning !== false,
    dependency_scanning: req.dependencyScanning !== false,
    secret_detection: req.secretDetection !== false,
    container_scanning: req.containerScanning === true,
  };

  const data = await performScan(payload);
  const findings = data.mappedFindings;
  const score = data.overall_risk ?? data.overall_risk_score ?? 0;

  // Secrets are the subset of findings produced by the secret scanner. They are
  // derived from real backend findings; nothing is invented, and secret values
  // are never reconstructed client-side (the backend redacts them).
  const secrets: SecretItem[] = findings
    .filter((finding) => finding.tool === 'Secret Detection')
    .map((finding, idx) => ({
      id: `${data.scan_id}-secret-${idx}`,
      type: finding.cve || 'Secret',
      maskedSecret: 'Redacted by Rakshak',
      rawSecret: '',
      filePath: finding.affectedFiles[0] || '',
      line: finding.lineNumber ?? 0,
      confidence: 'HIGH',
      status: finding.status,
      timestamp: new Date().toLocaleString(),
      repo: targetPath,
    }));

  return {
    scanId: data.scan_id,
    targetPath: data.target_path || targetPath,
    score,
    riskLevel: riskLevelFor(score),
    totalFindings: data.total_findings ?? findings.length,
    criticalCount: data.critical ?? 0,
    highCount: data.high ?? 0,
    mediumCount: data.medium ?? 0,
    lowCount: data.low ?? 0,
    secretsCount: secrets.length,
    vulnerableDependenciesCount: findings.filter((f) => f.tool === 'Trivy SCA').length,
    findings,
    secrets,
  };
}
