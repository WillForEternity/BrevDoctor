"use client";

interface Step {
  step: string;
  status: "pending" | "running" | "complete" | "error";
}

interface ProgressStepsProps {
  steps: Step[];
}

export function ProgressSteps({ steps }: ProgressStepsProps) {
  return (
    <div className="w-full max-w-md space-y-3">
      {steps.map((step, index) => (
        <div
          key={index}
          className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-500 ${
            step.status === "running"
              ? "bg-emerald-500/10 border border-emerald-500/30"
              : step.status === "complete"
              ? "bg-zinc-800/50"
              : step.status === "error"
              ? "bg-red-500/10 border border-red-500/30"
              : "bg-zinc-900/30"
          }`}
        >
          <div className="flex-shrink-0">
            {step.status === "pending" && (
              <div className="w-6 h-6 rounded-full border-2 border-zinc-600" />
            )}
            {step.status === "running" && (
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            )}
            {step.status === "complete" && (
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {step.status === "error" && (
              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>
          <span
            className={`text-sm ${
              step.status === "running"
                ? "text-emerald-400"
                : step.status === "complete"
                ? "text-zinc-400"
                : step.status === "error"
                ? "text-red-400"
                : "text-zinc-500"
            }`}
          >
            {step.step}
          </span>
        </div>
      ))}
    </div>
  );
}

