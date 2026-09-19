import { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, 
  Download, 
  Plus, 
  CheckCircle2, 
  Sparkles,
  X,
  FileDown,
  Trash2,
  Eye
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useSecurity } from '@/context/SecurityContext';
import { type SecurityReport } from '@/data/reports';

export default function Reports() {
  const { reports, addReport, deleteReport, findings, overallRiskScore } = useSecurity();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportName, setReportName] = useState('Security Report — May 19, 2025');
  const [reportType, setReportType] = useState('Full Report');
  const [includeAI, setIncludeAI] = useState(true);
  const [includeSecrets, setIncludeSecrets] = useState(true);

  // View Report Modal State
  const [viewingReport, setViewingReport] = useState<SecurityReport | null>(null);

  // Download Report
  const handleDownload = (report: SecurityReport) => {
    const crit = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;
    const med = findings.filter(f => f.severity === 'medium').length;
    const low = findings.filter(f => f.severity === 'low').length;

    const findingsListStr = findings.slice(0, 15).map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.cve}: ${f.title} (${f.package})`).join('\n');

    const content = `RAKSHAK DEVSECOPS SECURITY REPORT
----------------------------------
Report Name: ${report.name}
Type: ${report.type}
Generated On: ${report.generatedOn}
Total Findings: ${report.totalFindings}
Overall Risk Score: ${report.riskScore}/100
Status: ${report.status}

EXECUTIVE SUMMARY:
Rakshak AI DevSecOps platform analyzed repository source code, dependencies, and container environments.
Total ${report.totalFindings} findings detected (${crit} Critical, ${high} High, ${med} Medium, ${low} Low).

TOP IDENTIFIED VULNERABILITIES:
${findingsListStr || 'No active vulnerabilities recorded.'}

RECOMMENDED REMEDIATION:
1. Apply recommended patches for Critical and High priority vulnerabilities.
2. Ensure secrets and credentials are stored in secure secret managers.
3. Keep container base images and dependencies updated to latest secure releases.
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, '_')}.txt`;
    a.click();
  };

  // Generate New Report Handler
  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    addReport({
      name: reportName || 'Custom Security Audit',
      type: reportType,
      totalFindings: findings.length,
      riskScore: overallRiskScore,
      status: 'Completed',
      actions: ['View', 'Download', 'Delete'],
      size: '2.8 MB',
      format: 'PDF'
    });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <FileText className="text-neonPurple" size={28} />
            <span>Reports</span>
            <Badge variant="default" className="text-xs bg-rakshak-gradient text-white">{reports.length} Reports</Badge>
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Generate, view, and download executive security reports & DevSecOps compliance audits.
          </p>
        </div>

        <Button 
          variant="gradient" 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 text-xs cursor-pointer shadow-lg shrink-0"
        >
          <Plus size={16} />
          <span>Generate New Report</span>
        </Button>
      </div>

      {/* REPORTS TABLE */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#090014] border-b border-border/80 text-textSecondary uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Report Name</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Generated On</th>
                  <th className="px-5 py-3.5">Total Findings</th>
                  <th className="px-5 py-3.5">Risk Score</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-sans">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-textSecondary font-sans">
                      <FileText size={40} className="mx-auto text-neonPurple/40 mb-3" />
                      <p className="font-bold text-white text-sm">No reports available.</p>
                      <p className="text-xs text-textSecondary mt-1 max-w-md mx-auto">
                        Click &quot;Generate New Report&quot; above to create a DevSecOps executive audit report from your active scan findings.
                      </p>
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className="hover:bg-white/5 transition-colors">
                      {/* Report Name */}
                      <td className="px-5 py-4 font-bold text-white flex items-center gap-2.5">
                        <FileDown size={18} className="text-pinkAccent shrink-0" />
                        <span>{report.name}</span>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-4">
                        <Badge variant="outline" className="text-[10px] text-neonPurple border-neonPurple/30">
                          {report.type}
                        </Badge>
                      </td>

                      {/* Generated On */}
                      <td className="px-5 py-4 font-mono text-textSecondary">
                        {report.generatedOn}
                      </td>

                      {/* Total Findings */}
                      <td className="px-5 py-4 font-bold text-white">
                        {report.totalFindings}
                      </td>

                      {/* Risk Score */}
                      <td className="px-5 py-4 font-extrabold text-warning">
                        {report.riskScore}/100
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <Badge variant="success" className="text-[10px]">
                          {report.status}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingReport(report)}
                            className="px-2.5 py-1 rounded-lg bg-card border border-border text-textSecondary hover:text-white hover:border-neonPurple transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Eye size={14} />
                            <span>View</span>
                          </button>

                          <button
                            onClick={() => handleDownload(report)}
                            className="px-2.5 py-1 rounded-lg bg-neonPurple/10 border border-neonPurple/30 text-neonPurple hover:bg-neonPurple hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Download size={14} />
                            <span>Download</span>
                          </button>

                          <button
                            onClick={() => deleteReport(report.id)}
                            className="p-1 rounded-lg bg-card border border-border text-textSecondary hover:text-danger hover:border-danger/40 transition-all cursor-pointer"
                            title="Delete Report"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* VIEW REPORT MODAL */}
      {viewingReport && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-md p-4">
          <div className="w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto bg-[#12051F] border border-[#2A1240] rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-[#2A1240] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="text-neonPurple" size={24} />
                <div>
                  <h3 className="text-lg font-bold text-white">{viewingReport.name}</h3>
                  <p className="text-xs text-textSecondary">{viewingReport.type} • {viewingReport.generatedOn}</p>
                </div>
              </div>
              <button onClick={() => setViewingReport(null)} className="text-textSecondary hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-sans">
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[#090014] border border-[#2A1240] text-center">
                <div>
                  <span className="text-[10px] text-textSecondary uppercase">Total Findings</span>
                  <span className="text-base font-black text-white block mt-0.5">{viewingReport.totalFindings}</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary uppercase">Risk Score</span>
                  <span className="text-base font-black text-warning block mt-0.5">{viewingReport.riskScore}/100</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary uppercase">Status</span>
                  <span className="text-xs font-bold text-success block mt-1">{viewingReport.status}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#090014]/60 border border-[#2A1240] space-y-2">
                <span className="font-bold text-white block uppercase tracking-wider text-[10px]">Executive Audit Findings</span>
                <p className="text-textSecondary leading-relaxed">
                  {`Repository security scan completed with ${viewingReport.totalFindings} security findings tracked across application branches. Overall security posture is recorded at a risk index of ${viewingReport.riskScore}/100.`}
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#2A1240]">
                <Button 
                  variant="outline" 
                  onClick={() => setViewingReport(null)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button 
                  variant="gradient"
                  onClick={() => { handleDownload(viewingReport); setViewingReport(null); }}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>Download Report</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* GENERATE NEW REPORT MODAL */}
      {isModalOpen && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-md p-4">
          <div className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto bg-[#12051F] border border-[#2A1240] rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-[#2A1240] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-neonPurple" size={20} />
                <h3 className="text-lg font-bold text-white">Generate Security Report</h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-textSecondary hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGenerate} className="p-6 space-y-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="text-textSecondary font-semibold">Report Name</label>
                <Input 
                  type="text" 
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="bg-[#090014] border-[#2A1240] text-white text-xs h-10 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-textSecondary font-semibold">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full bg-[#090014] border border-[#2A1240] text-white text-xs h-10 rounded-xl px-3 focus:outline-none focus:border-neonPurple"
                >
                  <option value="Full Report">Full Security Report</option>
                  <option value="Executive Summary">Executive Summary</option>
                  <option value="Dependency Audit">Dependency Audit</option>
                  <option value="Secret Detection Audit">Secret Detection Audit</option>
                </select>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-textSecondary font-semibold block">Included Modules</label>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="incAI" checked={includeAI} onCheckedChange={(c) => setIncludeAI(!!c)} />
                    <label htmlFor="incAI" className="text-white cursor-pointer">Include AI Risk Explanations & Actionable Advice</label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="incSec" checked={includeSecrets} onCheckedChange={(c) => setIncludeSecrets(!!c)} />
                    <label htmlFor="incSec" className="text-white cursor-pointer">Include Leaked Secret & Credential Incidents</label>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#2A1240]">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>

                <Button 
                  type="submit" 
                  variant="gradient"
                  className="text-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>Generate Report</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

    </div>
  );
}
