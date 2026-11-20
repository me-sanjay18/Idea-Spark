import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { EmptyState } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function NotificationsPage() {
  const { setUnreadNotifications } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications?unreadOnly=${unreadOnly}&limit=30`);
      setNotifications(res.data.data.notifications || []);
      setUnreadNotifications(res.data.data.unreadCount || 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, setUnreadNotifications, toast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function handleMarkAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifications(0);
      toast.success('All notifications marked as read.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleOpen(item) {
    if (!item.isRead) {
      try {
        await api.patch(`/notifications/${item._id}/read`);
        setUnreadNotifications((c) => Math.max(0, c - 1));
      } catch {
        // Ignore
      }
    }
    navigate(item.link || '/dashboard');
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717]">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            Collaboration requests, team updates, messages, and account security alerts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold border ${
              unreadOnly
                ? 'border-[#6E05F2] bg-[#6E05F2]/10 text-[#6E05F2]'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            {unreadOnly ? 'Showing Unread' : 'Filter: Unread Only'}
          </button>

          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#6E05F2] px-4 py-2 text-xs font-semibold text-white"
          >
            <CheckCheck className="h-4 w-4" /> Mark All Read
          </button>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications to display"
            description="New collaboration requests, project updates, and security alerts will appear here in real time."
          />
        ) : (
          <div className="space-y-2.5">
            {notifications.map((item) => (
              <div
                key={item._id}
                onClick={() => handleOpen(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleOpen(item)}
                className={`flex items-start justify-between gap-4 rounded-2xl border p-4 cursor-pointer transition ${
                  !item.isRead
                    ? 'border-[#6E05F2]/30 bg-white shadow-2xs'
                    : 'border-slate-200/80 bg-white/75 hover:bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                      !item.isRead ? 'bg-[#6E05F2]' : 'bg-slate-200'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-bold text-[#171717]">{item.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.body}</p>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, item._id)}
                  aria-label="Delete notification"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

