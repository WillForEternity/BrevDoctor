"use client";

import type { AnalysisResult } from "@/app/dashboard/actions/createLaunchable";

interface ConfirmationCardProps {
  analysis: AnalysisResult;
  onConfirm: () => void;
  onDeny: () => void;
  onReject: () => void;
  isCreatingPR: boolean;
}

export function ConfirmationCard({ analysis, onConfirm, onDeny, onReject, isCreatingPR }: ConfirmationCardProps) {
  const { match, needs, recommendation } = analysis;
  const instance = match?.best;

  if (!instance || !needs) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-2xl p-8 backdrop-blur-sm bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-zinc-100">Review Recommendation</h3>
            <p className="text-zinc-400 text-sm">Please confirm before creating the pull request</p>
          </div>
        </div>

        {/* Recommended Instance Card */}
        <div className="mb-6 p-5 rounded-xl bg-zinc-900/80 border border-emerald-500/30">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-emerald-400">Recommended Instance</h4>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium">
              Best Match
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-zinc-800/50">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">GPU</p>
              <p className="text-zinc-100 font-semibold text-lg">{instance.name}</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">VRAM</p>
              <p className="text-zinc-100 font-semibold text-lg">
                {instance.vram}GB{instance.count > 1 ? ` × ${instance.count}` : ""}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Architecture</p>
              <p className="text-zinc-100 font-semibold text-lg">{instance.arch}</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Price</p>
              <p className="text-zinc-100 font-semibold text-lg">${instance.price.toFixed(2)}/hr</p>
            </div>
          </div>
        </div>

        {/* Your Requirements */}
        <div className="mb-6 p-5 rounded-xl bg-zinc-900/50 border border-zinc-700/50">
          <h4 className="text-sm font-medium text-zinc-300 mb-3">Your Requirements (Analyzed)</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Estimated VRAM:</span>
              <span className="text-zinc-300">{needs.estimated_vram_gb}GB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Architecture:</span>
              <span className="text-zinc-300">{needs.recommended_gpu_architecture}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Multi-GPU Required:</span>
              <span className="text-zinc-300">{needs.requires_multi_gpu ? "Yes" : "No"}</span>
            </div>
          </div>
        </div>

        {/* Alternative Option */}
        {match?.second_best && (
          <div className="mb-6 p-4 rounded-lg bg-zinc-900/30 border border-zinc-700/30">
            <p className="text-zinc-500 text-sm">
              <span className="text-zinc-400 font-medium">Alternative option:</span>{" "}
              {match.second_best.name} ({match.second_best.vram}GB, ${match.second_best.price.toFixed(2)}/hr)
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={isCreatingPR}
            className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-zinc-700 disabled:to-zinc-700 text-white font-medium transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {isCreatingPR ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating PR...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Accept & Create PR
              </span>
            )}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onReject}
              disabled={isCreatingPR}
              className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:from-zinc-700 disabled:to-zinc-700 text-white font-medium transition-all duration-300 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 disabled:shadow-none disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Reject & Provide Feedback
              </span>
            </button>
            <button
              onClick={onDeny}
              disabled={isCreatingPR}
              className="px-6 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 text-zinc-300 disabled:text-zinc-500 font-medium transition-colors disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

