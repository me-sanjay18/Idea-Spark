import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Cpu,
  FileCheck2,
  FolderKanban,
  Globe,
  GraduationCap,
  HeartPulse,
  Layers,
  Leaf,
  Lock,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { IdeaCard } from '../components/ideas/IdeaCard';
import { SkeletonCard } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ICON_MAP = {
  Cpu,
  Code2,
  Layers,
  Wallet,
  GraduationCap,
  HeartPulse,
  Leaf,
  ShieldCheck,
  Globe,
  Sparkles,
};

const SAMPLE_TESTIMONIALS = [
  {
    quote:
      'I had a healthcare intake prototype sitting in private repos for months. Within a week on IdeaSpark, I matched with a React accessibility lead under an NDA acknowledgement.',
    author: 'Sample Persona — Priya S.',
    role: 'ML Graduate Researcher (Illustrative Sample)',
  },
  {
    quote:
      'Instead of building another generic to-do app for my portfolio, I joined an early-stage climate analytics team here and shipped real production features.',
    author: 'Sample Persona — Daniel K.',
    role: 'Full-Stack Developer (Illustrative Sample)',
  },
  {
    quote:
      'Having unlisted links, edit history timestamps, and structured collaboration applications gave me confidence to share my SaaS concept safely.',
    author: 'Sample Persona — Hannah M.',
    role: 'First-Time Founder (Illustrative Sample)',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState({
    featuredIdeas: [],
    categories: [],
    stats: { publicIdeas: 0, activeBuilders: 0, activeCollaborations: 0, categoriesCount: 9 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get('/ideas/landing')
      .then((res) => {
        if (active && res.data?.data) {
          setData(res.data.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleVoteChange = useCallback((ideaId, updates) => {
    setData((prev) => ({
      ...prev,
      featuredIdeas: prev.featuredIdeas.map((item) =>
        String(item._id) === String(ideaId)
          ? {
              ...item,
              ...(typeof updates.upvoteCount === 'number' ? { upvoteCount: updates.upvoteCount } : {}),
              ...(typeof updates.isUpvoted === 'boolean' ? { isUpvoted: updates.isUpvoted } : {}),
            }
          : item
      ),
    }));
  }, []);

  async function handleToggleBookmark(ideaId) {
    if (!user) {
      toast.info('Sign in to bookmark ideas.');
      navigate('/login');
      return;
    }
    try {
      const res = await api.post(`/bookmarks/${ideaId}`);
      const { isBookmarked, bookmarkCount } = res.data.data;
      setData((prev) => ({
        ...prev,
        featuredIdeas: prev.featuredIdeas.map((item) =>
          item._id === ideaId ? { ...item, isBookmarked, bookmarkCount } : item
        ),
      }));
      toast.success(isBookmarked ? 'Idea bookmarked!' : 'Removed from saved ideas.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div>
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-32 -z-10 flex justify-center overflow-hidden blur-3xl"
        >
          <div className="h-80 w-[48rem] rounded-full bg-gradient-to-r from-[#6E05F2]/15 via-[#2057E8]/15 to-[#CD2BE2]/15" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#6E05F2]/20 bg-white px-4 py-1.5 text-xs font-semibold text-[#6E05F2] shadow-2xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Don&apos;t Just Have an Idea. Build It Together.</span>
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold tracking-tight text-[#171717] sm:text-6xl leading-[1.12]">
            Every Great Project Starts With an{' '}
            <span className="brand-gradient-text">Idea.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed">
            Share your ideas, discover innovative projects, and find the right people to turn your vision into reality.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              to="/explore"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl brand-gradient-bg px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#6E05F2]/25 hover:opacity-95 transition"
            >
              Explore Ideas
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={user ? '/ideas/new' : '/signup'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-sm font-semibold text-[#171717] shadow-2xs hover:border-[#6E05F2]/40 hover:text-[#6E05F2] transition"
            >
              Share Your Idea
            </Link>
          </div>

          {/* Community Statistics Strip */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Published Ideas', value: `${data.stats.publicIdeas}+` },
              { label: 'Active Builders', value: `${data.stats.activeBuilders}+` },
              { label: 'Team Workspaces', value: `${data.stats.activeCollaborations}+` },
              { label: 'Innovation Tracks', value: data.stats.categoriesCount || 9 },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-5 shadow-2xs"
              >
                <p className="text-2xl sm:text-3xl font-extrabold text-[#171717]">{stat.value}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IDEASPARE WORKS */}
      <section id="how-it-works" className="py-16 bg-white border-y border-slate-200/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6E05F2]">
              How IdeaSpark Works
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-[#171717]">
              From Spark to Shipping Team in Three Steps
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Designed so creators stay in full control of access while skilled builders find meaningful problems to solve.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                step: '01',
                icon: Lock,
                title: 'Publish With Granular Privacy',
                desc: 'Choose Public, Unlisted link, or Private stealth mode. Gate deep technical architecture behind a recorded Confidentiality / NDA acknowledgement.',
              },
              {
                step: '02',
                icon: Users,
                title: 'Vet & Accept Collaborators',
                desc: 'Developers, designers, and co-founders apply with their skills, experience, and contribution plan. You approve every person who joins.',
              },
              {
                step: '03',
                icon: FolderKanban,
                title: 'Execute in Dedicated Workspaces',
                desc: 'Accepted requests unlock a private project workspace with real-time Socket.IO team chat, role assignments, milestones, and progress updates.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative rounded-2xl border border-slate-200/80 bg-[#F8F9FC] p-7"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6E05F2]/10 text-[#6E05F2]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-300 text-2xl">{item.step}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-[#171717]">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED IDEAS */}
      <section className="py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#2057E8]">
                Featured Projects
              </span>
              <h2 className="mt-1.5 text-3xl font-extrabold text-[#171717]">
                Ideas Actively Recruiting Builders
              </h2>
            </div>
            <Link
              to="/explore"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6E05F2] hover:underline"
            >
              Browse all ideas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {loading
              ? [1, 2, 3].map((n) => <SkeletonCard key={n} />)
              : data.featuredIdeas.slice(0, 6).map((idea) => (
                  <IdeaCard
                    key={idea._id}
                    idea={idea}
                    onVoteChange={handleVoteChange}
                    onToggleBookmark={handleToggleBookmark}
                  />
                ))}
          </div>
        </div>
      </section>

      {/* POPULAR CATEGORIES */}
      <section className="py-16 bg-white border-y border-slate-200/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[#CD2BE2]">
              Domains &amp; Tracks
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-[#171717]">Popular Categories</h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.categories.slice(0, 9).map((cat) => {
              const IconComp = ICON_MAP[cat.icon] || Sparkles;
              return (
                <Link
                  key={cat._id || cat.slug}
                  to={`/explore?category=${encodeURIComponent(cat.name)}`}
                  className="group flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-[#F8F9FC] p-5 hover:border-[#6E05F2]/35 hover:bg-white transition"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-[#6E05F2] group-hover:bg-[#6E05F2] group-hover:text-white transition shrink-0">
                    <IconComp className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#171717] group-hover:text-[#6E05F2] truncate">
                        {cat.name}
                      </h3>
                      <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {cat.ideaCount || 0}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{cat.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* WHY COLLABORATE + IDEA PROTECTION & PRIVACY */}
      <section className="py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-2xs">
            <div className="inline-flex items-center gap-2 rounded-lg bg-[#2057E8]/10 px-3 py-1 text-xs font-bold text-[#2057E8]">
              <Rocket className="h-3.5 w-3.5" /> Why Collaborate on IdeaSpark?
            </div>
            <h3 className="mt-4 text-2xl font-extrabold text-[#171717]">
              Stop Building Alone. Match Complementary Skills.
            </h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Great concepts stall when technical founders lack product design or domain experts lack engineering partners. IdeaSpark bridges the gap with structured execution workspaces.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              {[
                'Structured skill, stage, and duration matching so expectations align upfront.',
                'Dedicated workspaces with milestone boards, progress logs, and role clarity.',
                'Permissioned real-time 1:1 and group messaging—no cold spam to private members.',
                'Portfolio-worthy collaborations for students, developers, designers, and founders.',
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#2057E8] shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-[#6E05F2]/25 bg-slate-950 text-white p-8 sm:p-10 shadow-lg">
            <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1 text-xs font-bold text-purple-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Idea Protection &amp; Privacy Architecture
            </div>
            <h3 className="mt-4 text-2xl font-extrabold">
              Built From Day One Around Creator Control &amp; Traceability
            </h3>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              Share teaser summaries publicly while keeping confidential specifications locked behind creator approval and versioned agreements.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <FileCheck2 className="h-4 w-4 text-purple-400 mb-2" />
                <p className="font-bold text-white">Ownership &amp; Edit Audit Trail</p>
                <p className="mt-1 text-slate-400">
                  Unique Idea IDs, original creation timestamps, edit changelogs, and visibility logs.
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <Lock className="h-4 w-4 text-blue-400 mb-2" />
                <p className="font-bold text-white">Confidentiality &amp; Custom NDAs</p>
                <p className="mt-1 text-slate-400">
                  Require NDA acknowledgement or upload your own NDA PDF before revealing protected details.
                </p>
              </div>
            </div>
            <p className="mt-6 text-[11px] text-slate-400 border-t border-white/10 pt-4 leading-relaxed">
              Transparency note: While IdeaSpark enforces backend access controls, audit logs, and reporting safeguards to reduce risk, an in-app checkbox or timestamp alone does not create legally enforceable IP protection; formal legal protection depends on applicable law and properly drafted agreements.
            </p>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS (CLEARLY LABELED SAMPLE CONTENT) */}
      <section className="py-16 bg-white border-t border-slate-200/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-block rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-semibold text-amber-800">
              Sample Community Scenarios (Illustrative Preview Content)
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-[#171717]">
              How Builders Use IdeaSpark
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {SAMPLE_TESTIMONIALS.map((t) => (
              <div
                key={t.author}
                className="rounded-2xl border border-slate-200/80 bg-[#F8F9FC] p-6 flex flex-col justify-between"
              >
                <p className="text-sm text-slate-700 italic leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-5 pt-4 border-t border-slate-200/70">
                  <p className="text-xs font-bold text-[#171717]">{t.author}</p>
                  <p className="text-[11px] text-slate-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl brand-gradient-bg px-6 py-12 sm:px-12 sm:py-16 text-center text-white shadow-xl shadow-[#6E05F2]/20">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ready to Turn Your Next Idea Into a Real Project?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-white/85">
              Join innovators, developers, designers, and students building startups and open collaborations safely on IdeaSpark.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to={user ? '/ideas/new' : '/signup'}
                className="w-full sm:w-auto rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-[#6E05F2] shadow-sm hover:bg-slate-50 transition"
              >
                {user ? 'Publish Your Idea' : 'Create Free Account'}
              </Link>
              <Link
                to="/explore"
                className="w-full sm:w-auto rounded-xl border border-white/35 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition"
              >
                Explore Open Ideas
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

