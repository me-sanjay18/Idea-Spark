import {
  Archive,
  Copy,
  Edit3,
  Eye,
  FileCheck2,
  Lightbulb,
  Link2Off,
  Plus,
  RefreshCw,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import {
  ConfirmDialog,
  EmptyState,
  NdaBadge,
  StageBadge,
  VisibilityBadge,
} from '../components/ui/CommonUI';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

export default function MyIdeasPage() {
  const { socket } = useSocket();
  const toast = useToast();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMyIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (visibilityFilter !== 'all') params.set('visibility', visibilityFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get(`/ideas/mine?${params.toString()}`);
      setIdeas(res.data.data.ideas || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [visibilityFilter, statusFilter, toast]);

  useEffect(() => {
    fetchMyIdeas();
  }, [fetchMyIdeas]);

  useEffect(() => {
    if (!socket) return undefined;
    function handleVoteUpdated(payload) {
      if (!payload?.ideaId || typeof payload.upvoteCount !== 'number') return;
      setIdeas((prev) =>
        prev.map((item) =>
          String(item._id) === String(payload.ideaId)
            ? { ...item, upvoteCount: payload.upvoteCount }
            : item
        )
      );
    }
    socket.on('idea:voteUpdated', handleVoteUpdated);
    return () => {
      socket.off('idea:voteUpdated', handleVoteUpdated);
    };
  }, [socket]);

  async function handleQuickAccessChange(ideaId, updates) {
    try {
      const res = await api.patch(`/ideas/${ideaId}/access`, updates);
      toast.success(res.data.message);
      fetchMyIdeas();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/ideas/${deleteTarget._id}`);
      toast.success('Idea deleted permanently.');
      setDeleteTarget(null);
      fetchMyIdeas();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  function copyShareLink(idea) {
    if (idea.shareLinkRevoked) {
      toast.error('This share link has been revoked. Generate a new link first.');
      return;
    }
    const url = `${window.location.origin}/ideas/${idea._id}${
      idea.shareToken ? `?token=${idea.shareToken}` : ''
    }`;
    navigator.clipboard.writeText(url);
    toast.success('Private unlisted link copied to clipboard!');
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717]">My Ideas &amp; Drafts</h1>
          <p className="mt-1 text-sm text-slate-600">
            Control visibility, NDA requirements, unlisted links, and lifecycle status for your concepts.
          </p>
        </div>
        <Link
          to="/ideas/new"
          className="inline-flex items-center gap-1.5 rounded-xl brand-gradient-bg px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> New Idea
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {['all', 'public', 'unlisted', 'private'].map((vis) => (
          <button
            key={vis}
            type="button"
            onClick={() => setVisibilityFilter(vis)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
              visibilityFilter === vis
                ? 'bg-[#6E05F2] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {vis === 'all' ? 'All Visibility' : vis}
          </button>
        ))}

        <div className="ml-auto flex gap-2">
          {['active', 'draft', 'archived'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st === 'draft' ? 'Drafts' : st}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title={
              statusFilter === 'draft'
                ? 'No drafts found'
                : 'No ideas found in this view'
            }
            description="Publish a new idea or switch filters to see active, draft, or private concepts."
            action={
              <Link
                to="/ideas/new"
                className="rounded-xl bg-[#6E05F2] px-4 py-2 text-xs font-semibold text-white"
              >
                Create an Idea
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {ideas.map((idea) => (
              <div
                key={idea._id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {idea.status === 'draft' ? (
                      <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 text-xs font-bold uppercase">
                        Draft (Unpublished)
                      </span>
                    ) : (
                      <>
                        <VisibilityBadge visibility={idea.visibility} />
                        <StageBadge stage={idea.projectStage} />
                        <NdaBadge protectedWithNda={idea.protectDetailsWithNDA} />
                      </>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#6E05F2]/8 px-2 py-0.5 text-xs font-semibold text-[#6E05F2]">
                      <ThumbsUp className="h-3 w-3" /> {idea.upvoteCount || 0}
                    </span>
                    <span className="font-mono text-xs text-slate-400">{idea.ideaCode}</span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      v{idea.version || 1}
                    </span>
                  </div>
                  <Link
                    to={idea.status === 'draft' ? `/ideas/${idea._id}/edit` : `/ideas/${idea._id}`}
                    className="block text-lg font-bold text-[#171717] hover:text-[#6E05F2]"
                  >
                    {idea.title || 'Untitled Draft'}
                  </Link>
                  <p className="text-xs text-slate-500 line-clamp-2 max-w-2xl">
                    {idea.shortSummary || 'No summary written yet.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {idea.status !== 'draft' && (
                    <select
                      aria-label="Change visibility"
                      value={idea.visibility}
                      onChange={(e) =>
                        handleQuickAccessChange(idea._id, { visibility: e.target.value })
                      }
                      className="rounded-xl border border-slate-200 bg-[#F8F9FC] px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  )}

                  {idea.visibility === 'unlisted' && idea.status !== 'draft' && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => copyShareLink(idea)}
                        className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                          idea.shareLinkRevoked
                            ? 'border-rose-200 bg-rose-50 text-rose-700 line-through'
                            : 'border-amber-200 bg-amber-50 text-amber-900'
                        }`}
                        title={idea.shareLinkRevoked ? 'Link revoked' : 'Copy unlisted share link'}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {idea.shareLinkRevoked ? 'Revoked' : 'Share Link'}
                      </button>

                      {idea.shareLinkRevoked ? (
                        <button
                          type="button"
                          onClick={() => handleQuickAccessChange(idea._id, { rotateShareToken: true })}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          title="Generate new active share link"
                        >
                          <RefreshCw className="h-3 w-3" /> New Link
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickAccessChange(idea._id, { revokeShareLink: true })}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          title="Revoke active sharing link"
                        >
                          <Link2Off className="h-3 w-3" /> Revoke
                        </button>
                      )}
                    </div>
                  )}

                  <Link
                    to={`/ideas/${idea._id}`}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </Link>

                  <Link
                    to={`/ideas/${idea._id}/edit`}
                    className="inline-flex items-center gap-1 rounded-xl brand-gradient-bg text-white px-3 py-2 text-xs font-semibold shadow-2xs hover:opacity-95"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> {idea.status === 'draft' ? 'Publish' : 'Edit'}
                  </Link>

                  {idea.status !== 'draft' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickAccessChange(idea._id, {
                          status: idea.status === 'archived' ? 'active' : 'archived',
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      {idea.status === 'archived' ? 'Restore' : 'Archive'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(idea)}
                    aria-label="Delete idea"
                    className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Idea Permanently?"
        description={`Are you sure you want to delete "${deleteTarget?.title}" (${deleteTarget?.ideaCode})? Pending collaboration requests will be withdrawn and access will be removed immediately.`}
        confirmLabel="Delete Idea"
        danger
        loading={deleting}
      />
    </div>
  );
}
