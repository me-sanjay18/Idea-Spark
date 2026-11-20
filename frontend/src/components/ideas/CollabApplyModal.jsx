import { useForm } from 'react-hook-form';
import { Modal } from '../ui/CommonUI';

export function CollabApplyModal({ open, onClose, idea, user, onSubmitRequest, submitting }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      desiredRole: '',
      skillsText: (user?.skills || []).join(', '),
      message: '',
      experience: '',
      contributionPlan: '',
      signerFullName: user?.name || '',
      ndaAccepted: false,
    },
  });

  function onValid(values) {
    const skills = values.skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    onSubmitRequest({
      desiredRole: values.desiredRole,
      skills,
      message: values.message,
      experience: values.experience,
      contributionPlan: values.contributionPlan,
      signerFullName: values.signerFullName,
      ndaAccepted: values.ndaAccepted,
    });
  }

  if (!idea) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Collaborate on "${idea.title}"`}
      subtitle="Introduce your skills, experience, and how you want to help build this project."
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onValid)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Desired Project Role *
            </label>
            <input
              type="text"
              placeholder="e.g. Frontend Developer, Product Designer"
              {...register('desiredRole', { required: 'Desired role is required' })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
            {idea.requiredRoles?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {idea.requiredRoles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      const input = document.querySelector('input[name="desiredRole"]');
                      if (input) {
                        input.value = r;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                      }
                    }}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-[#6E05F2]/10 hover:text-[#6E05F2]"
                  >
                    + {r}
                  </button>
                ))}
              </div>
            )}
            {errors.desiredRole && (
              <p className="mt-1 text-xs text-rose-600">{errors.desiredRole.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Key Skills (comma-separated)
            </label>
            <input
              type="text"
              placeholder="React, Node.js, Figma..."
              {...register('skillsText')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Personalized Message to Creator *
          </label>
          <textarea
            rows={3}
            placeholder="Share why this problem resonates with you and your availability..."
            {...register('message', {
              required: 'Please include a personalized introduction',
              minLength: { value: 15, message: 'Write at least 15 characters' },
            })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
          />
          {errors.message && <p className="mt-1 text-xs text-rose-600">{errors.message.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Relevant Experience *
            </label>
            <textarea
              rows={3}
              placeholder="Past projects, internships, hackathons, or domain knowledge..."
              {...register('experience', {
                required: 'Please describe your relevant experience',
                minLength: { value: 10, message: 'Write at least 10 characters' },
              })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
            {errors.experience && (
              <p className="mt-1 text-xs text-rose-600">{errors.experience.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              How You Can Contribute *
            </label>
            <textarea
              rows={3}
              placeholder="Concrete deliverables or modules you would love to lead..."
              {...register('contributionPlan', {
                required: 'Please explain how you can contribute',
                minLength: { value: 10, message: 'Write at least 10 characters' },
              })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
            {errors.contributionPlan && (
              <p className="mt-1 text-xs text-rose-600">{errors.contributionPlan.message}</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name for Confidentiality Record *
            </label>
            <input
              type="text"
              {...register('signerFullName', { required: 'Full name is required' })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              {...register('ndaAccepted', {
                required: 'You must accept the confidentiality commitment to apply',
              })}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#6E05F2]"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              I agree to keep non-public details of <strong>{idea.title}</strong> confidential. I understand this acknowledgement is logged with timestamp &amp; version for transparency, and formal legal protection depends on applicable law and executed agreements.
            </span>
          </label>
          {errors.ndaAccepted && (
            <p className="text-xs text-rose-600">{errors.ndaAccepted.message}</p>
          )}
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl brand-gradient-bg px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:opacity-95 disabled:opacity-60"
          >
            {submitting ? 'Sending Request...' : 'Send Collaboration Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

