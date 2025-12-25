"use server";

import { auth } from "@/lib/auth";
import { scoutRepo } from "@/lib/scout";
import { analyzeComputeNeeds } from "@/lib/specialist";
import { getBrevInventory } from "@/lib/brev-api";
import { findBestInstance, generateRecommendationSummary } from "@/lib/broker";
import { createPR, getRepoTree, getMultipleFileContents } from "@/lib/github";
import type { RepoMeta, MatchResult, SpecialistOutput, BrevInstance, AgentStep } from "@/types/agentSchemas";

export interface AnalysisResult {
  success: boolean;
  recommendation?: string;
  match?: MatchResult;
  needs?: SpecialistOutput;
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

// Step 1: Analyze repository and get GPU recommendation (without creating PR)
export async function analyzeRepository(repoMeta: RepoMeta, userFeedback?: string, previousNeeds?: SpecialistOutput, feedbackHistory?: string[]): Promise<AnalysisResult> {
  const agentSteps: AgentStep[] = [
    { id: "auth", name: "Authenticating with GitHub", status: "pending" },
    { id: "scan", name: "Scanning repository structure", status: "pending" },
    { id: "scout", name: "Scout AI selecting key files", status: "pending" },
    { id: "fetch", name: "Fetching file contents", status: "pending" },
    { id: "analyze", name: "Specialist analyzing compute needs", status: "pending" },
    { id: "match", name: "Matching to GPU inventory", status: "pending" },
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
        }
      }
    });

    // Step 6: Broker finds best GPU match
    updateStep("match", { status: "running", startTime: Date.now() });
    const inventory = await getBrevInventory();
    const match = findBestInstance(needs, inventory);
    const recommendation = generateRecommendationSummary(needs, match);
    
    const matchReasoning = match.best 
      ? `Searched Brev.dev inventory (${inventory.length} GPU configurations available).\n\nSelected: ${match.best.name}\n• VRAM: ${match.best.vram}GB${match.best.count > 1 ? ` × ${match.best.count} GPUs = ${match.best.vram * match.best.count}GB total` : ""}\n• Architecture: ${match.best.arch}\n• Price: $${match.best.price.toFixed(2)}/hour\n\nThis GPU meets your ${needs.estimated_vram_gb}GB VRAM requirement and supports the ${needs.recommended_gpu_architecture} architecture needed for your workload.${match.second_best ? `\n\nAlternative: ${match.second_best.name} (${match.second_best.vram}GB, $${match.second_best.price.toFixed(2)}/hr)` : ''}`
      : `Searched Brev.dev inventory (${inventory.length} GPU configurations) but could not find a suitable match for ${needs.estimated_vram_gb}GB VRAM requirement with ${needs.recommended_gpu_architecture} architecture.`;
    
    updateStep("match", { 
      status: "complete", 
      endTime: Date.now(),
      data: {
        inventoryChecked: inventory.length,
        matchReasoning: matchReasoning,
      }
    });

    if (!match.best) {
      return {
        success: false,
        error: "Could not find a suitable GPU instance for your requirements.",
        recommendation,
        needs,
        match,
        agentSteps,
        feedbackHistory: feedbackHistory || [],
      };
    }

    return {
      success: true,
      recommendation,
      match,
      needs,
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

// Step 2: Create PR after user confirms the recommendation
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
  
environment:
  architecture: ${needs.recommended_gpu_architecture}
  estimatedVram: ${needs.estimated_vram_gb}GB

setup:
  script: .brev/setup.sh

# Launch this environment at https://brev.dev
`;
}
