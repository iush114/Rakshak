import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Sparkles, 
  Code2, 
  KeyRound, 
  Cpu,
  FileText,
  TrendingUp, 
  ArrowRight, 
  ShieldCheck
} from 'lucide-react';
import { GithubIcon } from '@/components/ui/GithubIcon';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="space-y-12 pb-20 font-sans max-w-6xl mx-auto">
      
      {/* ========================================================= */}
      {/* 1. HERO BANNER */}
      {/* ========================================================= */}
      <section className="relative p-8 sm:p-14 rounded-3xl bg-gradient-to-br from-[#12051F] via-[#1c0733] to-[#2b0c4b] border border-[#A855F7]/40 shadow-[0_0_50px_rgba(168,85,247,0.2)] overflow-hidden text-center flex flex-col items-center">
        
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#EC4899]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#A855F7]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Large Glowing Shield with RAKSHAK Name on Big Rectangle */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative flex flex-col items-center mb-6 z-10"
        >
          {/* Big Purple Rectangle */}
          <div className="px-10 sm:px-16 py-6 rounded-3xl bg-gradient-to-b from-[#1d0838] via-[#150529] to-[#0f031f] border border-[#A855F7]/60 glow-neon flex flex-col items-center justify-center gap-3 shadow-[0_0_45px_rgba(168,85,247,0.35)]">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <Shield className="w-14 h-14 text-[#A855F7] drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]" />
              <span className="absolute text-lg font-black text-white leading-none">R</span>
            </div>

            {/* RAKSHAK Name on the Big Rectangle */}
            <h1 className="text-3xl sm:text-5xl font-black tracking-widest text-rakshak-gradient select-none">
              RAKSHAK
            </h1>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="z-10 max-w-3xl space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#090014]/70 border border-[#A855F7]/40 text-xs font-bold text-[#C4B5FD] mb-2">
            <Sparkles size={14} className="text-[#EC4899]" />
            <span>Autonomous DevSecOps Threat Defense & Intelligence</span>
          </div>

          <h2 className="text-xl sm:text-3xl font-bold text-white mt-2">
            AI-Powered DevSecOps Threat Detection & Remediation Platform
          </h2>

          <p className="text-xs sm:text-sm text-[#C4B5FD]/90 max-w-2xl mx-auto mt-4 leading-relaxed">
            Rakshak (रक्षक - The Protector) is a next-generation DevSecOps platform combining deep software composition analysis (SCA), container security inspection, secret detection, and Cloudflare Workers AI edge inference to safeguard modern software supply chains.
          </p>

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-6">
            <Button
              onClick={() => navigate('/dashboard')}
              className="bg-rakshak-gradient text-white text-xs font-bold px-6 py-5 rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.4)] hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Explore Dashboard</span>
              <ArrowRight size={15} />
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/repository-scan')}
              className="bg-[#090014]/80 border-[#2A1240] hover:border-[#A855F7] text-[#C4B5FD] hover:text-white text-xs font-semibold px-5 py-5 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <GithubIcon size={16} />
              <span>Launch Repo Scanner</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/findings')}
              className="bg-[#090014]/80 border-[#2A1240] hover:border-[#A855F7] text-[#C4B5FD] hover:text-white text-xs font-semibold px-5 py-5 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <ShieldCheck size={16} className="text-[#EC4899]" />
              <span>View Security Findings</span>
            </Button>
          </div>
        </motion.div>

      </section>

      {/* ========================================================= */}
      {/* 2. CORE ARCHITECTURAL PILLARS */}
      {/* ========================================================= */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <Badge className="bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30 px-3 py-1 text-xs mb-2">
            System Architecture
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Four Pillars of Autonomous Security
          </h2>
          <p className="text-xs sm:text-sm text-[#C4B5FD]/75 mt-1">
            Rakshak unites multi-vector security scanners with contextual risk engines and generative AI reasoning.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Pillar 1: Trivy Engine */}
          <Card className="bg-[#12051F]/80 border-[#2A1240] hover:border-[#A855F7]/60 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] transition-all group">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30 group-hover:scale-110 group-hover:bg-[#A855F7] group-hover:text-white transition-all">
                  <Code2 size={24} />
                </div>
                <Badge className="bg-[#090014] text-[#C4B5FD] border-[#2A1240] text-[10px] font-mono">
                  TRIVY SCA ENGINE
                </Badge>
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-[#EC4899] transition-colors">
                  Software Composition & Container Scanning
                </h3>
                <p className="text-xs text-[#C4B5FD]/80 leading-relaxed mt-1">
                  Parses project dependency manifests and Docker container image layers. Detects known Common Vulnerabilities and Exposures (CVEs) with exact version comparison and upstream fixed version tracking.
                </p>
              </div>

              <div className="pt-2 border-t border-[#2A1240]/60 grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Filesystem SCA</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Docker Base Layers</span>
              </div>
            </CardContent>
          </Card>

          {/* Pillar 2: Gitleaks Engine */}
          <Card className="bg-[#12051F]/80 border-[#2A1240] hover:border-[#EC4899]/60 hover:shadow-[0_0_30px_rgba(236,72,153,0.2)] transition-all group">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-[#EC4899]/15 text-[#EC4899] border border-[#EC4899]/30 group-hover:scale-110 group-hover:bg-[#EC4899] group-hover:text-white transition-all">
                  <KeyRound size={24} />
                </div>
                <Badge className="bg-[#090014] text-[#C4B5FD] border-[#2A1240] text-[10px] font-mono">
                  GITLEAKS AST ENGINE
                </Badge>
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-[#EC4899] transition-colors">
                  Hardcoded Secrets & Credential Detection
                </h3>
                <p className="text-xs text-[#C4B5FD]/80 leading-relaxed mt-1">
                  High-entropy pattern matching that inspects source trees, configuration files, and commit diffs for leaked API keys (AWS, Stripe, GitHub, Private Keys, JWTs) before deployment.
                </p>
              </div>

              <div className="pt-2 border-t border-[#2A1240]/60 grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-pink-400" /> Entropy Analysis</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-pink-400" /> Secret Masking</span>
              </div>
            </CardContent>
          </Card>

          {/* Pillar 3: Risk Prioritization Engine */}
          <Card className="bg-[#12051F]/80 border-[#2A1240] hover:border-amber-500/60 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] transition-all group">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-black transition-all">
                  <TrendingUp size={24} />
                </div>
                <Badge className="bg-[#090014] text-[#C4B5FD] border-[#2A1240] text-[10px] font-mono">
                  CONTEXT RISK ENGINE
                </Badge>
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-[#EC4899] transition-colors">
                  Contextual Risk Scoring & Priority Matrix
                </h3>
                <p className="text-xs text-[#C4B5FD]/80 leading-relaxed mt-1">
                  Eliminates alert fatigue by scoring vulnerabilities from 0 to 100 based on CVSS severity, public exploitability likelihood, and whether the vulnerable package is exposed in production.
                </p>
              </div>

              <div className="pt-2 border-t border-[#2A1240]/60 grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Exploit Probability</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Production Exposure</span>
              </div>
            </CardContent>
          </Card>

          {/* Pillar 4: Cloudflare Workers AI */}
          <Card className="bg-[#12051F]/80 border-[#2A1240] hover:border-blue-500/60 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] transition-all group">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/30 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <Cpu size={24} />
                </div>
                <Badge className="bg-[#090014] text-[#C4B5FD] border-[#2A1240] text-[10px] font-mono">
                  CLOUDFLARE WORKERS AI
                </Badge>
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-[#EC4899] transition-colors">
                  Edge-Accelerated AI Threat Reasoning
                </h3>
                <p className="text-xs text-[#C4B5FD]/80 leading-relaxed mt-1">
                  Generates plain-English threat summaries, impact evaluations, and code remediation patches powered by serverless Llama-3.1-8b inference on Cloudflare Workers AI with rule-based fallback intelligence.
                </p>
              </div>

              <div className="pt-2 border-t border-[#2A1240]/60 grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Patch Diff Generation</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Root-Cause Analysis</span>
              </div>
            </CardContent>
          </Card>

        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. END-TO-END DEVSECOPS PIPELINE VISUALIZER */}
      {/* ========================================================= */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <Badge className="bg-[#EC4899]/15 text-[#EC4899] border-[#EC4899]/30 px-3 py-1 text-xs mb-2">
            Workflow Execution
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            End-to-End Threat Defense Pipeline
          </h2>
          <p className="text-xs sm:text-sm text-[#C4B5FD]/75 mt-1">
            How code transitions from source ingestion to AI-validated patch deployment.
          </p>
        </div>

        <Card className="bg-[#12051F]/90 border-[#2A1240] shadow-xl">
          <CardContent className="p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
              
              {/* Step 1 */}
              <div className="p-4 rounded-2xl bg-[#090014]/90 border border-[#2A1240] flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#A855F7] px-2 py-0.5 rounded bg-[#A855F7]/10 border border-[#A855F7]/20">
                    STEP 01
                  </span>
                  <h4 className="text-sm font-bold text-white mt-2">Connect & Ingest</h4>
                  <p className="text-[11px] text-[#C4B5FD]/70 mt-1 leading-relaxed">
                    Connect GitHub repository or ingest Dockerfiles & requirements manifests.
                  </p>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">Input: Source / Image</div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-[#090014]/90 border border-[#2A1240] flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#EC4899] px-2 py-0.5 rounded bg-[#EC4899]/10 border border-[#EC4899]/20">
                    STEP 02
                  </span>
                  <h4 className="text-sm font-bold text-white mt-2">Scan & Parse</h4>
                  <p className="text-[11px] text-[#C4B5FD]/70 mt-1 leading-relaxed">
                    Trivy SCA checks dependencies; Gitleaks scans entropy for hardcoded secrets.
                  </p>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">Engine: Trivy & Gitleaks</div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-[#090014]/90 border border-[#2A1240] flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                    STEP 03
                  </span>
                  <h4 className="text-sm font-bold text-white mt-2">Risk Scoring</h4>
                  <p className="text-[11px] text-[#C4B5FD]/70 mt-1 leading-relaxed">
                    Evaluates exploitability & exposure to calculate 0-100 normalized risk score.
                  </p>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">Logic: Prioritize Engine</div>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-2xl bg-[#090014]/90 border border-[#2A1240] flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-400/10 border border-blue-400/20">
                    STEP 04
                  </span>
                  <h4 className="text-sm font-bold text-white mt-2">AI Remediation</h4>
                  <p className="text-[11px] text-[#C4B5FD]/70 mt-1 leading-relaxed">
                    Cloudflare Workers AI generates plain-English impact analyses and code diffs.
                  </p>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">LLM: Llama 3 8B Edge</div>
              </div>

              {/* Step 5 */}
              <div className="p-4 rounded-2xl bg-[#090014]/90 border border-emerald-500/30 flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-400/10 border border-emerald-400/20">
                    STEP 05
                  </span>
                  <h4 className="text-sm font-bold text-white mt-2">Audit & Resolve</h4>
                  <p className="text-[11px] text-[#C4B5FD]/70 mt-1 leading-relaxed">
                    Export compliance reports, patch vulnerabilities, and monitor risk reduction.
                  </p>
                </div>
                <div className="text-[10px] text-emerald-400 font-mono font-bold">Outcome: Secure Build</div>
              </div>

            </div>
          </CardContent>
        </Card>
      </section>

      {/* ========================================================= */}
      {/* 4. PLATFORM SPECIFICATIONS & COMPLIANCE TABLE */}
      {/* ========================================================= */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <Badge className="bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30 px-3 py-1 text-xs mb-2">
            Technical Specifications
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Compliance & Standards Matrix
          </h2>
          <p className="text-xs sm:text-sm text-[#C4B5FD]/75 mt-1">
            Engineered to meet enterprise DevSecOps benchmarks and industry compliance standards.
          </p>
        </div>

        <Card className="bg-[#12051F]/80 border-[#2A1240] shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090014] text-[#C4B5FD]/70 uppercase font-semibold text-[11px] border-b border-[#2A1240]">
                <tr>
                  <th className="px-5 py-4">Capability / Standard</th>
                  <th className="px-5 py-4">Specification & Engine</th>
                  <th className="px-5 py-4">Coverage Scope</th>
                  <th className="px-5 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A1240]/50 font-sans">
                
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span>OWASP Top 10 Compliance</span>
                  </td>
                  <td className="px-5 py-3.5 text-[#C4B5FD]/80">A01:2021 (Broken Access Control) through A10:2021 (SSRF)</td>
                  <td className="px-5 py-3.5 text-zinc-400">Application Source & Dependencies</td>
                  <td className="px-5 py-3.5 text-right">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">100% COVERED</Badge>
                  </td>
                </tr>

                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2">
                    <Code2 size={16} className="text-[#A855F7]" />
                    <span>Software Composition (SCA)</span>
                  </td>
                  <td className="px-5 py-3.5 text-[#C4B5FD]/80">Trivy Vulnerability Database (NVD, GitHub Advisories)</td>
                  <td className="px-5 py-3.5 text-zinc-400">Python (pip), Node.js (npm), Go, Docker</td>
                  <td className="px-5 py-3.5 text-right">
                    <Badge className="bg-[#A855F7]/20 text-[#A855F7] border-[#A855F7]/30 text-[10px]">INTEGRATED</Badge>
                  </td>
                </tr>

                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2">
                    <KeyRound size={16} className="text-[#EC4899]" />
                    <span>Secret Leak Detection</span>
                  </td>
                  <td className="px-5 py-3.5 text-[#C4B5FD]/80">Gitleaks AST Pattern & Shannon Entropy Parser</td>
                  <td className="px-5 py-3.5 text-zinc-400">AWS, Stripe, GitHub, Private Keys, JWTs</td>
                  <td className="px-5 py-3.5 text-right">
                    <Badge className="bg-[#EC4899]/20 text-[#EC4899] border-[#EC4899]/30 text-[10px]">ACTIVE</Badge>
                  </td>
                </tr>

                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2">
                    <Cpu size={16} className="text-blue-400" />
                    <span>Edge AI Reasoning</span>
                  </td>
                  <td className="px-5 py-3.5 text-[#C4B5FD]/80">Cloudflare Workers AI (Llama-3-8b-instruct)</td>
                  <td className="px-5 py-3.5 text-zinc-400">Real-time Automated Vulnerability Remediation</td>
                  <td className="px-5 py-3.5 text-right">
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">SERVERLESS</Badge>
                  </td>
                </tr>

                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2">
                    <FileText size={16} className="text-amber-400" />
                    <span>Audit & Compliance Export</span>
                  </td>
                  <td className="px-5 py-3.5 text-[#C4B5FD]/80">JSON / CSV Report Generation (ISO 27001 / SOC 2 Ready)</td>
                  <td className="px-5 py-3.5 text-zinc-400">Executive Briefings, Technical CVE Diffs</td>
                  <td className="px-5 py-3.5 text-right">
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">AVAILABLE</Badge>
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ========================================================= */}
      {/* 5. CALL TO ACTION FOOTER */}
      {/* ========================================================= */}
      <section className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#12051F] via-[#1c0733] to-[#2b0c4b] border border-[#A855F7]/40 shadow-2xl text-center flex flex-col items-center">
        <h3 className="text-2xl sm:text-3xl font-black text-white">
          Secure Your Software Supply Chain Today
        </h3>
        <p className="text-xs sm:text-sm text-[#C4B5FD]/80 max-w-xl mt-2 leading-relaxed">
          Launch a live scan now to discover exploitable CVEs, detect hardcoded secrets, and receive instant AI remediation guidance.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
          <Button
            onClick={() => navigate('/repository-scan')}
            className="bg-rakshak-gradient text-white text-xs font-bold px-7 py-5 rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.4)] hover:scale-105 transition-all cursor-pointer flex items-center gap-2"
          >
            <GithubIcon size={16} />
            <span>Connect Repository</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="bg-[#090014]/80 border-[#2A1240] hover:border-[#A855F7] text-white text-xs font-semibold px-6 py-5 rounded-xl transition-all cursor-pointer"
          >
            <span>Open Command Center</span>
          </Button>
        </div>
      </section>

    </div>
  );
}
