import { AlertCircle, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Modal } from '../ui/CommonUI';

export function NdaGateModal({ open, onClose, idea, defaultName = '', onSign, submitting }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      signerFullName: defaultName,
      acknowledged: false,
    },
  });

  if (!idea) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confidentiality & NDA Acknowledgement"
      subtitle={`Idea ID: ${idea.ideaCode} • Agreement Version v${idea.ndaVersion || 1}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit(onSign)} className="space-y-4">
        <div className="rounded-xl border border-[#6E05F2]/20 bg-[#6E05F2]/[0.04] p-4 text-sm text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-[#6E05F2]">
            <ShieldCheck className="h-4 w-4" />
            <span>Creator-Protected Specifications</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            The creator of <strong>{idea.title}</strong> requires a recorded confidentiality acknowledgement before revealing full technical specifications, proposed architecture, and protected documents.
          </p>
        </div>

        {idea.customNdaUrl && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="h-5 w-5 text-[#2057E8] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#171717] truncate">
                  {idea.customNdaName || 'Creator Custom NDA Document'}
                </p>
                <p className="text-[11px] text-slate-500">Review the creator&apos;s uploaded NDA document</p>
              </div>
            </div>
            <a
              href={idea.customNdaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#2057E8] hover:bg-slate-100"
            >
              Open <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        <div className="rounded-xl bg-amber-50/80 border border-amber-200/80 p-3.5 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong>Important Legal Notice:</strong> Recording an in-app acknowledgement and timestamp creates an audit trail of access and intent, and does not by itself guarantee legally enforceable IP protection. Actual legal protection depends on applicable law and properly drafted agreements.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Your Full Legal Name
          </label>
          <input
            type="text"
            placeholder="Enter your full name"
            {...register('signerFullName', {
              required: 'Full legal name is required',
              minLength: { value: 2, message: 'Please enter at least 2 characters' },
            })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
          />
          {errors.signerFullName && (
            <p className="mt-1 text-xs text-rose-600">{errors.signerFullName.message}</p>
          )}
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            {...register('acknowledged', {
              required: 'Please check the box to confirm your confidentiality commitment',
            })}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#6E05F2] focus:ring-[#6E05F2]"
          />
          <span className="text-xs text-slate-700 leading-relaxed">
            I agree to treat all non-public project descriptions, proposed solutions, and workspace discussions for <strong>{idea.ideaCode}</strong> as confidential, and not to copy, publish, or use them outside authorized collaboration without the creator&apos;s written consent.
          </span>
        </label>
        {errors.acknowledged && (
          <p className="text-xs text-rose-600">{errors.acknowledged.message}</p>
        )}

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
            className="rounded-xl bg-[#6E05F2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5b04c9] disabled:opacity-60"
          >
            {submitting ? 'Recording Acceptance...' : 'Accept & Unlock Details'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

