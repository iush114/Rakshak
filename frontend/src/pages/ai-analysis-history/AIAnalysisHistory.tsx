import { useState } from 'react';
import {
  BrainCircuit,
  Eye,
  Sparkles,
  X,
  Cpu
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSecurity } from '@/context/SecurityContext';
import { type AIAnalysisRecord } from '@/data/aiAnalysisHistory';
import { motion, AnimatePresence } from 'framer-motion';

export default function AIAnalysisHistory() {
  const { aiHistory } = useSecurity();
  const [selectedRecord, setSelectedRecord] = useState<AIAnalysisRecord | null>(null);

  return (
    <div className="space-y-6 pb-12">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <BrainCircuit className="text-neonPurple" size={32} />
            <span>AI Analysis History</span>
            <Badge variant="default" className="text-xs bg-rakshak-gradient text-white">
              {aiHistory.length} Saved Analyses
            </Badge>
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            History of AI-powered vulnerability explanations, risk insights, and remediation guidance.
          </p>
        </div>
      </div>

      {/* AI ANALYSIS HISTORY TABLE */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#090014] border-b border-border/80 text-textSecondary uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5">CVE ID</th>
                  <th className="px-5 py-3.5">Title</th>
                  <th className="px-5 py-3.5">Analyzed On</th>
                  <th className="px-5 py-3.5">Risk Score</th>
                  <th className="px-5 py-3.5">AI Model</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-sans">
                {aiHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-textSecondary font-sans">
                      <BrainCircuit size={40} className="mx-auto text-neonPurple/40 mb-3" />
                      <p className="font-bold text-white text-sm">No analysis history available.</p>
                      <p className="text-xs text-textSecondary mt-1 max-w-md mx-auto">
                        To generate AI threat remediation insights, navigate to Findings and click &quot;Analyze with AI&quot; on any security vulnerability.
                      </p>
                    </td>
                  </tr>
                ) : (
                  aiHistory.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRecord(item)}
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      {/* CVE ID */}
                      <td className="px-5 py-4 font-mono font-bold text-neonPurple whitespace-nowrap">
                        {item.cve}
                      </td>

                      {/* Title */}
                      <td className="px-5 py-4 font-medium text-white max-w-sm truncate" title={item.title}>
                        {item.title}
                      </td>

                      {/* Analyzed On */}
                      <td className="px-5 py-4 font-mono text-textSecondary whitespace-nowrap">
                        {item.analyzedOn}
                      </td>

                      {/* Risk Score */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-black text-warning text-sm">{item.riskScore}/100</span>
                      </td>

                      {/* AI Model */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] text-pinkAccent border-pinkAccent/30 flex items-center gap-1 w-fit">
                          <Cpu size={12} />
                          <span>{item.aiModel}</span>
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedRecord(item); }}
                          className="px-3 py-1.5 rounded-lg bg-neonPurple/10 border border-neonPurple/30 text-neonPurple hover:bg-neonPurple hover:text-white transition-all flex items-center gap-1.5 ml-auto cursor-pointer text-xs font-semibold"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI ANALYSIS RECORD DETAILS MODAL */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#12051F] border border-[#2A1240] rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#2A1240] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-neonPurple/20 text-neonPurple border border-neonPurple/30">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white font-mono">{selectedRecord.cve}</h2>
                    <p className="text-xs text-textSecondary">{selectedRecord.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-textSecondary hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 text-xs font-sans">

                {/* Metadata Pills */}
                <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[#090014] border border-[#2A1240] text-center">
                  <div>
                    <span className="text-[10px] text-textSecondary uppercase">Analyzed On</span>
                    <span className="text-xs font-mono text-white block mt-0.5">{selectedRecord.analyzedOn}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-textSecondary uppercase">Risk Score</span>
                    <span className="text-sm font-black text-warning block mt-0.5">{selectedRecord.riskScore}/100</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-textSecondary uppercase">AI Model</span>
                    <span className="text-xs font-bold text-pinkAccent block mt-0.5">{selectedRecord.aiModel}</span>
                  </div>
                </div>

                {/* AI Explanation */}
                <div className="p-4 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                  <span className="font-bold text-neonPurple uppercase tracking-wider text-[10px] block">AI Explanation</span>
                  <p className="text-white leading-relaxed">{selectedRecord.explanation}</p>
                </div>

                {/* Potential Impact */}
                <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 space-y-1">
                  <span className="font-bold text-danger uppercase tracking-wider text-[10px] block">Potential Impact</span>
                  <p className="text-foreground leading-relaxed">{selectedRecord.potentialImpact}</p>
                </div>

                {/* Recommended Action */}
                <div className="p-4 rounded-xl bg-success/10 border border-success/30 space-y-1">
                  <span className="font-bold text-success uppercase tracking-wider text-[10px] block">Recommended Action</span>
                  <p className="text-white font-medium leading-relaxed">{selectedRecord.recommendedAction}</p>
                </div>

                {/* Risk Summary */}
                <div className="p-4 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                  <span className="font-bold text-warning uppercase tracking-wider text-[10px] block">Risk Summary</span>
                  <p className="text-textSecondary leading-relaxed">{selectedRecord.riskSummary}</p>
                </div>

                {/* Close Button */}
                <div className="pt-3 flex justify-end border-t border-[#2A1240]">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedRecord(null)}
                    className="text-xs"
                  >
                    Close
                  </Button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
