import { Check, GitPullRequest, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { Avatar, ConfirmDialog, EmptyState } from '../components/ui/CommonUI';
import { useToast } from '../context/ToastContext';

export default function CollaborationRequestsPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ownerNotes, setOwnerNotes] = useState({});
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [processingId, setProcessingId] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/collaborations/requests');
      setReceived(res.data.data.received || []);
      setSent(res.data.data.sent || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function handleRespond(requestId, decision) {
    setProcessingId(requestId);
    try {
      const res = await api.patch(`/collaborations/requests/${requestId}/respond`, {
        decision,
        ownerNote: ownerNotes[requestId] || '',
      });
      toast.success(res.data.message);
      if (decision === 'accept' && res.data.data.collaborationId) {
        navigate(`/workspaces/${res.data.data.collaborationId}`);
        return;
      }
      loadRequests();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessingId('');
    }
  }

  async function handleWithdraw() {
    if (!withdrawTarget) return;
    setProcessingId(withdrawTarget._id);
    try {
      await api.patch(`/collaborations/requests/${withdrawTarget._id}/withdraw`);
      toast.success('Collaboration request withdrawn.');
      setWithdrawTarget(null);
      loadRequests();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessingId('');
    }
  }

  const activeList = tab === 'received' ? received : sent;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-extrabold text-[#171717]">Collaboration Requests</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review incoming builder applications or manage the collaboration requests you have submitted.
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-6 inline-flex rounded-2xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setTab('received')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            tab === 'received' ? 'bg-[#6E05F2] text-white' : 'text-slate-600 hover:text-[#171717]'
          }`}
        >
          Received ({received.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('sent')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            tab === 'sent' ? 'bg-[#6E05F2] text-white' : 'text-slate-600 hover:text-[#171717]'
          }`}
        >
          Sent ({sent.length})
        </button>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-44 rounded-3xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : activeList.length === 0 ? (
          <EmptyState
            icon={GitPullRequest}
            title={
              tab === 'received'
                ? 'No collaboration requests received yet'
                : 'You have not sent any collaboration requests'
            }
            description={
              tab === 'received'
                ? 'Share your idea to start receiving applications from developers, designers, and co-founders.'
                : 'Explore public ideas and apply with your skills to join a team workspace.'
            }
          />
        ) : (
          <div className="space-y-5">
            {activeList.map((reqItem) => (
              <div
                key={reqItem._id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      user={tab === 'received' ? reqItem.applicant : reqItem.owner}
                      size="md"
                    />
                    <div>
                      {tab === 'received' ? (
                        <Link
                          to={`/users/${reqItem.applicant?.username}`}
                          className="text-base font-bold text-[#171717] hover:text-[#6E05F2]"
                        >
                          {reqItem.applicant?.name}{' '}
                          <span className="text-xs font-normal text-slate-400">
                            @{reqItem.applicant?.username}
                          </span>
                        </Link>
                      ) : (
                        <Link
                          to={`/ideas/${reqItem.idea?._id}`}
                          className="text-base font-bold text-[#171717] hover:text-[#6E05F2]"
                        >
                          {reqItem.idea?.title}
                        </Link>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        Role: <strong className="text-slate-700">{reqItem.desiredRole}</strong> • Idea:{' '}
                        <Link
                          to={`/ideas/${reqItem.idea?._id}`}
                          className="text-[#2057E8] hover:underline"
                        >
                          {reqItem.idea?.title}
                        </Link>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {reqItem.ndaAccepted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#6E05F2]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#6E05F2]">
                        <ShieldCheck className="h-3.5 w-3.5" /> NDA Signed
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                        reqItem.status === 'accepted'
                          ? 'bg-emerald-50 text-emerald-700'
                          : reqItem.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700'
                          : reqItem.status === 'withdrawn'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {reqItem.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-2xl bg-[#F8F9FC] p-4 text-xs">
                  <div>
                    <p className="font-bold text-slate-700 mb-1">Personal Message</p>
                    <p className="text-slate-600 leading-relaxed">{reqItem.message}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 mb-1">Relevant Experience</p>
                    <p className="text-slate-600 leading-relaxed">{reqItem.experience}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 mb-1">Contribution Plan</p>
                    <p className="text-slate-600 leading-relaxed">{reqItem.contributionPlan}</p>
                  </div>
                </div>

                {reqItem.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {reqItem.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {tab === 'received' && reqItem.status === 'pending' && (
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      type="text"
                      value={ownerNotes[reqItem._id] || ''}
                      onChange={(e) =>
                        setOwnerNotes((prev) => ({ ...prev, [reqItem._id]: e.target.value }))
                      }
                      placeholder="Optional welcome or feedback note..."
                      className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={processingId === reqItem._id}
                        onClick={() => handleRespond(reqItem._id, 'accept')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" /> Accept &amp; Create Workspace
                      </button>
                      <button
                        type="button"
                        disabled={processingId === reqItem._id}
                        onClick={() => handleRespond(reqItem._id, 'reject')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        <X className="h-3.5 w-3.5" /> Decline
                      </button>
                    </div>
                  </div>
                )}

                {tab === 'sent' && reqItem.status === 'pending' && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setWithdrawTarget(reqItem)}
                      className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Withdraw Request
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(withdrawTarget)}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={handleWithdraw}
        title="Withdraw Collaboration Request?"
        description="Your pending application will be withdrawn and removed from the creator's queue."
        confirmLabel="Withdraw Request"
        danger
        loading={Boolean(processingId)}
      />
    </div>
  );
}

