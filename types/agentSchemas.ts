import { z } from "zod";

export const ScoutOutputSchema = z.object({
  selected_paths: z.array(z.string()).max(10),
  reasoning: z.string(),
});

export const SpecialistOutputSchema = z.object({
  thinking: z.string().describe("Step-by-step analysis of the codebase. Walk through each file, identify model architecture, estimate parameters, calculate memory requirements. Show your work."),
  estimated_vram_gb: z.number(),
  recommended_gpu_architecture: z.enum(["Any", "Ampere", "Hopper", "Ada"]),
  requires_multi_gpu: z.boolean(),
  setup_commands: z.array(z.string()),
  project_complexity: z.enum(["Low", "Medium", "High", "Enterprise"]),
  complexity_reasoning: z.string(),
  recommended_cpu_cores: z.number(),
  recommended_system_ram_gb: z.number(),
  estimated_disk_space_gb: z.number(),
});

export const BrokerOutputSchema = z.object({
  thinking: z.string().describe("Detailed reasoning about which GPU instance to recommend. Consider VRAM requirements, architecture compatibility, cost efficiency, and whether the instance meets the project's needs."),
  recommended_gpu: z.string().describe("The name of the recommended GPU (e.g., 'H100', 'A100', 'L4')"),
  recommended_vram: z.number().describe("The recommended VRAM in GB for this GPU"),
  gpu_count: z.number().describe("Number of GPUs recommended (1, 2, 4, or 8)"),
  alternative_gpu: z.string().describe("An alternative GPU if the primary isn't available. Use 'none' if no alternative."),
  alternative_vram: z.number().describe("Alternative GPU VRAM in GB. Use 0 if no alternative."),
  match_confidence: z.enum(["High", "Medium", "Low"]).describe("Confidence in the recommendation"),
  cost_optimization_notes: z.string().describe("Notes about cost optimization or potential savings"),
});

export const GpuProvisioningResultSchema = z.object({
  success: z.boolean(),
  gpu_name: z.string(),
  vram: z.number(),
  gpu_count: z.number(),
  workspace_name: z.string().optional(),
  error: z.string().optional(),
  error_type: z.enum(["out_of_stock", "auth_error", "invalid_config", "unknown"]).optional(),
  suggestion: z.string().optional(),
});

export const GpuRetryDecisionSchema = z.object({
  thinking: z.string().describe("Reasoning about what GPU to try next given the previous failure"),
  should_retry: z.boolean().describe("Whether to attempt another GPU"),
  next_gpu: z.string().optional().describe("The next GPU to try"),
  next_vram: z.number().optional().describe("VRAM for the next GPU to try"),
  next_gpu_count: z.number().optional().describe("Number of GPUs to try"),
  fallback_reason: z.string().optional().describe("Why this fallback was chosen"),
});

export const BrevInstanceSchema = z.object({
  name: z.string(),
  vram: z.number(),
  count: z.number(),
  arch: z.string(),
  price: z.number(),
});

export type ScoutOutput = z.infer<typeof ScoutOutputSchema>;
export type SpecialistOutput = z.infer<typeof SpecialistOutputSchema>;
export type BrevInstance = z.infer<typeof BrevInstanceSchema>;
export type BrokerOutput = z.infer<typeof BrokerOutputSchema>;
export type GpuProvisioningResult = z.infer<typeof GpuProvisioningResultSchema>;
export type GpuRetryDecision = z.infer<typeof GpuRetryDecisionSchema>;

export interface RepoMeta {
  owner: string;
  repo: string;
  branch?: string;
}

export interface MatchResult {
  best: BrevInstance | null;
  second_best: BrevInstance | null;
}

// Agent visualization types
export interface AgentStep {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  startTime?: number;
  endTime?: number;
  data?: AgentStepData;
}

export interface AgentStepData {
  // Repository scanning
  totalFiles?: number;
  fileTree?: string[];
  
  // Scout AI
  scoutReasoning?: string;
  selectedFiles?: string[];
  
  // File contents
  fileContents?: Record<string, string>;
  
  // Specialist analysis
  specialistThinking?: string;
  computeAnalysis?: {
    estimatedVram: number;
    architecture: string;
    multiGpu: boolean;
    setupCommands: string[];
    complexity?: string;
    complexityReasoning?: string;
    cpuCores?: number;
    systemRam?: number;
    diskSpace?: number;
  };
  
  // Specialist thinking
  specialistThinkingStream?: string;
  
  // Broker matching
  inventoryChecked?: number;
  matchReasoning?: string;
  brokerThinking?: string;
  matchConfidence?: string;
  costNotes?: string;
  
  // GPU provisioning
  provisioningAttempts?: Array<{
    gpu: string;
    vram: number;
    gpuCount: number;
    success: boolean;
    error?: string;
    errorType?: string;
  }>;
  provisionedWorkspace?: string;
  
  // General
  error?: string;
}
