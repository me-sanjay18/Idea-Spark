import {
  Activity,
  AlertTriangle,
  FolderKanban,
  Layers,
  Plus,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function AdminDashboardPage() {
  const toast = useToast();
  const [tab, setTab] = useState('overview');

  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [logs, setLogs] = useState([]);

  const [userSearch, setUserSearch] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState({});

  const loadAdminData = useCallback(async () => {
    try {
      const [ovRes, repRes, usrRes, catRes, logRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/reports'),
        api.get(`/admin/users${userSearch ? `?q=${encodeURIComponent(userSearch)}` : ''}`),
        api.get('/admin/categories'),
        api.get('/admin/logs'),
      ]);
      setOverview(ovRes.data.data);
      setReports(repRes.data.data.reports || []);
      setUsers(usrRes.data.data.users || []);
      setCategories(catRes.data.data.categories || []);
      setLogs(logRes.data.data.logs || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [userSearch, toast]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  async function handleReviewReport(reportId, status, actionTaken) {
    try {
      await api.patch(`/admin/reports/${reportId}`, {
        status,
        actionTaken,
        resolutionNote: resolutionNotes[reportId] || '',
      });
      toast.success('Moderation action applied.');
      loadAdminData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleUserStatus(userId, status) {
    try {
      await api.patch(`/admin/users/${userId}/status`, {
        status,
        reason: status === 'active' ? '' : 'Moderator enforcement',
      });
      toast.success(`User status updated to ${status}.`);
      loadAdminData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post('/admin/categories', {
        name: newCatName.trim(),
        description: newCatDesc.trim(),
      });
      setNewCatName('');
      setNewCatDesc('');
      toast.success('Category added.');
      loadAdminData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleDeleteCategory(catId) {
    try {
      await api.delete(`/admin/categories/${catId}`);
      toast.success('Category removed.');
      loadAdminData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const stats = overview?.stats || {};

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#6E05F2]/10 px-3 py-1 text-xs font-bold text-[#6E05F2]">
            <Shield className="h-3.5 w-3.5" /> Administrator Governance Console
          </span>
          <h1 className="mt-2 text-3xl font-extrabold text-[#171717]">Admin Dashboard</h1>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5">
          {[
            { id: 'overview', label: 'Platform Stats' },
            { id: 'reports', label: `Reports (${stats.openReports || 0})` },
            { id: 'users', label: 'Users' },
            { id: 'categories', label: 'Categories & Logs' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                tab === t.id ? 'bg-[#6E05F2] text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Registered Users', val: stats.totalUsers || 0, icon: Users },
              { label: 'Total Ideas (Public/Private)', val: `${stats.totalIdeas || 0} (${stats.publicIdeas || 0}/${stats.privateIdeas || 0})`, icon: Layers },
              { label: 'Active Workspaces', val: stats.activeCollaborations || 0, icon: FolderKanban },
              { label: 'Open Moderation Reports', val: stats.openReports || 0, icon: AlertTriangle },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5">
                <item.icon className="h-5 w-5 text-[#6E05F2]" />
                <p className="mt-3 text-2xl font-extrabold text-[#171717]">{item.val}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs">
            <h2 className="text-base font-bold text-[#171717] flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-[#2057E8]" /> Recent Platform Audit Activity
            </h2>
            <div className="divide-y divide-slate-100">
              {(overview?.recentAuditLogs || []).map((log) => (
                <div key={log._id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-mono font-bold text-[#6E05F2] mr-2">{log.action}</span>
                    <span className="text-slate-700">{log.summary}</span>
                  </div>
                  <span className="text-slate-400">
                    {log.actor?.username ? `@${log.actor.username} • ` : ''}
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: REPORTED IDEAS & USERS */}
      {tab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Moderation queue is clear.
            </div>
          ) : (
            reports.map((rep) => (
              <div
                key={rep._id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 uppercase">
                      {rep.targetType} • {rep.reason.replace(/_/g, ' ')}
                    </span>
                    <p className="mt-2 text-sm font-bold text-[#171717]">
                      {rep.targetIdea ? (
                        <Link to={`/ideas/${rep.targetIdea._id}`} className="hover:underline">
                          Idea: {rep.targetIdea.title} ({rep.targetIdea.ideaCode})
                        </Link>
                      ) : (
                        `User: @${rep.targetUser?.username || 'unknown'}`
                      )}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">
                    {rep.status}
                  </span>
                </div>

                <p className="text-xs text-slate-700 bg-[#F8F9FC] p-3.5 rounded-xl">
                  {rep.description}
                </p>

                {rep.status === 'open' || rep.status === 'under_review' ? (
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                    <input
                      type="text"
                      value={resolutionNotes[rep._id] || ''}
                      onChange={(e) =>
                        setResolutionNotes((p) => ({ ...p, [rep._id]: e.target.value }))
                      }
                      placeholder="Moderation note..."
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleReviewReport(rep._id, 'resolved', 'idea_removed')}
                      className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      Remove Idea
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewReport(rep._id, 'resolved', 'user_suspended')}
                      className="rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      Suspend User
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewReport(rep._id, 'dismissed', 'none')}
                      className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Action taken: <strong>{rep.actionTaken}</strong>{' '}
                    {rep.resolutionNote ? `— "${rep.resolutionNote}"` : ''}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: REGISTERED USERS */}
      {tab === 'users' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[#171717]">Registered Accounts</h2>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search name, username, or email..."
              className="w-64 rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
            />
          </div>

          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u._id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#171717]">
                    {u.name} <span className="text-xs font-normal text-slate-500">@{u.username}</span>
                    {u.role === 'admin' && (
                      <span className="ml-2 rounded bg-[#6E05F2]/10 px-2 py-0.5 text-[10px] font-bold text-[#6E05F2]">
                        ADMIN
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                      u.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {u.status}
                  </span>

                  {u.role !== 'admin' && (
                    <>
                      {u.status !== 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleUserStatus(u._id, 'active')}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Activate
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUserStatus(u._id, 'suspended')}
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900"
                          >
                            Suspend
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUserStatus(u._id, 'banned')}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                          >
                            Ban
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CATEGORIES & MODERATION HISTORY */}
      {tab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-lg font-bold text-[#171717]">Manage Categories</h2>

            <form onSubmit={handleAddCategory} className="space-y-2.5">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category name (e.g. Robotics & IoT)"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Short description..."
                  className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-xl bg-[#6E05F2] px-4 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </form>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat._id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-[#171717]">{cat.name}</p>
                    <p className="text-slate-500">{cat.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat._id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-lg font-bold text-[#171717]">Moderation &amp; Audit History</h2>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div key={log._id} className="py-2.5 text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span className="font-mono font-bold text-[#2057E8]">{log.action}</span>
                    <span className="text-slate-400">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-600">{log.summary}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

