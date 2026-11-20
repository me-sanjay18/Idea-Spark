import { Github, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { GoogleIcon } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function SignUpPage() {
  const { register: registerAccount } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      username: '',
      email: '',
      headline: '',
      skillsText: '',
      password: '',
    },
  });

  async function onSubmit(values) {
    setSubmitting(true);
    try {
      const skills = values.skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await registerAccount({
        name: values.name,
        username: values.username.toLowerCase().trim(),
        email: values.email.toLowerCase().trim(),
        headline: values.headline,
        skills,
        password: values.password,
      });

      toast.success(res.message || 'Welcome to IdeaSpark!');
      if (res.data?.devVerificationToken) {
        navigate(
          `/verify-email?email=${encodeURIComponent(values.email)}&devToken=${encodeURIComponent(
            res.data.devVerificationToken
          )}`
        );
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl brand-gradient-bg text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-[#171717]">Create Your Account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Don&apos;t Just Have an Idea. Build It Together.
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
          <span className="text-xs text-slate-400">or register with email</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              placeholder="Aarav Sharma"
              {...register('name', {
                required: 'Full name is required',
                minLength: { value: 2, message: 'At least 2 characters' },
              })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
            {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Username *</label>
            <input
              type="text"
              placeholder="aarav_builds"
              {...register('username', {
                required: 'Username is required',
                pattern: {
                  value: /^[a-zA-Z0-9_-]{3,32}$/,
                  message: '3-32 letters, numbers, underscores, or hyphens',
                },
              })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
            {errors.username && (
              <p className="mt-1 text-xs text-rose-600">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
            <input
              type="email"
              placeholder="you@university.edu"
              {...register('email', {
                required: 'Email address is required',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
              })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
            {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Professional Headline
            </label>
            <input
              type="text"
              placeholder="e.g. Full-Stack Developer & AI Enthusiast"
              {...register('headline')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Top Skills (comma-separated)
            </label>
            <input
              type="text"
              placeholder="React, Python, UI/UX, Product Strategy"
              {...register('skillsText')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              placeholder="Min 8 chars, uppercase, lowercase & number"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Minimum 8 characters' },
                validate: (v) =>
                  (/[A-Z]/.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v)) ||
                  'Include uppercase, lowercase, and a number',
              })}
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
            {submitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#6E05F2] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

