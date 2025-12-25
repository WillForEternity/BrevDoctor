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
  recommended_instance: z.string().describe("The name of the recommended GPU instance"),
  alternative_instance: z.string().optional().describe("An alternative GPU instance if available"),
  match_confidence: z.enum(["High", "Medium", "Low"]).describe("Confidence in the recommendation"),
  cost_optimization_notes: z.string().describe("Notes about cost optimization or potential savings"),
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
  
  // General
  error?: string;
}
