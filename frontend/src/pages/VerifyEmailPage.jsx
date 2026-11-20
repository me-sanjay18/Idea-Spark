import { CheckCircle2, MailCheck, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { user, refreshMe } = useAuth();
  const toast = useToast();

  const urlToken = searchParams.get('token') || '';
  const devToken = searchParams.get('devToken') || '';
  const emailParam = searchParams.get('email') || user?.email || '';

  const [verifying, setVerifying] = useState(Boolean(urlToken));
  const [verified, setVerified] = useState(Boolean(user?.emailVerified));
  const [resending, setResending] = useState(false);

  async function verifyWithToken(tokenToUse) {
    setVerifying(true);
    try {
      await api.post('/auth/verify-email', {
        email: emailParam,
        token: tokenToUse,
      });
      setVerified(true);
      await refreshMe();
      toast.success('Email address verified!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    if (urlToken && emailParam) {
      verifyWithToken(urlToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken, emailParam]);

  async function handleResend() {
    setResending(true);
    try {
      const res = await api.post('/auth/resend-verification');
      toast.success(res.data.message);
      if (res.data?.data?.devVerificationToken) {
        await verifyWithToken(res.data.data.devVerificationToken);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6E05F2]/10 text-[#6E05F2]">
          {verified ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <MailCheck className="h-6 w-6" />}
        </div>

        <h1 className="mt-4 text-2xl font-extrabold text-[#171717]">
          {verified ? 'Email Verified!' : 'Verify Your Email'}
        </h1>

        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {verified
            ? 'Your IdeaSpark account is verified and ready for full collaboration.'
            : verifying
            ? 'Validating your email verification token...'
            : `We sent a verification link to ${emailParam || 'your email address'}. Click the link in your inbox to activate full verification status.`}
        </p>

        {!verified && devToken && (
          <div className="mt-5 rounded-2xl border border-[#6E05F2]/25 bg-[#6E05F2]/[0.04] p-4 text-left">
            <p className="text-xs font-semibold text-[#6E05F2]">Local Development Quick Verify</p>
            <p className="mt-1 text-xs text-slate-600">
              SMTP is in development preview mode. Click below to complete verification immediately:
            </p>
            <button
              type="button"
              onClick={() => verifyWithToken(devToken)}
              disabled={verifying}
              className="mt-3 w-full rounded-xl bg-[#6E05F2] py-2 text-xs font-semibold text-white hover:bg-[#5b04c9]"
            >
              {verifying ? 'Verifying...' : 'Confirm Email Now'}
            </button>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <Link
            to={user ? '/dashboard' : '/login'}
            className="w-full rounded-xl brand-gradient-bg py-2.5 text-sm font-semibold text-white"
          >
            {user ? 'Go to Dashboard' : 'Continue to Sign In'}
          </Link>

          {!verified && user && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {resending ? 'Sending...' : 'Resend Verification Email'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

