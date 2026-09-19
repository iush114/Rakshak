import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Lock, 
  Eye, 
  EyeOff, 
  Mail, 
  Info, 
  CheckCircle2, 
  User, 
  Code, 
  Box, 
  ShieldCheck, 
  Sparkles, 
  Infinity as InfinityIcon, 
  Zap, 
  Loader2, 
  AlertCircle,
  X
} from 'lucide-react';
import { GithubIcon } from '@/components/ui/GithubIcon';
import { useSecurity } from '@/context/SecurityContext';
import { API_BASE_URL } from '@/services/api';

interface AuthPageProps {
  initialTab?: 'login' | 'register';
}

export default function Login({ initialTab = 'login' }: AuthPageProps) {
  const navigate = useNavigate();
  const { connectGithub } = useSecurity();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

  // Sync state if prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Form Field States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UX Feedback States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Password Validation Criteria
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  // Password Strength Calculator
  const getPasswordStrength = () => {
    if (!password) return { label: 'None', score: 0, color: 'bg-zinc-700', text: 'text-zinc-500' };
    let score = 0;
    if (hasMinLength) score += 25;
    if (hasUppercase) score += 25;
    if (hasNumber) score += 25;
    if (hasSpecial) score += 25;

    if (score <= 25) return { label: 'Weak', score: 25, color: 'bg-red-500', text: 'text-red-400' };
    if (score <= 50) return { label: 'Fair', score: 50, color: 'bg-amber-500', text: 'text-amber-400' };
    if (score <= 75) return { label: 'Good', score: 75, color: 'bg-blue-500', text: 'text-blue-400' };
    return { label: 'Strong', score: 100, color: 'bg-emerald-500', text: 'text-emerald-400' };
  };

  const strength = getPasswordStrength();

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (activeTab === 'login') {
      if (!email.trim()) {
        setErrorMessage('Please enter your email address.');
        return;
      }
      if (!emailRegex.test(email.trim())) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }
      if (!password) {
        setErrorMessage('Please enter your password.');
        return;
      }
    } else {
      if (!fullName.trim()) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (!email.trim() || !emailRegex.test(email.trim())) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }
      if (!hasMinLength || !hasUppercase || !hasNumber || !hasSpecial) {
        setErrorMessage('Password must meet all security requirements listed below.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-enter.');
        return;
      }
      if (!acceptedTerms) {
        setErrorMessage('You must agree to the Terms & Privacy Policy to continue.');
        return;
      }
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      connectGithub();
      navigate('/dashboard');
    }, 700);
  };

  // GitHub OAuth Login - Direct backend OAuth flow
  const handleGithubAuth = () => {
    setIsLoading(true);
    setErrorMessage(null);
    setToastMessage({
      title: 'Connecting GitHub Account',
      desc: 'Redirecting to GitHub OAuth authorization...',
      type: 'info'
    });
    window.location.href = `${API_BASE_URL}/auth/github`;
  };

  // Forgot Password Simulation
  const handleForgotPassword = () => {
    if (!email.trim()) {
      setToastMessage({
        title: 'Enter Email Address',
        desc: 'Please type your email address above so we can send reset instructions.',
        type: 'info'
      });
      return;
    }
    setToastMessage({
      title: 'Password Reset Link Sent',
      desc: `Instructions have been sent to ${email}. Check your inbox!`,
      type: 'success'
    });
  };

  return (
    <div className="min-h-screen bg-[#06000E] text-[#F5F3FF] flex flex-col justify-between relative overflow-hidden font-sans select-none">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[20%] w-[650px] h-[650px] bg-[#7c3aed]/18 rounded-full mix-blend-screen filter blur-[170px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[650px] h-[650px] bg-[#ec4899]/18 rounded-full mix-blend-screen filter blur-[170px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[10%] w-[700px] h-[700px] bg-[#c026d3]/12 rounded-full mix-blend-screen filter blur-[180px] pointer-events-none" />
      
      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#2A1240_1px,transparent_1px)] [background-size:28px_28px] opacity-30 pointer-events-none" />

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4"
          >
            <div className={`p-4 rounded-xl border backdrop-blur-md shadow-2xl flex items-start justify-between gap-3 ${
              toastMessage.type === 'success' 
                ? 'bg-[#12051F]/90 border-emerald-500/50 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.3)]' 
                : 'bg-[#12051F]/90 border-purple-500/50 text-purple-200 shadow-[0_0_25px_rgba(168,85,247,0.3)]'
            }`}>
              <div className="flex items-start gap-3">
                {toastMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <Info className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
                )}
                <div>
                  <h4 className="text-sm font-bold">{toastMessage.title}</h4>
                  <p className="text-xs text-zinc-300 mt-0.5">{toastMessage.desc}</p>
                </div>
              </div>
              <button 
                onClick={() => setToastMessage(null)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. TOP HEADER */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-20">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <Shield className="w-7 h-7 text-[#A855F7] group-hover:scale-105 transition-transform" />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">R</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-wider text-white-pink-gradient">
                RAKSHAK
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/30">
                AI DevSecOps
              </span>
            </div>
            <p className="text-[11px] text-[#C4B5FD]/70 hidden md:block">
              AI-Powered DevSecOps Threat Detection
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="rounded-full bg-[#12051F]/60 border-[#2A1240] text-[#C4B5FD] hover:text-white hover:border-[#A855F7]/60 hover:bg-[#A855F7]/10 px-4 py-2 text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.15)]"
          >
            <span>← Home</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/about')}
            className="rounded-full bg-[#12051F]/60 border-[#2A1240] text-[#C4B5FD] hover:text-white hover:border-[#A855F7]/60 hover:bg-[#A855F7]/10 px-4 sm:px-5 py-2 text-xs flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.15)]"
          >
            <Info size={14} className="text-[#EC4899]" />
            <span className="hidden sm:inline">About Rakshak</span>
            <span className="sm:hidden">About</span>
          </Button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex-1 flex flex-col justify-center items-center z-10 gap-8">
        
        {/* 2. HERO SECTION */}
        <section className="text-center max-w-3xl mx-auto flex flex-col items-center">
          {/* Centered Large Glowing Shield Logo */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative mb-5 flex items-center justify-center"
          >
            {/* Animated Glow Rings */}
            <div className="absolute w-28 h-28 rounded-full border border-[#A855F7]/40 animate-[spin_14s_linear_infinite]" />
            <div className="absolute w-36 h-36 rounded-full border border-[#EC4899]/30 border-dashed animate-[spin_20s_linear_infinite_reverse]" />
            <div className="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-[#7c3aed]/25 via-[#a855f7]/20 to-[#ec4899]/25 blur-2xl animate-pulse" />

            {/* Central Shield Icon */}
            <div className="relative z-10 p-3.5 flex items-center justify-center">
              <Shield className="w-20 h-20 text-[#A855F7] filter drop-shadow-[0_0_30px_rgba(168,85,247,0.9)]" />
              <span className="absolute font-black text-3xl text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.95)]">
                R
              </span>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-2"
          >
            <span className="text-white-pink-gradient">
              RAKSHAK
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.h2 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl font-bold text-[#A855F7] mb-2"
          >
            AI-Powered DevSecOps Threat Detection Platform
          </motion.h2>

          {/* Description Lines */}
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-xs sm:text-sm text-[#C4B5FD]/85 max-w-xl space-y-1 font-sans"
          >
            <p>Connect your GitHub repository & scan code for security threats.</p>
            <p className="text-white font-medium">Automated vulnerability analysis & AI risk calculation.</p>
          </motion.div>
        </section>

        {/* MAIN CONTENT GRID */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto">
          
          {/* SECURITY FEATURE CARDS (LEFT SIDE) */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-3 space-y-3.5 order-2 lg:order-1"
          >
            <div className="hidden lg:block text-xs uppercase tracking-widest font-bold text-[#A855F7] mb-2 px-1">
              Core Protection
            </div>

            {/* Card 1 */}
            <div className="p-3.5 rounded-xl bg-[#12051F]/70 border border-[#2A1240] hover:border-[#A855F7]/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.25)] transition-all flex items-start gap-3.5 group">
              <div className="p-2.5 rounded-lg bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/30 group-hover:scale-105 group-hover:bg-[#A855F7]/20 transition-all shrink-0">
                <Code size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#EC4899] transition-colors">Code Scanning</h4>
                <p className="text-[11px] text-[#C4B5FD]/70 leading-snug mt-0.5">Detect insecure code patterns</p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-3.5 rounded-xl bg-[#12051F]/70 border border-[#2A1240] hover:border-[#A855F7]/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.25)] transition-all flex items-start gap-3.5 group">
              <div className="p-2.5 rounded-lg bg-[#EC4899]/10 text-[#EC4899] border border-[#EC4899]/30 group-hover:scale-105 group-hover:bg-[#EC4899]/20 transition-all shrink-0">
                <Box size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#EC4899] transition-colors">Dependency Scanning</h4>
                <p className="text-[11px] text-[#C4B5FD]/70 leading-snug mt-0.5">Detect vulnerable packages</p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-3.5 rounded-xl bg-[#12051F]/70 border border-[#2A1240] hover:border-[#A855F7]/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.25)] transition-all flex items-start gap-3.5 group">
              <div className="p-2.5 rounded-lg bg-[#c026d3]/10 text-[#c026d3] border border-[#c026d3]/30 group-hover:scale-105 group-hover:bg-[#c026d3]/20 transition-all shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#EC4899] transition-colors">Secret Detection</h4>
                <p className="text-[11px] text-[#C4B5FD]/70 leading-snug mt-0.5">Detect leaked API keys & secrets</p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="p-3.5 rounded-xl bg-[#12051F]/70 border border-[#2A1240] hover:border-[#A855F7]/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.25)] transition-all flex items-start gap-3.5 group">
              <div className="p-2.5 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 group-hover:scale-105 group-hover:bg-[#3b82f6]/20 transition-all shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#EC4899] transition-colors">AI Analysis</h4>
                <p className="text-[11px] text-[#C4B5FD]/70 leading-snug mt-0.5">Intelligent explanations & risk summary</p>
              </div>
            </div>
          </motion.div>

          {/* CENTER AUTHENTICATION CARD */}
          <motion.div 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="lg:col-span-6 order-1 lg:order-2 w-full max-w-md mx-auto"
          >
            <div className="bg-[#12051F]/80 backdrop-blur-xl border border-[#2A1240] hover:border-[#A855F7]/40 transition-all rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(168,85,247,0.25)] relative overflow-hidden">
              
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-rakshak-gradient opacity-80" />

              {/* TABS: Login | Register */}
              <div className="flex justify-center border-b border-[#2A1240] mb-6 relative">
                <button
                  type="button"
                  onClick={() => { setActiveTab('login'); setErrorMessage(null); }}
                  className={`px-8 py-3 text-sm font-bold transition-all relative cursor-pointer ${
                    activeTab === 'login' ? 'text-white' : 'text-[#C4B5FD]/50 hover:text-[#C4B5FD]'
                  }`}
                >
                  Login
                  {activeTab === 'login' && (
                    <motion.div 
                      layoutId="activeTabUnderline" 
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-rakshak-gradient shadow-[0_0_10px_rgba(236,72,153,0.8)]" 
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setErrorMessage(null); }}
                  className={`px-8 py-3 text-sm font-bold transition-all relative cursor-pointer ${
                    activeTab === 'register' ? 'text-white' : 'text-[#C4B5FD]/50 hover:text-[#C4B5FD]'
                  }`}
                >
                  Register
                  {activeTab === 'register' && (
                    <motion.div 
                      layoutId="activeTabUnderline" 
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-rakshak-gradient shadow-[0_0_10px_rgba(236,72,153,0.8)]" 
                    />
                  )}
                </button>
              </div>

              {/* Form Heading & Subtitle */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-black text-white">
                  {activeTab === 'login' ? 'Welcome Back!' : 'Create Your Account'}
                </h3>
                <p className="text-xs text-[#C4B5FD]/80 mt-1">
                  {activeTab === 'login' 
                    ? 'Login to continue to Rakshak Security Platform' 
                    : 'Start securing your GitHub repositories'}
                </p>
              </div>

              {/* Inline Error Display */}
              {errorMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5"
                >
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}

              {/* GitHub OAuth Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleGithubAuth}
                disabled={isLoading}
                className="w-full h-11 bg-[#1A0830] hover:bg-[#250B42] text-white border-[#A855F7]/40 hover:border-[#A855F7] rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.2)] flex items-center justify-center gap-2.5 cursor-pointer mb-5"
              >
                <GithubIcon size={18} className="text-white shrink-0" />
                <span>{activeTab === 'login' ? 'Sign in with GitHub' : 'Sign up with GitHub'}</span>
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-[1px] bg-[#2A1240]" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#C4B5FD]/50">
                  Or continue with email
                </span>
                <div className="flex-1 h-[1px] bg-[#2A1240]" />
              </div>

              {/* AUTH FORM */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Registration: Full Name */}
                {activeTab === 'register' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#C4B5FD] uppercase tracking-wider">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C4B5FD]/50" size={16} />
                      <Input 
                        type="text" 
                        placeholder="Enter your full name" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10 bg-[#090014]/80 border-[#2A1240] focus:border-[#A855F7] focus:ring-[#A855F7]/20 text-white placeholder:text-[#C4B5FD]/40 text-xs h-11 rounded-xl transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#C4B5FD] uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C4B5FD]/50" size={16} />
                    <Input 
                      type="email" 
                      placeholder={activeTab === 'login' ? "Email address" : "Enter your email"} 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-[#090014]/80 border-[#2A1240] focus:border-[#A855F7] focus:ring-[#A855F7]/20 text-white placeholder:text-[#C4B5FD]/40 text-xs h-11 rounded-xl transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#C4B5FD] uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C4B5FD]/50" size={16} />
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder={activeTab === 'login' ? "Password" : "Create a password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-[#090014]/80 border-[#2A1240] focus:border-[#A855F7] focus:ring-[#A855F7]/20 text-white placeholder:text-[#C4B5FD]/40 text-xs h-11 rounded-xl transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#C4B5FD]/50 hover:text-white transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Checklist (Registration Only) */}
                {activeTab === 'register' && password && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 rounded-xl bg-[#090014]/60 border border-[#2A1240] space-y-2 text-xs"
                  >
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#C4B5FD]/70 font-medium">Password strength:</span>
                      <span className={`font-bold ${strength.text}`}>{strength.label}</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#2A1240] rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${strength.color} transition-all duration-300 rounded-full`} 
                        style={{ width: `${strength.score}%` }} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                      <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400 font-medium' : 'text-[#C4B5FD]/50'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                        <span>8+ characters</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-400 font-medium' : 'text-[#C4B5FD]/50'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${hasUppercase ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                        <span>1 uppercase letter</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400 font-medium' : 'text-[#C4B5FD]/50'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                        <span>1 number</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-400 font-medium' : 'text-[#C4B5FD]/50'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${hasSpecial ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                        <span>1 special char</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Confirm Password (Registration Only) */}
                {activeTab === 'register' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#C4B5FD] uppercase tracking-wider">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C4B5FD]/50" size={16} />
                      <Input 
                        type={showConfirmPassword ? "text" : "password"} 
                        placeholder="Confirm your password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10 bg-[#090014]/80 border-[#2A1240] focus:border-[#A855F7] focus:ring-[#A855F7]/20 text-white placeholder:text-[#C4B5FD]/40 text-xs h-11 rounded-xl transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#C4B5FD]/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Forgot Password Link (Login Only) */}
                {activeTab === 'login' && (
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs text-[#A855F7] hover:text-[#EC4899] font-semibold transition-colors cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                {/* Terms Checkbox (Registration Only) */}
                {activeTab === 'register' && (
                  <div className="flex items-center space-x-2.5 pt-1">
                    <Checkbox 
                      id="terms" 
                      checked={acceptedTerms} 
                      onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)} 
                      className="border-[#2A1240] data-[state=checked]:bg-[#A855F7] data-[state=checked]:border-[#A855F7]"
                    />
                    <label htmlFor="terms" className="text-xs text-[#C4B5FD]/90 cursor-pointer leading-tight">
                      I agree to the <a href="#" className="text-[#A855F7] hover:text-[#EC4899] font-medium underline">Terms & Privacy Policy</a>
                    </label>
                  </div>
                )}

                {/* SUBMIT BUTTON */}
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full h-11 text-sm font-bold text-white rounded-xl bg-rakshak-gradient shadow-[0_0_25px_rgba(168,85,247,0.45)] hover:shadow-[0_0_35px_rgba(236,72,153,0.6)] hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>{activeTab === 'login' ? 'Authenticating...' : 'Creating Account...'}</span>
                    </>
                  ) : (
                    <span>{activeTab === 'login' ? 'Login' : 'Create Account'}</span>
                  )}
                </Button>

                {/* TOGGLE TAB LINK */}
                <div className="text-center pt-2">
                  <p className="text-xs text-[#C4B5FD]/70">
                    {activeTab === 'login' ? (
                      <>
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => { setActiveTab('register'); setErrorMessage(null); }}
                          className="text-[#A855F7] hover:text-[#EC4899] font-bold transition-colors cursor-pointer underline ml-1"
                        >
                          Register
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => { setActiveTab('login'); setErrorMessage(null); }}
                          className="text-[#A855F7] hover:text-[#EC4899] font-bold transition-colors cursor-pointer underline ml-1"
                        >
                          Login
                        </button>
                      </>
                    )}
                  </p>
                </div>

              </form>
            </div>
          </motion.div>

          {/* RIGHT SIDE: GLOWING 3D SHIELD DISPLAY */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-3 hidden lg:flex flex-col items-center justify-center order-3 relative py-6"
          >
            <div className="relative w-full max-w-[260px] h-[300px] flex items-center justify-center">
              
              <div className="absolute bottom-6 w-36 h-6 border border-[#EC4899]/50 rounded-full bg-[#12051F]/90 shadow-[0_0_25px_rgba(236,72,153,0.6)] flex items-center justify-center">
                <span className="text-[10px] font-black tracking-widest text-white drop-shadow-[0_0_8px_rgba(236,72,153,0.9)]">
                  RAKSHAK
                </span>
              </div>

              <motion.div 
                animate={{ y: [-6, 6, -6] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10 flex flex-col items-center"
              >
                <div className="relative flex items-center justify-center group">
                  <Shield className="w-28 h-28 text-[#A855F7] filter drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]" />
                  <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]">R</span>
                </div>

                <div className="w-28 h-1 bg-gradient-to-r from-transparent via-[#EC4899] to-transparent blur-[1px] mt-4 animate-pulse" />
              </motion.div>
            </div>
          </motion.div>

        </div>

        {/* BOTTOM FEATURE BAR */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="w-full max-w-5xl mx-auto mt-4 p-4 rounded-2xl bg-[#12051F]/60 border border-[#2A1240] backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.1)]"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="flex items-center gap-3 p-2">
              <div className="p-2.5 rounded-xl bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/30 shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <h5 className="text-xs font-bold text-white">AI-Powered</h5>
                <p className="text-[11px] text-[#C4B5FD]/70 leading-tight">Intelligent threat detection and risk analysis</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2">
              <div className="p-2.5 rounded-xl bg-[#EC4899]/10 text-[#EC4899] border border-[#EC4899]/30 shrink-0">
                <InfinityIcon size={18} />
              </div>
              <div>
                <h5 className="text-xs font-bold text-white">DevSecOps Ready</h5>
                <p className="text-[11px] text-[#C4B5FD]/70 leading-tight">Seamless integration in your CI/CD pipeline</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2">
              <div className="p-2.5 rounded-xl bg-[#c026d3]/10 text-[#c026d3] border border-[#c026d3]/30 shrink-0">
                <Zap size={18} />
              </div>
              <div>
                <h5 className="text-xs font-bold text-white">Real-time Protection</h5>
                <p className="text-[11px] text-[#C4B5FD]/70 leading-tight">Continuous monitoring and real-time alerts</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2">
              <div className="p-2.5 rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <h5 className="text-xs font-bold text-white">Secure & Private</h5>
                <p className="text-[11px] text-[#C4B5FD]/70 leading-tight">Your data is safe and encrypted</p>
              </div>
            </div>

          </div>
        </motion.div>

      </main>

      {/* FOOTER */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-center z-10 text-xs text-[#C4B5FD]/60 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-[#2A1240]/40 mt-6">
        <p>© 2025 Rakshak. All rights reserved.</p>
        <p className="flex items-center gap-1.5">
          <span>Built for a secure tomorrow</span>
          <span className="text-[#EC4899]">💜</span>
        </p>
      </footer>

    </div>
  );
}
