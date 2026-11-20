import { Compass, Filter, RotateCcw, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { IdeaCard } from '../components/ideas/IdeaCard';
import { EmptyState, SkeletonCard } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const STAGES = [
  { value: 'all', label: 'All Stages' },
  { value: 'concept', label: 'Concept' },
  { value: 'validation', label: 'Validation' },
  { value: 'prototype', label: 'Prototype' },
  { value: 'mvp', label: 'MVP Ready' },
  { value: 'launched', label: 'Launched' },
];

export default function ExploreIdeasPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [skillInput, setSkillInput] = useState(searchParams.get('skill') || '');

  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'all';
  const stage = searchParams.get('stage') || 'all';
  const skill = searchParams.get('skill') || '';
  const sort = searchParams.get('sort') || 'newest';
  const page = Number(searchParams.get('page') || 1);

  useEffect(() => {
    api
      .get('/ideas/categories')
      .then((res) => setCategories(res.data?.data?.categories || []))
      .catch(() => {});
  }, []);

  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category && category !== 'all') params.set('category', category);
      if (stage && stage !== 'all') params.set('stage', stage);
      if (skill) params.set('skill', skill);
      params.set('sort', sort);
      params.set('page', String(page));
      params.set('limit', '9');

      const res = await api.get(`/ideas?${params.toString()}`);
      setIdeas(res.data.data.ideas || []);
      setMeta(res.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [q, category, stage, skill, sort, page, toast]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  function updateFilter(updates) {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (!v || v === 'all') next.delete(k);
      else next.set(k, String(v));
    });
    if (!('page' in updates)) {
      next.set('page', '1');
    }
    setSearchParams(next);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    updateFilter({ q: searchInput.trim(), skill: skillInput.trim() });
  }

  function resetFilters() {
    setSearchInput('');
    setSkillInput('');
    setSearchParams({});
  }

  const handleVoteChange = useCallback((ideaId, updates) => {
    setIdeas((prev) =>
      prev.map((item) =>
        String(item._id) === String(ideaId)
          ? {
              ...item,
              ...(typeof updates.upvoteCount === 'number' ? { upvoteCount: updates.upvoteCount } : {}),
              ...(typeof updates.isUpvoted === 'boolean' ? { isUpvoted: updates.isUpvoted } : {}),
            }
          : item
      )
    );
  }, []);

  async function handleToggleBookmark(ideaId) {
    if (!user) {
      toast.info('Please log in to bookmark ideas.');
      navigate('/login');
      return;
    }
    try {
      const res = await api.post(`/bookmarks/${ideaId}`);
      const { isBookmarked, bookmarkCount } = res.data.data;
      setIdeas((prev) =>
        prev.map((item) => (item._id === ideaId ? { ...item, isBookmarked, bookmarkCount } : item))
      );
      toast.success(isBookmarked ? 'Saved to bookmarks.' : 'Removed from bookmarks.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#6E05F2]">
            Idea Discovery
          </span>
          <h1 className="mt-1 text-3xl font-extrabold text-[#171717]">Explore Public Ideas</h1>
          <p className="mt-1 text-sm text-slate-600">
            Discover vetted public concepts and apply with your skills to join execution teams.
          </p>
        </div>
        <Link
          to={user ? '/ideas/new' : '/signup'}
          className="inline-flex items-center justify-center rounded-xl brand-gradient-bg px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:opacity-95"
        >
          Publish Your Idea
        </Link>
      </div>

      {/* Search & Filters Bar */}
      <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search ideas by title, problem, or keyword..."
              className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>

          <div className="md:col-span-4">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              placeholder="Filter by exact skill (e.g. React, Python, Figma)"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>

          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-[#6E05F2] py-2.5 px-4 text-sm font-semibold text-white hover:bg-[#5b04c9] transition"
            >
              Search
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <Filter className="h-3.5 w-3.5" /> Filters:
            </span>

            <select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => updateFilter({ category: e.target.value })}
              className="rounded-xl border border-slate-200 bg-[#F8F9FC] px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#6E05F2] focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by project stage"
              value={stage}
              onChange={(e) => updateFilter({ stage: e.target.value })}
              className="rounded-xl border border-slate-200 bg-[#F8F9FC] px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#6E05F2] focus:outline-none"
            >
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Sort ideas"
              value={sort}
              onChange={(e) => updateFilter({ sort: e.target.value })}
              className="rounded-xl border border-slate-200 bg-[#F8F9FC] px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#6E05F2] focus:outline-none"
            >
              <option value="newest">Sort: Newest</option>
              <option value="popular">Sort: Most Popular</option>
              <option value="collaborative">Sort: Most Collaborative</option>
            </select>

            {(q || category !== 'all' || stage !== 'all' || skill || sort !== 'newest') && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Showing <strong>{ideas.length}</strong> of <strong>{meta.total || 0}</strong> public ideas
          </p>
        </div>
      </div>

      {/* Results Grid */}
      <div className="mt-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="No matching public ideas found"
            description="Try adjusting your search keywords, category, or skill filter—or be the first to share an idea in this domain!"
            action={
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl bg-[#6E05F2] px-4 py-2 text-xs font-semibold text-white"
              >
                Clear All Filters
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea._id}
                idea={idea}
                onVoteChange={handleVoteChange}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={!meta.hasPrevPage}
            onClick={() => updateFilter({ page: page - 1 })}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-3 text-xs font-semibold text-slate-600">
            Page {meta.page} of {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={!meta.hasNextPage}
            onClick={() => updateFilter({ page: page + 1 })}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

