"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { getUserRepos, type GitHubRepo } from "@/lib/github";
import type { RepoMeta } from "@/types/agentSchemas";

interface RepoSelectorProps {
  onSubmit: (repoMeta: RepoMeta, description?: string) => void;
  isLoading: boolean;
}

export function RepoSelector({ onSubmit, isLoading }: RepoSelectorProps) {
  const { data: session } = useSession();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadRepos() {
      if (!session?.accessToken) return;

      try {
        setLoading(true);
        const userRepos = await getUserRepos(session.accessToken);
        setRepos(userRepos);
      } catch (err) {
        setError("Failed to load repositories");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadRepos();
  }, [session?.accessToken]);

  const filteredRepos = repos.filter((repo) => {
    const search = searchTerm.toLowerCase();
    return (
      repo.name.toLowerCase().includes(search) ||
      repo.full_name.toLowerCase().includes(search) ||
      repo.description?.toLowerCase().includes(search)
    );
  });

  const handleRepoSelect = (repo: GitHubRepo) => {
    onSubmit(
      {
        owner: repo.owner.login,
        repo: repo.name,
      },
      repo.description || undefined
    );
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl">
        <div className="p-6 rounded-xl bg-red-900/20 border border-red-500/30 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      {/* Search bar */}
      <div className="mb-6">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search your repositories..."
            className="w-full pl-12 pr-6 py-4 rounded-xl bg-zinc-900/80 border border-zinc-700/50 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Repository grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
        {filteredRepos.length === 0 ? (
          <div className="col-span-full text-center py-12 text-zinc-500">
            {searchTerm ? "No repositories found" : "No repositories available"}
          </div>
        ) : (
          filteredRepos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => handleRepoSelect(repo)}
              disabled={isLoading}
              className="group relative p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-emerald-500/50 hover:bg-zinc-800/50 transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-4">
                <img
                  src={repo.owner.avatar_url}
                  alt={repo.owner.login}
                  className="w-10 h-10 rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-100 truncate group-hover:text-emerald-400 transition-colors">
                      {repo.name}
                    </h3>
                    {repo.private && (
                      <span className="px-2 py-0.5 text-xs rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Private
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 mb-2 truncate">
                    {repo.full_name}
                  </p>
                  {repo.description && (
                    <p className="text-sm text-zinc-400 line-clamp-2 mb-2">
                      {repo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    {repo.language && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {repo.language}
                      </span>
                    )}
                    {repo.stargazers_count > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {repo.stargazers_count}
                      </span>
                    )}
                    <span>
                      Updated {new Date(repo.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/0 to-teal-500/0 group-hover:from-emerald-500/5 group-hover:to-teal-500/5 transition-all duration-300 pointer-events-none" />
            </button>
          ))
        )}
      </div>
      
      {filteredRepos.length > 0 && (
        <div className="mt-4 text-center text-sm text-zinc-500">
          Showing {filteredRepos.length} of {repos.length} repositories
        </div>
      )}
    </div>
  );
}

