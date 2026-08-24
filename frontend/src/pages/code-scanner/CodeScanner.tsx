import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Code2, 
  UploadCloud, 
  Search, 
  Trash2, 
  FileCode, 
  Sparkles, 
  ShieldAlert, 
  Key, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle, 
  ChevronRight, 
  X, 
  Copy, 
  FileText, 
  Box, 
  Terminal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSecurity, type FindingItem } from '@/context/SecurityContext';
import { performSecurityScan, type CodeScanResponse } from '@/services/scannerService';
import { motion, AnimatePresence } from 'framer-motion';

// Code Sample Presets for Quick Testing
const SAMPLE_PRESETS: { [key: string]: { lang: string; code: string } } = {
  python_vulnerable: {
    lang: 'python',
    code: `# Vulnerable Python Web API Service
import os
import sqlite3

# Exposed Cloud Credentials (Demo)
AWS_ACCESS_KEY_ID = "EXAMPLE_AWS_KEY_REDACTED"
AWS_SECRET_ACCESS_KEY = "EXAMPLE_AWS_SECRET_REDACTED"

def search_user(user_id):
    conn = sqlite3.connect('app.db')
    cursor = conn.cursor()
    # SQL Injection Vulnerability: direct string concatenation
    query = "SELECT * FROM users WHERE id=" + user_id
    cursor.execute(query)
    return cursor.fetchall()

def execute_command(user_input):
    # Remote Code Execution (RCE) Vulnerability
    return eval(user_input)
`
  },
  javascript_eval: {
    lang: 'javascript',
    code: `// Vulnerable Node.js Authentication Controller
const http = require('http');
const url = require('url');

const STRIPE_KEY = "EXAMPLE_STRIPE_SECRET_REDACTED";

const server = http.createServer((req, res) => {
  if (req.url === '/eval' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      // Dynamic Unsafe Code Execution
      const result = eval(body);
      res.writeHead(200);
      res.end(JSON.stringify({ result }));
    });
  }
});

server.listen(3000);
`
  },
  dockerfile_root: {
    lang: 'dockerfile',
    code: `FROM node:18-alpine
WORKDIR /app
COPY . .
# Running container as root user
USER root
EXPOSE 22
CMD ["npm", "start"]
`
  }
};

const LANGUAGES = [
  { id: 'python', name: 'Python' },
  { id: 'javascript', name: 'JavaScript' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'java', name: 'Java' },
  { id: 'c', name: 'C' },
  { id: 'cpp', name: 'C++' },
  { id: 'php', name: 'PHP' },
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'yaml', name: 'YAML' },
  { id: 'json', name: 'JSON' },
  { id: 'dockerfile', name: 'Dockerfile' },
  { id: 'shell', name: 'Shell Script' },
  { id: 'dotenv', name: '.env File' },
];

const SCAN_STAGES = [
  'Uploading Code & Assets',
  'Code Structure Analysis',
  'Vulnerability Detection',
  'Secret Detection – Gitleaks',
  'Dependency / Security Analysis',
  'Risk Assessment Engine',
  'AI Security Analysis',
  'Generating Security Score'
];

export default function CodeScanner() {
  const navigate = useNavigate();
  const { addScanResult, addReport } = useSecurity();

  const [mode, setMode] = useState<'paste' | 'upload'>('paste');
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(SAMPLE_PRESETS.python_vulnerable.code);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStageIndex, setScanStageIndex] = useState(0);
  const [scanResult, setScanResult] = useState<CodeScanResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected Finding for Code View Drawer
  const [selectedFinding, setSelectedFinding] = useState<FindingItem | null>(null);
  const [copiedFix, setCopiedFix] = useState(false);

  // Preload code presets
  const loadPreset = (presetKey: string) => {
    const preset = SAMPLE_PRESETS[presetKey];
    if (preset) {
      setLanguage(preset.lang);
      setCode(preset.code);
    }
  };

  // Drag & drop file handler
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      setUploadedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Start Security Scan Procedure
  const handleStartScan = async () => {
    setErrorMsg(null);

    // Validation
    if (mode === 'paste' && !code.trim()) {
      setErrorMsg('Please paste or enter valid source code before scanning.');
      return;
    }
    if (mode === 'upload' && uploadedFiles.length === 0) {
      setErrorMsg('Please upload at least one file or project archive to scan.');
      return;
    }

    setIsScanning(true);
    setScanStageIndex(0);
    setScanResult(null);

    // Animate stage progress simulation
    for (let i = 0; i < SCAN_STAGES.length; i++) {
      setScanStageIndex(i);
      await new Promise(res => setTimeout(res, 350));
    }

    try {
      const result = await performSecurityScan({
        code: mode === 'paste' ? code : undefined,
        files: mode === 'upload' ? uploadedFiles : undefined,
        language: mode === 'paste' ? language : undefined,
        projectName: mode === 'upload' && uploadedFiles.length > 0 ? uploadedFiles[0].name : 'Pasted Code Snippet'
      });

      setScanResult(result);
      
      // Persist scan result automatically into global Security Context!
      addScanResult({
        scanId: result.scanId,
        repoName: mode === 'upload' && uploadedFiles.length > 0 ? uploadedFiles[0].name : `source_${language}_snippet`,
        score: result.score,
        findings: result.findings,
        secrets: result.secrets,
        duration: '1.2s'
      });
    } catch (_err) {
      setErrorMsg('Security scan service encountered an unexpected error. Please check your file format and try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopyCodeFix = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFix(true);
    setTimeout(() => setCopiedFix(false), 2000);
  };

  const handleSaveToReports = () => {
    if (!scanResult) return;
    addReport({
      name: `Code Scan Audit - ${scanResult.scanId}`,
      type: 'Technical Vulnerability Report',
      totalFindings: scanResult.totalFindings,
      riskScore: scanResult.score,
      status: 'Completed',
      actions: ['View', 'Download', 'Delete'],
      size: '1.8 MB',
      format: 'PDF'
    });
    navigate('/reports');
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Code2 className="text-neonPurple" size={32} />
            <span>Code Scanner</span>
            <Badge variant="default" className="bg-rakshak-gradient text-white">DevSecOps Engine</Badge>
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Analyze your source code for security vulnerabilities, exposed secrets and potential threats.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-card/80 border border-border">
          <button
            onClick={() => { setMode('paste'); setScanResult(null); }}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mode === 'paste' 
                ? 'bg-neonPurple text-white glow-neon shadow-lg' 
                : 'text-textSecondary hover:text-white'
            }`}
          >
            <FileCode size={15} />
            <span>Paste Code</span>
          </button>
          <button
            onClick={() => { setMode('upload'); setScanResult(null); }}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mode === 'upload' 
                ? 'bg-neonPurple text-white glow-neon shadow-lg' 
                : 'text-textSecondary hover:text-white'
            }`}
          >
            <UploadCloud size={15} />
            <span>Upload Project</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-danger/15 border border-danger/40 text-danger text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} />
            {errorMsg}
          </span>
          <button onClick={() => setErrorMsg(null)} className="text-danger hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. Main Mode Input Area (Hidden while scanning or showing results) */}
      {!isScanning && !scanResult && (
        <Card className="border-border bg-card/80 shadow-2xl backdrop-blur-xl">
          <CardContent className="p-6 space-y-6">
            
            {/* PASTE CODE MODE */}
            {mode === 'paste' ? (
              <div className="space-y-4">
                
                {/* Editor Control Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-textSecondary font-semibold">Language:</span>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="bg-card border border-border text-white text-xs rounded-lg px-3 py-1.5 focus:border-neonPurple focus:outline-none"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.id} value={lang.id}>{lang.name}</option>
                      ))}
                    </select>

                    <div className="hidden sm:flex items-center gap-2 ml-4">
                      <span className="text-[11px] text-textSecondary font-mono">Load Sample:</span>
                      <button
                        onClick={() => loadPreset('python_vulnerable')}
                        className="px-2.5 py-1 rounded bg-card hover:bg-neonPurple/20 text-[11px] text-neonPurple border border-border transition-colors cursor-pointer"
                      >
                        Python RCE & SQLi
                      </button>
                      <button
                        onClick={() => loadPreset('javascript_eval')}
                        className="px-2.5 py-1 rounded bg-card hover:bg-neonPurple/20 text-[11px] text-pinkAccent border border-border transition-colors cursor-pointer"
                      >
                        Node.js Eval
                      </button>
                      <button
                        onClick={() => loadPreset('dockerfile_root')}
                        className="px-2.5 py-1 rounded bg-card hover:bg-neonPurple/20 text-[11px] text-warning border border-border transition-colors cursor-pointer"
                      >
                        Dockerfile Root
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCode('')}
                      className="text-xs text-textSecondary hover:text-danger hover:bg-danger/10"
                    >
                      <Trash2 size={14} className="mr-1" />
                      <span>Clear</span>
                    </Button>
                  </div>
                </div>

                {/* Monaco Code Editor Container */}
                <div className="h-96 rounded-xl overflow-hidden border border-[#2A1240] bg-[#090014]">
                  <Editor
                    height="100%"
                    language={language}
                    theme="vs-dark"
                    value={code}
                    onChange={(value) => setCode(value || '')}
                    options={{
                      fontSize: 13,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      padding: { top: 12, bottom: 12 },
                      lineNumbersMinChars: 3,
                    }}
                  />
                </div>

                {/* Action Bar */}
                <div className="flex justify-end pt-2">
                  <Button
                    variant="gradient"
                    onClick={handleStartScan}
                    className="h-12 px-8 text-base font-bold flex items-center gap-2 shadow-[0_0_25px_rgba(168,85,247,0.5)]"
                  >
                    <Search size={18} />
                    <span>🔍 Scan Code</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* UPLOAD PROJECT MODE */
              <div className="space-y-6">
                {/* Drag & Drop Box */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className="p-10 rounded-2xl border-2 border-dashed border-[#A855F7]/40 bg-[#090014]/60 hover:bg-[#12051F]/80 transition-all text-center flex flex-col items-center justify-center cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-neonPurple/10 border border-neonPurple/30 flex items-center justify-center text-neonPurple mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud size={32} />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">
                    Drag & Drop your files or project archive here
                  </h3>
                  <p className="text-xs text-textSecondary mb-4 max-w-md">
                    Supports individual source code files (.py, .js, .java, .cpp), configuration files (.json, .yaml, .env), or full ZIP project archives.
                  </p>

                  <label className="cursor-pointer">
                    <span className="px-5 py-2.5 rounded-lg bg-rakshak-gradient text-white font-bold text-xs shadow-lg hover:opacity-90 inline-block">
                      Browse Files
                    </span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Uploaded File List */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider">
                      Selected Files ({uploadedFiles.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-[#090014] border border-[#2A1240] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3 font-mono">
                            <FileCode size={16} className="text-neonPurple" />
                            <span className="text-white font-semibold">{file.name}</span>
                            <span className="text-[#C4B5FD]/60 text-[11px]">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button
                            onClick={() => removeFile(idx)}
                            className="text-textSecondary hover:text-danger p-1 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scan Button */}
                <div className="flex justify-end pt-4 border-t border-border/50">
                  <Button
                    variant="gradient"
                    onClick={handleStartScan}
                    disabled={uploadedFiles.length === 0}
                    className="h-12 px-8 text-base font-bold flex items-center gap-2 shadow-[0_0_25px_rgba(168,85,247,0.5)]"
                  >
                    <Search size={18} />
                    <span>🔍 Start Security Scan</span>
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* 3. MULTI-STAGE SCANNING ANIMATION INTERFACE */}
      {isScanning && (
        <Card className="bg-[#12051F]/90 border-[#A855F7]/40 shadow-2xl p-8 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto space-y-8 text-center">
            
            {/* Top Scanning Radar Orb */}
            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-neonPurple/40 animate-ping opacity-75" />
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#ec4899] p-[2px] glow-neon">
                <div className="w-full h-full bg-[#12051F] rounded-full flex items-center justify-center">
                  <RefreshCw size={36} className="text-neonPurple animate-spin" />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">Executing DevSecOps Security Pipeline</h2>
              <p className="text-xs text-textSecondary mt-1">
                Trivy AST • Gitleaks Secrets • Custom Risk Engine • Rakshak AI Analyzer
              </p>
            </div>

            {/* Stage Progress List */}
            <div className="space-y-3 text-left bg-[#090014] p-5 rounded-2xl border border-[#2A1240]">
              {SCAN_STAGES.map((stageName, idx) => {
                const isCompleted = idx < scanStageIndex;
                const isCurrent = idx === scanStageIndex;

                return (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      {isCompleted ? (
                        <CheckCircle2 size={16} className="text-success shrink-0" />
                      ) : isCurrent ? (
                        <RefreshCw size={16} className="text-neonPurple animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                      )}
                      <span className={isCompleted ? "text-white font-medium" : isCurrent ? "text-neonPurple font-bold animate-pulse" : "text-textSecondary/50"}>
                        {stageName}
                      </span>
                    </div>

                    <span className="font-mono text-[11px] text-textSecondary">
                      {isCompleted ? "DONE" : isCurrent ? "SCANNING..." : "WAITING"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Outer Progress Bar */}
            <div className="w-full bg-[#090014] h-2 rounded-full overflow-hidden border border-[#2A1240]">
              <div 
                className="h-full bg-rakshak-gradient transition-all duration-300 rounded-full"
                style={{ width: `${((scanStageIndex + 1) / SCAN_STAGES.length) * 100}%` }}
              />
            </div>

          </div>
        </Card>
      )}

      {/* 4. SCAN RESULT DASHBOARD */}
      {scanResult && !isScanning && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Top Score Banner + Risk Badge */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Security Score Meter */}
            <Card className="lg:col-span-5 bg-gradient-to-br from-[#12051F] to-[#1e0736] border-neonPurple/40 glow-neon">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Overall Security Score</span>
                
                {/* Radial Score Gauge */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-border"
                      strokeWidth="3"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={scanResult.score >= 75 ? "text-success" : scanResult.score >= 50 ? "text-warning" : "text-danger"}
                      strokeDasharray={`${scanResult.score}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-white">{scanResult.score}</span>
                    <span className="text-xs text-textSecondary font-bold">/ 100</span>
                  </div>
                </div>

                <div className="mt-4">
                  <Badge variant={scanResult.score >= 75 ? "success" : scanResult.score >= 50 ? "medium" : "critical"} className="px-4 py-1 text-xs">
                    RISK LEVEL: {scanResult.riskLevel}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* KPI Cards Grid */}
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <span className="text-[10px] font-bold text-textSecondary uppercase block">Total Findings</span>
                <span className="text-3xl font-black text-white mt-1 block">{scanResult.totalFindings}</span>
              </Card>

              <Card className="p-4 text-center border-danger/40">
                <span className="text-[10px] font-bold text-danger uppercase block">Critical</span>
                <span className="text-3xl font-black text-danger mt-1 block">{scanResult.criticalCount}</span>
              </Card>

              <Card className="p-4 text-center border-pinkAccent/40">
                <span className="text-[10px] font-bold text-pinkAccent uppercase block">High</span>
                <span className="text-3xl font-black text-pinkAccent mt-1 block">{scanResult.highCount}</span>
              </Card>

              <Card className="p-4 text-center border-warning/40">
                <span className="text-[10px] font-bold text-warning uppercase block">Medium</span>
                <span className="text-3xl font-black text-warning mt-1 block">{scanResult.mediumCount}</span>
              </Card>

              <Card className="p-4 text-center border-warning/50 col-span-2">
                <span className="text-[10px] font-bold text-warning uppercase block flex items-center justify-center gap-1">
                  <Key size={12} />
                  Secrets Detected
                </span>
                <span className="text-2xl font-black text-white mt-1 block">{scanResult.secretsCount}</span>
              </Card>

              <Card className="p-4 text-center col-span-2">
                <span className="text-[10px] font-bold text-textSecondary uppercase block flex items-center justify-center gap-1">
                  <Box size={12} />
                  Vulnerable Deps
                </span>
                <span className="text-2xl font-black text-white mt-1 block">{scanResult.vulnerableDependenciesCount}</span>
              </Card>
            </div>

          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScanResult(null)}
                className="text-xs flex items-center gap-1.5"
              >
                <RefreshCw size={14} />
                <span>Scan Again</span>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/findings')}
                className="text-xs flex items-center gap-1.5"
              >
                <ShieldAlert size={14} className="text-neonPurple" />
                <span>View Findings</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/ai-analysis')}
                className="text-xs flex items-center gap-1.5"
              >
                <Sparkles size={14} className="text-pinkAccent" />
                <span>AI Analysis</span>
              </Button>

              <Button
                variant="gradient"
                size="sm"
                onClick={handleSaveToReports}
                className="text-xs flex items-center gap-1.5"
              >
                <FileText size={14} />
                <span>Generate & Download Report</span>
              </Button>
            </div>
          </div>

          {/* 5. FINDINGS TABLE */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="text-neonPurple" size={20} />
                  <span>Detected Code Vulnerabilities</span>
                </CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  AST & SCA security scan results
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#090014] border-b border-border/80 text-textSecondary uppercase font-semibold">
                    <tr>
                      <th className="px-5 py-3.5">Severity</th>
                      <th className="px-5 py-3.5">Finding Title</th>
                      <th className="px-5 py-3.5">File</th>
                      <th className="px-5 py-3.5">Line</th>
                      <th className="px-5 py-3.5">Detection Tool</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {scanResult.findings.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedFinding(item)}
                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        <td className="px-5 py-4">
                          <Badge variant={item.severity}>
                            {item.severity.toUpperCase()}
                          </Badge>
                        </td>

                        <td className="px-5 py-4 font-semibold text-white">
                          {item.description}
                        </td>

                        <td className="px-5 py-4 font-mono text-neonPurple">
                          {item.affectedFiles[0] || 'submitted_code'}
                        </td>

                        <td className="px-5 py-4 font-mono font-bold text-pinkAccent">
                          Line {item.lineNumber || 1}
                        </td>

                        <td className="px-5 py-4">
                          <Badge variant="outline" className="text-[10px] border-border text-textSecondary">
                            {item.tool || 'Rakshak AST'}
                          </Badge>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <ChevronRight size={18} className="inline text-textSecondary group-hover:text-neonPurple group-hover:translate-x-1 transition-all" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 6. AI SECURITY ANALYSIS PANEL */}
          <Card className="bg-gradient-to-br from-[#12051F] via-[#1c0733] to-[#250942] border-[#A855F7]/40 shadow-2xl">
            <CardHeader className="border-b border-[#2A1240] pb-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-neonPurple/20 text-neonPurple">
                  <Sparkles size={22} className="animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-white">AI Security Analysis</CardTitle>
                  <CardDescription className="text-xs text-textSecondary">
                    AI-assisted analysis generated by Rakshak AI reasoning engine
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-success border-success/30">AI-Assisted</Badge>
            </CardHeader>

            <CardContent className="p-6 space-y-6 text-xs text-foreground leading-relaxed">
              
              <div className="p-4 rounded-xl bg-[#090014]/80 border border-[#2A1240] space-y-1">
                <span className="font-bold text-neonPurple text-xs uppercase tracking-wider block">Security Summary</span>
                <p>{scanResult.aiAnalysis.summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 space-y-2">
                  <span className="font-bold text-danger text-xs uppercase tracking-wider block flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    Most Dangerous Issues
                  </span>
                  <ul className="space-y-1.5 font-mono text-[11px] text-foreground/90">
                    {scanResult.aiAnalysis.mostDangerousIssues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-danger font-bold">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 space-y-2">
                  <span className="font-bold text-warning text-xs uppercase tracking-wider block">Why It Matters</span>
                  <p>{scanResult.aiAnalysis.whyItMatters}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#090014] border border-[#2A1240] space-y-3 font-mono">
                <span className="font-bold text-white text-xs uppercase tracking-wider block font-sans flex items-center gap-2">
                  <Terminal size={16} className="text-neonPurple" />
                  Recommended Fixes & Secure Alternatives
                </span>
                <ul className="space-y-2 text-xs text-textSecondary">
                  {scanResult.aiAnalysis.recommendedFixes.map((fix, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-foreground/90">
                      <span className="text-success font-bold">✓</span>
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </CardContent>
          </Card>

          {/* 7. SECRETS DETECTION (GITLEAKS) */}
          {scanResult.secrets.length > 0 && (
            <Card className="border-danger/40 bg-gradient-to-br from-[#12051F] to-[#24081c]">
              <CardHeader className="border-b border-danger/30">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Key className="text-danger animate-pulse" size={20} />
                  <span>Exposed Secrets (Gitleaks Detection)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {scanResult.secrets.map((sec) => (
                  <div key={sec.id} className="p-4 rounded-xl bg-[#090014] border border-danger/40 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="font-mono text-sm font-bold text-white block">{sec.type}</span>
                      <span className="font-mono text-xs text-textSecondary">File: {sec.filePath} (Line {sec.line})</span>
                    </div>

                    <div className="px-4 py-2 rounded-lg bg-card border border-border font-mono text-xs text-danger font-bold">
                      {sec.maskedSecret}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

        </div>
      )}

      {/* 8. VULNERABLE CODE VIEW DRAWER */}
      <AnimatePresence>
        {selectedFinding && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-md">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-2xl bg-[#12051F] border-l border-[#2A1240] h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#2A1240] pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-neonPurple/10 text-neonPurple border border-neonPurple/20">
                      <ShieldAlert size={22} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white font-mono">{selectedFinding.cve}</h2>
                      <p className="text-xs text-textSecondary">{selectedFinding.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFinding(null)}
                    className="p-2 rounded-lg bg-card/60 text-textSecondary hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Vulnerable Code Line View */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#090014] border border-danger/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-danger font-bold">Line {selectedFinding.lineNumber || 1}</span>
                      <span className="text-textSecondary">{selectedFinding.affectedFiles[0] || 'source_file.py'}</span>
                    </div>

                    <div className="p-3 rounded bg-card/80 border border-border font-mono text-xs text-pinkAccent overflow-x-auto">
                      <code>{selectedFinding.codeSnippet || `query = "SELECT * FROM users WHERE id=" + user_id`}</code>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 space-y-1 text-xs">
                    <h4 className="font-bold text-warning uppercase">Why is this dangerous?</h4>
                    <p className="text-textSecondary leading-relaxed">{selectedFinding.aiExplanation}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-success/10 border border-success/30 space-y-3 text-xs">
                    <h4 className="font-bold text-success uppercase">Recommended Fix</h4>
                    <p className="text-textSecondary leading-relaxed">{selectedFinding.recommendedFix}</p>

                    <div className="p-3 rounded bg-[#090014] border border-success/30 flex items-center justify-between font-mono text-xs">
                      <code className="text-success">cursor.execute("SELECT * FROM users WHERE id=?", (user_id,))</code>
                      <button
                        onClick={() => handleCopyCodeFix('cursor.execute("SELECT * FROM users WHERE id=?", (user_id,))')}
                        className="text-textSecondary hover:text-white flex items-center gap-1 text-xs"
                      >
                        <Copy size={13} />
                        <span>{copiedFix ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-[#2A1240] flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setSelectedFinding(null)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
