import { EyeOff, Globe, Link2, Lock, ShieldCheck, X } from 'lucide-react';

export function Avatar({ user, size = 'md', className = '' }) {
  const sizes = {
    xs: 'h-7 w-7 text-xs',
    sm: 'h-9 w-9 text-sm',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
    xl: 'h-20 w-20 text-2xl',
  };
  const initials = (user?.name || user?.username || 'IS')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name || 'User avatar'}
        className={`${sizes[size] || sizes.md} rounded-full object-cover ring-2 ring-white shadow-xs ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size] || sizes.md} rounded-full brand-gradient-bg text-white font-semibold flex items-center justify-center shrink-0 ring-2 ring-white shadow-xs ${className}`}
    >
      {initials}
    </div>
  );
}

const STAGE_META = {
  concept: { label: 'Concept', cls: 'bg-purple-50 text-[#6E05F2] border-purple-200' },
  validation: { label: 'Validation', cls: 'bg-blue-50 text-[#2057E8] border-blue-200' },
  prototype: { label: 'Prototype', cls: 'bg-fuchsia-50 text-[#CD2BE2] border-fuchsia-200' },
  mvp: { label: 'MVP Ready', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  launched: { label: 'Launched', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export function StageBadge({ stage = 'concept' }) {
  const item = STAGE_META[stage] || STAGE_META.concept;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${item.cls}`}>
      {item.label}
    </span>
  );
}

export function VisibilityBadge({ visibility = 'public' }) {
  if (visibility === 'private') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-white px-2.5 py-0.5 text-xs font-medium">
        <Lock className="h-3 w-3" /> Private
      </span>
    );
  }
  if (visibility === 'unlisted') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-xs font-medium">
        <Link2 className="h-3 w-3" /> Unlisted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium">
      <Globe className="h-3 w-3" /> Public
    </span>
  );
}

export function NdaBadge({ protectedWithNda }) {
  if (!protectedWithNda) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#6E05F2]/10 text-[#6E05F2] border border-[#6E05F2]/20 px-2.5 py-0.5 text-xs font-semibold">
      <ShieldCheck className="h-3.5 w-3.5" /> NDA Protected
    </span>
  );
}

export function Modal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-xl' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-[#171717]">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description,
  confirmLabel = 'Confirm',
  danger = true,
  loading = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-xs transition ${
            danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#6E05F2] hover:bg-[#5b04c9]'
          } disabled:opacity-60`}
        >
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 rounded-full bg-slate-200" />
        <div className="h-5 w-16 rounded-full bg-slate-100" />
      </div>
      <div className="h-6 w-3/4 rounded-lg bg-slate-200" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-5/6 rounded bg-slate-100" />
      </div>
      <div className="flex gap-2 pt-2">
        <div className="h-6 w-16 rounded-md bg-slate-100" />
        <div className="h-6 w-20 rounded-md bg-slate-100" />
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = EyeOff, title, description, action = null }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6E05F2]/10 text-[#6E05F2]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-bold text-[#171717]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function GoogleIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.98 3.09c.95-2.85 3.6-4.94 6.73-4.94z"
      />
    </svg>
  );
}

