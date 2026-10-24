import { API_BASE_URL } from '@/services/api';
import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Sliders,
  Key,
  Bell,
  Palette,
  ShieldCheck,
  Save,
  CheckCircle2,
  User,
  Mail
} from 'lucide-react';
import { GithubIcon } from '@/components/ui/GithubIcon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useSecurity } from '@/context/SecurityContext';

export default function Settings() {
  const { currentUser, isGithubConnected } = useSecurity();
  const [activeSection, setActiveSection] = useState<'account' | 'general' | 'api' | 'notifications' | 'appearance' | 'security'>('account');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // General Settings
  const [appName, setAppName] = useState(() => localStorage.getItem('rakshak_app_name') || 'Rakshak Security Platform');
  const [riskThreshold, setRiskThreshold] = useState(() => localStorage.getItem('rakshak_risk_threshold') || '75');
  const [itemsPerPage, setItemsPerPage] = useState(() => localStorage.getItem('rakshak_items_per_page') || '25');
  const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem('rakshak_auto_refresh') !== 'false');

  // API Config
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rakshak_api_key') || 'EXAMPLE_API_KEY_REDACTED_12345');
  const [apiEndpoint, setApiEndpoint] = useState(() => localStorage.getItem('rakshak_api_endpoint') || `${API_BASE_URL}/scan`);
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

  const handleGlowToggle = (checked: boolean) => {
    setEnableGlowEffects(checked);
    localStorage.setItem('rakshak_glow_effects', String(checked));
    document.documentElement.setAttribute('data-glow', checked ? 'true' : 'false');
    document.documentElement.setAttribute('data-neon', checked ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('rakshak-glow-changed', { detail: { enabled: checked } }));
  };

  // Sync when changed externally (e.g. from Topbar)
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        setEnableGlowEffects(customEvent.detail.enabled);
      }
    };
    window.addEventListener('rakshak-glow-changed', handleSync);
    return () => window.removeEventListener('rakshak-glow-changed', handleSync);
  }, []);

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
    document.documentElement.setAttribute('data-neon', enableGlowEffects ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('rakshak-glow-changed', { detail: { enabled: enableGlowEffects } }));
    localStorage.setItem('rakshak_enable_2fa', String(enable2FA));
    localStorage.setItem('rakshak_session_timeout', sessionTimeout);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12">

      {/* 1. STANDARDIZED PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <SettingsIcon className="text-neonPurple" size={28} />
            <span>Platform Settings</span>
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Manage your account profile, workspace defaults, integrations, appearance, and security policies.
          </p>
        </div>

        {savedSuccess && (
          <div className="px-4 py-2 rounded-xl bg-success/20 border border-success/40 text-success text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 size={16} />
            <span>Changes saved successfully!</span>
          </div>
        )}
      </div>

      {/* 2. SECTION TABS */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-3 overflow-x-auto">
        {[
          { id: 'account', label: 'Account & Profile', icon: User },
          { id: 'general', label: 'General & Workspace', icon: Sliders },
          { id: 'api', label: 'Integrations & API', icon: Key },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'security', label: 'Security & Auth', icon: ShieldCheck }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeSection === tab.id
                ? 'bg-neonPurple text-white shadow-md'
                : 'bg-card/40 border border-border/50 text-textSecondary hover:text-white hover:bg-card'
            }`}
          >
            <tab.icon size={14} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 3. SETTINGS CONTENT FORM */}
      <div className="max-w-3xl">
        <form onSubmit={handleSave} className="space-y-6">

          {/* SECTION: ACCOUNT & PROFILE */}
          {activeSection === 'account' && (
            <Card className="border-border/80 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <User size={18} className="text-neonPurple" />
                  <span>Account & User Profile</span>
                </CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  Authenticated identity details, verification state, and connected accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">Full Name</span>
                    <span className="text-white font-semibold text-sm block">
                      {currentUser?.name || currentUser?.login || 'Rakshak Security User'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                    <span className="text-[10px] text-textSecondary uppercase font-semibold block">GitHub Username</span>
                    <span className="text-white font-semibold text-sm block truncate font-mono">
                      {currentUser?.login ? `@${currentUser.login}` : 'Not connected'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#090014] border border-[#2A1240] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <GithubIcon size={16} className="text-neonPurple" />
                    <div>
                      <span className="text-white font-bold block">GitHub Account Status</span>
                      <span className="text-textSecondary text-[11px]">
                        {isGithubConnected && currentUser ? `Connected as ${currentUser.login}` : 'No GitHub account linked'}
                      </span>
                    </div>
                  </div>
                  {isGithubConnected ? (
                    <Badge variant="success" className="text-xs font-semibold">Connected</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Disconnected</Badge>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-[#090014] border border-[#2A1240] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Mail size={16} className="text-neonPurple" />
                    <div>
                      <span className="text-white font-bold block">Security Workspace Mode</span>
                      <span className="text-textSecondary text-[11px]">Isolated tenant data & scan sandboxing</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs bg-neonPurple/10 text-neonPurple border-neonPurple/30">Active</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION: GENERAL & WORKSPACE */}
          {activeSection === 'general' && (
            <Card className="border-border/80 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders size={18} className="text-neonPurple" />
                  <span>General Workspace Settings</span>
                </CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  Global application preferences, item limits, and scan threshold parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">Workspace / Platform Name</label>
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
                    className="w-full bg-[#090014] border border-[#2A1240] text-white text-xs h-10 rounded-xl px-3 focus:outline-none focus:border-neonPurple cursor-pointer"
                  >
                    <option value="10">10 Findings</option>
                    <option value="25">25 Findings</option>
                    <option value="50">50 Findings</option>
                    <option value="100">100 Findings</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">Auto-Refresh Telemetry</span>
                    <span className="text-textSecondary text-[11px]">Periodically sync findings telemetry in background</span>
                  </div>
                  <Checkbox checked={autoRefresh} onCheckedChange={(c) => setAutoRefresh(!!c)} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION: API & INTEGRATIONS */}
          {activeSection === 'api' && (
            <Card className="border-border/80 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Key size={18} className="text-neonPurple" />
                  <span>API & Scanner Integrations</span>
                </CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  FastAPI connection endpoints and Cloudflare Workers AI integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">Scanner API Endpoint</label>
                  <Input
                    type="text"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    className="bg-[#090014] border-[#2A1240] text-white font-mono text-xs h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">API Secret Key / Token</label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API token..."
                    className="bg-[#090014] border-[#2A1240] text-white font-mono text-xs h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-textSecondary font-semibold">AI Threat Intelligence Model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full bg-[#090014] border border-[#2A1240] text-white text-xs h-10 rounded-xl px-3 focus:outline-none focus:border-neonPurple cursor-pointer"
                  >
                    <option value="Cloudflare AI (Llama 3.1 8B)">Cloudflare AI (Llama 3.1 8B) - Default</option>
                    <option value="Rakshak AI (Default)">Rakshak AI (Default)</option>
                    <option value="DeepSeek R1 Security">DeepSeek R1 Security</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#090014] border border-[#2A1240] space-y-1">
                  <span className="font-bold text-white block">Connected Scanners Status</span>
                  <p className="text-textSecondary text-[11px]">
                    Semgrep (SAST), Trivy (SCA & Container), and Gitleaks (Secrets) pipeline tools are connected and verified via FastAPI backend.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION: NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <Card className="border-border/80 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Bell size={18} className="text-neonPurple" />
                  <span>Notification Preferences</span>
                </CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  Configure real-time security alerts and scan completion notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">In-App Threat Alerts</span>
                    <span className="text-textSecondary text-[11px]">Receive in-app alerts when security scans find vulnerabilities</span>
                  </div>
                  <Checkbox checked={inAppAlerts} onCheckedChange={(c) => setInAppAlerts(!!c)} />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">Critical & High Priority Filter</span>
                    <span className="text-textSecondary text-[11px]">Only notify on critical and high severity security incidents</span>
                  </div>
                  <Checkbox checked={criticalOnly} onCheckedChange={(c) => setCriticalOnly(!!c)} />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">Scan Completion Notices</span>
                    <span className="text-textSecondary text-[11px]">Display notification badge when repository scans finish</span>
                  </div>
                  <Checkbox checked={scanCompletionNotices} onCheckedChange={(c) => setScanCompletionNotices(!!c)} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION: APPEARANCE */}
          {activeSection === 'appearance' && (
            <Card className="border-border/80 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Palette size={18} className="text-neonPurple" />
                  <span>Appearance & Visual Theme</span>
                </CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  Customization options for Rakshak's dark DevSecOps visual style
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="p-4 rounded-xl border border-neonPurple/40 bg-neonPurple/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">Rakshak Dark Theme</span>
                    <Badge variant="default" className="bg-rakshak-gradient text-white">Active Identity</Badge>
                  </div>
                  <p className="text-textSecondary text-xs">
                    Dark background with curated purple and pink accents, subtle borders, and glassmorphism.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">Neon Glow Effects & Halos</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        enableGlowEffects 
                          ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/40' 
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {enableGlowEffects ? 'ACTIVE (GLOW ON)' : 'DISABLED (GLOW OFF)'}
                      </span>
                    </div>
                    <span className="text-textSecondary text-[11px] block mt-0.5">
                      Toggle illuminated cyber borders, radiant badge halos, and ambient scanlines.
                    </span>
                  </div>
                  <Checkbox checked={enableGlowEffects} onCheckedChange={(c) => handleGlowToggle(!!c)} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION: SECURITY & AUTH */}
          {activeSection === 'security' && (
            <Card className="border-border/80 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck size={18} className="text-neonPurple" />
                  <span>Security & Authentication Policies</span>
                </CardTitle>
                <CardDescription className="text-xs text-textSecondary">
                  Session controls, authentication enforcement, and access token management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-sans">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#090014] border border-[#2A1240]">
                  <div>
                    <span className="font-bold text-white block">Enforce Two-Factor Authentication (2FA)</span>
                    <span className="text-textSecondary text-[11px]">Require TOTP authenticator verification on login</span>
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

                <div className="p-3.5 rounded-xl bg-[#090014] border border-[#2A1240] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">OAuth Token Security</span>
                    <span className="text-textSecondary text-[11px]">Encrypted session tokens & isolated workspace scope</span>
                  </div>
                  <Badge variant="success" className="text-xs">Active</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SAVE BUTTON */}
          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="gradient"
              className="h-10 px-6 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Save size={15} />
              <span>Save Changes</span>
            </Button>
          </div>

        </form>
      </div>

    </div>
  );
}
