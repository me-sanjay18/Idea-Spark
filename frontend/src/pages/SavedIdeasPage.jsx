import { Bookmark } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { IdeaCard } from '../components/ideas/IdeaCard';
import { EmptyState, SkeletonCard } from '../components/ui/CommonUI';
import { useToast } from '../context/ToastContext';

export default function SavedIdeasPage() {
  const toast = useToast();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookmarks');
      setIdeas(res.data.data.ideas || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  async function handleToggleBookmark(ideaId) {
    try {
      await api.delete(`/bookmarks/${ideaId}`);
      setIdeas((prev) => prev.filter((item) => item._id !== ideaId));
      toast.success('Removed from saved ideas.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const handleVoteChange = useCallback((ideaId, updates) => {
    setIdeas((prev) =>
      prev.map((item) =>
        String(item._id) === String(ideaId)
          ? {
              ...item,
              ...(typeof updates.upvoteCount === 'number' ? { upvoteCount: updates.upvoteCount } : {}),
              ...(typeof updates.isUpvoted === 'boolean' ? { isUpvoted: updates.isUpvoted } : {}),
            }
          : item
      )
    );
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-extrabold text-[#171717]">Saved Ideas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ideas you have bookmarked to revisit or apply to join.
        </p>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="No bookmarked ideas yet"
            description="Explore public ideas and click the bookmark icon to save concepts you want to collaborate on."
            action={
              <Link
                to="/explore"
                className="rounded-xl brand-gradient-bg px-5 py-2.5 text-xs font-semibold text-white"
              >
                Explore Ideas
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea._id}
                idea={idea}
                onToggleBookmark={handleToggleBookmark}
                onVoteChange={handleVoteChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

