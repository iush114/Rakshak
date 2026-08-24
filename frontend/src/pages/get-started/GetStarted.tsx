import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Shield, 
  Sparkles, 
  ArrowRight, 
  Code2, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ChevronRight,
  Zap,
  KeyRound,
  Play,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

export default function GetStarted() {
  const navigate = useNavigate();
  const [activeDemoTab, setActiveDemoTab] = useState<'cve' | 'secrets' | 'ai'>('cve');
  const [isSimulatingAI, setIsSimulatingAI] = useState(false);

  const handleSimulateAI = () => {
    setIsSimulatingAI(true);
    setTimeout(() => {
      setIsSimulatingAI(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#06000E] text-[#F5F3FF] flex flex-col relative overflow-hidden font-sans selection:bg-[#EC4899]/30 selection:text-white">
      
      {/* Background Ambient Glows & Cyber Grid */}
      <div className="absolute top-[-10%] left-[20%] w-[650px] h-[650px] bg-[#7c3aed]/18 rounded-full mix-blend-screen filter blur-[170px] pointer-events-none" />
      <div className="absolute top-[35%] right-[-10%] w-[650px] h-[650px] bg-[#ec4899]/18 rounded-full mix-blend-screen filter blur-[170px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[10%] w-[700px] h-[700px] bg-[#c026d3]/12 rounded-full mix-blend-screen filter blur-[180px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#2A1240_1px,transparent_1px)] [background-size:28px_28px] opacity-35 pointer-events-none" />

      {/* ========================================================= */}
      {/* 1. TOP NAVIGATION BAR */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#06000E]/80 border-b border-[#2A1240]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <Shield className="w-7 h-7 text-[#A855F7] group-hover:scale-110 transition-transform" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">R</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-wider text-white-pink-gradient">
                  RAKSHAK
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30">
                  AI DevSecOps
                </span>
              </div>
              <p className="text-[11px] text-[#C4B5FD]/70 hidden md:block">
                AI-Powered Threat Detection & Remediation
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-[#C4B5FD]/80">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#live-demo" className="hover:text-white transition-colors">Live Preview</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <Link to="/about" className="hover:text-white transition-colors">About</Link>
          </nav>

          {/* Auth CTA Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate('/login')}
              className="text-[#C4B5FD] hover:text-white hover:bg-[#12051F] border border-transparent hover:border-[#2A1240] text-sm font-medium px-4 py-2 rounded-xl transition-all"
            >
              Sign In
            </Button>
            
            <Button
              onClick={() => navigate('/register')}
              className="bg-rakshak-gradient text-white font-semibold px-5 py-2 rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_25px_rgba(236,72,153,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Get Started Free</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. HERO SECTION */}
      {/* ========================================================= */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 max-w-7xl mx-auto flex flex-col items-center text-center z-10">
        
        {/* Glowing Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#12051F] border border-[#A855F7]/40 shadow-[0_0_20px_rgba(168,85,247,0.25)] text-xs font-semibold text-[#C4B5FD] mb-6"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <Sparkles size={14} className="text-[#EC4899]" />
          <span>Next-Gen AI Security Engine 2.0</span>
          <span className="text-zinc-600">|</span>
          <span className="text-white font-bold">Zero Setup Required</span>
        </motion.div>

        {/* Main Hero Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight max-w-5xl leading-[1.15]"
        >
          Defend Code. Detect CVEs. <br />
          <span className="text-rakshak-gradient">
            Remediate with Instant AI.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base sm:text-xl text-[#C4B5FD]/90 max-w-3xl mt-6 leading-relaxed font-normal"
        >
          Rakshak combines AST vulnerability parsing, Trivy dependency audits, Gitleaks secret detection, and Cloudflare Workers AI to identify threats and autonomously generate production-ready fixes in seconds.
        </motion.p>

        {/* Primary Call-To-Action Group */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-4 mt-10"
        >
          <Button
            onClick={() => navigate('/register')}
            size="lg"
            className="bg-rakshak-gradient text-white font-bold px-8 py-6 rounded-2xl text-base shadow-[0_0_30px_rgba(168,85,247,0.45)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 cursor-pointer"
          >
            <Zap size={20} className="text-yellow-300" />
            <span>Get Started with Rakshak</span>
            <ArrowRight size={18} />
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            size="lg"
            className="bg-[#12051F]/80 border-[#2A1240] hover:border-[#A855F7]/70 text-white font-semibold px-7 py-6 rounded-2xl text-base hover:bg-[#1C0830] transition-all flex items-center gap-2.5 shadow-[0_0_20px_rgba(0,0,0,0.5)] cursor-pointer"
          >
            <Play size={18} className="text-[#EC4899] fill-[#EC4899]" />
            <span>Explore Live Dashboard</span>
          </Button>
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 mt-14 max-w-4xl w-full text-left"
        >
          <div className="p-4 rounded-2xl bg-[#12051F]/60 border border-[#2A1240] flex items-center gap-3">
            <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">OWASP & CWE</p>
              <p className="text-[11px] text-[#C4B5FD]/70">Strict Compliance</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#12051F]/60 border border-[#2A1240] flex items-center gap-3">
            <Zap className="w-5 h-5 text-yellow-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">&lt; 50ms Parsing</p>
              <p className="text-[11px] text-[#C4B5FD]/70">Sub-second Speed</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#12051F]/60 border border-[#2A1240] flex items-center gap-3">
            <Cpu className="w-5 h-5 text-[#EC4899] shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">Cloudflare AI</p>
              <p className="text-[11px] text-[#C4B5FD]/70">Deep Remediation</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#12051F]/60 border border-[#2A1240] flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-[#A855F7] shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">Secret Scanner</p>
              <p className="text-[11px] text-[#C4B5FD]/70">Gitleaks Integration</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ========================================================= */}
      {/* 3. INTERACTIVE LIVE THREAT DEMO / RADAR WIDGET */}
      {/* ========================================================= */}
      <section id="live-demo" className="py-16 px-4 sm:px-6 max-w-6xl mx-auto w-full z-10">
        <div className="text-center mb-8">
          <Badge className="bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30 px-3 py-1 text-xs mb-2">
            Interactive Threat Sandbox
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            See How Rakshak Catches What Others Miss
          </h2>
          <p className="text-sm text-[#C4B5FD]/80 mt-2 max-w-xl mx-auto">
            Switch tabs below to inspect how Rakshak isolates vulnerabilities, catches exposed credentials, and prompts instant AI explanations.
          </p>
        </div>

        {/* Demo Card */}
        <div className="rounded-3xl bg-[#12051F]/90 border border-[#A855F7]/30 shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden">
          
          {/* Header Bar with Tabs */}
          <div className="p-4 bg-[#0A0214] border-b border-[#2A1240] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-xs text-zinc-400 font-mono ml-2">rakshak-inspector://realtime-telemetry</span>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-[#12051F] rounded-xl border border-[#2A1240]">
              <button
                onClick={() => setActiveDemoTab('cve')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeDemoTab === 'cve' 
                    ? 'bg-[#A855F7] text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' 
                    : 'text-[#C4B5FD]/70 hover:text-white'
                }`}
              >
                1. CVE Detection
              </button>
              <button
                onClick={() => setActiveDemoTab('secrets')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeDemoTab === 'secrets' 
                    ? 'bg-[#EC4899] text-white shadow-[0_0_10px_rgba(236,72,153,0.4)]' 
                    : 'text-[#C4B5FD]/70 hover:text-white'
                }`}
              >
                2. Secret Leaks
              </button>
              <button
                onClick={() => setActiveDemoTab('ai')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeDemoTab === 'ai' 
                    ? 'bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' 
                    : 'text-[#C4B5FD]/70 hover:text-white'
                }`}
              >
                3. AI Remediation
              </button>
            </div>
          </div>

          {/* Interactive Content Area */}
          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              
              {/* TAB 1: CVE */}
              {activeDemoTab === 'cve' && (
                <motion.div
                  key="cve"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300">
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-amber-200">CVE-2026-54371</span>
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">MEDIUM RISK</Badge>
                          <Badge className="bg-[#12051F] text-[#C4B5FD] border-[#2A1240] text-[10px]">Risk Score: 42/100</Badge>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1">
                          Symlink Traversal Privilege Escalation via <code className="text-pink-300 font-mono">getfattr</code> and <code className="text-pink-300 font-mono">setfattr</code>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-zinc-400">Package: <span className="text-white font-mono font-bold">libattr1</span></p>
                      <p className="text-[11px] text-zinc-400">Target: <span className="text-white font-mono font-bold">rakshak:latest</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-[#090014] border border-[#2A1240] font-mono text-xs text-zinc-300">
                      <div className="text-[11px] text-zinc-500 mb-2 flex items-center justify-between">
                        <span>TRIVY SCA PARSER OUTPUT</span>
                        <span className="text-emerald-400">STATUS: PARSED</span>
                      </div>
                      <p className="text-[#C4B5FD]">Package: libattr1 (1:2.5.2-3)</p>
                      <p className="text-amber-400 mt-1">Exploitability Vector: Local unprivileged symlink path redirect</p>
                      <p className="text-zinc-400 mt-1">Fixed Version: Patched in v2.6.0 upstream</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#090014] border border-[#2A1240] font-mono text-xs text-zinc-300">
                      <div className="text-[11px] text-zinc-500 mb-2 flex items-center justify-between">
                        <span>RAKSHAK RISK MATRIX</span>
                        <span className="text-[#A855F7]">SCORE: 42</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-zinc-400">Exploitability Rate:</span>
                          <span className="text-white font-bold">0.63</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-zinc-400">Production Impact:</span>
                          <span className="text-rose-400 font-bold">CONTAINERIZED ROOT ESCALATION</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-zinc-400">Recommended Action:</span>
                          <span className="text-emerald-400 font-bold">Enforce rigid symlink sandbox check</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: SECRETS */}
              {activeDemoTab === 'secrets' && (
                <motion.div
                  key="secrets"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300">
                        <KeyRound size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-rose-300">GITLEAKS SECRET DETECTED</span>
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">CRITICAL</Badge>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1">
                          AWS Access Key ID leaked inside repository file <code className="text-pink-300 font-mono">config/.env</code>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-zinc-400">Confidence: <span className="text-emerald-400 font-bold">HIGH</span></p>
                      <p className="text-[11px] text-zinc-400">Detection Engine: <span className="text-white font-mono">Gitleaks AST</span></p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#090014] border border-[#2A1240] font-mono text-xs text-zinc-300">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-3 border-b border-[#2A1240] pb-2">
                      <span>VULNERABLE CODE EXCERPT</span>
                      <span className="text-rose-400 font-bold">LIVE SECRET EXPOSURE</span>
                    </div>
                    <div className="space-y-1 font-mono text-xs">
                      <p className="text-zinc-500"># config/.env - Line 12</p>
                      <p className="text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                        - AWS_ACCESS_KEY_ID = <span className="bg-rose-900/60 px-1 text-white font-bold">EXAMPLE_AWS_KEY_REDACTED</span>
                      </p>
                      <p className="text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20 mt-2">
                        + AWS_ACCESS_KEY_ID = <span className="text-zinc-300">${'{'}AWS_SECRETS_MANAGER_KEY{'}'}</span> # Secured with KMS
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: AI */}
              {activeDemoTab === 'ai' && (
                <motion.div
                  key="ai"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-[#A855F7]/15 via-[#EC4899]/15 to-[#7c3aed]/15 border border-[#A855F7]/40 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-rakshak-gradient text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]">
                        <Sparkles size={22} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          Cloudflare Workers AI Threat Reasoning
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">Real-time LLM</Badge>
                        </h4>
                        <p className="text-xs text-[#C4B5FD]/80 mt-0.5">
                          Autonomous patch generation and business risk contextualization.
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={handleSimulateAI}
                      disabled={isSimulatingAI}
                      className="bg-rakshak-gradient text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {isSimulatingAI ? (
                        <>
                          <RotateCcw size={14} className="animate-spin" />
                          <span>Analyzing with AI...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          <span>Simulate AI Analysis</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                    <div className="p-4 rounded-2xl bg-[#090014] border border-[#2A1240]">
                      <h5 className="font-bold text-[#A855F7] mb-1.5 flex items-center gap-1.5">
                        <Cpu size={14} />
                        <span>AI Vulnerability Explanation</span>
                      </h5>
                      <p className="text-zinc-300 leading-relaxed">
                        The vulnerability allows local unprivileged attackers to escalate privileges by replacing a pathname component with a symbolic link during directory hierarchy traversal in <code className="text-pink-300 font-mono">libattr1</code>.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#090014] border border-[#2A1240]">
                      <h5 className="font-bold text-emerald-400 mb-1.5 flex items-center gap-1.5">
                        <CheckCircle2 size={14} />
                        <span>Recommended Remediation</span>
                      </h5>
                      <p className="text-zinc-300 leading-relaxed">
                        Upgrade <code className="text-pink-300 font-mono">libattr1</code> to version 2.6.0+. In container builds, verify <code className="text-zinc-200 font-mono">dpkg-query</code> paths and enforce read-only system mounts.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Bar of Demo */}
          <div className="p-4 bg-[#0A0214] border-t border-[#2A1240] flex items-center justify-between text-xs text-[#C4B5FD]/70">
            <span>Powered by Trivy SCA, Gitleaks, and Cloudflare Workers AI</span>
            <Link to="/repository-scan" className="text-white hover:text-pink-400 font-bold flex items-center gap-1">
              <span>Try with your own repository</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. CORE CAPABILITIES (4 PILLARS) */}
      {/* ========================================================= */}
      <section id="features" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge className="bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30 px-3 py-1 text-xs mb-3">
            Core Architecture
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Built for Modern DevSecOps Teams
          </h2>
          <p className="text-sm sm:text-base text-[#C4B5FD]/80 mt-3">
            Everything you need to secure your source code, container images, and software supply chain from development to production.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Pillar 1 */}
          <Card className="bg-[#12051F]/70 border-[#2A1240] hover:border-[#A855F7]/60 hover:shadow-[0_0_30px_rgba(168,85,247,0.25)] transition-all group">
            <CardContent className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/30 w-fit group-hover:scale-110 group-hover:bg-[#A855F7] group-hover:text-white transition-all">
                <Code2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#EC4899] transition-colors">
                Multi-Tool Scanning
              </h3>
              <p className="text-xs text-[#C4B5FD]/80 leading-relaxed">
                Seamless AST dependency analysis, container image filesystem scanning via Trivy, and live secret detection with Gitleaks.
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Trivy + Gitleaks Integration</span>
              </div>
            </CardContent>
          </Card>

          {/* Pillar 2 */}
          <Card className="bg-[#12051F]/70 border-[#2A1240] hover:border-[#EC4899]/60 hover:shadow-[0_0_30px_rgba(236,72,153,0.25)] transition-all group">
            <CardContent className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#EC4899]/10 text-[#EC4899] border border-[#EC4899]/30 w-fit group-hover:scale-110 group-hover:bg-[#EC4899] group-hover:text-white transition-all">
                <Sparkles size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#EC4899] transition-colors">
                Cloudflare AI Engine
              </h3>
              <p className="text-xs text-[#C4B5FD]/80 leading-relaxed">
                Leverages ultra-fast Llama-3-8b via Cloudflare Workers AI to interpret vulnerability mechanics and generate exact patch diffs.
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>Serverless Edge Inference</span>
              </div>
            </CardContent>
          </Card>

          {/* Pillar 3 */}
          <Card className="bg-[#12051F]/70 border-[#2A1240] hover:border-yellow-500/60 hover:shadow-[0_0_30px_rgba(234,179,8,0.25)] transition-all group">
            <CardContent className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 w-fit group-hover:scale-110 group-hover:bg-yellow-500 group-hover:text-black transition-all">
                <Zap size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#EC4899] transition-colors">
                Risk Prioritization
              </h3>
              <p className="text-xs text-[#C4B5FD]/80 leading-relaxed">
                Dynamically scores exploitability, public exposure vectors, and severity to eliminate alert fatigue and highlight true criticals.
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                <span>0-100 Normalized Scoring</span>
              </div>
            </CardContent>
          </Card>

          {/* Pillar 4 */}
          <Card className="bg-[#12051F]/70 border-[#2A1240] hover:border-blue-500/60 hover:shadow-[0_0_30px_rgba(59,130,246,0.25)] transition-all group">
            <CardContent className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/30 w-fit group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all">
                <FileText size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#EC4899] transition-colors">
                Audit Reports & SBOM
              </h3>
              <p className="text-xs text-[#C4B5FD]/80 leading-relaxed">
                Generate executive summary PDFs, compliance CSVs, and full JSON reports ready for DevOps integration and SOC2 audits.
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>One-Click Export</span>
              </div>
            </CardContent>
          </Card>

        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. HOW IT WORKS (3-STEP PIPELINE) */}
      {/* ========================================================= */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge className="bg-[#EC4899]/15 text-[#EC4899] border-[#EC4899]/30 px-3 py-1 text-xs mb-3">
            Workflow Overview
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            How Rakshak Works
          </h2>
          <p className="text-sm sm:text-base text-[#C4B5FD]/80 mt-3">
            From raw repository code to AI-verified remediation in three seamless steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          
          {/* Step 1 */}
          <div className="relative p-8 rounded-3xl bg-[#12051F]/80 border border-[#2A1240] hover:border-[#A855F7]/50 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30 flex items-center justify-center font-mono font-bold text-lg">
                01
              </div>
              <h3 className="text-xl font-bold text-white">Connect & Ingest</h3>
              <p className="text-xs text-[#C4B5FD]/80 leading-relaxed">
                Connect your GitHub repositories with one click or paste snippet code and Dockerfile configurations directly into the interactive scanner.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#2A1240] text-[11px] text-zinc-400 font-mono">
              → Supports GitHub, Local Files, Docker
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative p-8 rounded-3xl bg-[#12051F]/80 border border-[#2A1240] hover:border-[#EC4899]/50 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EC4899]/15 text-[#EC4899] border border-[#EC4899]/30 flex items-center justify-center font-mono font-bold text-lg">
                02
              </div>
              <h3 className="text-xl font-bold text-white">Detect & Prioritize</h3>
              <p className="text-xs text-[#C4B5FD]/80 leading-relaxed">
                Rakshak runs parallel AST parsers, Trivy scans, and Gitleaks rules to compile an actionable risk matrix ranked by exploitability.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#2A1240] text-[11px] text-zinc-400 font-mono">
              → High / Medium / Low CVSS v3 Matrix
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative p-8 rounded-3xl bg-[#12051F]/80 border border-[#2A1240] hover:border-emerald-500/50 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-lg">
                03
              </div>
              <h3 className="text-xl font-bold text-white">Remediate with AI</h3>
              <p className="text-xs text-[#C4B5FD]/80 leading-relaxed">
                Click any finding to trigger Cloudflare AI analysis, view exact patch lines, resolve threats, and track historical risk reduction metrics.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#2A1240] text-[11px] text-zinc-400 font-mono">
              → One-Click AI Remediation Guidance
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================= */}
      {/* 6. CALL TO ACTION BANNER */}
      {/* ========================================================= */}
      <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto w-full z-10">
        <div className="relative p-10 sm:p-16 rounded-3xl bg-gradient-to-br from-[#12051F] via-[#1c0733] to-[#2b0c4b] border border-[#A855F7]/40 shadow-[0_0_50px_rgba(168,85,247,0.25)] text-center flex flex-col items-center overflow-hidden">
          
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#EC4899]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#A855F7]/15 rounded-full blur-3xl pointer-events-none" />

          {/* Glowing Shield Icon */}
          <div className="relative w-16 h-16 flex items-center justify-center mb-6">
            <Shield className="w-12 h-12 text-[#A855F7] drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]" />
            <span className="absolute text-base font-black text-white leading-none">R</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-3xl">
            Start Securing Your Codebase with Rakshak Today
          </h2>

          <p className="text-sm sm:text-base text-[#C4B5FD]/90 max-w-2xl mt-4 leading-relaxed">
            Protect your repositories against supply chain vulnerabilities, container exploits, and leaked credentials in minutes.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
            <Button
              onClick={() => navigate('/register')}
              size="lg"
              className="bg-rakshak-gradient text-white font-bold px-8 py-6 rounded-2xl text-base shadow-[0_0_25px_rgba(236,72,153,0.5)] hover:scale-105 transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Get Started Free</span>
              <ArrowRight size={18} />
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/login')}
              size="lg"
              className="bg-[#12051F] border-[#2A1240] hover:border-[#A855F7] text-white font-semibold px-7 py-6 rounded-2xl text-base hover:bg-[#1C0830] transition-all cursor-pointer"
            >
              Sign In to Account
            </Button>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 7. FOOTER */}
      {/* ========================================================= */}
      <footer className="w-full bg-[#06000E] border-t border-[#2A1240] py-12 px-4 sm:px-6 z-10 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <Shield className="w-7 h-7 text-[#A855F7]" />
              <span className="absolute text-[10px] font-black text-white">R</span>
            </div>
            <div>
              <span className="text-lg font-black tracking-wider text-white-pink-gradient">
                RAKSHAK
              </span>
              <p className="text-xs text-[#C4B5FD]/60">
                AI-Powered DevSecOps Threat Detection Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-[#C4B5FD]/80">
            <Link to="/about" className="hover:text-white transition-colors">About</Link>
            <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link to="/repository-scan" className="hover:text-white transition-colors">Scanner</Link>
            <Link to="/findings" className="hover:text-white transition-colors">Findings</Link>
            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#C4B5FD]/70">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>All Systems Operational</span>
          </div>

        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-[#2A1240]/60 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} Rakshak DevSecOps Platform. Built for autonomous cyber threat defense.
        </div>
      </footer>

    </div>
  );
}
