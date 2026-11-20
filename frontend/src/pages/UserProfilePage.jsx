import {
  Ban,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Flag,
  Github,
  Globe,
  Linkedin,
  MessageSquare,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { IdeaCard } from '../components/ideas/IdeaCard';
import { Avatar } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function UserProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/users/profile/${id}`)
      .then((res) => {
        setProfile(res.data.data.profile);
        setIdeas(res.data.data.ideas || []);
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, toast]);

  async function handleStartMessage() {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.post('/messages/conversations/direct', {
        recipientId: profile._id,
      });
      navigate(`/messages/${res.data.data.conversation._id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleToggleBlock() {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      if (profile.isBlockedByViewer) {
        await api.delete(`/users/${profile._id}/block`);
        setProfile((p) => ({ ...p, isBlockedByViewer: false }));
        toast.success('User unblocked.');
      } else {
        await api.post(`/users/${profile._id}/block`);
        setProfile((p) => ({ ...p, isBlockedByViewer: true }));
        toast.success('User blocked.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="h-64 rounded-3xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-base font-bold text-slate-700">Profile unavailable.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <Avatar user={profile} size="xl" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-[#171717]">{profile.name}</h1>
                {profile.emailVerified && (
                  <CheckCircle2 className="h-5 w-5 text-[#2057E8]" title="Verified Email" />
                )}
              </div>
              <p className="text-sm text-slate-500">@{profile.username}</p>
              {profile.headline && (
                <p className="mt-2 text-sm font-medium text-slate-700">{profile.headline}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span>
                  <strong>{profile.stats?.publicIdeasCount || 0}</strong> Public Ideas
                </span>
                <span>
                  <strong>{profile.stats?.collaborationsCount || 0}</strong> Team Collaborations
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profile.isSelf ? (
              <Link
                to="/settings/profile"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6E05F2] px-4 py-2 text-xs font-semibold text-white"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit Profile
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleStartMessage}
                  className="inline-flex items-center gap-1.5 rounded-xl brand-gradient-bg px-4 py-2 text-xs font-semibold text-white"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Message
                </button>
                <button
                  type="button"
                  onClick={handleToggleBlock}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Ban className="h-3.5 w-3.5" />
                  {profile.isBlockedByViewer ? 'Unblock' : 'Block'}
                </button>
                <Link
                  to={`/report?user=${encodeURIComponent(profile.username)}`}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Flag className="h-3.5 w-3.5" /> Report
                </Link>
              </>
            )}
          </div>
        </div>

        {profile.bio && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Professional Bio
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {profile.bio}
            </p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Skills
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(profile.skills || []).length === 0 ? (
                <span className="text-xs text-slate-400">No skills listed yet</span>
              ) : (
                profile.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-lg bg-[#6E05F2]/8 border border-[#6E05F2]/20 px-2.5 py-1 text-xs font-semibold text-[#6E05F2]"
                  >
                    {s}
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Interests &amp; Links
            </h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(profile.interests || []).map((interest) => (
                <span
                  key={interest}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {interest}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-semibold text-[#2057E8]">
              {profile.socialLinks?.github && (
                <a
                  href={profile.socialLinks.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <Github className="h-3.5 w-3.5" /> GitHub <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {profile.socialLinks?.linkedin && (
                <a
                  href={profile.socialLinks.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {profile.socialLinks?.portfolio && (
                <a
                  href={profile.socialLinks.portfolio}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" /> Portfolio <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User's Public Ideas */}
      <section className="space-y-4">
        <h2 className="text-xl font-extrabold text-[#171717]">
          Public Ideas Shared by {profile.name}
        </h2>
        {ideas.length === 0 ? (
          <p className="text-sm text-slate-500">No public ideas published yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ideas.map((idea) => (
              <IdeaCard key={idea._id} idea={idea} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

