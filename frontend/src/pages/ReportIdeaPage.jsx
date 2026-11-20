import { Flag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function ReportIdeaPage() {
  const { id: ideaIdFromParam } = useParams();
  const [searchParams] = useSearchParams();
  const userFromQuery = searchParams.get('user') || '';

  const toast = useToast();
  const navigate = useNavigate();
  const [myReports, setMyReports] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const initialType = userFromQuery && !ideaIdFromParam ? 'user' : 'idea';

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      targetType: initialType,
      targetIdeaId: ideaIdFromParam || '',
      targetUserId: userFromQuery || '',
      reason: 'stolen_or_copied',
      description: '',
      evidenceUrl: '',
    },
  });

  const targetType = watch('targetType');

  useEffect(() => {
    api
      .get('/reports/mine')
      .then((res) => setMyReports(res.data.data.reports || []))
      .catch(() => {});
  }, []);

  async function onSubmit(values) {
    setSubmitting(true);
    try {
      const res = await api.post('/reports', values);
      toast.success(res.data.message);
      reset();
      const updated = await api.get('/reports/mine');
      setMyReports(updated.data.data.reports || []);
      if (ideaIdFromParam) {
        navigate(`/ideas/${ideaIdFromParam}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
          <Flag className="h-3.5 w-3.5" /> Trust, Safety &amp; IP Moderation
        </div>
        <h1 className="mt-2 text-3xl font-extrabold text-[#171717]">Report an Idea or User</h1>
        <p className="mt-1 text-sm text-slate-600">
          Report suspected idea plagiarism, copied confidential specifications, or abusive behavior for administrator review.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Report Type *</label>
            <select
              {...register('targetType')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
            >
              <option value="idea">Stolen / Copied or Violating Idea</option>
              <option value="user">Suspicious or Abusive User Account</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason *</label>
            <select
              {...register('reason')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
            >
              <option value="stolen_or_copied">Stolen or Copied Idea</option>
              <option value="ip_infringement">Confidentiality / NDA Breach</option>
              <option value="suspicious_account">Suspicious / Fake Account</option>
              <option value="spam">Spam or Scam</option>
              <option value="harassment">Harassment</option>
              <option value="inappropriate_content">Inappropriate Content</option>
              <option value="other">Other Policy Issue</option>
            </select>
          </div>
        </div>

        {targetType === 'idea' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Idea ID (Mongo ID from Idea URL) *
            </label>
            <input
              type="text"
              placeholder="e.g. 67b1f0..."
              {...register('targetIdeaId', { required: 'Target Idea ID is required' })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono"
            />
            {errors.targetIdeaId && (
              <p className="mt-1 text-xs text-rose-600">{errors.targetIdeaId.message}</p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reported Username or User ID *
            </label>
            <input
              type="text"
              placeholder="username"
              {...register('targetUserId', { required: 'Username or User ID is required' })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
            {errors.targetUserId && (
              <p className="mt-1 text-xs text-rose-600">{errors.targetUserId.message}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Detailed Explanation &amp; Prior Ownership Context *
          </label>
          <textarea
            rows={4}
            placeholder="Describe what was copied or violated, including original IdeaSpark IDs or timestamps where applicable..."
            {...register('description', {
              required: 'Please describe the issue',
              minLength: { value: 15, message: 'Please write at least 15 characters' },
            })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
          />
          {errors.description && (
            <p className="mt-1 text-xs text-rose-600">{errors.description.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Optional Evidence Link (Original Repo, Timestamped Post, or Document URL)
          </label>
          <input
            type="url"
            placeholder="https://..."
            {...register('evidenceUrl')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {submitting ? 'Submitting Report...' : 'Submit Report for Review'}
          </button>
        </div>
      </form>

      {myReports.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-3">
          <h2 className="text-base font-bold text-[#171717]">My Submitted Reports</h2>
          <div className="divide-y divide-slate-100">
            {myReports.map((rep) => (
              <div key={rep._id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-[#171717] capitalize">
                    {rep.targetType} Report — {rep.reason.replace(/_/g, ' ')}
                  </p>
                  <p className="text-slate-500 line-clamp-1 mt-0.5">{rep.description}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold uppercase text-[10px] text-slate-700">
                  {rep.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

