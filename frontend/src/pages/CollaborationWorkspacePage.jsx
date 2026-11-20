import {
  CheckCircle2,
  Circle,
  Clock,
  FolderKanban,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { Avatar, ConfirmDialog, EmptyState, StageBadge, VisibilityBadge } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

export default function CollaborationWorkspacePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const toast = useToast();

  const [workspacesList, setWorkspacesList] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [teamMessages, setTeamMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDesc, setMilestoneDesc] = useState('');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const [chatText, setChatText] = useState('');
  const [removeMemberTarget, setRemoveMemberTarget] = useState(null);
  const chatScrollRef = useRef(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/collaborations');
      setWorkspacesList(res.data.data.collaborations || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadSingleWorkspace = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/collaborations/${id}`);
      const collab = res.data.data.collaboration;
      setWorkspace(collab);

      if (collab.conversation) {
        const msgRes = await api.get(
          `/messages/conversations/${collab.conversation}/messages?limit=30`
        );
        setTeamMessages(msgRes.data.data.messages || []);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (id) loadSingleWorkspace();
    else loadList();
  }, [id, loadList, loadSingleWorkspace]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [teamMessages.length]);

  useEffect(() => {
    if (!socket || !workspace?.conversation) return undefined;
    const convId = String(workspace.conversation?._id || workspace.conversation);

    function joinConversationRoom() {
      socket.emit('conversation:join', convId);
    }

    if (socket.connected) {
      joinConversationRoom();
    }
    socket.on('connect', joinConversationRoom);

    function onNewMessage(msg) {
      const msgConvId = String(msg.conversation?._id || msg.conversation);
      if (msgConvId === convId) {
        setTeamMessages((prev) =>
          prev.some((m) => String(m._id) === String(msg._id)) ? prev : [...prev, msg]
        );
      }
    }

    function onWorkspaceUpdated(payload) {
      if (payload && String(payload.collaborationId) === String(id)) {
        setWorkspace((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            ...(payload.milestones ? { milestones: payload.milestones } : {}),
            ...(payload.updates ? { updates: payload.updates } : {}),
            ...(payload.members ? { members: payload.members } : {}),
            ...(payload.status ? { status: payload.status } : {}),
          };
        });
      }
    }

    socket.on('message:new', onNewMessage);
    socket.on('workspace:updated', onWorkspaceUpdated);
    return () => {
      socket.off('connect', joinConversationRoom);
      socket.off('message:new', onNewMessage);
      socket.off('workspace:updated', onWorkspaceUpdated);
    };
  }, [socket, workspace?.conversation, id]);

  async function handleAddMilestone(e) {
    e.preventDefault();
    if (!milestoneTitle.trim()) return;
    try {
      const res = await api.post(`/collaborations/${id}/milestones`, {
        title: milestoneTitle.trim(),
        description: milestoneDesc.trim(),
        status: 'todo',
      });
      setWorkspace((prev) => ({ ...prev, milestones: res.data.data.milestones }));
      setMilestoneTitle('');
      setMilestoneDesc('');
      toast.success('Milestone added.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleMilestoneStatus(milestoneId, status) {
    try {
      const res = await api.patch(`/collaborations/${id}/milestones/${milestoneId}`, { status });
      setWorkspace((prev) => ({ ...prev, milestones: res.data.data.milestones }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleDeleteMilestone(milestoneId) {
    try {
      const res = await api.delete(`/collaborations/${id}/milestones/${milestoneId}`);
      setWorkspace((prev) => ({ ...prev, milestones: res.data.data.milestones }));
      toast.success('Milestone removed.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handlePostUpdate(e) {
    e.preventDefault();
    if (!updateContent.trim()) return;
    try {
      const res = await api.post(`/collaborations/${id}/updates`, {
        title: updateTitle.trim(),
        content: updateContent.trim(),
      });
      setWorkspace((prev) => ({ ...prev, updates: res.data.data.updates }));
      setUpdateTitle('');
      setUpdateContent('');
      toast.success('Project update shared!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleSendTeamMessage(e) {
    e.preventDefault();
    if (!chatText.trim() || !workspace?.conversation) return;
    const text = chatText.trim();
    setChatText('');
    try {
      const res = await api.post(
        `/messages/conversations/${workspace.conversation}/messages`,
        { content: text }
      );
      const created = res.data.data.message;
      setTeamMessages((prev) =>
        prev.some((m) => m._id === created._id) ? prev : [...prev, created]
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmRemoveMember() {
    if (!removeMemberTarget) return;
    try {
      const res = await api.patch(
        `/collaborations/${id}/members/${removeMemberTarget.user._id}`,
        { remove: true }
      );
      setWorkspace((prev) => ({ ...prev, members: res.data.data.members }));
      setRemoveMemberTarget(null);
      toast.success('Collaborator removed from workspace.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  // LIST VIEW (/workspaces)
  if (!id) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold text-[#171717]">Collaboration Workspaces</h1>
        <p className="mt-1 text-sm text-slate-600">
          Private execution spaces for ideas where you are the founder or an accepted team member.
        </p>

        <div className="mt-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((n) => (
                <div key={n} className="h-44 rounded-3xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : workspacesList.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No active workspaces yet"
              description="Accept a collaborator on one of your ideas or apply to join a public project to unlock your first team workspace."
              action={
                <Link
                  to="/explore"
                  className="rounded-xl brand-gradient-bg px-5 py-2.5 text-xs font-semibold text-white"
                >
                  Discover Ideas to Join
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {workspacesList.map((ws) => (
                <Link
                  key={ws._id}
                  to={`/workspaces/${ws._id}`}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs hover:border-[#6E05F2]/40 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {ws.idea?.category}
                      </span>
                      <span className="font-mono text-xs text-slate-400">{ws.idea?.ideaCode}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-[#171717]">{ws.idea?.title}</h3>
                    <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
                      {ws.idea?.shortSummary}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {(ws.members || []).slice(0, 5).map((m) => (
                        <Avatar key={m._id} user={m.user} size="xs" />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-[#6E05F2]">Open Workspace →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // DETAIL WORKSPACE VIEW (/workspaces/:id)
  if (loading || !workspace) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="h-72 rounded-3xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const isOwner = String(workspace.owner?._id || workspace.owner) === String(user?._id);
  const completedCount = (workspace.milestones || []).filter((m) => m.status === 'done').length;
  const totalMilestones = (workspace.milestones || []).length;
  const progressPct = totalMilestones ? Math.round((completedCount / totalMilestones) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Workspace Header */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-[#6E05F2]/10 px-2.5 py-1 text-xs font-bold text-[#6E05F2]">
              Team Workspace
            </span>
            <StageBadge stage={workspace.idea?.projectStage} />
            <VisibilityBadge visibility={workspace.idea?.visibility} />
            <span className="font-mono text-xs text-slate-400">{workspace.idea?.ideaCode}</span>
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-[#171717]">
            {workspace.idea?.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{workspace.idea?.shortSummary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {workspace.conversation && (
            <Link
              to={`/messages/${workspace.conversation}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2057E8] px-4 py-2.5 text-xs font-semibold text-white"
            >
              <MessageSquare className="h-4 w-4" /> Full-Screen Team Chat
            </Link>
          )}
          <Link
            to={`/ideas/${workspace.idea?._id}`}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            View Idea Brief
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT 2 COLUMNS: MILESTONES + UPDATES */}
        <div className="lg:col-span-2 space-y-8">
          {/* Progress & Milestones */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#171717]">Project Progress &amp; Milestones</h2>
                <p className="text-xs text-slate-500">
                  {completedCount} of {totalMilestones} milestones completed ({progressPct}%)
                </p>
              </div>
              <span className="text-sm font-extrabold text-[#6E05F2]">{progressPct}%</span>
            </div>

            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full brand-gradient-bg transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Add Milestone Form */}
            <form onSubmit={handleAddMilestone} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                placeholder="New milestone title..."
                className="sm:col-span-5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-[#6E05F2] focus:outline-none"
              />
              <input
                type="text"
                value={milestoneDesc}
                onChange={(e) => setMilestoneDesc(e.target.value)}
                placeholder="Optional deliverable note..."
                className="sm:col-span-5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-[#6E05F2] focus:outline-none"
              />
              <button
                type="submit"
                className="sm:col-span-2 inline-flex items-center justify-center gap-1 rounded-xl bg-[#6E05F2] px-3 py-2 text-xs font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </form>

            {/* Milestones List */}
            <div className="space-y-2.5">
              {(workspace.milestones || []).map((ms) => (
                <div
                  key={ms._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-[#F8F9FC] p-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {ms.status === 'done' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : ms.status === 'in_progress' ? (
                      <Clock className="h-5 w-5 text-[#2057E8] shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={`text-sm font-bold ${
                          ms.status === 'done' ? 'line-through text-slate-400' : 'text-[#171717]'
                        }`}
                      >
                        {ms.title}
                      </p>
                      {ms.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{ms.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Milestone status"
                      value={ms.status}
                      onChange={(e) => handleMilestoneStatus(ms._id, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Completed</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleDeleteMilestone(ms._id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Private Project Discussions & Updates */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
            <h2 className="text-lg font-bold text-[#171717]">Project Updates &amp; Standups</h2>

            <form onSubmit={handlePostUpdate} className="space-y-2.5">
              <input
                type="text"
                value={updateTitle}
                onChange={(e) => setUpdateTitle(e.target.value)}
                placeholder="Update headline (e.g. Sprint 1 API Deployed)"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-[#6E05F2] focus:outline-none"
              />
              <textarea
                rows={3}
                value={updateContent}
                onChange={(e) => setUpdateContent(e.target.value)}
                placeholder="Share progress, blockers, or architecture decisions with your collaborators..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-[#6E05F2] focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-[#6E05F2] px-4 py-2 text-xs font-semibold text-white"
                >
                  Post Update
                </button>
              </div>
            </form>

            <div className="space-y-3 pt-2">
              {(workspace.updates || []).map((upd) => (
                <div
                  key={upd._id}
                  className="rounded-2xl border border-slate-100 bg-[#F8F9FC] p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#171717]">
                      {upd.title || 'Team Update'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {upd.author?.name} • {new Date(upd.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {upd.content}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: TEAM MEMBERS & REAL-TIME WORKSPACE CHAT */}
        <div className="space-y-6">
          {/* Team Members & Roles */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-[#171717] flex items-center gap-2">
              <Users className="h-4 w-4 text-[#6E05F2]" /> Team Members ({workspace.members?.length || 1})
            </h2>

            <div className="space-y-3">
              {(workspace.members || []).map((member) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-[#F8F9FC] p-3"
                >
                  <Link
                    to={`/users/${member.user?.username}`}
                    className="flex items-center gap-2.5 min-w-0"
                  >
                    <Avatar user={member.user} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#171717] truncate">
                        {member.user?.name}
                      </p>
                      <p className="text-[11px] font-medium text-[#6E05F2] truncate">
                        {member.role}
                      </p>
                    </div>
                  </Link>
                  {isOwner && !member.isOwner && (
                    <button
                      type="button"
                      onClick={() => setRemoveMemberTarget(member)}
                      title="Remove member"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Live Team Group Chat */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col h-[26rem]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-[#171717] flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-[#2057E8]" /> Team Live Chat
              </h3>
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
                title={connected ? 'Real-time Socket.IO connected' : 'Connecting to live server...'}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    connected ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
                  }`}
                />
                {connected ? 'Live' : 'Connecting...'}
              </span>
            </div>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {teamMessages.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10">
                  Say hello to your collaborators!
                </p>
              ) : (
                teamMessages.map((msg) => {
                  const mine = String(msg.sender?._id || msg.sender) === String(user?._id);
                  return (
                    <div
                      key={msg._id}
                      className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] text-slate-400 mb-0.5">
                        {mine ? 'You' : msg.sender?.name}
                      </span>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${
                          msg.systemMessage
                            ? 'bg-slate-100 text-slate-500 italic'
                            : mine
                            ? 'bg-[#6E05F2] text-white'
                            : 'bg-[#F8F9FC] border border-slate-200 text-[#171717]'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendTeamMessage} className="pt-2 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Message team..."
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-[#6E05F2] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Send message"
                className="rounded-xl bg-[#2057E8] px-3 py-2 text-white hover:opacity-95"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(removeMemberTarget)}
        onClose={() => setRemoveMemberTarget(null)}
        onConfirm={confirmRemoveMember}
        title="Remove Collaborator?"
        description={`Remove ${removeMemberTarget?.user?.name} from this workspace and revoke private chat & protected document access?`}
        confirmLabel="Remove Member"
        danger
      />
    </div>
  );
}

