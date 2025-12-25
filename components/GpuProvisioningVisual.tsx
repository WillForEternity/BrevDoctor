"use client";

import { useState, useEffect } from "react";

interface GpuProvisioningAttempt {
  gpu: string;
  vram: number;
  gpuCount: number;
  success: boolean;
  error?: string;
  errorType?: string;
}

interface GpuProvisioningVisualProps {
  isProvisioning: boolean;
  currentAttempt?: {
    gpu: string;
    vram: number;
    gpuCount: number;
    attemptNumber: number;
  };
  attempts: GpuProvisioningAttempt[];
  retryDecision?: {
    thinking: string;
    shouldRetry: boolean;
    nextGpu?: string;
    fallbackReason?: string;
  };
  finalResult?: {
    success: boolean;
    workspaceName?: string;
    gpu?: string;
    vram?: number;
  };
}

// GPU catalog with visual metadata
const GPU_VISUALS: Record<string, { tier: string; color: string; icon: string }> = {
  // Blackwell
  B300: { tier: "Ultra", color: "from-violet-500 to-purple-600", icon: "⚡" },
  B200: { tier: "Ultra", color: "from-violet-500 to-purple-600", icon: "⚡" },
  // Hopper
  H200: { tier: "Elite", color: "from-emerald-400 to-teal-500", icon: "🔥" },
  H100: { tier: "Elite", color: "from-emerald-400 to-teal-500", icon: "🔥" },
  // Ampere High
  A100: { tier: "Pro", color: "from-blue-400 to-cyan-500", icon: "💎" },
  "A100-40GB": { tier: "Pro", color: "from-blue-400 to-cyan-500", icon: "💎" },
  A40: { tier: "Pro", color: "from-blue-400 to-indigo-500", icon: "⚙️" },
  // Ada
  L40s: { tier: "Advanced", color: "from-amber-400 to-orange-500", icon: "✨" },
  L40: { tier: "Advanced", color: "from-amber-400 to-orange-500", icon: "✨" },
  L4: { tier: "Standard", color: "from-green-400 to-emerald-500", icon: "🚀" },
  // Ampere Standard
  A10: { tier: "Standard", color: "from-sky-400 to-blue-500", icon: "🎯" },
  A10G: { tier: "Standard", color: "from-sky-400 to-blue-500", icon: "🎯" },
  A6000: { tier: "Advanced", color: "from-indigo-400 to-purple-500", icon: "🔧" },
  A5000: { tier: "Standard", color: "from-indigo-400 to-violet-500", icon: "🔧" },
  A4000: { tier: "Entry", color: "from-slate-400 to-zinc-500", icon: "📦" },
  A16: { tier: "Entry", color: "from-slate-400 to-zinc-500", icon: "📦" },
  // Others
  T4: { tier: "Budget", color: "from-zinc-400 to-slate-500", icon: "💰" },
  V100: { tier: "Legacy", color: "from-rose-400 to-pink-500", icon: "🏛️" },
  P4: { tier: "Budget", color: "from-zinc-500 to-gray-600", icon: "💡" },
  M60: { tier: "Legacy", color: "from-zinc-500 to-gray-600", icon: "📜" },
  // RTX Ada
  "RTX Pro 6000": { tier: "Pro", color: "from-lime-400 to-green-500", icon: "🎨" },
  "RTX 6000 Ada": { tier: "Pro", color: "from-lime-400 to-green-500", icon: "🎨" },
  "RTX 4000 Ada": { tier: "Standard", color: "from-teal-400 to-cyan-500", icon: "🎨" },
};

function getGpuVisual(gpuName: string) {
  return GPU_VISUALS[gpuName] || { tier: "Unknown", color: "from-zinc-400 to-zinc-500", icon: "🔲" };
}

export function GpuProvisioningVisual({
  isProvisioning,
  currentAttempt,
  attempts,
  retryDecision,
  finalResult,
}: GpuProvisioningVisualProps) {
  const [pulsePhase, setPulsePhase] = useState(0);

  // Animate pulse for provisioning state
  useEffect(() => {
    if (!isProvisioning) return;
    const interval = setInterval(() => {
      setPulsePhase((p) => (p + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, [isProvisioning]);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
          finalResult?.success 
            ? "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30" 
            : isProvisioning 
              ? "bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30 animate-pulse"
              : attempts.length > 0 && !attempts[attempts.length - 1]?.success
                ? "bg-gradient-to-br from-red-500 to-rose-500 shadow-lg shadow-red-500/30"
                : "bg-gradient-to-br from-zinc-700 to-zinc-800"
        }`}>
          <span className="text-2xl">
            {finalResult?.success ? "✅" : isProvisioning ? "⚙️" : attempts.length > 0 ? "🔄" : "🎯"}
          </span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-zinc-100">
            {finalResult?.success 
              ? "GPU Provisioned!" 
              : isProvisioning 
                ? "Provisioning GPU..." 
                : attempts.length > 0 
                  ? "Selecting Alternative GPU" 
                  : "GPU Configuration"}
          </h3>
          <p className="text-sm text-zinc-400">
            {finalResult?.success 
              ? `Workspace ${finalResult.workspaceName} is ready`
              : isProvisioning 
                ? `Attempting to start ${currentAttempt?.gpu || "GPU"}...`
                : attempts.length > 0
                  ? "Finding the best available option"
                  : "Matching your requirements to available GPUs"}
          </p>
        </div>
      </div>

      {/* Current Attempt Visualization */}
      {isProvisioning && currentAttempt && (
        <div className="relative overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-900/50 p-6">
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden">
            <div 
              className={`absolute inset-0 bg-gradient-to-r ${getGpuVisual(currentAttempt.gpu).color} opacity-10`}
              style={{
                transform: `translateX(${(pulsePhase - 2) * 25}%)`,
                transition: "transform 0.5s ease-in-out",
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-transparent via-transparent to-zinc-950/80" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getGpuVisual(currentAttempt.gpu).icon}</span>
                <div>
                  <h4 className="text-2xl font-bold text-zinc-100">{currentAttempt.gpu}</h4>
                  <p className="text-sm text-zinc-400">
                    {getGpuVisual(currentAttempt.gpu).tier} Tier • Attempt #{currentAttempt.attemptNumber}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-zinc-200">
                  {currentAttempt.vram}GB VRAM
                </p>
                {currentAttempt.gpuCount > 1 && (
                  <p className="text-sm text-zinc-400">
                    × {currentAttempt.gpuCount} GPUs
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${getGpuVisual(currentAttempt.gpu).color} transition-all duration-1000`}
                style={{
                  width: `${25 + pulsePhase * 20}%`,
                  animation: "pulse 2s ease-in-out infinite",
                }}
              />
            </div>

            {/* Status indicators */}
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-zinc-400">Contacting Brev Cloud</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${pulsePhase >= 1 ? "bg-amber-500 animate-pulse" : "bg-zinc-600"}`} />
                <span className={`text-xs ${pulsePhase >= 1 ? "text-zinc-400" : "text-zinc-600"}`}>
                  Checking Availability
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${pulsePhase >= 2 ? "bg-blue-500 animate-pulse" : "bg-zinc-600"}`} />
                <span className={`text-xs ${pulsePhase >= 2 ? "text-zinc-400" : "text-zinc-600"}`}>
                  Allocating Resources
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attempts History */}
      {attempts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Provisioning Attempts
          </h4>
          <div className="space-y-2">
            {attempts.map((attempt, i) => {
              const visual = getGpuVisual(attempt.gpu);
              return (
                <div
                  key={i}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                    attempt.success
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-zinc-900/50 border-zinc-700/50"
                  }`}
                >
                  {/* Status icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    attempt.success
                      ? "bg-emerald-500"
                      : "bg-red-500/20 border border-red-500/30"
                  }`}>
                    {attempt.success ? (
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>

                  {/* GPU info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{visual.icon}</span>
                      <span className="font-semibold text-zinc-200">{attempt.gpu}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${visual.color} text-white`}>
                        {visual.tier}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {attempt.vram}GB VRAM {attempt.gpuCount > 1 && `× ${attempt.gpuCount}`}
                      {!attempt.success && attempt.error && (
                        <span className="text-red-400 ml-2">• {attempt.error}</span>
                      )}
                    </p>
                  </div>

                  {/* Attempt number */}
                  <div className="text-right">
                    <span className="text-xs text-zinc-500">#{i + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Retry Decision */}
      {retryDecision && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-300 mb-1">
                AI Selecting Alternative
              </h4>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {retryDecision.thinking}
              </p>
              {retryDecision.nextGpu && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Next attempt:</span>
                  <span className="text-sm font-semibold text-amber-300">
                    {getGpuVisual(retryDecision.nextGpu).icon} {retryDecision.nextGpu}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Final Success */}
      {finalResult?.success && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-bold text-emerald-300">
                GPU Ready! 🎉
              </h4>
              <p className="text-sm text-zinc-300 mt-1">
                <span className="font-semibold text-zinc-100">{finalResult.gpu}</span>
                {finalResult.vram && <span> with {finalResult.vram}GB VRAM</span>}
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                Workspace: <code className="text-emerald-400">{finalResult.workspaceName}</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* GPU Catalog Preview (when not provisioning) */}
      {!isProvisioning && attempts.length === 0 && !finalResult && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Available GPU Tiers
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { tier: "Ultra", gpus: ["B300", "B200"], color: "from-violet-500/20 to-purple-500/20", border: "border-violet-500/30" },
              { tier: "Elite", gpus: ["H200", "H100"], color: "from-emerald-500/20 to-teal-500/20", border: "border-emerald-500/30" },
              { tier: "Pro", gpus: ["A100", "A40"], color: "from-blue-500/20 to-cyan-500/20", border: "border-blue-500/30" },
              { tier: "Advanced", gpus: ["L40s", "A6000"], color: "from-amber-500/20 to-orange-500/20", border: "border-amber-500/30" },
              { tier: "Standard", gpus: ["L4", "A10G"], color: "from-green-500/20 to-emerald-500/20", border: "border-green-500/30" },
              { tier: "Budget", gpus: ["T4", "P4"], color: "from-zinc-500/20 to-slate-500/20", border: "border-zinc-500/30" },
            ].map((category) => (
              <div
                key={category.tier}
                className={`p-3 rounded-xl bg-gradient-to-br ${category.color} border ${category.border}`}
              >
                <h5 className="text-xs font-bold text-zinc-200 mb-1">{category.tier}</h5>
                <p className="text-xs text-zinc-400">{category.gpus.join(", ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

