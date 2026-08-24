export interface AIAnalysisRecord {
  id: string;
  cve: string;
  title: string;
  analyzedOn: string;
  riskScore: number;
  aiModel: string;
  explanation: string;
  potentialImpact: string;
  recommendedAction: string;
  riskSummary: string;
}

export const mockAIAnalysisHistory: AIAnalysisRecord[] = [
  {
    id: 'ai-1',
    cve: 'CVE-2026-54371',
    title: 'attr: Symlink Traversal Privilege Escalation via getfattr and setfattr',
    analyzedOn: '19 May 2025',
    riskScore: 42,
    aiModel: 'Rakshak AI',
    explanation: 'Symlink traversal vulnerability in attr tools (getfattr, setfattr) allows local unprivileged users to execute attribute modifications across symlinked paths.',
    potentialImpact: 'Local privilege escalation, arbitrary extended attribute manipulation on system configuration files, and potential host restriction bypass.',
    recommendedAction: 'Apply kernel symlink traversal protections (fs.protected_symlinks=1), restrict binary permissions on setfattr, and sanitize target paths.',
    riskSummary: 'Moderate risk local privilege escalation vector.'
  },
  {
    id: 'ai-2',
    cve: 'CVE-2024-3094',
    title: 'xz-utils: Backdoor Infiltration in liblzma Build Scripts',
    analyzedOn: '18 May 2025',
    riskScore: 98,
    aiModel: 'Rakshak AI',
    explanation: 'Catastrophic supply-chain backdoor injected into upstream build scripts affecting OpenSSH daemon authentication routines.',
    potentialImpact: 'Unauthenticated remote code execution (RCE) and root server takeover across Linux deployments.',
    recommendedAction: 'Downgrade xz-utils package to version 5.4.x immediately or rebuild image with clean distro package 5.6.1-r1.',
    riskSummary: 'Critical severity vulnerability with active weaponized exploits.'
  },
  {
    id: 'ai-3',
    cve: 'CVE-2024-21626',
    title: 'runc: Container Breakout via File Descriptor Leak',
    analyzedOn: '15 May 2025',
    riskScore: 94,
    aiModel: 'Rakshak AI',
    explanation: 'Container breakout flaw where leaked host file descriptors allow an attacker inside a container to inspect and mutate the host filesystem during startup.',
    potentialImpact: 'Host node compromise, Kubernetes pod escape, and multi-tenant isolation failure.',
    recommendedAction: 'Upgrade container runtime package runc to version 1.1.12 or higher on all cluster worker nodes.',
    riskSummary: 'Critical container security boundary breach.'
  },
  {
    id: 'ai-4',
    cve: 'CVE-2023-44487',
    title: 'nghttp2: HTTP/2 Rapid Reset Denial of Service',
    analyzedOn: '12 May 2025',
    riskScore: 88,
    aiModel: 'Rakshak AI',
    explanation: 'Protocol-level DDoS exploit abusing HTTP/2 RST_STREAM frames to saturate web server CPU threads.',
    potentialImpact: 'Service downtime, API unavailability, and resource starvation.',
    recommendedAction: 'Enforce RST_STREAM rate limits in reverse proxy layer (Nginx/HAProxy) and update nghttp2.',
    riskSummary: 'High availability impact.'
  }
];
