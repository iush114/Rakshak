import { useState, useEffect } from 'react';
import { 
  Brain, 
  Sparkles, 
  Copy, 
  RefreshCw, 
  CheckCircle2, 
  ShieldAlert, 
  AlertTriangle, 
  Terminal,
  Zap,
  Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AnalysisFinding {
  id: string;
  cve: string;
  package: string;
  severity: 'critical' | 'high' | 'medium';
  riskScore: number;
  explanation: {
    meaning: string;
    danger: string;
    impact: string;
    remediation: string[];
    riskSummary: string;
  }
}

const mockAIAnalyses: AnalysisFinding[] = [
  {
    id: '1',
    cve: 'CVE-2024-3094',
    package: 'xz-utils (5.6.0)',
    severity: 'critical',
    riskScore: 98,
    explanation: {
      meaning: 'This vulnerability allows remote code execution through an outdated OpenSSL & liblzma dependency. Because the affected container is internet-facing, the exploitability is HIGH.',
      danger: 'An attacker can intercept SSH authentication routines by abusing injected build artifacts in liblzma.so, allowing complete unauthorized root shell access.',
      impact: 'Full host system compromise, secrets exfiltration, container escape, and lateral movement across your Kubernetes cluster.',
      remediation: [
        'Upgrade xz-utils package to >= 5.6.1-r1 in Dockerfile',
        'Rebuild the Docker image with --no-cache flag',
        'Trigger a new Trivy AST scan to verify patch resolution'
      ],
      riskSummary: 'CRITICAL THREAT: Proof-of-concept exploit is active in the wild. Immediate action required within 2 hours.'
    }
  },
  {
    id: '2',
    cve: 'CVE-2024-21626',
    package: 'runc (1.1.10)',
    severity: 'critical',
    riskScore: 94,
    explanation: {
      meaning: 'Container breakout flaw in runc runtime allows process inside container to gain file descriptor access to host file system.',
      danger: 'Attacker executing arbitrary commands inside container can traverse host `/proc` directory and read/write host binaries.',
      impact: 'Loss of container isolation, host filesystem tampering, potential cluster worker node compromise.',
      remediation: [
        'Upgrade runc to version 1.1.12 or higher',
        'Deploy Seccomp default security profiles across container workloads',
        'Restart Docker / containerd daemon'
      ],
      riskSummary: 'HIGH EXPLOITABILITY: Host container runtime boundaries compromised.'
    }
  },
  {
    id: '3',
    cve: 'CVE-2023-44487',
    package: 'nghttp2 (1.51.0)',
    severity: 'high',
    riskScore: 88,
    explanation: {
      meaning: 'HTTP/2 protocol flaw enabling massive Denial of Service via stream cancellation flood (Rapid Reset).',
      danger: 'Single client can generate millions of HTTP/2 requests/cancellations per second, exhausting CPU/RAM resources.',
      impact: 'Service outage, high latency, denial of service for all legitimate users.',
      remediation: [
        'Update nghttp2 to version >= 1.55.1',
        'Configure NGINX / Cloudflare rate limits for HTTP/2 RST_STREAM frames',
        'Audit ingress controller max concurrent streams settings'
      ],
      riskSummary: 'DENIAL OF SERVICE: Widespread protocol exploitation requires ingress proxy level protection.'
    }
  }
];

export default function AIAnalysis() {
  const [selectedId, setSelectedId] = useState<string>('1');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [displayedText, setDisplayedText] = useState<string>('');

  const currentAnalysis = mockAIAnalyses.find(a => a.id === selectedId) || mockAIAnalyses[0];

  // Typewriter effect simulation for AI response
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const fullText = currentAnalysis.explanation.meaning;
    const timer = setInterval(() => {
      if (i < fullText.length) {
        setDisplayedText((prev) => prev + fullText.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 15);

    return () => clearInterval(timer);
  }, [selectedId, isGenerating]);

  const handleRegenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 800);
  };

  const handleCopy = () => {
    const textToCopy = `CVE: ${currentAnalysis.cve}\nMeaning: ${currentAnalysis.explanation.meaning}\nDanger: ${currentAnalysis.explanation.danger}\nImpact: ${currentAnalysis.explanation.impact}\nRemediation:\n${currentAnalysis.explanation.remediation.map(r => `• ${r}`).join('\n')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Brain className="text-neonPurple" size={28} />
            <span>AI Risk & Threat Analyzer</span>
            <Badge className="bg-rakshak-gradient text-white">Rakshak AI Analysis</Badge>
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Deep contextual LLM threat analysis, attack vectors & automated patch recommendations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 text-xs"
          >
            <RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} />
            <span>Regenerate AI Analysis</span>
          </Button>

          <Button 
            variant="gradient" 
            size="sm"
            onClick={handleCopy}
            className="flex items-center gap-2 text-xs"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Response'}</span>
          </Button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Panel: Finding Selector & Risk Gauge */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Select Security Finding</CardTitle>
              <CardDescription className="text-xs">Choose a vulnerability to inspect AI insights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockAIAnalyses.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedId === item.id 
                      ? 'bg-neonPurple/15 border-neonPurple glow-neon' 
                      : 'bg-card/50 border-border hover:bg-white/5'
                  }`}
                >
                  <div>
                    <span className="font-mono font-bold text-sm text-white block">{item.cve}</span>
                    <span className="text-xs text-textSecondary font-mono">{item.package}</span>
                  </div>
                  <Badge variant={item.severity}>
                    {item.severity.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Risk Gauge Meter Card */}
          <Card className="bg-gradient-to-br from-[#12051F] to-[#1e0736] border-neonPurple/30">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-sm font-bold text-textSecondary uppercase tracking-wider">AI Risk Score Gauge</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-6 pt-0">
              {/* Circular Radial Meter */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-border"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-danger transition-all duration-1000 ease-out"
                    strokeDasharray={`${currentAnalysis.riskScore}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white">{currentAnalysis.riskScore}</span>
                  <span className="text-[10px] text-textSecondary font-bold">/ 100</span>
                </div>
              </div>

              <div className="mt-4 text-center">
                <Badge variant={currentAnalysis.severity} className="text-xs px-3 py-1">
                  EXPLOITABILITY: HIGH
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: AI Explanation & Formatting */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="bg-[#12051F]/90 border-[#A855F7]/40 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-neonPurple/10 rounded-full blur-3xl pointer-events-none" />

            <CardHeader className="border-b border-[#2A1240] pb-4 flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="text-neonPurple animate-pulse" size={20} />
                  <CardTitle className="text-xl font-bold text-white">🧠 AI Security Insight</CardTitle>
                </div>
                <CardDescription className="text-xs text-textSecondary mt-0.5">
                  Generated by Rakshak Automated Security Analysis Engine
                </CardDescription>
              </div>

              <span className="text-xs font-mono text-success flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Verified Vector
              </span>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              
              {/* Typewriter Meaning Block */}
              <div className="p-4 rounded-xl bg-[#090014]/80 border border-[#2A1240] text-sm leading-relaxed text-foreground font-sans">
                <span className="font-mono text-neonPurple font-bold block mb-1">Overview:</span>
                <p className="min-h-[48px]">
                  {displayedText}
                  <span className="inline-block w-2 h-4 bg-neonPurple ml-1 animate-pulse" />
                </p>
              </div>

              {/* Danger & Impact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 space-y-1.5">
                  <h4 className="text-xs font-extrabold text-danger uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert size={15} />
                    Why It Is Dangerous
                  </h4>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {currentAnalysis.explanation.danger}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 space-y-1.5">
                  <h4 className="text-xs font-extrabold text-warning uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    Potential Impact
                  </h4>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {currentAnalysis.explanation.impact}
                  </p>
                </div>
              </div>

              {/* Recommended Action Code Block */}
              <div className="p-4 rounded-xl bg-[#090014] border border-[#2A1240] space-y-3 font-mono">
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2 font-sans">
                  <Terminal size={16} className="text-neonPurple" />
                  Recommended Action Plan
                </h4>
                <ul className="space-y-2 text-xs text-textSecondary">
                  {currentAnalysis.explanation.remediation.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-foreground/90">
                      <span className="text-neonPurple font-bold">•</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risk Summary Highlight */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-neonPurple/20 to-pinkAccent/20 border border-neonPurple/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="text-warning shrink-0" size={20} />
                  <div>
                    <span className="text-xs font-bold text-white block">AI Executive Summary</span>
                    <span className="text-xs text-textSecondary">{currentAnalysis.explanation.riskSummary}</span>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
