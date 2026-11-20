import { ArrowUpRight, Bookmark, Clock, ThumbsUp, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { Avatar, NdaBadge, StageBadge, VisibilityBadge } from '../ui/CommonUI';

export function IdeaCard({
  idea,
  onVoteChange,
  onToggleBookmark,
  showVisibility = false,
}) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();

  const [isUpvoted, setIsUpvoted] = useState(Boolean(idea.isUpvoted));
  const [upvoteCount, setUpvoteCount] = useState(idea.upvoteCount ?? 0);
  const [isBookmarked, setIsBookmarked] = useState(Boolean(idea.isBookmarked));
  const votingInFlightRef = useRef(false);
  const bookmarkInFlightRef = useRef(false);

  useEffect(() => {
    setIsUpvoted(Boolean(idea.isUpvoted));
  }, [idea._id, idea.isUpvoted]);

  useEffect(() => {
    setUpvoteCount(idea.upvoteCount ?? 0);
  }, [idea._id, idea.upvoteCount]);

  useEffect(() => {
    setIsBookmarked(Boolean(idea.isBookmarked));
  }, [idea._id, idea.isBookmarked]);

  useEffect(() => {
    if (!socket || !idea?._id) return undefined;
    const targetId = String(idea._id);

    function handleVoteUpdated(payload) {
      if (String(payload?.ideaId) === targetId && typeof payload.upvoteCount === 'number') {
        setUpvoteCount(payload.upvoteCount);
        onVoteChange?.(idea._id, { upvoteCount: payload.upvoteCount });
      }
    }

    function handleMyVoteUpdated(payload) {
      if (String(payload?.ideaId) === targetId) {
        if (typeof payload.upvoteCount === 'number') {
          setUpvoteCount(payload.upvoteCount);
        }
        if (typeof payload.isUpvoted === 'boolean') {
          setIsUpvoted(payload.isUpvoted);
        }
        onVoteChange?.(idea._id, {
          upvoteCount: payload.upvoteCount,
          isUpvoted: payload.isUpvoted,
        });
      }
    }

    function handleMyBookmarkUpdated(payload) {
      if (String(payload?.ideaId) === targetId && typeof payload.isBookmarked === 'boolean') {
        setIsBookmarked(payload.isBookmarked);
      }
    }

    socket.on('idea:voteUpdated', handleVoteUpdated);
    socket.on('idea:myVoteUpdated', handleMyVoteUpdated);
    socket.on('idea:myBookmarkUpdated', handleMyBookmarkUpdated);

    return () => {
      socket.off('idea:voteUpdated', handleVoteUpdated);
      socket.off('idea:myVoteUpdated', handleMyVoteUpdated);
      socket.off('idea:myBookmarkUpdated', handleMyBookmarkUpdated);
    };
  }, [socket, idea._id, onVoteChange]);

  async function handleUpvoteClick() {
    if (!user) {
      toast.info('Please sign in to like ideas.');
      navigate('/login');
      return;
    }
    if (votingInFlightRef.current) return;
    votingInFlightRef.current = true;

    const prevUpvoted = isUpvoted;
    const prevCount = upvoteCount;
    const optimisticUpvoted = !prevUpvoted;
    const optimisticCount = Math.max(0, prevCount + (optimisticUpvoted ? 1 : -1));

    setIsUpvoted(optimisticUpvoted);
    setUpvoteCount(optimisticCount);
    onVoteChange?.(idea._id, { isUpvoted: optimisticUpvoted, upvoteCount: optimisticCount });

    try {
      const res = await api.post(`/ideas/${idea._id}/vote`);
      const serverData = res.data.data;
      setIsUpvoted(Boolean(serverData.isUpvoted));
      setUpvoteCount(serverData.upvoteCount ?? optimisticCount);
      onVoteChange?.(idea._id, serverData);
    } catch (err) {
      setIsUpvoted(prevUpvoted);
      setUpvoteCount(prevCount);
      onVoteChange?.(idea._id, { isUpvoted: prevUpvoted, upvoteCount: prevCount });
      toast.error(getErrorMessage(err));
    } finally {
      votingInFlightRef.current = false;
    }
  }

  async function handleBookmarkClick() {
    if (onToggleBookmark) {
      onToggleBookmark(idea._id);
      return;
    }
    if (!user) {
      toast.info('Please sign in to bookmark ideas.');
      navigate('/login');
      return;
    }
    if (bookmarkInFlightRef.current) return;
    bookmarkInFlightRef.current = true;

    const prevBookmarked = isBookmarked;
    setIsBookmarked(!prevBookmarked);
    try {
      const res = await api.post(`/bookmarks/${idea._id}`);
      const nextState = Boolean(res.data.data.isBookmarked);
      setIsBookmarked(nextState);
      toast.success(nextState ? 'Saved to bookmarks.' : 'Removed from bookmarks.');
    } catch (err) {
      setIsBookmarked(prevBookmarked);
      toast.error(getErrorMessage(err));
    } finally {
      bookmarkInFlightRef.current = false;
    }
  }
  return (
    <article className="group flex flex-col justify-between rounded-2xl border border-slate-200/85 bg-white p-6 shadow-2xs hover:shadow-md hover:border-[#6E05F2]/30 transition-all">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {idea.status === 'draft' ? (
              <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase">
                Draft
              </span>
            ) : (
              <>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {idea.category}
                </span>
                <StageBadge stage={idea.projectStage} />
                <NdaBadge protectedWithNda={idea.protectDetailsWithNDA} />
                {showVisibility && <VisibilityBadge visibility={idea.visibility} />}
              </>
            )}
          </div>
          <span className="font-mono text-[11px] text-slate-400">{idea.ideaCode}</span>
        </div>

        <Link to={`/ideas/${idea._id}`} className="block mt-3.5 group/title">
          <h3 className="text-lg font-bold text-[#171717] group-hover/title:text-[#6E05F2] transition line-clamp-2">
            {idea.title}
          </h3>
        </Link>

        <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">
          {idea.shortSummary}
        </p>

        {idea.requiredSkills?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {idea.requiredSkills.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className="rounded-md bg-[#F8F9FC] border border-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-600"
              >
                {skill}
              </span>
            ))}
            {idea.requiredSkills.length > 4 && (
              <span className="rounded-md bg-slate-50 px-2 py-0.5 text-xs text-slate-400">
                +{idea.requiredSkills.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
        <Link
          to={idea.creator?.username ? `/users/${idea.creator.username}` : `/ideas/${idea._id}`}
          className="flex items-center gap-2 min-w-0"
        >
          <Avatar user={idea.creator} size="xs" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#171717] truncate">
              {idea.creator?.name || 'Creator'}
            </p>
            <p className="text-[11px] text-slate-400 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> {idea.collaboratorCount || 1}/{idea.teamSize || 4}
              </span>
              {idea.expectedDuration && (
                <span className="hidden sm:inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {idea.expectedDuration}
                </span>
              )}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleUpvoteClick}
            aria-label="Upvote idea"
            aria-pressed={isUpvoted}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
              isUpvoted
                ? 'border-[#6E05F2]/30 bg-[#6E05F2]/10 text-[#6E05F2]'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            <span>{upvoteCount}</span>
          </button>

          <button
            type="button"
            onClick={handleBookmarkClick}
            aria-label="Bookmark idea"
            aria-pressed={isBookmarked}
            className={`rounded-xl border p-1.5 transition ${
              isBookmarked
                ? 'border-[#2057E8]/30 bg-[#2057E8]/10 text-[#2057E8]'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
          </button>

          <Link
            to={`/ideas/${idea._id}`}
            aria-label={`Open ${idea.title}`}
            className="rounded-xl bg-slate-100 p-1.5 text-slate-700 hover:bg-[#6E05F2] hover:text-white transition"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

