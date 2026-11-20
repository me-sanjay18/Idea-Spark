import { CheckCircle2, FileCheck2, Github, KeyRound, ShieldAlert, Trash2, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { api, getErrorMessage, setCsrfToken } from '../api/client';
import { GoogleIcon, Modal } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function SecuritySettingsPage() {
  const { setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [security, setSecurity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingPwd, setUpdatingPwd] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);

  const pwdForm = useForm({
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const loadSecurity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/me/security');
      setSecurity(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSecurity();
  }, [loadSecurity]);

  async function handleChangePassword(values) {
    setUpdatingPwd(true);
    try {
      const res = await api.post('/auth/change-password', values);
      if (res.data?.data?.csrfToken) setCsrfToken(res.data.data.csrfToken);
      pwdForm.reset();
      toast.success(res.data.message);
      loadSecurity();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingPwd(false);
    }
  }

  async function handleUnblock(userId) {
    try {
      await api.delete(`/users/${userId}/block`);
      toast.success('User unblocked.');
      loadSecurity();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    setDeleting(true);
    try {
      await api.delete('/users/me', {
        data: { password: deletePassword, confirmPhrase: deletePhrase },
      });
      setUser(null);
      toast.success('Your account has been permanently deleted.');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="h-72 rounded-3xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-[#171717]">Security &amp; Privacy Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your password, connected OAuth accounts, accepted NDA agreements, blocked users, and account security history.
        </p>
      </div>

      {/* Connected Sign-In Providers */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
        <h2 className="text-lg font-bold text-[#171717]">Connected Social Sign-In</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-[#F8F9FC] px-4 py-3">
            <span className="inline-flex items-center gap-2 font-semibold text-[#171717]">
              <GoogleIcon className="h-4 w-4" /> Google Account
            </span>
            {security?.googleConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </span>
            ) : (
              <span className="text-slate-400 font-medium">Not linked</span>
            )}
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-[#F8F9FC] px-4 py-3">
            <span className="inline-flex items-center gap-2 font-semibold text-[#171717]">
              <Github className="h-4 w-4" /> GitHub Account
            </span>
            {security?.githubConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </span>
            ) : (
              <span className="text-slate-400 font-medium">Not linked</span>
            )}
          </div>
        </div>
      </section>

      {/* Password Update */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-[#6E05F2]" />
          <h2 className="text-lg font-bold text-[#171717]">Update Password</h2>
        </div>

        <form
          onSubmit={pwdForm.handleSubmit(handleChangePassword)}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              {...pwdForm.register('currentPassword', { required: security?.hasPassword })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password (min 8 chars, mixed case + number)
            </label>
            <input
              type="password"
              {...pwdForm.register('newPassword', { required: true, minLength: 8 })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={updatingPwd}
              className="rounded-xl bg-[#6E05F2] px-5 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {updatingPwd ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      {/* Signed Confidentiality & NDA Records */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-[#2057E8]" />
          <h2 className="text-lg font-bold text-[#171717]">
            Accepted Confidentiality &amp; NDA Records
          </h2>
        </div>

        {!security?.signedAgreements?.length ? (
          <p className="text-xs text-slate-500">
            You have not signed any confidentiality acknowledgements yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {security.signedAgreements.map((ag) => (
              <div key={ag._id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <Link
                    to={`/ideas/${ag.idea?._id}`}
                    className="font-bold text-[#171717] hover:text-[#6E05F2]"
                  >
                    {ag.idea?.title || 'Protected Idea'} ({ag.idea?.ideaCode})
                  </Link>
                  <p className="text-slate-500 mt-0.5">
                    Signed as {ag.signerFullName} • Version v{ag.agreementVersion}
                  </p>
                </div>
                <span className="text-slate-400">
                  {new Date(ag.acceptedAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Blocked Users */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <UserX className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-bold text-[#171717]">Blocked Accounts</h2>
        </div>

        {!security?.blockedUsers?.length ? (
          <p className="text-xs text-slate-500">You have not blocked any users.</p>
        ) : (
          <div className="space-y-2">
            {security.blockedUsers.map((bUser) => (
              <div
                key={bUser._id}
                className="flex items-center justify-between rounded-xl bg-[#F8F9FC] px-4 py-2.5 text-xs"
              >
                <span className="font-semibold text-[#171717]">
                  {bUser.name} (@{bUser.username})
                </span>
                <button
                  type="button"
                  onClick={() => handleUnblock(bUser._id)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Security Events */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-[#CD2BE2]" />
          <h2 className="text-lg font-bold text-[#171717]">Recent Account Security Activity</h2>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto">
          {(security?.securityEvents || []).map((ev) => (
            <div
              key={ev._id}
              className="flex items-center justify-between rounded-xl bg-[#F8F9FC] px-4 py-2.5 text-xs"
            >
              <span className="font-medium text-slate-700">{ev.event}</span>
              <span className="text-slate-400">
                {new Date(ev.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Danger Zone: Account Deletion */}
      <section className="rounded-3xl border border-rose-200 bg-rose-50/50 p-6 sm:p-8 space-y-3">
        <h2 className="text-lg font-bold text-rose-800">Danger Zone — Delete Account</h2>
        <p className="text-xs text-rose-700 leading-relaxed">
          Permanently remove your IdeaSpark account, withdraw pending requests, and remove your published ideas from public feeds.
        </p>
        <button
          type="button"
          onClick={() => setDeleteModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
        >
          <Trash2 className="h-3.5 w-3.5" /> Permanently Delete Account
        </button>
      </section>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Permanent Account Deletion"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleDeleteAccount} className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            This action cannot be undone. Enter your current password to permanently delete your account.
          </p>
          {security?.hasPassword ? (
            <input
              type="password"
              required
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Current password"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          ) : (
            <input
              type="text"
              required
              value={deletePhrase}
              onChange={(e) => setDeletePhrase(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deleting}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
            >
              {deleting ? 'Deleting...' : 'Delete My Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

