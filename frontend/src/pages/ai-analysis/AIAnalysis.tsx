import { formatScore } from '@/utils/formatters';
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
import { useSecurity } from '@/context/SecurityContext';
import { analyzeFindingWithAI } from '@/services/api';

export default function AIAnalysis() {
  const { findings, addAIAnalysis } = useSecurity();
  const [selectedId, setSelectedId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [displayedText, setDisplayedText] = useState<string>('');
  const [aiDetails, setAiDetails] = useState<{
    explanation: string;
    danger: string;
    impact: string;
    remediation: string[];
    riskSummary: string;
  } | null>(null);

  useEffect(() => {
    if (findings.length > 0 && !selectedId) {
      setSelectedId(findings[0].vulnerabilityId || '');
    }
  }, [findings, selectedId]);

  const selectedFinding = findings.find(f => f.vulnerabilityId === selectedId) || findings[0];

  useEffect(() => {
    if (!selectedFinding) return;

    if (selectedFinding.aiExplanation) {
      setAiDetails({
        explanation: selectedFinding.aiExplanation,
        danger: selectedFinding.potentialImpact || 'Potential security risk in application component.',
        impact: selectedFinding.potentialImpact || 'Component security breach or privilege risk.',
        remediation: selectedFinding.recommendedFix ? [selectedFinding.recommendedFix] : ['Apply vendor security updates.'],
        riskSummary: selectedFinding.riskSummary || `${selectedFinding.priority} priority vulnerability requiring remediation.`
      });
    } else {
      setAiDetails({
        explanation: selectedFinding.description || 'Vulnerability detected by DevSecOps pipeline scanner.',
        danger: `Exploit risk assessed with CVSS score of ${formatScore(selectedFinding.riskScore)}/100.`,
        impact: `Potential impact across ${selectedFinding.package}.`,
        remediation: [selectedFinding.fixedVersion !== 'No fix available' ? `Upgrade ${selectedFinding.package} to ${selectedFinding.fixedVersion}` : 'Apply security hardening configuration.'],
        riskSummary: `${selectedFinding.priority} priority threat vector.`
      });
    }
  }, [selectedFinding]);

  // Typewriter effect simulation for AI response
  useEffect(() => {
    if (!aiDetails) return;
    setDisplayedText('');
    let i = 0;
    const fullText = aiDetails.explanation;
    const timer = setInterval(() => {
      if (i < fullText.length) {
        setDisplayedText((prev) => prev + fullText.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 12);

    return () => clearInterval(timer);
  }, [selectedId, isGenerating, aiDetails]);

  const handleRegenerate = async () => {
    if (!selectedFinding) return;
    if (!selectedFinding.vulnerabilityId) return;
    setIsGenerating(true);
    try {
      const res = await analyzeFindingWithAI(selectedFinding.vulnerabilityId);
      setAiDetails({
        explanation: res.explanation,
        danger: res.potentialImpact,
        impact: res.potentialImpact,
        remediation: [res.recommendedAction],
        riskSummary: res.riskSummary,
      });
      addAIAnalysis({
        cve: selectedFinding.cve,
        title: selectedFinding.title,
        riskScore: selectedFinding.riskScore,
        aiModel: 'Cloudflare AI (Llama 3.1 8B)',
        explanation: res.explanation,
        potentialImpact: res.potentialImpact,
        recommendedAction: res.recommendedAction,
        riskSummary: res.riskSummary,
      });
    } catch (e) {
      console.warn('[Rakshak] AI regeneration failed:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!selectedFinding || !aiDetails) return;
    const textToCopy = `CVE: ${selectedFinding.cve}\nMeaning: ${aiDetails.explanation}\nDanger: ${aiDetails.danger}\nImpact: ${aiDetails.impact}\nRemediation:\n${aiDetails.remediation.map(r => `• ${r}`).join('\n')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (findings.length === 0) {
    return (
      <div className="space-y-6 pb-12 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <Brain className="text-neonPurple" size={28} />
              <span>AI Risk & Threat Analyzer</span>
            </h1>
            <p className="text-sm text-textSecondary mt-1">
              Deep contextual LLM threat analysis, attack vectors & automated patch recommendations.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-16 text-center text-textSecondary">
            <Brain size={48} className="mx-auto text-neonPurple/40 mb-3" />
            <h3 className="text-lg font-bold text-white">No analysis history available.</h3>
            <p className="text-xs text-textSecondary mt-1 max-w-sm mx-auto">
              Run a security scan from the Repository Scan page to detect vulnerabilities and generate real-time AI security remediation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Brain className="text-neonPurple" size={28} />
            <span>AI Risk & Threat Analyzer</span>
            <Badge className="bg-rakshak-gradient text-white">Rakshak AI Active</Badge>
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
            className="flex items-center gap-2 text-xs cursor-pointer"
          >
            <RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} />
            <span>{isGenerating ? 'Querying FastAPI...' : 'Analyze with AI'}</span>
          </Button>

          <Button
            variant="gradient"
            size="sm"
            onClick={handleCopy}
            className="flex items-center gap-2 text-xs cursor-pointer"
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
              {findings.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.cve)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedId === item.cve
                      ? 'bg-neonPurple/15 border-neonPurple glow-neon'
                      : 'bg-card/50 border-border hover:bg-white/5'
                  }`}
                >
                  <div>
                    <span className="font-mono font-bold text-sm text-white block">{item.cve}</span>
                    <span className="text-xs text-textSecondary truncate block max-w-[200px]">{item.package}</span>
                  </div>
                  <Badge variant={item.severity}>{item.severity.toUpperCase()}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Threat Metric Card */}
          {selectedFinding && (
            <Card className="bg-gradient-to-br from-card to-background border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldAlert className="text-danger" size={16} />
                  <span>Calculated Threat Index</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end justify-between">
                  <span className="text-4xl font-black font-mono text-warning">{formatScore(selectedFinding.riskScore)}</span>
                  <span className="text-xs font-mono text-textSecondary">CVSS Normalized Score</span>
                </div>
                <div className="w-full bg-border/50 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${selectedFinding.riskScore > 80 ? 'bg-danger' : selectedFinding.riskScore > 50 ? 'bg-warning' : 'bg-neonPurple'}`}
                    style={{ width: `${selectedFinding.riskScore}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel: AI Deep Explanation */}
        <div className="lg:col-span-8 space-y-6">
          {selectedFinding && aiDetails && (
            <Card className="border-neonPurple/40 bg-[#12051F]/90 glow-neon">
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-neonPurple/20 text-neonPurple">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white font-mono">{selectedFinding.cve}</h2>
                      <p className="text-xs text-textSecondary">{selectedFinding.package}</p>
                    </div>
                  </div>
                  <Badge className="bg-success/20 text-success border-success/40 text-xs">
                    Autonomous Fix Analysis
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">

                {/* Meaning Section */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neonPurple flex items-center gap-1.5">
                    <Zap size={14} />
                    <span>What This Means</span>
                  </h3>
                  <div className="p-4 rounded-xl bg-card/60 border border-border/50 text-sm leading-relaxed text-zinc-200">
                    {displayedText}
                    {isGenerating && <span className="inline-block w-2 h-4 ml-1 bg-neonPurple animate-pulse" />}
                  </div>
                </div>

                {/* Danger & Impact Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-danger flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      <span>The Danger</span>
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {aiDetails.danger}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-pinkAccent/10 border border-pinkAccent/30 space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-pinkAccent flex items-center gap-1.5">
                      <ShieldAlert size={14} />
                      <span>Potential Impact</span>
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {aiDetails.impact}
                    </p>
                  </div>
                </div>

                {/* Remediation Recipe */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-success flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Automated Remediation Steps</span>
                  </h3>
                  <div className="space-y-2">
                    {aiDetails.remediation.map((step, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-card/80 border border-border/60 flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-success/20 text-success text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="text-xs text-zinc-200 font-mono flex-1">
                          {step}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk Synthesis */}
                <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 flex items-center gap-3">
                  <Terminal className="text-warning shrink-0" size={20} />
                  <p className="text-xs text-warning font-mono">
                    <strong>EXECUTIVE SUMMARY:</strong> {aiDetails.riskSummary}
                  </p>
                </div>

              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
