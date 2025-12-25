"use server";

import { auth } from "@/lib/auth";
import { scoutRepo } from "@/lib/scout";
import { analyzeComputeNeeds } from "@/lib/specialist";
import { getBrevInventory, getGpuByName, getGpuCatalogDescription, attemptGpuProvisioning } from "@/lib/brev-api";
import { findBestInstance, generateRecommendationSummary, selectGpuInstance, decideGpuRetry, brokerOutputToInstance } from "@/lib/broker";
import { createPR, getRepoTree, getMultipleFileContents } from "@/lib/github";
import type { RepoMeta, MatchResult, SpecialistOutput, BrevInstance, AgentStep, BrokerOutput } from "@/types/agentSchemas";

export interface AnalysisResult {
  success: boolean;
  recommendation?: string;
  match?: MatchResult;
  needs?: SpecialistOutput;
  brokerOutput?: BrokerOutput;
  error?: string;
  repoMeta?: RepoMeta;
  agentSteps: AgentStep[];
  feedbackHistory?: string[];
}

export interface LaunchableResult {
  success: boolean;
  prUrl?: string;
  recommendation?: string;
  match?: MatchResult;
  needs?: SpecialistOutput;
  error?: string;
  agentSteps: AgentStep[];
}

export interface ProvisioningResult {
  success: boolean;
  workspaceName?: string;
  gpu?: string;
  vram?: number;
  gpuCount?: number;
  attempts: Array<{
    gpu: string;
    vram: number;
    gpuCount: number;
    success: boolean;
    error?: string;
  }>;
  error?: string;
}

// Step 1: Analyze repository and get GPU recommendation (without creating PR)
export async function analyzeRepository(
  repoMeta: RepoMeta, 
  userFeedback?: string, 
  previousNeeds?: SpecialistOutput, 
  feedbackHistory?: string[]
): Promise<AnalysisResult> {
  const agentSteps: AgentStep[] = [
    { id: "auth", name: "Authenticating with GitHub", status: "pending" },
    { id: "scan", name: "Scanning repository structure", status: "pending" },
    { id: "scout", name: "Scout AI selecting key files", status: "pending" },
    { id: "fetch", name: "Fetching file contents", status: "pending" },
    { id: "analyze", name: "Specialist analyzing compute needs", status: "pending" },
    { id: "match", name: "Selecting optimal GPU from catalog", status: "pending" },
  ];

  const updateStep = (id: string, updates: Partial<AgentStep>) => {
    const step = agentSteps.find(s => s.id === id);
    if (step) {
      Object.assign(step, updates);
    }
  };

  try {
    // Step 1: Get session
    updateStep("auth", { status: "running", startTime: Date.now() });
    const session = await auth();
    
    if (!session?.accessToken) {
      updateStep("auth", { 
        status: "error", 
        endTime: Date.now(),
        data: { error: "Not authenticated" }
      });
      return {
        success: false,
        error: "Not authenticated. Please sign in with GitHub.",
        agentSteps,
      };
    }
    updateStep("auth", { status: "complete", endTime: Date.now() });

    // Step 2: Get repo file tree
    updateStep("scan", { status: "running", startTime: Date.now() });
    const fileTree = await getRepoTree(
      session.accessToken,
      repoMeta.owner,
      repoMeta.repo,
      repoMeta.branch || "main"
    );
    
    if (fileTree.length === 0) {
      updateStep("scan", { 
        status: "error", 
        endTime: Date.now(),
        data: { error: "Repository appears empty or inaccessible" }
      });
      return {
        success: false,
        error: "Repository appears to be empty or inaccessible.",
        agentSteps,
      };
    }
    
    updateStep("scan", { 
      status: "complete", 
      endTime: Date.now(),
      data: { 
        totalFiles: fileTree.length,
        fileTree: fileTree,
      }
    });

    // Step 3: Scout selects relevant files
    updateStep("scout", { status: "running", startTime: Date.now() });
    const scoutResult = await scoutRepo(fileTree);
    
    updateStep("scout", { 
      status: "complete", 
      endTime: Date.now(),
      data: {
        scoutReasoning: scoutResult.reasoning,
        selectedFiles: scoutResult.selected_paths,
      }
    });

    // Step 4: Fetch selected file contents
    updateStep("fetch", { status: "running", startTime: Date.now() });
    const fileContents = await getMultipleFileContents(
      session.accessToken,
      repoMeta.owner,
      repoMeta.repo,
      scoutResult.selected_paths,
      repoMeta.branch || "main"
    );
    
    updateStep("fetch", { 
      status: "complete", 
      endTime: Date.now(),
      data: {
        fileContents: fileContents,
      }
    });

    // Step 5: Specialist analyzes compute needs
    updateStep("analyze", { status: "running", startTime: Date.now() });
    const needs = await analyzeComputeNeeds(fileContents, userFeedback, previousNeeds);
    
    updateStep("analyze", { 
      status: "complete", 
      endTime: Date.now(),
      data: {
        computeAnalysis: {
          estimatedVram: needs.estimated_vram_gb,
          architecture: needs.recommended_gpu_architecture,
          multiGpu: needs.requires_multi_gpu,
          setupCommands: needs.setup_commands,
          complexity: needs.project_complexity,
          complexityReasoning: needs.complexity_reasoning,
          cpuCores: needs.recommended_cpu_cores,
          systemRam: needs.recommended_system_ram_gb,
          diskSpace: needs.estimated_disk_space_gb,
        }
      }
    });

    // Step 6: Broker selects optimal GPU using full catalog knowledge
    updateStep("match", { status: "running", startTime: Date.now() });
    
    // Use LLM-based selection with the complete GPU catalog
    const brokerOutput = await selectGpuInstance(needs);
    
    // Convert to BrevInstance for compatibility
    const recommendedInstance = getGpuByName(brokerOutput.recommended_gpu);
    const alternativeInstance = brokerOutput.alternative_gpu 
      ? getGpuByName(brokerOutput.alternative_gpu) 
      : null;

    const best = recommendedInstance ? {
      ...recommendedInstance,
      count: brokerOutput.gpu_count,
    } : null;

    const second_best = alternativeInstance ? {
      ...alternativeInstance,
      count: brokerOutput.gpu_count,
    } : null;
    
    const match: MatchResult = { best, second_best };
    
    // Generate recommendation summary
    let recommendation = brokerOutput.thinking;
    if (best) {
      recommendation += `\n\n**Selected GPU: ${best.name}${best.count > 1 ? ` × ${best.count}` : ''}**\n`;
      recommendation += `• VRAM: ${best.vram}GB${best.count > 1 ? ` × ${best.count} = ${best.vram * best.count}GB total` : ''}\n`;
      recommendation += `• Architecture: ${best.arch}\n`;
      recommendation += `• Price: $${best.price.toFixed(2)}/hour\n`;
      recommendation += `• Confidence: ${brokerOutput.match_confidence}\n`;
      if (brokerOutput.cost_optimization_notes) {
        recommendation += `\n**Cost Notes:** ${brokerOutput.cost_optimization_notes}`;
      }
      if (second_best) {
        recommendation += `\n\n**Alternative (if out of stock):** ${second_best.name} (${second_best.vram}GB)`;
      }
    }
    
    updateStep("match", { 
      status: "complete", 
      endTime: Date.now(),
      data: {
        inventoryChecked: getBrevInventory().length,
        matchReasoning: recommendation,
        brokerThinking: brokerOutput.thinking,
        matchConfidence: brokerOutput.match_confidence,
        costNotes: brokerOutput.cost_optimization_notes,
      }
    });

    if (!match.best) {
      return {
        success: false,
        error: "Could not find a suitable GPU instance for your requirements.",
        recommendation,
        needs,
        match,
        brokerOutput,
        agentSteps,
        feedbackHistory: feedbackHistory || [],
      };
    }

    return {
      success: true,
      recommendation,
      match,
      needs,
      brokerOutput,
      repoMeta,
      agentSteps,
      feedbackHistory: feedbackHistory || [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      error: errorMessage,
      agentSteps,
      feedbackHistory: feedbackHistory || [],
    };
  }
}

// Step 2: Attempt to provision the GPU (with retry logic)
export async function provisionGpu(
  needs: SpecialistOutput,
  brokerOutput: BrokerOutput
): Promise<ProvisioningResult> {
  const MAX_RETRIES = 3;
  const attempts: ProvisioningResult["attempts"] = [];
  
  let currentGpu = brokerOutput.recommended_gpu;
  let currentVram = brokerOutput.recommended_vram;
  let currentCount = brokerOutput.gpu_count;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await attemptGpuProvisioning(currentGpu, currentCount);
    
    attempts.push({
      gpu: currentGpu,
      vram: currentVram,
      gpuCount: currentCount,
      success: result.success,
      error: result.error,
    });
    
    if (result.success) {
      return {
        success: true,
        workspaceName: result.workspaceName,
        gpu: currentGpu,
        vram: currentVram,
        gpuCount: currentCount,
        attempts,
      };
    }
    
    // Only retry on out of stock errors
    if (result.errorType !== "out_of_stock" || attempt >= MAX_RETRIES - 1) {
      break;
    }
    
    // Ask the agent to decide what GPU to try next
    const retryDecision = await decideGpuRetry(
      needs,
      attempts.map(a => ({
        gpu: a.gpu,
        vram: a.vram,
        gpuCount: a.gpuCount,
        error: a.error || "Unknown error",
      }))
    );
    
    if (!retryDecision.should_retry || !retryDecision.next_gpu) {
      break;
    }
    
    // Update for next attempt
    currentGpu = retryDecision.next_gpu;
    currentVram = retryDecision.next_vram || currentVram;
    currentCount = retryDecision.next_gpu_count || currentCount;
  }
  
  return {
    success: false,
    attempts,
    error: `Failed to provision GPU after ${attempts.length} attempts`,
  };
}

// Step 3: Create PR after user confirms the recommendation
export async function confirmAndCreatePR(
  repoMeta: RepoMeta,
  needs: SpecialistOutput,
  selectedInstance: BrevInstance
): Promise<LaunchableResult> {
  const agentSteps: AgentStep[] = [
    { id: "pr", name: "Creating pull request", status: "pending" },
  ];

  try {
    agentSteps[0].status = "running";
    agentSteps[0].startTime = Date.now();
    
    const session = await auth();
    
    if (!session?.accessToken) {
      agentSteps[0].status = "error";
      agentSteps[0].endTime = Date.now();
      return {
        success: false,
        error: "Not authenticated. Please sign in with GitHub.",
        agentSteps,
      };
    }

    const setupScript = generateSetupScript(needs);
    const brevYaml = generateBrevYaml(selectedInstance, needs);

    const prUrl = await createPR({
      accessToken: session.accessToken,
      owner: repoMeta.owner,
      repo: repoMeta.repo,
      baseBranch: repoMeta.branch || "main",
      files: [
        { path: ".brev/setup.sh", content: setupScript },
        { path: "brev-launchable.yaml", content: brevYaml },
      ],
    });
    
    agentSteps[0].status = "complete";
    agentSteps[0].endTime = Date.now();

    return {
      success: true,
      prUrl,
      needs,
      agentSteps,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    agentSteps[0].status = "error";
    agentSteps[0].endTime = Date.now();
    return {
      success: false,
      error: errorMessage,
      agentSteps,
    };
  }
}

// Legacy function - kept for backward compatibility
export async function createLaunchable(repoMeta: RepoMeta): Promise<LaunchableResult> {
  const analysis = await analyzeRepository(repoMeta);
  
  if (!analysis.success || !analysis.match?.best || !analysis.needs) {
    return {
      success: false,
      error: analysis.error,
      recommendation: analysis.recommendation,
      match: analysis.match,
      needs: analysis.needs,
      agentSteps: analysis.agentSteps,
    };
  }

  const prResult = await confirmAndCreatePR(repoMeta, analysis.needs, analysis.match.best);
  
  return {
    ...prResult,
    recommendation: analysis.recommendation,
    match: analysis.match,
    agentSteps: [...analysis.agentSteps, ...prResult.agentSteps],
  };
}

function generateSetupScript(needs: SpecialistOutput): string {
  const commands = [
    "#!/bin/bash",
    "set -e",
    "",
    "# Brev Doctor Auto-Generated Setup Script",
    `# Generated: ${new Date().toISOString()}`,
    "",
    "echo '🚀 Setting up Brev environment...'",
    "",
    ...needs.setup_commands.map((cmd) => cmd),
    "",
    "echo '✅ Setup complete!'",
  ];

  return commands.join("\n");
}

function generateBrevYaml(
  instance: BrevInstance,
  needs: SpecialistOutput
): string {
  return `# Brev.dev Launchable Configuration
# Generated by Brev Doctor

name: brev-launchable
version: "1.0"

compute:
  gpu: ${instance.name}
  gpuCount: ${instance.count}
  vram: ${instance.vram}GB
  architecture: ${instance.arch}
  
requirements:
  estimatedVram: ${needs.estimated_vram_gb}GB
  cpuCores: ${needs.recommended_cpu_cores}
  systemRam: ${needs.recommended_system_ram_gb}GB
  diskSpace: ${needs.estimated_disk_space_gb}GB

setup:
  script: .brev/setup.sh

# Launch this environment at https://brev.dev
`;
}
