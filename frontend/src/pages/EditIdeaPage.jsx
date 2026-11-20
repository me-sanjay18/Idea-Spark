import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { IdeaEditorForm } from '../components/ideas/IdeaEditorForm';
import { useToast } from '../context/ToastContext';

export default function EditIdeaPage() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();

  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get(`/ideas/${id}`)
      .then((res) => {
        const fetched = res.data.data.idea;
        if (!fetched.access?.isOwner) {
          toast.error('Only the idea owner can edit this idea.');
          navigate(`/ideas/${id}`);
          return;
        }
        setIdea(fetched);
      })
      .catch((err) => {
        toast.error(getErrorMessage(err));
        navigate('/my-ideas');
      })
      .finally(() => setLoading(false));
  }, [id, navigate, toast]);

  async function handleUpdate(payload) {
    setSubmitting(true);
    try {
      const res = await api.put(`/ideas/${id}`, payload);
      toast.success(res.data.message);
      if (payload.status === 'draft') {
        navigate('/my-ideas');
      } else {
        navigate(`/ideas/${id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14">
        <div className="h-64 rounded-3xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (!idea) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-wider text-[#2057E8]">
          Editing {idea.ideaCode} (v{idea.version || 1})
        </span>
        <h1 className="mt-1 text-3xl font-extrabold text-[#171717]">Edit Idea &amp; Access Controls</h1>
        <p className="mt-1 text-sm text-slate-600">
          Updates are versioned in your idea&apos;s edit &amp; ownership history log with previous snapshots.
        </p>
      </div>

      <IdeaEditorForm
        mode="edit"
        initialIdea={idea}
        onSubmitIdea={handleUpdate}
        onSaveDraft={handleUpdate}
        submitting={submitting}
      />
    </div>
  );
}
