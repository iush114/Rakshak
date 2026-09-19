import { formatNumber } from '@/utils/formatters';
import { useState } from 'react';
import { 
  ShieldCheck, 
  Save, 
  CheckCircle,
  Sliders,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PolicyItem {
  id: string;
  category: 'Container Security' | 'Dependency Security' | 'Secrets Detection' | 'CI/CD Enforcement' | 'Kubernetes Security';
  name: string;
  description: string;
  enabled: boolean;
  cvssThreshold: number;
  rules: string[];
}

const DEFAULT_POLICIES: PolicyItem[] = [
  {
    id: 'pol-1',
    category: 'Container Security',
    name: 'Container Image Hardening Policy',
    description: 'Enforces vulnerability thresholds & signing verification during container build stage.',
    enabled: true,
    cvssThreshold: 8.0,
    rules: [
      'Block CRITICAL vulnerabilities automatically',
      'Require Docker Cosign image signature',
      'Fail build on HIGH CVSS > 8.0'
    ]
  },
  {
    id: 'pol-2',
    category: 'Secrets Detection',
    name: 'Zero Secret Commit Policy',
    description: 'Prevents hardcoded API tokens, private keys, or credentials from entering git history.',
    enabled: true,
    cvssThreshold: 7.0,
    rules: [
      'Block commit if Gitleaks detects HIGH confidence secret',
      'Mask secret strings in CI/CD pipeline build logs',
      'Notify security team on Slack / Email immediately'
    ]
  },
  {
    id: 'pol-3',
    category: 'Dependency Security',
    name: 'SCA Supply Chain Policy',
    description: 'Inspects third-party package managers (npm, pip, cargo) for malicious or abandoned modules.',
    enabled: true,
    cvssThreshold: 7.5,
    rules: [
      'Disallow dependencies with unpatched remote code execution',
      'Enforce license compliance (GPL/AGPL restriction flags)',
      'Alert on typosquatting package names'
    ]
  },
  {
    id: 'pol-4',
    category: 'Kubernetes Security',
    name: 'Pod Security Standards (PSS)',
    description: 'Enforces privileged container execution restrictions across target K8s namespaces.',
    enabled: false,
    cvssThreshold: 9.0,
    rules: [
      'Disallow root container execution (runAsNonRoot)',
      'Restrict host network & IPC namespace access',
      'Require read-only root filesystems'
    ]
  }
];

export default function Policies() {
  const [policies, setPolicies] = useState<PolicyItem[]>(DEFAULT_POLICIES);
  const [savedToast, setSavedToast] = useState(false);

  const togglePolicy = (id: string) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const updateThreshold = (id: string, newVal: number) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, cvssThreshold: newVal } : p));
  };

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <ShieldCheck className="text-success" size={28} />
            <span>Security Policy Enforcement</span>
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Enterprise DevSecOps policy engine rules for automated CI/CD pipeline gating.
          </p>
        </div>

        <Button 
          variant="gradient" 
          onClick={handleSave}
          className="flex items-center gap-2 text-xs"
        >
          <Save size={16} />
          <span>Save Policy Configuration</span>
        </Button>
      </div>

      {savedToast && (
        <div className="p-3 rounded-xl bg-success/20 border border-success/40 text-success text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top duration-300">
          <span className="flex items-center gap-2">
            <CheckCircle size={16} />
            Policy changes successfully applied & synchronized with CI runner.
          </span>
          <Badge variant="outline" className="text-[10px] text-success border-success/30">Version 2.4.0 Active</Badge>
        </div>
      )}

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {policies.map((pol) => (
          <Card key={pol.id} className={`border transition-all duration-300 ${pol.enabled ? 'border-border' : 'border-border/40 opacity-70'}`}>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant="outline" className="text-[10px] text-neonPurple border-neonPurple/30 mb-1">
                    {pol.category}
                  </Badge>
                  <CardTitle className="text-base font-bold text-white">{pol.name}</CardTitle>
                </div>

                {/* Custom Toggle Switch */}
                <button
                  onClick={() => togglePolicy(pol.id)}
                  className="text-textSecondary hover:text-white transition-colors cursor-pointer"
                >
                  {pol.enabled ? (
                    <ToggleRight size={36} className="text-neonPurple" />
                  ) : (
                    <ToggleLeft size={36} className="text-textSecondary/50" />
                  )}
                </button>
              </div>

              <CardDescription className="text-xs text-textSecondary mt-1">
                {pol.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              
              {/* Threshold Slider Input */}
              <div className="space-y-2 p-3 rounded-lg bg-[#090014] border border-[#2A1240]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-textSecondary font-semibold flex items-center gap-1.5">
                    <Sliders size={14} className="text-neonPurple" />
                    CVSS Failure Threshold:
                  </span>
                  <span className="font-extrabold text-danger font-mono">{formatNumber(pol.cvssThreshold, 2)} / 10</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="10.0" 
                  step="0.5" 
                  value={pol.cvssThreshold}
                  onChange={(e) => updateThreshold(pol.id, parseFloat(e.target.value))}
                  disabled={!pol.enabled}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-[#A855F7]"
                />
              </div>

              {/* Policy Rules List */}
              <div className="space-y-2">
                <span className="text-[11px] uppercase font-bold text-textSecondary tracking-wider block">Active Rules</span>
                <ul className="space-y-1.5 text-xs text-foreground/90 font-sans">
                  {pol.rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-success font-bold">✓</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
