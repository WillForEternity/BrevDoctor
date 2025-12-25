"use client";

interface RepoConfirmationProps {
  repoName: string;
  repoOwner: string;
  repoDescription?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RepoConfirmation({ 
  repoName, 
  repoOwner, 
  repoDescription, 
  onConfirm, 
  onCancel 
}: RepoConfirmationProps) {
  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-2xl p-8 backdrop-blur-sm bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-zinc-100">Ready to Analyze</h3>
            <p className="text-zinc-400 text-sm">Start AI analysis for this repository?</p>
          </div>
        </div>

        {/* Repository info */}
        <div className="mb-6 p-5 rounded-xl bg-zinc-900/80 border border-blue-500/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-zinc-100 mb-1">
                {repoOwner}/{repoName}
              </h4>
              {repoDescription && (
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {repoDescription}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* What will happen */}
        <div className="mb-6 p-4 rounded-lg bg-zinc-900/50 border border-zinc-700/50">
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">What the AI will do:</h4>
          <div className="space-y-2">
            {[
              { icon: "🔍", text: "Scan repository structure and files" },
              { icon: "🧠", text: "Analyze ML/AI code and dependencies" },
              { icon: "📊", text: "Estimate GPU compute requirements" },
              { icon: "🎯", text: "Match to optimal Brev GPU instances" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-zinc-400">
                <span className="text-lg">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start Analysis
            </span>
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

