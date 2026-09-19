import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Sliders,
  Key,
  Bell,
  Palette,
  ShieldCheck,
  Save,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export default function Settings() {
  const [activeSection, setActiveSection] = useState<'general' | 'api' | 'notifications' | 'appearance' | 'security'>('general');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // General Settings
  const [appName, setAppName] = useState(() => localStorage.getItem('rakshak_app_name') || 'Rakshak Security Platform');
  const [riskThreshold, setRiskThreshold] = useState(() => localStorage.getItem('rakshak_risk_threshold') || '75');
  const [itemsPerPage, setItemsPerPage] = useState(() => localStorage.getItem('rakshak_items_per_page') || '25');
  const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem('rakshak_auto_refresh') !== 'false');

  // API Config
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rakshak_api_key') || 'EXAMPLE_API_KEY_REDACTED_12345');
  const [apiEndpoint, setApiEndpoint] = useState(() => localStorage.getItem('rakshak_api_endpoint') || 'http://127.0.0.1:8000/api/scan');
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('rakshak_ai_model') || 'Rakshak AI (Default)');

  // Notification Preferences (Workspace Preferences)
  const [inAppAlerts, setInAppAlerts] = useState(() => localStorage.getItem('rakshak_inapp_notifications') !== 'false');
  const [criticalOnly, setCriticalOnly] = useState(() => localStorage.getItem('rakshak_notifications_critical_only') === 'true');
  const [scanCompletionNotices, setScanCompletionNotices] = useState(() => localStorage.getItem('rakshak_scan_notices') !== 'false');

  // Appearance Settings
  const [enableGlowEffects, setEnableGlowEffects] = useState(() => localStorage.getItem('rakshak_glow_effects') !== 'false');

  // Security Preferences
  const [enable2FA, setEnable2FA] = useState(() => localStorage.getItem('rakshak_enable_2fa') !== 'false');
  const [sessionTimeout, setSessionTimeout] = useState(() => localStorage.getItem('rakshak_session_timeout') || '30');
  const [githubOAuthStatus] = useState('Connected');

  const handleGlowToggle = (checked: boolean) => {
    setEnableGlowEffects(checked);
    document.documentElement.setAttribute('data-glow', checked ? 'true' : 'false');
  };

  // Save Settings to LocalStorage
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('rakshak_app_name', appName);
    localStorage.setItem('rakshak_risk_threshold', riskThreshold);
    localStorage.setItem('rakshak_items_per_page', itemsPerPage);
    localStorage.setItem('rakshak_auto_refresh', String(autoRefresh));
    localStorage.setItem('rakshak_api_key', apiKey);
    localStorage.setItem('rakshak_api_endpoint', apiEndpoint);
    localStorage.setItem('rakshak_ai_model', aiModel);
    localStorage.setItem('rakshak_inapp_notifications', String(inAppAlerts));
    localStorage.setItem('rakshak_notifications_critical_only', String(criticalOnly));
    localStorage.setItem('rakshak_scan_notices', String(scanCompletionNotices));
    localStorage.setItem('rakshak_glow_effects', String(enableGlowEffects));
    document.documentElement.setAttribute('data-glow', enableGlowEffects ? 'true' : 'false');
    localStorage.setItem('rakshak_enable_2fa', String(enable2FA));
    localStorage.setItem('rakshak_session_timeout', sessionTimeout);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <SettingsIcon className="text-neonPurple" size={28} />
            <span>Platform Settings</span>
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Manage application general settings, API configurations, notifications, appearance, and security.
          </p>
        </div>

        {savedSuccess && (
          <div className="px-4 py-2 rounded-xl bg-success/20 border border-success/40 text-success text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 size={16} />
            <span>Changes saved to localStorage!</span>
          </div>
        )}
      </div>

      {/* SECTION TABS */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-3 overflow-x-auto">
        {[
          { id: 'general', label: 'General', icon: Sliders },
          { id: 'api', label: 'API Configuration', icon: Key },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'security', label: 'Security', icon: ShieldCheck }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === tab.id
                ? 'bg-neonPurple text-white glow-neon shadow-lg'
                : 'bg-card/40 border border-border/50 text-textSecondary hover:text-white'
            }`}
          >
            <tab.icon size={14} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* SETTINGS CONTENT FORM */}
      <div className="max-w-3xl">
        <form onSubmit={handleSave} className="space-y-6">

          {/* 1. GENERAL SECTION */}
          {activeSection === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">General Settings</CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  Global application preferences and scan threshold parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">Application Name</label>
                  <Input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="bg-[#090014] border-[#2A1240] text-white text-xs h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">Risk Alert Threshold Score (1-100)</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={riskThreshold}
                    onChange={(e) => setRiskThreshold(e.target.value)}
                    className="bg-[#090014] border-[#2A1240] text-white text-xs h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">Findings Table Items Per Page</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(e.target.value)}
                    className="w-full bg-[#090014] border border-[#2A1240] text-white text-xs h-10 rounded-xl px-3 focus:outline-none focus:border-neonPurple"
                  >
                    <option value="10">10 Findings</option>
                    <option value="25">25 Findings</option>
                    <option value="50">50 Findings</option>
                    <option value="100">100 Findings</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">Auto-Refresh Dashboard Data</span>
                    <span className="text-textSecondary text-[11px]">Periodically poll backend telemetry every 30 seconds</span>
                  </div>
                  <Checkbox checked={autoRefresh} onCheckedChange={(c) => setAutoRefresh(!!c)} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2. API CONFIGURATION SECTION */}
          {activeSection === 'api' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">API & Scanner Integrations</CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  Backend connection settings and AI analyzer parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">API Secret Key Token</label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="bg-[#090014] border-[#2A1240] text-white font-mono text-xs h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">Backend Scan Service Endpoint</label>
                  <Input
                    type="text"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    className="bg-[#090014] border-[#2A1240] text-white font-mono text-xs h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">AI Analysis LLM Model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full bg-[#090014] border border-[#2A1240] text-white text-xs h-10 rounded-xl px-3 focus:outline-none focus:border-neonPurple"
                  >
                    <option value="Rakshak AI (Default)">Rakshak AI (Default)</option>
                    <option value="Rakshak AI Advanced">Rakshak AI Advanced</option>
                    <option value="DeepSeek R1 Security">DeepSeek R1 Security</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3. NOTIFICATIONS SECTION */}
          {activeSection === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">Notification Preferences</CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  Workspace preferences for in-app alert thresholds and scan completion notices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">In-App Threat Alerts</span>
                    <span className="text-textSecondary text-[11px]">Save preference to receive in-app alerts for security scan events</span>
                  </div>
                  <Checkbox checked={inAppAlerts} onCheckedChange={(c) => setInAppAlerts(!!c)} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">Critical & High Severity Threshold</span>
                    <span className="text-textSecondary text-[11px]">Save preference to filter security alerts to critical and high severity findings only</span>
                  </div>
                  <Checkbox checked={criticalOnly} onCheckedChange={(c) => setCriticalOnly(!!c)} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">Scan Completion Notices</span>
                    <span className="text-textSecondary text-[11px]">Save preference to display notification notices when repository scans complete</span>
                  </div>
                  <Checkbox checked={scanCompletionNotices} onCheckedChange={(c) => setScanCompletionNotices(!!c)} />
                </div>

                <div className="p-3.5 rounded-xl bg-[#12051F]/90 border border-border/70 text-textSecondary text-[11px] space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Bell size={13} className="text-neonPurple" />
                    <span>Notification Delivery Status</span>
                  </div>
                  <p>
                    In-app security alerts and scan notices are actively delivered to the notification bell in the top navigation bar. Preferences are applied locally to your workspace views. External notification channels (Email SMTP / Slack Webhooks) are not configured.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 4. APPEARANCE SECTION */}
          {activeSection === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">Appearance & Theme</CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  Visual identity options keeping the signature Dark + Purple + Pink + Neon theme
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="p-4 rounded-xl border border-neonPurple bg-neonPurple/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">Rakshak Dark Neon Theme (Default)</span>
                    <Badge variant="default" className="bg-rakshak-gradient text-white">Active Identity</Badge>
                  </div>
                  <p className="text-textSecondary text-xs">
                    Dark navy/black background with purple and pink neon gradients, glowing borders, and glassmorphism.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">Enable Neon Glow Effects & Glassmorphism</span>
                    <span className="text-textSecondary text-[11px]">Render real-time CSS glowing halos around security badges</span>
                  </div>
                  <Checkbox checked={enableGlowEffects} onCheckedChange={(c) => handleGlowToggle(!!c)} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 5. SECURITY SECTION */}
          {activeSection === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">Security Preferences</CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  Authentication controls, session management, and OAuth integration status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">Enforce Two-Factor Authentication (2FA)</span>
                    <span className="text-textSecondary text-[11px]">Require TOTP authenticator app verification on login</span>
                  </div>
                  <Checkbox checked={enable2FA} onCheckedChange={(c) => setEnable2FA(!!c)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">Idle Session Timeout (Minutes)</label>
                  <Input
                    type="number"
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    className="bg-[#090014] border-[#2A1240] text-white text-xs h-10 rounded-xl"
                  />
                </div>

                <div className="p-4 rounded-xl bg-[#090014] border border-[#2A1240] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">GitHub OAuth Connection Token</span>
                    <span className="text-textSecondary text-[11px]">OAuth Token Scope: read:user, repo:status, read:packages</span>
                  </div>
                  <Badge variant="success" className="text-xs">
                    {githubOAuthStatus}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SAVE CHANGES BUTTON */}
          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="gradient"
              className="h-11 px-8 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-[0_0_25px_rgba(168,85,247,0.4)]"
            >
              <Save size={16} />
              <span>Save Changes</span>
            </Button>
          </div>

        </form>
      </div>

    </div>
  );
}
