import {
  Bell,
  Bookmark,
  CheckCheck,
  FolderKanban,
  GitPullRequest,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../ui/CommonUI';

export function Navbar() {
  const {
    user,
    logout,
    unreadNotifications,
    setUnreadNotifications,
    unreadMessages,
  } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  async function openNotificationDropdown() {
    const next = !notifOpen;
    setNotifOpen(next);
    setUserMenuOpen(false);
    if (next && user) {
      setLoadingNotifs(true);
      try {
        const res = await api.get('/notifications?limit=6');
        setNotifications(res.data.data.notifications || []);
        setUnreadNotifications(res.data.data.unreadCount || 0);
      } catch {
        // Ignore transient dropdown error
      } finally {
        setLoadingNotifs(false);
      }
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifications(0);
    } catch {
      toast.error('Could not mark notifications as read');
    }
  }

  async function handleNotificationClick(item) {
    setNotifOpen(false);
    if (!item.isRead) {
      try {
        await api.patch(`/notifications/${item._id}/read`);
        setUnreadNotifications((c) => Math.max(0, c - 1));
      } catch {
        // Ignore
      }
    }
    navigate(item.link || '/notifications');
  }

  async function handleLogout() {
    setUserMenuOpen(false);
    setMobileOpen(false);
    await logout();
    toast.success('Signed out safely.');
    navigate('/');
  }

  const navLinkClass = ({ isActive }) =>
    `text-sm font-medium transition px-3 py-2 rounded-lg ${
      isActive
        ? 'text-[#6E05F2] bg-[#6E05F2]/8 font-semibold'
        : 'text-slate-600 hover:text-[#171717] hover:bg-slate-100/70'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient-bg text-white shadow-sm shadow-[#6E05F2]/25 group-hover:scale-105 transition">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-[#171717]">
              Idea<span className="text-[#6E05F2]">Spark</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          {!user ? (
            <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
              <NavLink to="/" end className={navLinkClass}>
                Home
              </NavLink>
              <NavLink to="/explore" className={navLinkClass}>
                Explore Ideas
              </NavLink>
              <a
                href="/#how-it-works"
                className="text-sm font-medium text-slate-600 hover:text-[#171717] hover:bg-slate-100/70 px-3 py-2 rounded-lg transition"
              >
                How It Works
              </a>
            </nav>
          ) : (
            <nav className="hidden lg:flex items-center gap-1" aria-label="Workspace navigation">
              <NavLink to="/dashboard" className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/explore" className={navLinkClass}>
                Explore Ideas
              </NavLink>
              <NavLink to="/requests" className={navLinkClass}>
                Requests
              </NavLink>
              <NavLink to="/workspaces" className={navLinkClass}>
                Workspaces
              </NavLink>
              <NavLink to="/my-ideas" className={navLinkClass}>
                My Ideas
              </NavLink>
              {user.role === 'admin' && (
                <NavLink to="/admin" className={navLinkClass}>
                  Admin
                </NavLink>
              )}
            </nav>
          )}
        </div>

        {/* Right Controls */}
        <div className="hidden md:flex items-center gap-2.5">
          {!user ? (
            <>
              <Link
                to="/login"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-xl brand-gradient-bg px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#6E05F2]/25 hover:opacity-95 transition"
              >
                Get Started
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/ideas/new"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6E05F2] px-3.5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#5b04c9] transition"
              >
                <Plus className="h-4 w-4" />
                Share Idea
              </Link>

              <Link
                to="/messages"
                aria-label="Messages"
                className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-[#171717] transition"
              >
                <MessageSquare className="h-5 w-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2057E8] px-1 text-[10px] font-bold text-white">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>

              {/* Notification Dropdown */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={openNotificationDropdown}
                  aria-label="Notifications"
                  className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-[#171717] transition"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#CD2BE2] px-1 text-[10px] font-bold text-white">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-88 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <span className="text-sm font-bold text-[#171717]">Notifications</span>
                      {unreadNotifications > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E05F2] hover:underline"
                        >
                          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {loadingNotifs ? (
                        <div className="p-6 text-center text-xs text-slate-400">Loading alerts...</div>
                      ) : notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          You are all caught up!
                        </div>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item._id}
                            type="button"
                            onClick={() => handleNotificationClick(item)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-start gap-3 ${
                              !item.isRead ? 'bg-[#6E05F2]/[0.03]' : ''
                            }`}
                          >
                            <span
                              className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                                !item.isRead ? 'bg-[#6E05F2]' : 'bg-transparent'
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#171717] truncate">{item.title}</p>
                              <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{item.body}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <Link
                      to="/notifications"
                      onClick={() => setNotifOpen(false)}
                      className="block border-t border-slate-100 bg-slate-50/70 py-2.5 text-center text-xs font-semibold text-[#2057E8] hover:bg-slate-100"
                    >
                      View all notifications
                    </Link>
                  </div>
                )}
              </div>

              {/* User Profile Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen((o) => !o);
                    setNotifOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-[#6E05F2]/30 transition"
                >
                  <Avatar user={user} size="sm" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                      <p className="text-sm font-bold text-[#171717] truncate">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                    </div>
                    <Link
                      to={`/users/${user.username}`}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <UserIcon className="h-4 w-4 text-slate-400" /> Public Profile
                    </Link>
                    <Link
                      to="/saved-ideas"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <Bookmark className="h-4 w-4 text-slate-400" /> Saved Ideas
                    </Link>
                    <Link
                      to="/settings/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <Settings className="h-4 w-4 text-slate-400" /> Edit Profile
                    </Link>
                    <Link
                      to="/settings/security"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <Shield className="h-4 w-4 text-slate-400" /> Security & Privacy
                    </Link>
                    <Link
                      to="/report"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <ShieldAlert className="h-4 w-4 text-slate-400" /> Report Issue
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          className="md:hidden rounded-xl p-2 text-slate-700 hover:bg-slate-100"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
          {!user ? (
            <>
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Home
              </Link>
              <Link
                to="/explore"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Explore Ideas
              </Link>
              <a
                href="/#how-it-works"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                How It Works
              </a>
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="w-full rounded-xl brand-gradient-bg py-2.5 text-center text-sm font-semibold text-white"
                >
                  Get Started
                </Link>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-3 px-2 py-2 border-b border-slate-100 mb-2">
                <Avatar user={user} size="sm" />
                <div>
                  <p className="text-sm font-bold text-[#171717]">{user.name}</p>
                  <p className="text-xs text-slate-500">@{user.username}</p>
                </div>
              </div>
              <Link
                to="/ideas/new"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#6E05F2] py-2.5 text-sm font-semibold text-white mb-2"
              >
                <Plus className="h-4 w-4" /> Share Your Idea
              </Link>
              {[
                { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { to: '/explore', label: 'Explore Ideas', icon: Search },
                { to: '/my-ideas', label: 'My Ideas', icon: Lightbulb },
                { to: '/saved-ideas', label: 'Saved Ideas', icon: Bookmark },
                { to: '/requests', label: 'Collaboration Requests', icon: GitPullRequest },
                { to: '/workspaces', label: 'Workspaces', icon: FolderKanban },
                { to: '/messages', label: `Messages${unreadMessages ? ` (${unreadMessages})` : ''}`, icon: MessageSquare },
                { to: '/notifications', label: `Notifications${unreadNotifications ? ` (${unreadNotifications})` : ''}`, icon: Bell },
                { to: `/users/${user.username}`, label: 'My Profile', icon: UserIcon },
                { to: '/settings/profile', label: 'Edit Profile', icon: Settings },
                { to: '/settings/security', label: 'Security & Privacy', icon: Shield },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <item.icon className="h-4 w-4 text-slate-400" />
                  {item.label}
                </Link>
              ))}
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#6E05F2] bg-[#6E05F2]/8"
                >
                  <Shield className="h-4 w-4" /> Admin Dashboard
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

