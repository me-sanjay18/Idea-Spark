import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ForgotPasswordPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const emailFromUrl = searchParams.get('email') || '';

  const { refreshMe } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [sentMessage, setSentMessage] = useState('');

  const requestForm = useForm({ defaultValues: { email: emailFromUrl } });
  const resetForm = useForm({ defaultValues: { password: '', confirmPassword: '' } });

  async function handleRequestReset(values) {
    setSubmitting(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: values.email });
      setSentMessage(res.data.message);
      toast.success('Reset instructions processed.');
      if (res.data?.data?.devResetToken) {
        setSearchParams({
          email: values.email,
          token: res.data.data.devResetToken,
        });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(values) {
    if (values.password !== values.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', {
        email: emailFromUrl,
        token,
        password: values.password,
      });
      await refreshMe();
      toast.success('Password updated! You are now signed in.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2057E8]/10 text-[#2057E8]">
          <KeyRound className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-center text-2xl font-extrabold text-[#171717]">
          {token ? 'Choose a New Password' : 'Reset Your Password'}
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          {token
            ? `Setting a new password for ${emailFromUrl}`
            : 'Enter your registered email and we will send a secure reset link.'}
        </p>

        {!token ? (
          <form onSubmit={requestForm.handleSubmit(handleRequestReset)} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                {...requestForm.register('email', { required: 'Email is required' })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              />
            </div>

            {sentMessage && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                {sentMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl brand-gradient-bg py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Sending Link...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                placeholder="Min 8 chars, upper, lower & number"
                {...resetForm.register('password', {
                  required: 'New password is required',
                  minLength: { value: 8, message: 'At least 8 characters' },
                })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Re-enter password"
                {...resetForm.register('confirmPassword', { required: 'Please confirm password' })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl brand-gradient-bg py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          Remembered your password?{' '}
          <Link to="/login" className="font-semibold text-[#6E05F2] hover:underline">
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}

