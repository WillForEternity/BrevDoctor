"use client";

import type { LaunchableResult } from "@/app/dashboard/actions/createLaunchable";

interface ResultCardProps {
  result: LaunchableResult;
  onReset: () => void;
}

export function ResultCard({ result, onReset }: ResultCardProps) {
  return (
    <div className="w-full max-w-2xl">
      <div
        className={`rounded-2xl p-8 backdrop-blur-sm ${
          result.success
            ? "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30"
            : "bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30"
        }`}
      >
        {result.success ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-zinc-100">Pull Request Created!</h3>
                <p className="text-zinc-400 text-sm">Your Brev configuration is ready</p>
              </div>
            </div>

            {result.recommendation && (
              <div className="mb-6 p-4 rounded-lg bg-zinc-900/50 border border-zinc-700/50">
                <h4 className="text-sm font-medium text-zinc-300 mb-2">GPU Recommendation</h4>
                <pre className="text-sm text-zinc-400 whitespace-pre-wrap font-mono">
                  {result.recommendation}
                </pre>
              </div>
            )}

            <a
              href={result.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              View Pull Request
            </a>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-zinc-100">Something went wrong</h3>
                <p className="text-red-400 text-sm">{result.error}</p>
              </div>
            </div>

            {result.recommendation && (
              <div className="mb-6 p-4 rounded-lg bg-zinc-900/50 border border-zinc-700/50">
                <h4 className="text-sm font-medium text-zinc-300 mb-2">Analysis Results</h4>
                <pre className="text-sm text-zinc-400 whitespace-pre-wrap font-mono">
                  {result.recommendation}
                </pre>
              </div>
            )}
          </>
        )}

        <button
          onClick={onReset}
          className="mt-4 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors text-sm"
        >
          Analyze Another Repository
        </button>
      </div>
    </div>
  );
}

