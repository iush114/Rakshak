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

  // API Config (UI only - Demo)
  const [apiKey, setApiKey] = useState('EXAMPLE_API_KEY_REDACTED_12345');
  const [apiEndpoint, setApiEndpoint] = useState('https://api.rakshak.sec/v1/scan');
  const [aiModel, setAiModel] = useState('Rakshak AI (Default)');

  // Notifications Settings
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/DEMO/WEBHOOK');
  const [criticalOnly, setCriticalOnly] = useState(true);

  // Appearance Settings
  const [enableGlowEffects, setEnableGlowEffects] = useState(true);

  // Security Preferences
  const [enable2FA, setEnable2FA] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [githubOAuthStatus] = useState('Connected');

  // Save Settings to LocalStorage
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('rakshak_app_name', appName);
    localStorage.setItem('rakshak_risk_threshold', riskThreshold);
    localStorage.setItem('rakshak_items_per_page', itemsPerPage);
    localStorage.setItem('rakshak_auto_refresh', String(autoRefresh));

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
                  <label className="text-textSecondary font-semibold">Critical Risk Score Threshold (0-100)</label>
                  <Input 
                    type="number" 
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
                    <option value="10">10 items</option>
                    <option value="25">25 items</option>
                    <option value="50">50 items</option>
                    <option value="100">100 items</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#090014] border border-[#2A1240] pt-3">
                  <div>
                    <span className="font-bold text-white block">Auto Refresh Dashboard Data</span>
                    <span className="text-textSecondary text-[11px]">Periodically poll local scan telemetry every 60 seconds</span>
                  </div>
                  <Checkbox 
                    checked={autoRefresh}
                    onCheckedChange={(c) => setAutoRefresh(!!c)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2. API CONFIGURATION (UI ONLY) */}
          {activeSection === 'api' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">API Configuration</CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  UI prototype credentials and endpoint orchestration (UI Only)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="p-3 rounded-xl bg-neonPurple/10 border border-neonPurple/30 text-neonPurple text-xs">
                  ℹ API Configuration is UI-only in this frontend prototype.
                </div>

                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">Rakshak API Secret Key</label>
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
                  Configure alert dispatch channels and threshold triggers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">Email Threat Alerts (Demo Preference)</span>
                    <span className="text-textSecondary text-[11px]">Save your preference for email alert notifications (frontend only)</span>
                  </div>
                  <Checkbox checked={emailAlerts} onCheckedChange={(c) => setEmailAlerts(!!c)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">Slack Webhook URL</label>
                  <Input 
                    type="text" 
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    className="bg-[#090014] border-[#2A1240] text-white font-mono text-xs h-10 rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">Dispatch Critical & High Severity Only</span>
                    <span className="text-textSecondary text-[11px]">Suppress notifications for medium and low findings</span>
                  </div>
                  <Checkbox checked={criticalOnly} onCheckedChange={(c) => setCriticalOnly(!!c)} />
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
                  <Checkbox checked={enableGlowEffects} onCheckedChange={(c) => setEnableGlowEffects(!!c)} />
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
