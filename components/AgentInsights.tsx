"use client";

import { useState, useEffect, useRef } from "react";
import type { AgentStep } from "@/types/agentSchemas";
import { GpuProvisioningVisual } from "./GpuProvisioningVisual";
import type { GpuProvisioningAttempt } from "@/hooks/useAnalysisStream";

interface AgentInsightsProps {
  steps: AgentStep[];
  streamingData?: {
    scoutReasoning?: string;
    scoutSelectedFiles?: string[];
    // Specialist streaming
    specialistThinking?: string;
    specialistVram?: number | null;
    specialistArch?: string | null;
    specialistMultiGpu?: boolean | null;
    specialistCommands?: string[];
    specialistComplexity?: string | null;
    specialistComplexityReasoning?: string | null;
    specialistCpuCores?: number | null;
    specialistSystemRam?: number | null;
    specialistDiskSpace?: number | null;
    // Broker streaming
    brokerThinking?: string;
    brokerRecommendedInstance?: string | null;
    brokerRecommendedVram?: number | null;
    brokerRecommendedCount?: number | null;
    brokerAlternativeInstance?: string | null;
    brokerConfidence?: string | null;
    brokerCostNotes?: string | null;
    brokerStatus?: "idle" | "starting" | "streaming" | "complete";
    brokerUpdateCount?: number;
    // GPU Provisioning streaming
    isProvisioning?: boolean;
    provisioningAttempt?: {
      gpu: string;
      vram: number;
      gpuCount: number;
      attemptNumber: number;
    } | null;
    provisioningAttempts?: GpuProvisioningAttempt[];
    retryDecision?: {
      thinking: string;
      shouldRetry: boolean;
      nextGpu?: string;
      fallbackReason?: string;
    } | null;
    provisioningResult?: {
      success: boolean;
      workspaceName?: string;
      gpu?: string;
      vram?: number;
      gpuCount?: number;
    } | null;
  };
  className?: string;
}

export function AgentInsights({ steps, streamingData, className = "" }: AgentInsightsProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);

  // Auto-expand current running step
  useEffect(() => {
    const runningStep = steps.find((s) => s.status === "running");
    if (runningStep && (runningStep.id === "scout" || runningStep.id === "analyze" || runningStep.id === "match")) {
      setExpandedStep(runningStep.id);
    }
  }, [steps]);

  // Auto-scroll thinking as it streams
  useEffect(() => {
    if (thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [streamingData?.scoutReasoning, streamingData?.specialistThinking, streamingData?.brokerThinking]);

  const getStepIcon = (step: AgentStep) => {
    const iconMap: Record<string, React.ReactNode> = {
      auth: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      scan: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      scout: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      fetch: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      analyze: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      match: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    };
    return iconMap[step.id] || (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  };

  const getStepDuration = (step: AgentStep) => {
    if (!step.startTime || !step.endTime) return null;
    const duration = step.endTime - step.startTime;
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <div className={`w-full max-w-4xl ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
          <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">Agent Insights</h3>
          <p className="text-sm text-zinc-500">Watch the AI analyze your repository in real-time</p>
        </div>
      </div>

      {/* Steps timeline */}
      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`relative rounded-xl border transition-all duration-300 overflow-hidden ${
              step.status === "running"
                ? "bg-zinc-900/50 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                : step.status === "complete"
                ? "bg-zinc-900/50 border-zinc-700/50 hover:border-zinc-600/50"
                : step.status === "error"
                ? "bg-red-500/10 border-red-500/40"
                : "bg-zinc-900/30 border-zinc-800/50"
            }`}
          >
            {/* Step header */}
            <button
              onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              disabled={step.status === "pending"}
              className="w-full p-4 flex items-center gap-4 text-left disabled:cursor-default"
            >
              {/* Icon */}
              <div className={`text-2xl ${step.status === "pending" ? "opacity-40 grayscale" : ""}`}>
                {getStepIcon(step)}
              </div>

              {/* Status indicator */}
              <div className="flex-shrink-0">
                {step.status === "pending" && (
                  <div className="w-5 h-5 rounded-full border-2 border-zinc-600" />
                )}
                {step.status === "running" && (
                  <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                )}
                {step.status === "complete" && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {step.status === "error" && (
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Step name and info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${
                    step.status === "running" ? "text-emerald-300" :
                    step.status === "complete" ? "text-zinc-200" :
                    step.status === "error" ? "text-red-300" :
                    "text-zinc-500"
                  }`}>
                    {step.name}
                  </span>
                  {getStepDuration(step) && (
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                      {getStepDuration(step)}
                    </span>
                  )}
                </div>
                
                {/* Quick summary */}
                {step.status === "complete" && step.data && (
                  <p className="text-xs text-zinc-500 mt-1 truncate">
                    {step.id === "scan" && step.data.totalFiles && `Found ${step.data.totalFiles} files`}
                    {step.id === "scout" && step.data.selectedFiles && `Selected ${step.data.selectedFiles.length} key files`}
                    {step.id === "fetch" && step.data.fileContents && `Loaded ${Object.keys(step.data.fileContents).length} files`}
                    {step.id === "analyze" && step.data.computeAnalysis && `${step.data.computeAnalysis.estimatedVram}GB VRAM • ${step.data.computeAnalysis.complexity} complexity`}
                    {step.id === "match" && step.data.matchConfidence && `${step.data.matchConfidence} confidence match`}
                  </p>
                )}
              </div>

              {/* Expand indicator */}
              {step.status !== "pending" && (
                <svg
                  className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${
                    expandedStep === step.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {/* Expanded content - Show streaming data for running steps */}
            {expandedStep === step.id && (step.data || step.status === "running") && (
              <div className="px-4 pb-4 pt-0 border-t border-zinc-800/50">
                {step.status === "running" ? (
                  <StreamingStepContent step={step} streamingData={streamingData} thinkingRef={thinkingRef} />
                ) : (
                  <StepDetails step={step} />
                )}
              </div>
            )}

            {/* Running indicator bar */}
            {step.status === "running" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 animate-pulse" style={{ width: "100%" }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StreamingStepContent({ 
  step, 
  streamingData,
  thinkingRef 
}: { 
  step: AgentStep; 
  streamingData?: AgentInsightsProps["streamingData"];
  thinkingRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (step.id === "scout" && streamingData) {
    return (
      <div className="mt-4 space-y-4">
        {/* Live reasoning stream */}
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Scout AI Thinking...
          </h4>
          <div
            ref={thinkingRef}
            className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 max-h-48 overflow-y-auto"
          >
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {streamingData.scoutReasoning || (
                <span className="text-zinc-500 italic">Analyzing file structure...</span>
              )}
              <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1" />
            </p>
          </div>
        </div>

        {/* Selected files streaming */}
        {streamingData.scoutSelectedFiles && streamingData.scoutSelectedFiles.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
              Files Being Selected
            </h4>
            <div className="flex flex-wrap gap-2">
              {streamingData.scoutSelectedFiles.map((file, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400"
                >
                  <FileIcon filename={file} />
                  {file.split("/").pop()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step.id === "analyze" && streamingData) {
    return (
      <div className="mt-4 space-y-4">
        {/* Specialist Thinking Stream */}
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Specialist Deep Analysis...
          </h4>
          <div
            ref={thinkingRef}
            className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 max-h-64 overflow-y-auto"
          >
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">
              {streamingData.specialistThinking || (
                <span className="text-zinc-500 italic">Analyzing model architecture, dependencies, and compute requirements...</span>
              )}
              <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1" />
            </p>
          </div>
        </div>

        {/* Complexity Badge */}
        {streamingData.specialistComplexity && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Complexity:</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              streamingData.specialistComplexity === "Enterprise" ? "bg-zinc-700 text-zinc-200" :
              streamingData.specialistComplexity === "High" ? "bg-zinc-700 text-zinc-200" :
              streamingData.specialistComplexity === "Medium" ? "bg-zinc-700 text-zinc-200" :
              "bg-zinc-700 text-zinc-200"
            }`}>
              {streamingData.specialistComplexity}
            </span>
          </div>
        )}

        {/* Live metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">VRAM</p>
            <p className={`text-lg font-semibold ${streamingData.specialistVram ? "text-zinc-200" : "text-zinc-600"}`}>
              {streamingData.specialistVram ? `${streamingData.specialistVram}GB` : "..."}
            </p>
          </div>
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">Architecture</p>
            <p className={`text-lg font-semibold ${streamingData.specialistArch ? "text-zinc-200" : "text-zinc-600"}`}>
              {streamingData.specialistArch || "..."}
            </p>
          </div>
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">Multi-GPU</p>
            <p className={`text-lg font-semibold ${streamingData.specialistMultiGpu !== null ? "text-zinc-200" : "text-zinc-600"}`}>
              {streamingData.specialistMultiGpu !== null 
                ? (streamingData.specialistMultiGpu ? "Yes" : "No")
                : "..."}
            </p>
          </div>
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">CPU Cores</p>
            <p className={`text-lg font-semibold ${streamingData.specialistCpuCores ? "text-zinc-200" : "text-zinc-600"}`}>
              {streamingData.specialistCpuCores || "..."}
            </p>
          </div>
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">System RAM</p>
            <p className={`text-lg font-semibold ${streamingData.specialistSystemRam ? "text-zinc-200" : "text-zinc-600"}`}>
              {streamingData.specialistSystemRam ? `${streamingData.specialistSystemRam}GB` : "..."}
            </p>
          </div>
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">Disk Space</p>
            <p className={`text-lg font-semibold ${streamingData.specialistDiskSpace ? "text-zinc-200" : "text-zinc-600"}`}>
              {streamingData.specialistDiskSpace ? `${streamingData.specialistDiskSpace}GB` : "..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step.id === "match" && streamingData) {
    // Check if we're in provisioning mode
    const isProvisioning = streamingData.isProvisioning || false;
    const hasProvisioningData = streamingData.provisioningAttempts && streamingData.provisioningAttempts.length > 0;
    const brokerStatus = streamingData.brokerStatus || "idle";
    const updateCount = streamingData.brokerUpdateCount || 0;

    return (
      <div className="mt-4 space-y-4">
        {/* Broker Status Header */}
        {!isProvisioning && !hasProvisioningData && (
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                brokerStatus === "complete" ? "bg-emerald-500" : "bg-emerald-500 animate-pulse"
              }`} />
              {brokerStatus === "starting" && "Initializing GPU Selection..."}
              {brokerStatus === "streaming" && "AI Evaluating GPU Options..."}
              {brokerStatus === "complete" && "GPU Selection Complete"}
              {brokerStatus === "idle" && "Waiting to start..."}
            </h4>
            {updateCount > 0 && brokerStatus === "streaming" && (
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                {updateCount} updates
              </span>
            )}
          </div>
        )}

        {/* Broker Thinking Stream */}
        {!isProvisioning && !hasProvisioningData && (
          <div>
            <div
              ref={thinkingRef}
              className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 max-h-64 overflow-y-auto"
            >
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {streamingData.brokerThinking || (
                  <span className="text-zinc-500 italic flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    Analyzing inventory and matching to requirements...
                  </span>
                )}
                {brokerStatus !== "complete" && streamingData.brokerThinking && (
                  <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1" />
                )}
              </p>
            </div>
          </div>
        )}

        {/* GPU Selection Card */}
        {streamingData.brokerRecommendedInstance && !isProvisioning && !hasProvisioningData && (
          <GpuSelectionCard
            gpu={streamingData.brokerRecommendedInstance}
            vram={streamingData.brokerRecommendedVram || undefined}
            gpuCount={streamingData.brokerRecommendedCount || 1}
            alternative={streamingData.brokerAlternativeInstance || undefined}
            confidence={streamingData.brokerConfidence || undefined}
            costNotes={streamingData.brokerCostNotes || undefined}
            isSelecting={!streamingData.brokerConfidence}
          />
        )}

        {/* GPU Provisioning Visual */}
        {(isProvisioning || hasProvisioningData) && (
          <GpuProvisioningVisual
            isProvisioning={isProvisioning}
            currentAttempt={streamingData.provisioningAttempt || undefined}
            attempts={streamingData.provisioningAttempts || []}
            retryDecision={streamingData.retryDecision || undefined}
            finalResult={streamingData.provisioningResult || undefined}
          />
        )}

        {/* Cost notes (when not provisioning) */}
        {streamingData.brokerCostNotes && !isProvisioning && !hasProvisioningData && (
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Cost Optimization
            </p>
            <p className="text-sm text-zinc-300">{streamingData.brokerCostNotes}</p>
          </div>
        )}
      </div>
    );
  }

  // Default: just show a loading state
  return (
    <div className="mt-4 flex items-center justify-center py-8">
      <div className="flex items-center gap-3 text-zinc-500">
        <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        <span>Processing...</span>
      </div>
    </div>
  );
}

function StepDetails({ step }: { step: AgentStep }) {
  const { data } = step;
  if (!data) return null;

  return (
    <div className="mt-4 space-y-4">
      {/* File tree visualization */}
      {data.fileTree && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Repository Files</h4>
          <div className="bg-zinc-950 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs">
            {data.fileTree.slice(0, 50).map((file, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5 text-zinc-400 hover:text-zinc-200">
                <FileIcon filename={file} />
                <span className="truncate">{file}</span>
              </div>
            ))}
            {data.fileTree.length > 50 && (
              <div className="text-zinc-600 mt-2">...and {data.fileTree.length - 50} more files</div>
            )}
          </div>
        </div>
      )}

      {/* Scout reasoning */}
      {data.scoutReasoning && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Scout AI Reasoning
          </h4>
          <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4">
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{data.scoutReasoning}</p>
          </div>
        </div>
      )}

      {/* Selected files */}
      {data.selectedFiles && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Selected Files for Analysis</h4>
          <div className="flex flex-wrap gap-2">
            {data.selectedFiles.map((file, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400"
              >
                <FileIcon filename={file} />
                {file.split("/").pop()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* File contents preview */}
      {data.fileContents && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">File Contents</h4>
          <div className="space-y-2">
            {Object.entries(data.fileContents).slice(0, 3).map(([filename, content]) => (
              <FilePreview key={filename} filename={filename} content={content} />
            ))}
            {Object.keys(data.fileContents).length > 3 && (
              <p className="text-xs text-zinc-500">+{Object.keys(data.fileContents).length - 3} more files</p>
            )}
          </div>
        </div>
      )}

      {/* Specialist Thinking (full) */}
      {data.specialistThinkingStream && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Specialist Thinking Process
          </h4>
          <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 max-h-64 overflow-y-auto">
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">{data.specialistThinkingStream}</p>
          </div>
        </div>
      )}

      {/* Compute analysis */}
      {data.computeAnalysis && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Specialist Analysis
          </h4>
          
          {/* Complexity Assessment */}
          {data.computeAnalysis.complexity && (
             <div className="mb-3 bg-zinc-900/50 border border-zinc-700 rounded-lg p-3">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-xs text-zinc-400 font-medium uppercase">Project Complexity</span>
                 <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                   {data.computeAnalysis.complexity}
                 </span>
               </div>
               {data.computeAnalysis.complexityReasoning && (
                 <p className="text-xs text-zinc-300 leading-relaxed">
                   {data.computeAnalysis.complexityReasoning}
                 </p>
               )}
             </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-950 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">Estimated VRAM</p>
              <p className="text-lg font-semibold text-zinc-200">{data.computeAnalysis.estimatedVram}GB</p>
            </div>
            <div className="bg-zinc-950 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">Architecture</p>
              <p className="text-lg font-semibold text-zinc-200">{data.computeAnalysis.architecture}</p>
            </div>
            <div className="bg-zinc-950 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">Multi-GPU</p>
              <p className="text-lg font-semibold text-zinc-200">{data.computeAnalysis.multiGpu ? "Required" : "Not needed"}</p>
            </div>
            <div className="bg-zinc-950 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">CPU Cores</p>
              <p className="text-lg font-semibold text-zinc-200">{data.computeAnalysis.cpuCores || "?"}</p>
            </div>
            <div className="bg-zinc-950 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">System RAM</p>
              <p className="text-lg font-semibold text-zinc-200">{data.computeAnalysis.systemRam || "?"} GB</p>
            </div>
            <div className="bg-zinc-950 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">Disk Space</p>
              <p className="text-lg font-semibold text-zinc-200">{data.computeAnalysis.diskSpace || "?"} GB</p>
            </div>
          </div>
          
          {data.computeAnalysis.setupCommands.length > 0 && (
            <div className="mt-3 bg-zinc-950 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-2">Generated Setup Commands</p>
              <div className="font-mono text-xs space-y-1">
                {data.computeAnalysis.setupCommands.map((cmd, i) => (
                  <div key={i} className="text-emerald-400">
                    <span className="text-zinc-600 mr-2">$</span>{cmd}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Broker Thinking (full) */}
      {data.brokerThinking && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Broker Reasoning
          </h4>
          <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 max-h-64 overflow-y-auto">
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{data.brokerThinking}</p>
          </div>
        </div>
      )}

      {/* Match confidence and cost notes */}
      {(data.matchConfidence || data.costNotes) && (
        <div className="grid grid-cols-2 gap-3">
          {data.matchConfidence && (
            <div className="bg-zinc-950 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">Match Confidence</p>
              <p className="text-lg font-semibold text-zinc-200">{data.matchConfidence}</p>
            </div>
          )}
          {data.costNotes && (
            <div className="bg-zinc-950 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cost Notes
              </p>
              <p className="text-sm text-zinc-300">{data.costNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Legacy match reasoning (fallback) */}
      {data.matchReasoning && !data.brokerThinking && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            GPU Matching Logic
          </h4>
          <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4">
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{data.matchReasoning}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {data.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm text-red-400">{data.error}</p>
        </div>
      )}
    </div>
  );
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase();
  
  const iconColors: Record<string, string> = {
    py: "text-yellow-400",
    js: "text-yellow-300",
    ts: "text-blue-400",
    tsx: "text-blue-400",
    jsx: "text-blue-300",
    json: "text-amber-400",
    yaml: "text-pink-400",
    yml: "text-pink-400",
    md: "text-zinc-400",
    txt: "text-zinc-500",
    sh: "text-green-400",
    dockerfile: "text-cyan-400",
    toml: "text-orange-400",
  };

  return (
    <svg className={`w-4 h-4 ${iconColors[ext || ""] || "text-zinc-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function FilePreview({ filename, content }: { filename: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = content.slice(0, 500);
  const hasMore = content.length > 500;

  return (
    <div className="bg-zinc-950 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900 hover:bg-zinc-800 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs text-zinc-300">
          <FileIcon filename={filename} />
          {filename}
        </span>
        <span className="text-xs text-zinc-500">{content.length} chars</span>
      </button>
      {expanded && (
        <div className="p-3 max-h-64 overflow-y-auto">
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono">
            {expanded ? content : preview}
            {!expanded && hasMore && <span className="text-zinc-600">...</span>}
          </pre>
        </div>
      )}
    </div>
  );
}

// GPU tier visuals
const GPU_TIER_VISUALS: Record<string, { tier: string; color: string; gradient: string; icon: string }> = {
  // Blackwell
  B300: { tier: "Ultra", color: "violet", gradient: "from-violet-500 to-purple-600", icon: "⚡" },
  B200: { tier: "Ultra", color: "violet", gradient: "from-violet-500 to-purple-600", icon: "⚡" },
  // Hopper
  H200: { tier: "Elite", color: "emerald", gradient: "from-emerald-400 to-teal-500", icon: "🔥" },
  H100: { tier: "Elite", color: "emerald", gradient: "from-emerald-400 to-teal-500", icon: "🔥" },
  // Ampere High
  A100: { tier: "Pro", color: "blue", gradient: "from-blue-400 to-cyan-500", icon: "💎" },
  "A100-40GB": { tier: "Pro", color: "blue", gradient: "from-blue-400 to-cyan-500", icon: "💎" },
  A40: { tier: "Pro", color: "blue", gradient: "from-blue-400 to-indigo-500", icon: "⚙️" },
  // Ada
  L40s: { tier: "Advanced", color: "amber", gradient: "from-amber-400 to-orange-500", icon: "✨" },
  L40: { tier: "Advanced", color: "amber", gradient: "from-amber-400 to-orange-500", icon: "✨" },
  L4: { tier: "Standard", color: "green", gradient: "from-green-400 to-emerald-500", icon: "🚀" },
  // Ampere Standard
  A10: { tier: "Standard", color: "sky", gradient: "from-sky-400 to-blue-500", icon: "🎯" },
  A10G: { tier: "Standard", color: "sky", gradient: "from-sky-400 to-blue-500", icon: "🎯" },
  A6000: { tier: "Advanced", color: "indigo", gradient: "from-indigo-400 to-purple-500", icon: "🔧" },
  A5000: { tier: "Standard", color: "indigo", gradient: "from-indigo-400 to-violet-500", icon: "🔧" },
  A4000: { tier: "Entry", color: "slate", gradient: "from-slate-400 to-zinc-500", icon: "📦" },
  A16: { tier: "Entry", color: "slate", gradient: "from-slate-400 to-zinc-500", icon: "📦" },
  // Others
  T4: { tier: "Budget", color: "zinc", gradient: "from-zinc-400 to-slate-500", icon: "💰" },
  V100: { tier: "Legacy", color: "rose", gradient: "from-rose-400 to-pink-500", icon: "🏛️" },
  P4: { tier: "Budget", color: "zinc", gradient: "from-zinc-500 to-gray-600", icon: "💡" },
  M60: { tier: "Legacy", color: "zinc", gradient: "from-zinc-500 to-gray-600", icon: "📜" },
  // RTX Ada
  "RTX Pro 6000": { tier: "Pro", color: "lime", gradient: "from-lime-400 to-green-500", icon: "🎨" },
  "RTX 6000 Ada": { tier: "Pro", color: "lime", gradient: "from-lime-400 to-green-500", icon: "🎨" },
  "RTX 4000 Ada": { tier: "Standard", color: "teal", gradient: "from-teal-400 to-cyan-500", icon: "🎨" },
};

function getGpuVisual(gpuName: string) {
  return GPU_TIER_VISUALS[gpuName] || { tier: "Unknown", color: "zinc", gradient: "from-zinc-400 to-zinc-500", icon: "🔲" };
}

function GpuSelectionCard({
  gpu,
  vram,
  gpuCount = 1,
  alternative,
  confidence,
  costNotes,
  isSelecting = false,
}: {
  gpu: string;
  vram?: number;
  gpuCount?: number;
  alternative?: string;
  confidence?: string;
  costNotes?: string;
  isSelecting?: boolean;
}) {
  const visual = getGpuVisual(gpu);
  const altVisual = alternative ? getGpuVisual(alternative) : null;

  return (
    <div className="space-y-3">
      {/* Main GPU Card */}
      <div className={`relative overflow-hidden rounded-xl border transition-all duration-500 ${
        isSelecting 
          ? "border-amber-500/30 bg-amber-500/5" 
          : "border-emerald-500/30 bg-emerald-500/5"
      }`}>
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${visual.gradient} opacity-10`} />
        
        {/* Content */}
        <div className="relative z-10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${visual.gradient} flex items-center justify-center shadow-lg`}>
                <span className="text-2xl">{visual.icon}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xl font-bold text-zinc-100">{gpu}</h4>
                  {gpuCount > 1 && (
                    <span className="text-sm text-zinc-400">× {gpuCount}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${visual.gradient} text-white font-medium`}>
                    {visual.tier}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">
                  {vram ? `${vram}GB VRAM` : "Loading specs..."}
                  {gpuCount > 1 && vram && ` (${vram * gpuCount}GB total)`}
                </p>
              </div>
            </div>
            
            {/* Confidence badge */}
            {confidence && (
              <div className={`px-3 py-1.5 rounded-lg ${
                confidence === "High" 
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                  : confidence === "Medium"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}>
                <p className="text-xs font-medium">{confidence} Confidence</p>
              </div>
            )}
            
            {isSelecting && (
              <div className="flex items-center gap-2 text-amber-400">
                <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <span className="text-sm">Selecting...</span>
              </div>
            )}
          </div>
        </div>

        {/* Animated border for selecting state */}
        {isSelecting && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800 overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${visual.gradient}`}
              style={{ 
                width: "50%",
                animation: "slide 1.5s ease-in-out infinite",
              }}
            />
          </div>
        )}
      </div>

      {/* Alternative GPU */}
      {alternative && altVisual && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50">
          <span className="text-lg">{altVisual.icon}</span>
          <div className="flex-1">
            <p className="text-xs text-zinc-500">Alternative (if unavailable)</p>
            <p className="text-sm font-medium text-zinc-300">{alternative}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400`}>
            {altVisual.tier}
          </span>
        </div>
      )}

      {/* Cost notes */}
      {costNotes && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
          <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-zinc-400 leading-relaxed">{costNotes}</p>
        </div>
      )}

      <style jsx>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
