import {
  AlertCircle,
  Bookmark,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Flag,
  FolderKanban,
  History,
  Info,
  Link2Off,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { CollabApplyModal } from '../components/ideas/CollabApplyModal';
import { NdaGateModal } from '../components/ideas/NdaGateModal';
import { Avatar, ConfirmDialog, NdaBadge, StageBadge, VisibilityBadge } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

export default function IdeaDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get('token') || '';

  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const votingInFlightRef = useRef(false);

  const [idea, setIdea] = useState(null);
  const [myRequest, setMyRequest] = useState(null);
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  const [ndaModalOpen, setNdaModalOpen] = useState(false);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [submittingNda, setSubmittingNda] = useState(false);
  const [submittingCollab, setSubmittingCollab] = useState(false);
  const [authUserInput, setAuthUserInput] = useState('');
  const [revokeNdaTarget, setRevokeNdaTarget] = useState(null);

  const loadIdea = useCallback(async () => {
    setLoading(true);
    setErrorText('');
    try {
      const query = shareToken ? `?token=${encodeURIComponent(shareToken)}` : '';
      const res = await api.get(`/ideas/${id}${query}`);
      setIdea(res.data.data.idea);
      setMyRequest(res.data.data.myCollaborationRequest || null);

      if (user) {
        api
          .get(`/ideas/${id}/records`)
          .then((r) => setRecords(r.data.data))
          .catch(() => {});
      }
    } catch (err) {
      setErrorText(getErrorMessage(err, 'Unable to load this idea.'));
    } finally {
      setLoading(false);
    }
  }, [id, shareToken, user]);

  useEffect(() => {
    loadIdea();
  }, [loadIdea]);

  useEffect(() => {
    if (!socket || !id) return undefined;
    const targetId = String(id);

    function handleVoteUpdated(payload) {
      if (String(payload?.ideaId) === targetId && typeof payload.upvoteCount === 'number') {
        setIdea((prev) => (prev ? { ...prev, upvoteCount: payload.upvoteCount } : prev));
      }
    }

    function handleMyVoteUpdated(payload) {
      if (String(payload?.ideaId) === targetId) {
        setIdea((prev) =>
          prev
            ? {
                ...prev,
                ...(typeof payload.upvoteCount === 'number' ? { upvoteCount: payload.upvoteCount } : {}),
                ...(typeof payload.isUpvoted === 'boolean' ? { isUpvoted: payload.isUpvoted } : {}),
              }
            : prev
        );
      }
    }

    function handleMyBookmarkUpdated(payload) {
      if (String(payload?.ideaId) === targetId && typeof payload.isBookmarked === 'boolean') {
        setIdea((prev) =>
          prev
            ? {
                ...prev,
                isBookmarked: payload.isBookmarked,
                ...(typeof payload.bookmarkCount === 'number' ? { bookmarkCount: payload.bookmarkCount } : {}),
              }
            : prev
        );
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
  }, [socket, id]);

  async function handleSignNda(values) {
    setSubmittingNda(true);
    try {
      const res = await api.post(`/ideas/${id}/nda`, {
        ...values,
        shareToken,
      });
      setIdea(res.data.data.idea);
      setNdaModalOpen(false);
      toast.success(res.data.message);
      loadIdea();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingNda(false);
    }
  }

  async function handleSendCollabRequest(values) {
    setSubmittingCollab(true);
    try {
      const res = await api.post('/collaborations/requests', {
        ideaId: id,
        ...values,
        shareToken,
      });
      setMyRequest(res.data.data.request);
      setCollabModalOpen(false);
      toast.success(res.data.message);
      loadIdea();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingCollab(false);
    }
  }

  async function handleUpvote() {
    if (!user) {
      navigate('/login');
      return;
    }
    if (votingInFlightRef.current || !idea) return;
    votingInFlightRef.current = true;

    const prevUpvoted = Boolean(idea.isUpvoted);
    const prevCount = idea.upvoteCount ?? 0;
    const optimisticUpvoted = !prevUpvoted;
    const optimisticCount = Math.max(0, prevCount + (optimisticUpvoted ? 1 : -1));

    setIdea((prev) =>
      prev ? { ...prev, isUpvoted: optimisticUpvoted, upvoteCount: optimisticCount } : prev
    );

    try {
      const query = shareToken ? `?token=${encodeURIComponent(shareToken)}` : '';
      const res = await api.post(`/ideas/${id}/vote${query}`);
      setIdea((prev) =>
        prev
          ? {
              ...prev,
              isUpvoted: res.data.data.isUpvoted,
              upvoteCount: res.data.data.upvoteCount,
            }
          : prev
      );
    } catch (err) {
      setIdea((prev) =>
        prev ? { ...prev, isUpvoted: prevUpvoted, upvoteCount: prevCount } : prev
      );
      toast.error(getErrorMessage(err));
    } finally {
      votingInFlightRef.current = false;
    }
  }

  async function handleBookmark() {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.post(`/bookmarks/${id}`, { shareToken });
      setIdea((prev) => ({
        ...prev,
        isBookmarked: res.data.data.isBookmarked,
        bookmarkCount: res.data.data.bookmarkCount,
      }));
      toast.success(res.data.message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleAddAuthorizedUser(e) {
    e.preventDefault();
    if (!authUserInput.trim()) return;
    try {
      const res = await api.patch(`/ideas/${id}/access`, {
        addAuthorizedIdentifier: authUserInput.trim(),
      });
      setIdea(res.data.data.idea);
      setAuthUserInput('');
      toast.success('Authorized viewer added.');
      loadIdea();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleRevokeNdaAccess() {
    if (!revokeNdaTarget) return;
    try {
      await api.patch(`/ideas/${id}/access`, {
        revokeNdaAgreementId: revokeNdaTarget._id,
        revokeReason: 'Revoked by owner',
      });
      toast.success(`Revoked NDA access for ${revokeNdaTarget.signerFullName}.`);
      setRevokeNdaTarget(null);
      loadIdea();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  function copyUnlistedLink() {
    if (!idea?.shareToken) return;
    if (idea.shareLinkRevoked) {
      toast.error('This sharing link has been revoked. Generate a new link in settings.');
      return;
    }
    const url = `${window.location.origin}/ideas/${idea._id}?token=${idea.shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success('Private unlisted link copied to clipboard!');
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-14 space-y-6">
        <div className="h-44 rounded-3xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-72 rounded-3xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (errorText || !idea) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-2xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-[#171717]">Protected or Unavailable Idea</h1>
          <p className="mt-2 text-sm text-slate-600">{errorText}</p>
          <Link
            to="/explore"
            className="mt-6 inline-flex rounded-xl bg-[#6E05F2] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Explore Public Ideas
          </Link>
        </div>
      </div>
    );
  }

  const { access } = idea;
  const isTeamFull = Boolean(idea.maxCollaborators && (idea.collaboratorCount || 1) >= idea.maxCollaborators);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Draft Status Banner */}
      {idea.status === 'draft' && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Info className="h-5 w-5 text-amber-700 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-amber-900">
              This idea is currently an unpublished private draft. Only you can view it until published.
            </span>
          </div>
          <Link
            to={`/ideas/${idea._id}/edit`}
            className="rounded-xl brand-gradient-bg text-white px-4 py-2 text-xs font-bold text-center shrink-0 shadow-xs"
          >
            Finish &amp; Publish Idea
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* LEFT COLUMN: IDEA CONTENT */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {idea.category}
                </span>
                <StageBadge stage={idea.projectStage} />
                <VisibilityBadge visibility={idea.visibility} />
                <NdaBadge protectedWithNda={idea.protectDetailsWithNDA} />
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                <span>{idea.ideaCode}</span>
                <span className="text-slate-400">• v{idea.version || 1}</span>
              </div>
            </div>

            <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-[#171717] leading-tight">
              {idea.title}
            </h1>

            <p className="mt-3 text-base text-slate-600 leading-relaxed">{idea.shortSummary}</p>

            {/* Target Audience & Domain Badges */}
            {(idea.targetAudience || idea.industryDomain) && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {idea.industryDomain && (
                  <span className="rounded-lg bg-[#2057E8]/10 text-[#2057E8] border border-[#2057E8]/20 px-3 py-1 font-semibold">
                    Industry: {idea.industryDomain}
                  </span>
                )}
                {idea.targetAudience && (
                  <span className="rounded-lg bg-[#6E05F2]/10 text-[#6E05F2] border border-[#6E05F2]/20 px-3 py-1 font-semibold">
                    Audience: {idea.targetAudience}
                  </span>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4 pt-5 border-t border-slate-100 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-400" />
                Published {new Date(idea.createdAt).toLocaleDateString()}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" />
                Duration: {idea.expectedDuration}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-slate-400" />
                Team: {idea.collaboratorCount || 1} / {idea.maxCollaborators || idea.teamSize} members
              </span>
            </div>
          </div>

          {/* Section 1: Problem & Existing Alternatives */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
            <h2 className="text-lg font-bold text-[#171717]">Problem &amp; Context</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Problem Statement
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {idea.problemStatement}
                </p>
              </div>

              {idea.existingAlternatives && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Existing Alternatives &amp; Current Friction
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {idea.existingAlternatives}
                  </p>
                </div>
              )}

              {idea.marketOpportunity && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Market Opportunity
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {idea.marketOpportunity}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Protected Specifications Gate OR Full Details */}
          {!access?.canViewProtectedDetails ? (
            <section className="rounded-3xl border-2 border-dashed border-[#6E05F2]/30 bg-white p-8 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6E05F2]/10 text-[#6E05F2]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-extrabold text-[#171717]">
                {access?.requiresAuthenticationForDetails && !user
                  ? 'Sign In to View Full Project Architecture'
                  : 'Confidentiality Acknowledgement Required'}
              </h2>
              <p className="mx-auto max-w-lg text-sm text-slate-600 leading-relaxed">
                {access?.requiresAuthenticationForDetails && !user
                  ? 'Detailed descriptions, proposed solutions, and project attachments are restricted to authenticated IdeaSpark builders.'
                  : 'The creator has protected the detailed solution, technical architecture, and confidential attachments behind a recorded NDA / Confidentiality acknowledgement.'}
              </p>
              {!user ? (
                <Link
                  to="/login"
                  state={{ from: `/ideas/${idea._id}${shareToken ? `?token=${shareToken}` : ''}` }}
                  className="inline-flex rounded-xl brand-gradient-bg px-6 py-2.5 text-sm font-semibold text-white"
                >
                  Sign In to Continue
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setNdaModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#6E05F2] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5b04c9]"
                >
                  <ShieldCheck className="h-4 w-4" /> Review &amp; Accept Confidentiality Terms
                </button>
              )}
            </section>
          ) : (
            <>
              <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[#171717]">
                    Proposed Solution &amp; Detailed Specifications
                  </h2>
                  {access.hasAcceptedNda && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> NDA Accepted
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Proposed Solution
                  </h3>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {idea.proposedSolution}
                  </p>
                </div>

                {idea.uniqueSellingProposition && (
                  <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Unique Selling Proposition (USP)
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {idea.uniqueSellingProposition}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Detailed Description &amp; Roadmap
                  </h3>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {idea.detailedDescription}
                  </p>
                </div>

                {/* Key Features List */}
                {idea.keyFeatures?.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                      Key Features
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {idea.keyFeatures.map((feat) => (
                        <div
                          key={feat._id || feat.title}
                          className="rounded-xl border border-slate-200 bg-[#F8F9FC] p-3 text-xs space-y-1"
                        >
                          <p className="font-bold text-[#171717]">{feat.title}</p>
                          {feat.description && (
                            <p className="text-slate-600 leading-relaxed">{feat.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(idea.expectedOutcome || idea.successMetrics) && (
                  <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {idea.expectedOutcome && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Expected Outcome
                        </h3>
                        <p className="text-xs text-slate-700 leading-relaxed">{idea.expectedOutcome}</p>
                      </div>
                    )}
                    {idea.successMetrics && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Success Metrics
                        </h3>
                        <p className="text-xs text-slate-700 leading-relaxed">{idea.successMetrics}</p>
                      </div>
                    )}
                  </div>
                )}

                {idea.referenceLinks?.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Reference &amp; Inspiration Links
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {idea.referenceLinks.map((linkItem, idx) => (
                        <a
                          key={idx}
                          href={linkItem.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#2057E8] hover:bg-slate-50"
                        >
                          {linkItem.title || 'Reference Link'} <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {idea.collaborationRequirements && (
                  <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Collaboration Expectations
                    </h3>
                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                      {idea.collaborationRequirements}
                    </p>
                  </div>
                )}

                {idea.attachments?.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                      Project Attachments
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {idea.attachments.map((att) => (
                        <a
                          key={att._id || att.url}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-[#F8F9FC] px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:border-[#2057E8]"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <FileText className="h-4 w-4 text-[#2057E8] shrink-0" />
                            <span className="truncate">{att.name}</span>
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          {/* Section 3: Collaboration Setup */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
            <h2 className="text-lg font-bold text-[#171717]">Collaboration &amp; Work Model</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400">Collaboration:</span>
                <p className="font-bold text-[#171717] mt-0.5 capitalize">
                  {idea.collaborationType?.replace('_', ' ') || 'Startup'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400">Work Style:</span>
                <p className="font-bold text-[#171717] mt-0.5 capitalize">{idea.workArrangement || 'Remote'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400">Weekly Time:</span>
                <p className="font-bold text-[#171717] mt-0.5">{idea.weeklyCommitment || '5-10'} hrs/wk</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400">Compensation:</span>
                <p className="font-bold text-[#171717] mt-0.5 capitalize">{idea.compensationModel || 'Open'}</p>
              </div>
            </div>

            {idea.requiredRoles?.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-bold text-slate-700 mb-2">Required Team Roles:</p>
                <div className="flex flex-wrap gap-1.5">
                  {idea.requiredRoles.map((role) => (
                    <span
                      key={role}
                      className="rounded-xl bg-[#2057E8]/10 text-[#2057E8] border border-[#2057E8]/20 px-3 py-1 text-xs font-semibold"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Ownership, Edit History & Audit Records */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-[#6E05F2]" />
              <h2 className="text-base font-bold text-[#171717]">
                Ownership Record &amp; Version History
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl bg-[#F8F9FC] p-3.5 border border-slate-100">
                <p className="text-slate-500">Unique Idea ID</p>
                <p className="mt-1 font-mono font-bold text-[#171717]">{idea.ideaCode}</p>
              </div>
              <div className="rounded-xl bg-[#F8F9FC] p-3.5 border border-slate-100">
                <p className="text-slate-500">Original Timestamp</p>
                <p className="mt-1 font-semibold text-[#171717]">
                  {new Date(idea.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-[#F8F9FC] p-3.5 border border-slate-100">
                <p className="text-slate-500">Current Version</p>
                <p className="mt-1 font-semibold text-[#171717]">Version v{idea.version || 1}</p>
              </div>
              <div className="rounded-xl bg-[#F8F9FC] p-3.5 border border-slate-100">
                <p className="text-slate-500">Recorded Revisions</p>
                <p className="mt-1 font-semibold text-[#171717]">
                  {idea.editHistory ? idea.editHistory.length : idea.editCount || 0} edits
                </p>
              </div>
            </div>

            {/* Signed Confidentiality Log (Owner view with Revocation) */}
            {access?.isOwner && records?.agreements?.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  Signed Confidentiality Acknowledgements ({records.agreements.length})
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {records.agreements.map((ag) => (
                    <div
                      key={ag._id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs border border-slate-200"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-[#171717]">{ag.signerFullName}</span>{' '}
                        <span className="text-slate-500">(@{ag.user?.username})</span> —{' '}
                        <span className="font-mono text-[11px] text-[#6E05F2]">v{ag.agreementVersion}</span>
                        {ag.revokedAt && (
                          <span className="ml-2 rounded-md bg-rose-100 text-rose-700 px-1.5 py-0.5 text-[10px] font-bold">
                            Revoked
                          </span>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Signed {new Date(ag.acceptedAt).toLocaleString()}
                        </p>
                      </div>

                      {!ag.revokedAt && (
                        <button
                          type="button"
                          onClick={() => setRevokeNdaTarget(ag)}
                          className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 shrink-0"
                        >
                          Revoke Access
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT SIDEBAR: ACTIONS, SKILLS, CREATOR */}
        <div className="space-y-6">
          {/* Primary Action Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUpvote}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition ${
                  idea.isUpvoted
                    ? 'border-[#6E05F2] bg-[#6E05F2]/10 text-[#6E05F2]'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ThumbsUp className="h-4 w-4" />
                Upvote ({idea.upvoteCount || 0})
              </button>
              <button
                type="button"
                onClick={handleBookmark}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  idea.isBookmarked
                    ? 'border-[#2057E8] bg-[#2057E8]/10 text-[#2057E8]'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Bookmark className="h-4 w-4" />
                {idea.isBookmarked ? 'Saved' : 'Save'}
              </button>
            </div>

            {access?.isOwner ? (
              <div className="space-y-2.5 pt-2">
                <Link
                  to={`/ideas/${idea._id}/edit`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient-bg py-2.5 text-sm font-semibold text-white shadow-xs hover:opacity-95"
                >
                  <Edit3 className="h-4 w-4" /> Edit Idea &amp; Access Controls
                </Link>

                {access.collaborationId && (
                  <Link
                    to={`/workspaces/${access.collaborationId}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2057E8]/30 bg-[#2057E8]/8 py-2.5 text-sm font-semibold text-[#2057E8]"
                  >
                    <FolderKanban className="h-4 w-4" /> Open Team Workspace
                  </Link>
                )}

                {idea.visibility === 'unlisted' && idea.shareToken && (
                  <button
                    type="button"
                    onClick={copyUnlistedLink}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 py-2 text-xs font-semibold text-amber-900"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy Unlisted Share Link
                  </button>
                )}

                {idea.visibility === 'private' && (
                  <form onSubmit={handleAddAuthorizedUser} className="pt-2 space-y-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      Authorize Private Viewer (username or email)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={authUserInput}
                        onChange={(e) => setAuthUserInput(e.target.value)}
                        placeholder="username"
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Grant
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : access?.isCollaborator ? (
              <Link
                to={`/workspaces/${access.collaborationId}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient-bg py-3 text-sm font-semibold text-white shadow-sm"
              >
                <FolderKanban className="h-4 w-4" /> Enter Team Workspace
              </Link>
            ) : myRequest?.status === 'pending' ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-xs font-bold text-amber-900">Collaboration Request Pending</p>
                <p className="mt-1 text-xs text-amber-800">
                  Applied as <strong>{myRequest.desiredRole}</strong>. Manage in{' '}
                  <Link to="/requests" className="underline font-semibold">
                    Requests
                  </Link>
                  .
                </p>
              </div>
            ) : !idea.allowCollaborationRequests ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-xs font-bold text-slate-700">Collaboration Requests Disabled</p>
                <p className="mt-1 text-xs text-slate-500">
                  The creator is not accepting new team applications at this time.
                </p>
              </div>
            ) : isTeamFull ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-xs font-bold text-slate-700">Team Roster Full</p>
                <p className="mt-1 text-xs text-slate-500">
                  This project has reached its maximum team size limit ({idea.maxCollaborators} members).
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    navigate('/login', { state: { from: `/ideas/${idea._id}` } });
                    return;
                  }
                  setCollabModalOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient-bg py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              >
                <UserPlus className="h-4 w-4" /> Request to Collaborate
              </button>
            )}
          </div>

          {/* Required Skills */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs">
            <h3 className="text-sm font-bold text-[#171717]">Skills Needed</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {(idea.requiredSkills || []).length === 0 ? (
                <span className="text-xs text-slate-500">Open to all motivated collaborators</span>
              ) : (
                idea.requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg border border-[#6E05F2]/20 bg-[#6E05F2]/6 px-2.5 py-1 text-xs font-semibold text-[#6E05F2]"
                  >
                    {skill}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Creator Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Idea Creator</h3>
            <Link
              to={`/users/${idea.creator?.username}`}
              className="flex items-center gap-3 group"
            >
              <Avatar user={idea.creator} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#171717] group-hover:text-[#6E05F2] truncate">
                  {idea.creator?.name}
                </p>
                <p className="text-xs text-slate-500 truncate">@{idea.creator?.username}</p>
              </div>
            </Link>
            {idea.creator?.headline && (
              <p className="text-xs text-slate-600 leading-relaxed">{idea.creator.headline}</p>
            )}

            {!access?.isOwner && (
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <Link
                  to={`/users/${idea.creator?.username}`}
                  className="text-xs font-semibold text-[#2057E8] hover:underline"
                >
                  View Creator Profile
                </Link>
                <Link
                  to={`/ideas/${idea._id}/report`}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600"
                >
                  <Flag className="h-3.5 w-3.5" /> Report Idea
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <NdaGateModal
        open={ndaModalOpen}
        onClose={() => setNdaModalOpen(false)}
        idea={idea}
        defaultName={user?.name || ''}
        onSign={handleSignNda}
        submitting={submittingNda}
      />

      <CollabApplyModal
        open={collabModalOpen}
        onClose={() => setCollabModalOpen(false)}
        idea={idea}
        user={user}
        onSubmitRequest={handleSendCollabRequest}
        submitting={submittingCollab}
      />

      <ConfirmDialog
        open={Boolean(revokeNdaTarget)}
        onClose={() => setRevokeNdaTarget(null)}
        onConfirm={handleRevokeNdaAccess}
        title="Revoke NDA Confidentiality Access?"
        description={`Are you sure you want to revoke NDA access for ${revokeNdaTarget?.signerFullName}? They will immediately lose access to your protected solution and technical attachments.`}
        confirmLabel="Revoke Access"
        danger
      />
    </div>
  );
}
