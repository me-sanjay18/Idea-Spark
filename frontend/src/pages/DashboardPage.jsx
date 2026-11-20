import {
  ArrowRight,
  Bell,
  Bookmark,
  FolderKanban,
  GitPullRequest,
  Lightbulb,
  MailWarning,
  Plus,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { Avatar, StageBadge, VisibilityBadge } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/users/dashboard')
      .then((res) => setOverview(res.data.data))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-3xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const stats = overview?.stats || {};

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Unverified email reminder */}
      {user && !user.emailVerified && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <MailWarning className="h-5 w-5 text-amber-700 shrink-0" />
            <p className="text-xs sm:text-sm text-amber-900">
              Please verify your email address (<strong>{user.email}</strong>) to build full trust with collaborators.
            </p>
          </div>
          <Link
            to="/verify-email"
            className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-semibold text-white text-center shrink-0"
          >
            Verify Email
          </Link>
        </div>
      )}

      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171717]">
            Welcome back, {user?.name?.split(' ')[0] || 'Builder'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your ideas, review incoming collaboration requests, and track active workspaces.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/explore"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Explore Ideas
          </Link>
          <Link
            to="/ideas/new"
            className="inline-flex items-center gap-1.5 rounded-xl brand-gradient-bg px-4 py-2.5 text-sm font-semibold text-white shadow-xs"
          >
            <Plus className="h-4 w-4" /> Publish Idea
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Ideas Published',
            value: stats.ideasPublished || 0,
            icon: Lightbulb,
            color: 'text-[#6E05F2] bg-[#6E05F2]/10',
            to: '/my-ideas',
          },
          {
            label: 'Saved Ideas',
            value: stats.bookmarkedCount || 0,
            icon: Bookmark,
            color: 'text-[#2057E8] bg-[#2057E8]/10',
            to: '/saved-ideas',
          },
          {
            label: 'Pending Requests',
            value: stats.pendingReceivedCount || 0,
            icon: GitPullRequest,
            color: 'text-[#CD2BE2] bg-[#CD2BE2]/10',
            to: '/requests',
          },
          {
            label: 'Active Workspaces',
            value: stats.activeProjectsCount || 0,
            icon: FolderKanban,
            color: 'text-emerald-700 bg-emerald-50',
            to: '/workspaces',
          },
        ].map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-[#6E05F2]/35 transition"
          >
            <div className="flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300" />
            </div>
            <p className="mt-4 text-2xl font-extrabold text-[#171717]">{card.value}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Active Projects / Team Collaborations */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#171717] flex items-center gap-2">
                <Users className="h-4 w-4 text-[#6E05F2]" /> Active Projects &amp; Team Collaborations
              </h2>
              <Link to="/workspaces" className="text-xs font-semibold text-[#6E05F2] hover:underline">
                All Workspaces
              </Link>
            </div>

            {!overview?.activeCollaborations?.length ? (
              <p className="text-sm text-slate-500 py-4">
                No active workspaces yet. Accept a collaboration request or apply to join an idea!
              </p>
            ) : (
              <div className="space-y-3">
                {overview.activeCollaborations.map((collab) => (
                  <Link
                    key={collab._id}
                    to={`/workspaces/${collab._id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-[#F8F9FC] p-4 hover:border-[#6E05F2]/40 transition"
                  >
                    <div>
                      <p className="text-sm font-bold text-[#171717]">
                        {collab.idea?.title || 'Project Workspace'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {collab.members?.length || 1} team members • Lead: {collab.owner?.name}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#6E05F2]">
                      Open Workspace <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Ideas I've Published */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#171717]">Ideas I&apos;ve Published</h2>
              <Link to="/my-ideas" className="text-xs font-semibold text-[#6E05F2] hover:underline">
                Manage My Ideas
              </Link>
            </div>

            {!overview?.myIdeas?.length ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500">You haven&apos;t published an idea yet.</p>
                <Link
                  to="/ideas/new"
                  className="mt-3 inline-flex rounded-xl bg-[#6E05F2] px-4 py-2 text-xs font-semibold text-white"
                >
                  Share Your First Idea
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {overview.myIdeas.map((idea) => (
                  <div
                    key={idea._id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/ideas/${idea._id}`}
                        className="text-sm font-bold text-[#171717] hover:text-[#6E05F2]"
                      >
                        {idea.title}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <VisibilityBadge visibility={idea.visibility} />
                        <StageBadge stage={idea.projectStage} />
                        <span className="text-xs text-slate-400 font-mono">{idea.ideaCode}</span>
                      </div>
                    </div>
                    <Link
                      to={`/ideas/${idea._id}/edit`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Collaboration Requests Received & Sent */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#171717]">Requests Received</h3>
                <Link to="/requests" className="text-xs font-semibold text-[#2057E8] hover:underline">
                  Review
                </Link>
              </div>
              {!overview?.receivedRequests?.length ? (
                <p className="text-xs text-slate-500 py-3">No pending incoming requests.</p>
              ) : (
                <div className="space-y-2.5">
                  {overview.receivedRequests.slice(0, 4).map((reqItem) => (
                    <Link
                      key={reqItem._id}
                      to="/requests"
                      className="flex items-center gap-2.5 rounded-xl bg-[#F8F9FC] p-3 hover:bg-slate-100"
                    >
                      <Avatar user={reqItem.applicant} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#171717] truncate">
                          {reqItem.applicant?.name} • {reqItem.desiredRole}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{reqItem.idea?.title}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#171717]">Requests Sent</h3>
                <Link to="/requests" className="text-xs font-semibold text-[#2057E8] hover:underline">
                  Track
                </Link>
              </div>
              {!overview?.sentRequests?.length ? (
                <p className="text-xs text-slate-500 py-3">No collaboration applications sent yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {overview.sentRequests.slice(0, 4).map((reqItem) => (
                    <Link
                      key={reqItem._id}
                      to="/requests"
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#F8F9FC] p-3 hover:bg-slate-100"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#171717] truncate">
                          {reqItem.idea?.title}
                        </p>
                        <p className="text-[11px] text-slate-500">{reqItem.desiredRole}</p>
                      </div>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                        {reqItem.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Right Sidebar: Bookmarked Ideas & Recent Notifications */}
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#171717] flex items-center gap-1.5">
                <Bookmark className="h-4 w-4 text-[#2057E8]" /> Saved Ideas
              </h2>
              <Link to="/saved-ideas" className="text-xs font-semibold text-[#2057E8] hover:underline">
                View All
              </Link>
            </div>
            {!overview?.bookmarkedIdeas?.length ? (
              <p className="text-xs text-slate-500">Bookmark interesting ideas while exploring.</p>
            ) : (
              <div className="space-y-3">
                {overview.bookmarkedIdeas.map((idea) => (
                  <Link
                    key={idea._id}
                    to={`/ideas/${idea._id}`}
                    className="block rounded-xl border border-slate-100 bg-[#F8F9FC] p-3 hover:border-[#2057E8]/30"
                  >
                    <p className="text-xs font-bold text-[#171717] line-clamp-1">{idea.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{idea.category}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#171717] flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-[#CD2BE2]" /> Recent Notifications
              </h2>
              <Link to="/notifications" className="text-xs font-semibold text-[#6E05F2] hover:underline">
                All
              </Link>
            </div>
            {!overview?.recentNotifications?.length ? (
              <p className="text-xs text-slate-500">No recent notifications.</p>
            ) : (
              <div className="space-y-3">
                {overview.recentNotifications.slice(0, 5).map((notif) => (
                  <Link
                    key={notif._id}
                    to={notif.link || '/notifications'}
                    className="block rounded-xl bg-[#F8F9FC] p-3 hover:bg-slate-100"
                  >
                    <p className="text-xs font-semibold text-[#171717]">{notif.title}</p>
                    <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{notif.body}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

