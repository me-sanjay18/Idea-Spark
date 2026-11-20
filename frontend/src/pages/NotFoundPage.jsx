import { Compass, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-2xs">
        <p className="text-5xl font-extrabold brand-gradient-text">404</p>
        <h1 className="mt-3 text-2xl font-extrabold text-[#171717]">Page Not Found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page you are looking for doesn&apos;t exist or may have been moved.
        </p>
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl brand-gradient-bg px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Home className="h-4 w-4" /> Back to Home
          </Link>
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Compass className="h-4 w-4" /> Explore Ideas
          </Link>
        </div>
      </div>
    </div>
  );
}

