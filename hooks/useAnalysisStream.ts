"use client";

import { useState, useCallback } from "react";
import type { RepoMeta, AgentStep, MatchResult, SpecialistOutput } from "@/types/agentSchemas";

export interface GpuProvisioningAttempt {
  gpu: string;
  vram: number;
  gpuCount: number;
  success: boolean;
  error?: string;
  errorType?: string;
}

export interface StreamingAnalysisState {
  isStreaming: boolean;
  agentSteps: AgentStep[];
  scoutReasoning: string;
  scoutSelectedFiles: string[];
  // Specialist streaming
  specialistThinking: string;
  specialistVram: number | null;
  specialistArch: string | null;
  specialistMultiGpu: boolean | null;
  specialistCommands: string[];
  specialistComplexity: string | null;
  specialistComplexityReasoning: string | null;
  specialistCpuCores: number | null;
  specialistSystemRam: number | null;
  specialistDiskSpace: number | null;
  // Broker streaming
  brokerThinking: string;
  brokerRecommendedInstance: string | null;
  brokerRecommendedVram: number | null;
  brokerRecommendedCount: number | null;
  brokerAlternativeInstance: string | null;
  brokerConfidence: string | null;
  brokerCostNotes: string | null;
  brokerStatus: "idle" | "starting" | "streaming" | "complete";
  brokerUpdateCount: number;
  // GPU Provisioning streaming
  isProvisioning: boolean;
  provisioningAttempt: {
    gpu: string;
    vram: number;
    gpuCount: number;
    attemptNumber: number;
  } | null;
  provisioningAttempts: GpuProvisioningAttempt[];
  retryDecision: {
    thinking: string;
    shouldRetry: boolean;
    nextGpu?: string;
    fallbackReason?: string;
  } | null;
  provisioningResult: {
    success: boolean;
    workspaceName?: string;
    gpu?: string;
    vram?: number;
    gpuCount?: number;
  } | null;
  // Final result
  result: {
    success: boolean;
    match?: MatchResult;
    needs?: SpecialistOutput;
    recommendation?: string;
  } | null;
  error: string | null;
}

const initialSteps: AgentStep[] = [
  { id: "auth", name: "Authenticating with GitHub", status: "running", startTime: Date.now() },
  { id: "scan", name: "Scanning repository structure", status: "pending" },
  { id: "scout", name: "Scout AI selecting key files", status: "pending" },
  { id: "fetch", name: "Fetching file contents", status: "pending" },
  { id: "analyze", name: "Specialist analyzing compute needs", status: "pending" },
  { id: "match", name: "Matching to GPU inventory", status: "pending" },
];

const initialState: StreamingAnalysisState = {
  isStreaming: false,
  agentSteps: [],
  scoutReasoning: "",
  scoutSelectedFiles: [],
  // Specialist
  specialistThinking: "",
  specialistVram: null,
  specialistArch: null,
  specialistMultiGpu: null,
  specialistCommands: [],
  specialistComplexity: null,
  specialistComplexityReasoning: null,
  specialistCpuCores: null,
  specialistSystemRam: null,
  specialistDiskSpace: null,
  // Broker
  brokerThinking: "",
  brokerRecommendedInstance: null,
  brokerRecommendedVram: null,
  brokerRecommendedCount: null,
  brokerAlternativeInstance: null,
  brokerConfidence: null,
  brokerCostNotes: null,
  brokerStatus: "idle",
  brokerUpdateCount: 0,
  // GPU Provisioning
  isProvisioning: false,
  provisioningAttempt: null,
  provisioningAttempts: [],
  retryDecision: null,
  provisioningResult: null,
  // Result
  result: null,
  error: null,
};

export function useAnalysisStream() {
  const [state, setState] = useState<StreamingAnalysisState>(initialState);

  const startAnalysis = useCallback(async (repoMeta: RepoMeta, userFeedback?: string, previousNeeds?: SpecialistOutput) => {
    // Reset state and initialize steps
    setState({
      ...initialState,
      isStreaming: true,
      agentSteps: initialSteps.map((s) => ({ ...s })),
    });

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoMeta, userFeedback, previousNeeds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: errorData.error || "Failed to start analysis",
        }));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: "No response stream available",
        }));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamEvent(data, setState);
            } catch (e) {
              console.error("Failed to parse stream data:", e);
            }
          }
        }
      }

      setState((prev) => ({ ...prev, isStreaming: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return { state, startAnalysis, reset };
}

function handleStreamEvent(
  data: Record<string, unknown>,
  setState: React.Dispatch<React.SetStateAction<StreamingAnalysisState>>
) {
  switch (data.type) {
    case "step_update":
      const stepUpdate = data.step as Partial<AgentStep> & { id: string };
      setState((prev) => ({
        ...prev,
        agentSteps: prev.agentSteps.map((s) =>
          s.id === stepUpdate.id
            ? {
                ...s,
                ...stepUpdate,
                data: stepUpdate.data ? { ...s.data, ...stepUpdate.data } : s.data,
              }
            : // If this step is complete, mark the next one as running
              stepUpdate.status === "complete" &&
              prev.agentSteps.findIndex((x) => x.id === stepUpdate.id) + 1 ===
                prev.agentSteps.findIndex((x) => x.id === s.id)
            ? { ...s, status: "running" as const, startTime: Date.now() }
            : s
        ),
      }));
      break;

    case "scout_stream":
      setState((prev) => ({
        ...prev,
        scoutReasoning: (data.reasoning as string) || prev.scoutReasoning,
        scoutSelectedFiles: (data.selectedFiles as string[]) || prev.scoutSelectedFiles,
      }));
      break;

    case "specialist_stream":
      setState((prev) => ({
        ...prev,
        specialistThinking: (data.thinking as string) ?? prev.specialistThinking,
        specialistVram: (data.estimatedVram as number) ?? prev.specialistVram,
        specialistArch: (data.architecture as string) ?? prev.specialistArch,
        specialistMultiGpu: (data.multiGpu as boolean) ?? prev.specialistMultiGpu,
        specialistCommands: (data.setupCommands as string[]) ?? prev.specialistCommands,
        specialistComplexity: (data.complexity as string) ?? prev.specialistComplexity,
        specialistComplexityReasoning: (data.complexityReasoning as string) ?? prev.specialistComplexityReasoning,
        specialistCpuCores: (data.cpuCores as number) ?? prev.specialistCpuCores,
        specialistSystemRam: (data.systemRam as number) ?? prev.specialistSystemRam,
        specialistDiskSpace: (data.diskSpace as number) ?? prev.specialistDiskSpace,
      }));
      break;

    case "broker_stream":
      setState((prev) => ({
        ...prev,
        brokerThinking: (data.thinking as string) ?? prev.brokerThinking,
        brokerRecommendedInstance: (data.recommendedGpu as string) ?? (data.recommendedInstance as string) ?? prev.brokerRecommendedInstance,
        brokerRecommendedVram: (data.recommendedVram as number) ?? prev.brokerRecommendedVram,
        brokerRecommendedCount: (data.gpuCount as number) ?? prev.brokerRecommendedCount,
        brokerAlternativeInstance: (data.alternativeGpu as string) ?? (data.alternativeInstance as string) ?? prev.brokerAlternativeInstance,
        brokerConfidence: (data.matchConfidence as string) ?? prev.brokerConfidence,
        brokerCostNotes: (data.costNotes as string) ?? prev.brokerCostNotes,
        brokerStatus: (data.status as "idle" | "starting" | "streaming" | "complete") ?? prev.brokerStatus,
        brokerUpdateCount: (data.updateCount as number) ?? prev.brokerUpdateCount,
      }));
      break;

    case "provisioning_attempt":
      setState((prev) => ({
        ...prev,
        isProvisioning: true,
        provisioningAttempt: {
          gpu: data.gpu as string,
          vram: data.vram as number,
          gpuCount: data.gpuCount as number,
          attemptNumber: data.attempt as number,
        },
      }));
      break;

    case "provisioning_failed":
      setState((prev) => ({
        ...prev,
        provisioningAttempts: [
          ...prev.provisioningAttempts,
          {
            gpu: data.gpu as string,
            vram: prev.provisioningAttempt?.vram || 0,
            gpuCount: prev.provisioningAttempt?.gpuCount || 1,
            success: false,
            error: data.error as string,
            errorType: data.errorType as string,
          },
        ],
        isProvisioning: data.willRetry as boolean,
      }));
      break;

    case "provisioning_success":
      setState((prev) => ({
        ...prev,
        isProvisioning: false,
        provisioningAttempts: [
          ...prev.provisioningAttempts,
          {
            gpu: data.gpu as string,
            vram: data.vram as number,
            gpuCount: data.gpuCount as number,
            success: true,
          },
        ],
        provisioningResult: {
          success: true,
          workspaceName: data.workspaceName as string,
          gpu: data.gpu as string,
          vram: data.vram as number,
          gpuCount: data.gpuCount as number,
        },
      }));
      break;

    case "retry_decision":
      setState((prev) => ({
        ...prev,
        retryDecision: {
          thinking: data.thinking as string,
          shouldRetry: data.shouldRetry as boolean,
          nextGpu: data.nextGpu as string | undefined,
          fallbackReason: data.fallbackReason as string | undefined,
        },
      }));
      break;

    case "complete":
      const result = data.result as StreamingAnalysisState["result"];
      setState((prev) => ({
        ...prev,
        result,
        isStreaming: false,
      }));
      break;

    case "error":
      setState((prev) => ({
        ...prev,
        error: data.error as string,
        isStreaming: false,
      }));
      break;
  }
}

