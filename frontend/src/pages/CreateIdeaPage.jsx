import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { IdeaEditorForm } from '../components/ideas/IdeaEditorForm';
import { useToast } from '../context/ToastContext';

export default function CreateIdeaPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(payload) {
    setSubmitting(true);
    try {
      const res = await api.post('/ideas', payload);
      toast.success(res.data.message);
      const created = res.data.data.idea;

      if (created.status === 'draft') {
        navigate('/my-ideas');
        return;
      }

      const tokenQuery =
        created.visibility === 'unlisted' && created.shareToken
          ? `?token=${created.shareToken}`
          : '';
      navigate(`/ideas/${created._id}${tokenQuery}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-wider text-[#6E05F2]">
          Creator Studio
        </span>
        <h1 className="mt-1 text-3xl font-extrabold text-[#171717]">Share a New Idea</h1>
        <p className="mt-1 text-sm text-slate-600">
          Record an immutable ownership timestamp, configure visibility &amp; NDA controls, and recruit collaborators.
        </p>
      </div>

      <IdeaEditorForm
        mode="create"
        onSubmitIdea={handleCreate}
        onSaveDraft={handleCreate}
        submitting={submitting}
      />
    </div>
  );
}
