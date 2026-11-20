import { Camera } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { Avatar } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function EditProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: user?.name || '',
      username: user?.username || '',
      headline: user?.headline || '',
      bio: user?.bio || '',
      skillsText: (user?.skills || []).join(', '),
      interestsText: (user?.interests || []).join(', '),
      github: user?.socialLinks?.github || '',
      linkedin: user?.socialLinks?.linkedin || '',
      portfolio: user?.socialLinks?.portfolio || '',
      allowDirectMessagesFromPublic: user?.allowDirectMessagesFromPublic ?? true,
    },
  });

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.post('/users/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(res.data.data.user);
      toast.success('Profile photo updated!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  }

  async function onSubmit(values) {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        username: values.username,
        headline: values.headline,
        bio: values.bio,
        skills: values.skillsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        interests: values.interestsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        socialLinks: {
          github: values.github,
          linkedin: values.linkedin,
          portfolio: values.portfolio,
        },
        allowDirectMessagesFromPublic: Boolean(values.allowDirectMessagesFromPublic),
      };

      const res = await api.patch('/users/me', payload);
      setUser(res.data.data.user);
      toast.success('Profile saved!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717]">Edit Profile</h1>
          <p className="mt-1 text-sm text-slate-600">
            Showcase your skills, interests, and portfolio so collaborators can find you.
          </p>
        </div>
        <Link
          to={`/users/${user?.username}`}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
        >
          View Public Profile
        </Link>
      </div>

      {/* Avatar Upload Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 flex items-center gap-5 shadow-2xs">
        <Avatar user={user} size="xl" />
        <div>
          <label className="inline-flex items-center gap-2 rounded-xl bg-[#6E05F2] px-4 py-2 text-xs font-semibold text-white cursor-pointer hover:bg-[#5b04c9]">
            <Camera className="h-4 w-4" />
            {uploadingAvatar ? 'Uploading...' : 'Upload Profile Picture'}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">JPG, PNG, or WEBP up to 3MB.</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              {...register('name', { required: true })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
            <input
              type="text"
              {...register('username', { required: true })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Professional Headline
          </label>
          <input
            type="text"
            placeholder="e.g. Full-Stack Engineer & Startup Builder"
            {...register('headline')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Bio &amp; Professional Introduction
          </label>
          <textarea
            rows={4}
            placeholder="Tell founders and teammates what you love building..."
            {...register('bio')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Skills (comma-separated)
            </label>
            <input
              type="text"
              placeholder="React, Node.js, Python, Figma"
              {...register('skillsText')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Interests (comma-separated)
            </label>
            <input
              type="text"
              placeholder="AI, FinTech, Climate, Developer Tools"
              {...register('interestsText')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">GitHub URL</label>
            <input
              type="url"
              placeholder="https://github.com/..."
              {...register('github')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">LinkedIn URL</label>
            <input
              type="url"
              placeholder="https://linkedin.com/in/..."
              {...register('linkedin')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Portfolio URL</label>
            <input
              type="url"
              placeholder="https://yoursite.dev"
              {...register('portfolio')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>
        </div>

        <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
          <input
            type="checkbox"
            {...register('allowDirectMessagesFromPublic')}
            className="mt-1 h-4 w-4 rounded text-[#6E05F2]"
          />
          <span className="text-xs text-slate-600 leading-relaxed">
            Allow builders to message me directly about my public ideas. (When unchecked, only accepted collaborators and active collaboration applicants can message you.)
          </span>
        </label>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl brand-gradient-bg px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

