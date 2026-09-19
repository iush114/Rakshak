import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, History } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getScan, getScans, type ScanDetail, type ScanHistoryItem } from '@/services/api';

const PAGE_SIZE = 20;

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'In progress';
}

function statusVariant(status: string): 'success' | 'critical' | 'medium' | 'info' {
  const value = status.toLowerCase();
  if (value === 'completed' || value === 'passed') return 'success';
  if (value === 'failed') return 'critical';
  if (value === 'running' || value === 'queued') return 'medium';
  return 'info';
}

function gateVariant(status: string | null): 'success' | 'critical' | 'medium' | 'info' {
  if (status === 'PASS') return 'success';
  if (status === 'FAIL') return 'critical';
  if (status === 'ERROR') return 'critical';
  return 'medium';
}

function duration(scan: ScanHistoryItem) {
  if (!scan.started_at || !scan.completed_at) return 'In progress';
  const seconds = Math.max(0, (new Date(scan.completed_at).getTime() - new Date(scan.started_at).getTime()) / 1000);
  return `${seconds.toFixed(1)}s`;
}

function SeverityCounts({ scan }: { scan: ScanHistoryItem }) {
  return <div className="flex flex-wrap gap-2 text-xs">
    <Badge variant="critical">C {scan.critical}</Badge>
    <Badge variant="high">H {scan.high}</Badge>
    <Badge variant="medium">M {scan.medium}</Badge>
    <Badge variant="low">L {scan.low}</Badge>
  </div>;
}

export default function ScanHistory() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<ScanHistoryItem[]>([]);
  const [detail, setDetail] = useState<ScanDetail | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [repository, setRepository] = useState('');
  const [status, setStatus] = useState('');
  const [eventType, setEventType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId) return;
    setLoading(true);
    setError(null);
    getScan(scanId).then(setDetail).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, [scanId]);

  useEffect(() => {
    if (scanId) return;
    setLoading(true);
    setError(null);
    getScans({ repository: repository || undefined, status: status || undefined, event_type: eventType || undefined, limit: PAGE_SIZE, offset })
      .then((data) => { setItems(data.items); setTotal(data.total); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [scanId, repository, status, eventType, offset]);

  if (scanId) {
    if (loading) return <p className="text-sm text-textSecondary">Loading scan details...</p>;
    if (error || !detail) return <div className="space-y-4"><p className="text-sm text-danger">{error || 'Scan not found.'}</p><Button variant="outline" onClick={() => navigate('/scan-history')}>Back to Scan History</Button></div>;
    return <div className="space-y-6 pb-12">
      <Button variant="ghost" onClick={() => navigate('/scan-history')} className="gap-2"><ArrowLeft size={16} /> Back to Scan History</Button>
      <div><h1 className="text-3xl font-extrabold text-foreground">Scan Details</h1><p className="text-sm text-textSecondary mt-1 font-mono">{detail.scan_id}</p></div>
      <Card><CardContent className="p-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 text-sm"><div className="sm:col-span-2 flex items-center justify-between"><strong className="text-lg">{detail.repository || detail.target_path}</strong><Badge variant={statusVariant(detail.status)}>{detail.status}</Badge></div><div><span className="text-textSecondary block">Security Gate</span><Badge variant={gateVariant(detail.security_gate_status)}>{detail.security_gate_status || 'UNKNOWN'}</Badge><span className="text-textSecondary block mt-1">{detail.security_gate_reason || 'No persisted gate result.'}</span></div><div><span className="text-textSecondary block">Event</span><strong>{detail.event_type}</strong></div><div><span className="text-textSecondary block">Branch / ref</span><strong>{detail.ref || 'Not specified'}</strong></div><div><span className="text-textSecondary block">Commit</span><strong className="font-mono">{detail.commit_sha ? detail.commit_sha.slice(0, 12) : 'Not specified'}</strong></div><div><span className="text-textSecondary block">Risk score</span><strong>{detail.overall_risk.toFixed(1)}</strong></div><div><span className="text-textSecondary block">Started</span><strong>{formatDate(detail.started_at)}</strong></div><div><span className="text-textSecondary block">Completed</span><strong>{formatDate(detail.completed_at)}</strong></div><div><span className="text-textSecondary block">Duration</span><strong>{duration(detail)}</strong></div><div><span className="text-textSecondary block">Findings</span><strong>{detail.total_findings}</strong></div></CardContent></Card>
      <Card><CardContent className="p-5 space-y-3"><h2 className="text-xl font-bold">Findings</h2><SeverityCounts scan={detail} />{detail.findings.length === 0 ? <p className="text-sm text-textSecondary pt-3">No findings were recorded for this scan.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-textSecondary"><tr><th className="pb-3">Vulnerability</th><th className="pb-3">Title</th><th className="pb-3">Severity</th><th className="pb-3">Lifecycle</th><th className="pb-3">Risk</th></tr></thead><tbody>{detail.findings.map((finding) => <tr key={finding.id} className="border-t border-border/50"><td className="py-3 font-mono">{finding.vulnerability_id}</td><td className="py-3">{finding.title}</td><td className="py-3"><Badge variant={statusVariant(finding.severity)}>{finding.severity}</Badge></td><td className="py-3"><Badge variant={finding.lifecycle_status === 'fixed' ? 'success' : finding.lifecycle_status === 'reopened' ? 'high' : finding.lifecycle_status === 'new' ? 'info' : 'outline'}>{(finding.lifecycle_status || 'open').toUpperCase()}</Badge></td><td className="py-3">{finding.risk_score}</td></tr>)}</tbody></table></div>}</CardContent></Card>
    </div>;
  }

  const hasPrevious = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;
  return <div className="space-y-6 pb-12"><div><h1 className="text-3xl font-extrabold flex items-center gap-3"><History className="text-neonPurple" size={28} /> Scan History</h1><p className="text-sm text-textSecondary mt-1">Review completed and in-progress security scans.</p></div><Card><CardContent className="p-4 grid gap-3 md:grid-cols-4"><label className="text-xs text-textSecondary">Repository<input value={repository} onChange={(e) => { setRepository(e.target.value); setOffset(0); }} placeholder="owner/repository" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-neonPurple" /></label><label className="text-xs text-textSecondary">Status<select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">All statuses</option><option value="completed">Completed</option><option value="running">Running</option><option value="failed">Failed</option><option value="queued">Queued</option></select></label><label className="text-xs text-textSecondary">Event type<select value={eventType} onChange={(e) => { setEventType(e.target.value); setOffset(0); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">All events</option><option value="manual">Manual</option><option value="push">Push</option><option value="pull_request">Pull request</option></select></label><div className="flex items-end text-xs text-textSecondary"><Clock size={15} className="mr-2" />{total} total scans</div></CardContent></Card>{loading ? <p className="text-sm text-textSecondary">Loading scan history...</p> : error ? <p className="text-sm text-danger">{error}</p> : items.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-textSecondary">No scans match the selected filters.</CardContent></Card> : <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-textSecondary"><tr><th className="p-4">Scan</th><th className="p-4">Repository</th><th className="p-4">Event</th><th className="p-4">Status</th><th className="p-4">Findings</th><th className="p-4">Risk</th><th className="p-4">Started</th><th className="p-4"></th></tr></thead><tbody>{items.map((scan) => <tr key={scan.scan_id} className="border-t border-border/50 hover:bg-white/5"><td className="p-4 font-mono text-xs">{scan.scan_id.slice(0, 8)}</td><td className="p-4">{scan.repository || scan.target_path}</td><td className="p-4">{scan.event_type}</td><td className="p-4"><Badge variant={statusVariant(scan.status)}>{scan.status}</Badge></td><td className="p-4"><div className="space-y-2"><strong>{scan.total_findings}</strong><SeverityCounts scan={scan} /></div></td><td className="p-4">{scan.risk_score.toFixed(1)}</td><td className="p-4 whitespace-nowrap"><Clock size={13} className="inline mr-1" />{formatDate(scan.started_at)}</td><td className="p-4"><Button size="sm" variant="outline" onClick={() => navigate(`/scan-history/${scan.scan_id}`)}>View</Button></td></tr>)}</tbody></table></CardContent></Card>}<div className="flex items-center justify-between"><span className="text-xs text-textSecondary">Showing {total === 0 ? 0 : offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!hasPrevious} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={15} /> Previous</Button><Button size="sm" variant="outline" disabled={!hasNext} onClick={() => setOffset(offset + PAGE_SIZE)}>Next <ChevronRight size={15} /></Button></div></div></div>;
}
