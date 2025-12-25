"use client";

import { useState, useEffect, useRef } from "react";
import type { AgentStep } from "@/types/agentSchemas";

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
    brokerAlternativeInstance?: string | null;
    brokerConfidence?: string | null;
    brokerCostNotes?: string | null;
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
    const icons: Record<string, string> = {
      auth: "🔐",
      scan: "📂",
      scout: "🔍",
      fetch: "📄",
      analyze: "🧠",
      match: "🎯",
    };
    return icons[step.id] || "⚡";
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                ? "bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/40 shadow-lg shadow-violet-500/10"
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
                  <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
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
                    step.status === "running" ? "text-violet-300" :
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
                <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 animate-pulse" style={{ width: "100%" }} />
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
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            Scout AI Thinking...
          </h4>
          <div
            ref={thinkingRef}
            className="bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-violet-500/20 rounded-lg p-4 max-h-48 overflow-y-auto"
          >
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {streamingData.scoutReasoning || (
                <span className="text-zinc-500 italic">Analyzing file structure...</span>
              )}
              <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-1" />
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
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Specialist Deep Analysis...
          </h4>
          <div
            ref={thinkingRef}
            className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-lg p-4 max-h-64 overflow-y-auto"
          >
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">
              {streamingData.specialistThinking || (
                <span className="text-zinc-500 italic">Analyzing model architecture, dependencies, and compute requirements...</span>
              )}
              <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse ml-1" />
            </p>
          </div>
        </div>

        {/* Complexity Badge */}
        {streamingData.specialistComplexity && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Complexity:</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              streamingData.specialistComplexity === "Enterprise" ? "bg-purple-500 text-white" :
              streamingData.specialistComplexity === "High" ? "bg-red-500 text-white" :
              streamingData.specialistComplexity === "Medium" ? "bg-amber-500 text-zinc-900" :
              "bg-emerald-500 text-zinc-900"
            }`}>
              {streamingData.specialistComplexity}
            </span>
          </div>
        )}

        {/* Live metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">VRAM</p>
            <p className={`text-lg font-semibold ${streamingData.specialistVram ? "text-amber-400" : "text-zinc-600"}`}>
              {streamingData.specialistVram ? `${streamingData.specialistVram}GB` : "..."}
            </p>
          </div>
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">Architecture</p>
            <p className={`text-lg font-semibold ${streamingData.specialistArch ? "text-cyan-400" : "text-zinc-600"}`}>
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
    return (
      <div className="mt-4 space-y-4">
        {/* Broker Thinking Stream */}
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Broker Evaluating GPU Options...
          </h4>
          <div
            ref={thinkingRef}
            className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-lg p-4 max-h-64 overflow-y-auto"
          >
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {streamingData.brokerThinking || (
                <span className="text-zinc-500 italic">Analyzing inventory and matching to requirements...</span>
              )}
              <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1" />
            </p>
          </div>
        </div>

        {/* Live recommendation */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">Recommended</p>
            <p className={`text-lg font-semibold ${streamingData.brokerRecommendedInstance ? "text-emerald-400" : "text-zinc-600"}`}>
              {streamingData.brokerRecommendedInstance || "Evaluating..."}
            </p>
          </div>
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">Alternative</p>
            <p className={`text-lg font-semibold ${streamingData.brokerAlternativeInstance ? "text-zinc-300" : "text-zinc-600"}`}>
              {streamingData.brokerAlternativeInstance || "—"}
            </p>
          </div>
          <div className="bg-zinc-950 rounded-lg p-3 col-span-2">
            <p className="text-xs text-zinc-500 mb-1">Confidence</p>
            <p className={`text-lg font-semibold ${
              streamingData.brokerConfidence === "High" ? "text-emerald-400" :
              streamingData.brokerConfidence === "Medium" ? "text-amber-400" :
              streamingData.brokerConfidence === "Low" ? "text-red-400" :
              "text-zinc-600"
            }`}>
              {streamingData.brokerConfidence || "Calculating..."}
            </p>
          </div>
        </div>

        {streamingData.brokerCostNotes && (
          <div className="bg-zinc-950 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">💰 Cost Optimization</p>
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
        <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
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
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            <span className="mr-2">🤔</span>Scout AI Reasoning
          </h4>
          <div className="bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-violet-500/20 rounded-lg p-4">
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
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            <span className="mr-2">💭</span>Specialist Thinking Process
          </h4>
          <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-lg p-4 max-h-64 overflow-y-auto">
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">{data.specialistThinkingStream}</p>
          </div>
        </div>
      )}

      {/* Compute analysis */}
      {data.computeAnalysis && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            <span className="mr-2">🧠</span>Specialist Analysis
          </h4>
          
          {/* Complexity Assessment */}
          {data.computeAnalysis.complexity && (
             <div className="mb-3 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-lg p-3">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-xs text-zinc-400 font-medium uppercase">Project Complexity</span>
                 <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    data.computeAnalysis.complexity === "Enterprise" ? "bg-purple-500 text-white" :
                    data.computeAnalysis.complexity === "High" ? "bg-red-500 text-white" :
                    data.computeAnalysis.complexity === "Medium" ? "bg-amber-500 text-zinc-900" :
                    "bg-emerald-500 text-zinc-900"
                 }`}>
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
              <p className="text-lg font-semibold text-amber-400">{data.computeAnalysis.estimatedVram}GB</p>
            </div>
            <div className="bg-zinc-950 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">Architecture</p>
              <p className="text-lg font-semibold text-cyan-400">{data.computeAnalysis.architecture}</p>
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
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            <span className="mr-2">💭</span>Broker Reasoning
          </h4>
          <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-lg p-4 max-h-64 overflow-y-auto">
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
              <p className={`text-lg font-semibold ${
                data.matchConfidence === "High" ? "text-emerald-400" :
                data.matchConfidence === "Medium" ? "text-amber-400" :
                "text-red-400"
              }`}>{data.matchConfidence}</p>
            </div>
          )}
          {data.costNotes && (
            <div className="bg-zinc-950 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">💰 Cost Notes</p>
              <p className="text-sm text-zinc-300">{data.costNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Legacy match reasoning (fallback) */}
      {data.matchReasoning && !data.brokerThinking && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            <span className="mr-2">🎯</span>GPU Matching Logic
          </h4>
          <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-lg p-4">
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
