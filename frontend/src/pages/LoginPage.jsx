import { Github, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { GoogleIcon } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from || '/dashboard';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  useEffect(() => {
    const oauthNotice = searchParams.get('oauth');
    if (!oauthNotice) return;
    if (oauthNotice === 'github_not_configured') {
      toast.info('GitHub OAuth credentials are not configured in .env yet. Please sign in with email/password.');
    } else if (oauthNotice === 'google_not_configured') {
      toast.info('Google OAuth credentials are not configured in .env yet. Please add GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET or sign in with email/password.');
    } else if (oauthNotice === 'google_cancelled') {
      toast.info('Google sign-in was cancelled.');
    } else if (oauthNotice === 'account_restricted') {
      toast.error('This account is currently restricted from signing in.');
    } else {
      toast.error('Social sign-in could not be completed. Please try again.');
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, toast]);

  async function onSubmit(values) {
    setSubmitting(true);
    try {
      await login(values);
      toast.success('Welcome back!');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemoAccount(identifier) {
    setValue('identifier', identifier);
    setValue('password', 'SparkDemo123');
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl brand-gradient-bg text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-[#171717]">Sign In to IdeaSpark</h1>
          <p className="mt-1 text-sm text-slate-500">
            Access your ideas, collaborations, and workspaces.
          </p>
        </div>

        <div className="mt-6 space-y-2.5">
          <a
            href="/api/auth/google"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-[#171717] hover:bg-slate-50 transition"
          >
            <GoogleIcon className="h-4 w-4" /> Continue with Google
          </a>
          <a
            href="/api/auth/github"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-[#171717] hover:bg-slate-50 transition"
          >
            <Github className="h-4 w-4" /> Continue with GitHub
          </a>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">or sign in with credentials</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email or Username
            </label>
            <input
              type="text"
              placeholder="you@example.com or username"
              {...register('identifier', { required: 'Email or username is required' })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
            {errors.identifier && (
              <p className="mt-1 text-xs text-rose-600">{errors.identifier.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-[#2057E8] hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              {...register('password', { required: 'Password is required' })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl brand-gradient-bg py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60 transition"
          >
            {submitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-[#F8F9FC] p-3.5">
          <p className="text-[11px] font-semibold text-slate-500 mb-2">
            Quick Demo Accounts (Seeded Local Sandbox):
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => fillDemoAccount('maya@ideaspark.local')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-[#6E05F2]"
            >
              Creator (Maya)
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('arjun@ideaspark.local')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-[#6E05F2]"
            >
              Collaborator (Arjun)
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('admin@ideaspark.local')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#6E05F2] hover:border-[#6E05F2]"
            >
              Admin Panel
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          New to IdeaSpark?{' '}
          <Link to="/signup" className="font-semibold text-[#6E05F2] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

