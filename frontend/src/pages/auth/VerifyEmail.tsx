import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ArrowRight, 
  Mail, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSecurity } from '@/context/SecurityContext';
import { verifyEmail, resendVerification } from '@/services/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkAuthStatus } = useSecurity();

  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Verifying your email address...');
  const [resendEmail, setResendEmail] = useState<string>('');
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided in the URL. Please check the link from your email.');
      return;
    }

    let isMounted = true;

    async function performVerification() {
      try {
        const res = await verifyEmail(token as string);
        if (isMounted) {
          setStatus('success');
          setMessage(res.message || 'Email verified successfully! Your account is now active.');
          // Refresh auth context so user is logged in
          await checkAuthStatus();
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setMessage(err.message || 'Verification link is invalid or expired.');
        }
      }
    }

    performVerification();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setIsResending(true);
    setResendStatus(null);
    try {
      const res = await resendVerification(resendEmail.trim());
      setResendStatus({ type: 'success', message: res.message || 'A new verification link has been sent.' });
    } catch (err: any) {
      setResendStatus({ type: 'error', message: err.message || 'Failed to resend verification email.' });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06000E] text-[#F5F3FF] flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[20%] w-[650px] h-[650px] bg-[#7c3aed]/18 rounded-full mix-blend-screen filter blur-[170px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[650px] h-[650px] bg-[#ec4899]/18 rounded-full mix-blend-screen filter blur-[170px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[10%] w-[700px] h-[700px] bg-[#c026d3]/12 rounded-full mix-blend-screen filter blur-[180px] pointer-events-none" />

      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#2A1240_1px,transparent_1px)] [background-size:28px_28px] opacity-30 pointer-events-none" />

      {/* HEADER */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <Link to="/" className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rakshak-gradient shadow-[0_0_20px_rgba(168,85,247,0.4)]">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white font-mono">RAKSHAK</span>
            <span className="block text-[10px] text-[#A855F7] tracking-widest font-semibold uppercase">Security Cloud</span>
          </div>
        </Link>
      </header>

      {/* MAIN CONTAINER */}
      <main className="w-full max-w-lg mx-auto px-6 py-12 flex-1 flex flex-col justify-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-8 rounded-3xl bg-[#12051F]/80 border border-[#2A1240] backdrop-blur-xl shadow-[0_0_50px_rgba(168,85,247,0.15)] text-center relative overflow-hidden"
        >
          {/* TOP ACCENT LINE */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-rakshak-gradient" />

          {/* LOADING STATE */}
          {status === 'loading' && (
            <div className="py-8 space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#A855F7]/10 border border-[#A855F7]/30 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#A855F7] animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">Verifying Your Email</h2>
                <p className="text-sm text-[#C4B5FD]/70">{message}</p>
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {status === 'success' && (
            <div className="py-6 space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">Email Verified!</h2>
                <p className="text-sm text-[#C4B5FD]/80">{message}</p>
              </div>
              <div className="pt-4 flex flex-col gap-3">
                <Button
                  onClick={() => navigate('/dashboard')}
                  className="w-full h-11 text-sm font-bold text-white rounded-xl bg-rakshak-gradient shadow-[0_0_25px_rgba(168,85,247,0.45)] hover:shadow-[0_0_35px_rgba(236,72,153,0.6)] hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Link
                  to="/login"
                  className="text-xs text-[#C4B5FD]/70 hover:text-white transition-colors"
                >
                  Return to Login
                </Link>
              </div>
            </div>
          )}

          {/* ERROR STATE */}
          {status === 'error' && (
            <div className="py-6 space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.2)]">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">Verification Failed</h2>
                <p className="text-sm text-red-300/80">{message}</p>
              </div>

              {/* RESEND FORM */}
              <div className="p-4 rounded-xl bg-[#06000E]/70 border border-[#2A1240] text-left space-y-3 mt-4">
                <p className="text-xs font-semibold text-[#C4B5FD]">Need a new verification link?</p>
                <form onSubmit={handleResend} className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A855F7]/70" />
                    <Input
                      type="email"
                      placeholder="Enter your registered email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      className="pl-10 h-10 bg-[#12051F]/90 border-[#2A1240] focus:border-[#A855F7] text-xs text-white placeholder:text-[#C4B5FD]/40 rounded-xl"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isResending || !resendEmail.trim()}
                    className="w-full h-9 text-xs font-semibold text-white rounded-xl bg-[#2A1240] hover:bg-[#3D1A5C] border border-[#A855F7]/30 transition-all flex items-center justify-center gap-2"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Link...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Resend Verification Email</span>
                      </>
                    )}
                  </Button>
                </form>

                {resendStatus && (
                  <div className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                    resendStatus.type === 'success' 
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-red-500/10 text-red-300 border border-red-500/30'
                  }`}>
                    {resendStatus.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    )}
                    <span>{resendStatus.message}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="text-xs text-[#A855F7] hover:text-[#EC4899] font-semibold underline transition-colors"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      {/* FOOTER */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-center z-10 text-xs text-[#C4B5FD]/60">
        <p>© 2025 Rakshak. All rights reserved.</p>
      </footer>
    </div>
  );
}
