import { ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white mt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2 space-y-3">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl brand-gradient-bg text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-[#171717]">
                Idea<span className="text-[#6E05F2]">Spark</span>
              </span>
            </Link>
            <p className="text-sm font-semibold text-[#6E05F2]">
              &ldquo;Don&apos;t Just Have an Idea. Build It Together.&rdquo;
            </p>
            <p className="max-w-md text-sm text-slate-500 leading-relaxed">
              Where innovators, developers, designers, and founders share ideas with practical privacy controls and form real execution teams.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Platform</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <Link to="/explore" className="hover:text-[#6E05F2]">
                  Explore Ideas
                </Link>
              </li>
              <li>
                <Link to="/ideas/new" className="hover:text-[#6E05F2]">
                  Publish an Idea
                </Link>
              </li>
              <li>
                <a href="/#how-it-works" className="hover:text-[#6E05F2]">
                  How IdeaSpark Works
                </a>
              </li>
              <li>
                <Link to="/report" className="hover:text-[#6E05F2]">
                  Trust &amp; Reporting
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Account &amp; Safety</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <Link to="/signup" className="hover:text-[#6E05F2]">
                  Create Account
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-[#6E05F2]">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/settings/security" className="hover:text-[#6E05F2]">
                  Privacy &amp; NDA Records
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} IdeaSpark. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-[#6E05F2] shrink-0" />
            <span>
              Access controls, ownership timestamps &amp; NDA logs reduce risk; formal IP protection depends on applicable law and executed agreements.
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

