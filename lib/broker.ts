import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { SpecialistOutput, BrevInstance, MatchResult, BrokerOutput, GpuRetryDecision } from "@/types/agentSchemas";
import { BrokerOutputSchema, GpuRetryDecisionSchema } from "@/types/agentSchemas";
import { getGpuCatalogDescription, getGpuByName, BREV_GPU_CATALOG } from "@/lib/brev-api";

export interface BrokerResult extends MatchResult {
  brokerOutput: BrokerOutput;
}

export interface BrokerContext {
  repoMeta?: { owner: string; repo: string; branch?: string };
  scoutOutput?: { reasoning: string; selected_paths: string[] };
  totalFilesInRepo?: number;
}

/**
 * LLM-powered GPU instance selector.
 * Uses AI reasoning to select the optimal GPU configuration based on:
 * - Compute requirements from Specialist
 * - Complete Brev GPU catalog with specs
 * - Cost optimization
 * - Architecture compatibility
 * 
 * The agent is given the full list of available GPUs and makes an informed decision.
 */
export async function selectGpuInstance(
  needs: SpecialistOutput,
  context?: BrokerContext
): Promise<BrokerOutput> {
  const gpuCatalog = getGpuCatalogDescription();

  // Build context sections
  let repoContextSection = "";
  if (context?.repoMeta) {
    repoContextSection = `
## REPOSITORY CONTEXT
- **Repository**: ${context.repoMeta.owner}/${context.repoMeta.repo}
- **Branch**: ${context.repoMeta.branch || "main"}
- **Total Files in Repo**: ${context.totalFilesInRepo || "Unknown"}
`;
  }

  let scoutContextSection = "";
  if (context?.scoutOutput) {
    scoutContextSection = `
## SCOUT AI'S ANALYSIS
The Scout AI identified these as the most relevant files for compute analysis:
${context.scoutOutput.selected_paths.map(p => `- ${p}`).join('\n')}

**Scout's reasoning**: ${context.scoutOutput.reasoning}
`;
  }

  const prompt = `You are a Strategic Infrastructure Advisor for Brev.dev.
        
## MISSION
Select the GPU that guarantees **success** and **stability** for the user's project, while optimizing cost *only if safe to do so*.
${repoContextSection}${scoutContextSection}
## SPECIALIST'S COMPUTE ANALYSIS
The Specialist analyzed the code and determined:

**Full Analysis Thinking:**
${needs.thinking}

**Key Findings:**
- **Estimated VRAM Needed**: ${needs.estimated_vram_gb}GB
- **Recommended Architecture**: ${needs.recommended_gpu_architecture}
- **Multi-GPU Required**: ${needs.requires_multi_gpu ? "Yes" : "No"}
- **Project Complexity**: ${needs.project_complexity}
- **Complexity Reasoning**: ${needs.complexity_reasoning}
- **Recommended CPU Cores**: ${needs.recommended_cpu_cores}
- **Recommended System RAM**: ${needs.recommended_system_ram_gb}GB
- **Estimated Disk Space**: ${needs.estimated_disk_space_gb}GB
- **Setup Commands**: ${needs.setup_commands.length > 0 ? needs.setup_commands.join(', ') : 'None specified'}

${gpuCatalog}

## SELECTION LOGIC
1. **Safety First**: 
   - If Complexity is "High" or "Enterprise", prefer A100/H100/L40s. Do not recommend consumer-tier cards (T4) for heavy training.
   - If VRAM requirement is borderline (e.g. 22GB req for 24GB card), **upsize** to the next tier (40GB+) to prevent OOM.
   
2. **Architecture Matching**:
   - "Hopper" req -> H100 (or H200).
   - "Ampere" req -> A100, A10, A6000, A40.
   - "Ada" req -> L4, L40s.

3. **Availability Heuristic**:
   - L4 and A10G are often most available.
   - H100 is scarce. If H100 is ideal but overkill, suggest A100.

4. **Cost/Performance**:
   - For "Low/Medium" complexity: L4 or A10G are best value.
   - For "High" complexity: A100-80GB is often more cost-effective than crashing 5 times on an A10.

Make your selection based on the complete analysis chain above. Reference specific findings from the Specialist's analysis in your reasoning.`;

  const { object: brokerOutput } = await generateObject({
    model: openai("gpt-4o"),
    schema: BrokerOutputSchema,
    prompt,
  });

  return brokerOutput;
}

export interface GpuRetryContext {
  repoMeta?: { owner: string; repo: string; branch?: string };
  scoutReasoning?: string;
  selectedFiles?: string[];
}

/**
 * When a GPU provisioning fails (e.g., out of stock), ask the agent to decide
 * what GPU to try next.
 */
export async function decideGpuRetry(
  needs: SpecialistOutput,
  failedAttempts: Array<{ gpu: string; vram: number; gpuCount: number; error: string }>,
  context?: GpuRetryContext
): Promise<GpuRetryDecision> {
  const gpuCatalog = getGpuCatalogDescription();
  
  const failedAttemptsStr = failedAttempts
    .map((a, i) => `${i + 1}. ${a.gpu} (${a.vram}GB × ${a.gpuCount}) - Failed: ${a.error}`)
    .join("\n");

  let repoContextSection = "";
  if (context?.repoMeta) {
    repoContextSection = `
## REPOSITORY CONTEXT
- **Repository**: ${context.repoMeta.owner}/${context.repoMeta.repo}
- **Branch**: ${context.repoMeta.branch || "main"}
`;
  }

  let scoutContextSection = "";
  if (context?.scoutReasoning) {
    scoutContextSection = `
## SCOUT'S FILE SELECTION
${context.selectedFiles?.map(p => `- ${p}`).join('\n') || 'No files listed'}

**Scout's reasoning**: ${context.scoutReasoning}
`;
  }

  const prompt = `You are a Strategic Infrastructure Advisor for Brev.dev. A provisioning attempt has failed.

## MISSION
Find a viable alternative GPU that preserves project success. **Do not downgrade capabilities** if the project is complex.
${repoContextSection}${scoutContextSection}
## SPECIALIST'S FULL ANALYSIS
The Specialist thoroughly analyzed this project and determined:

**Detailed Thinking:**
${needs.thinking}

**Computed Requirements:**
- **Required VRAM**: ${needs.estimated_vram_gb}GB
- **Architecture**: ${needs.recommended_gpu_architecture}
- **Complexity**: ${needs.project_complexity}
- **Complexity Reasoning**: ${needs.complexity_reasoning}
- **Multi-GPU Required**: ${needs.requires_multi_gpu ? "Yes" : "No"}
- **CPU Cores**: ${needs.recommended_cpu_cores}
- **System RAM**: ${needs.recommended_system_ram_gb}GB
- **Disk Space**: ${needs.estimated_disk_space_gb}GB

## FAILED PROVISIONING ATTEMPTS
${failedAttemptsStr}

${gpuCatalog}

## RETRY LOGIC
1. **Out of Stock?**
   - If H100 OOS -> Try A100-80GB (closest equivalent).
   - If A100 OOS -> Try L40s or Multi-GPU A10g/L4.
   - If L4 OOS -> Try A10g or T4.

2. **Avoid Death Spirals**:
   - If a high-end card failed, do NOT fallback to a low-end card (e.g. H100 -> T4) just to get *something*. That will just crash the user's job.
   - Prefer **Multi-GPU** of cheaper cards over a single weak card. (e.g. 2x L40s > 1x A100 if A100 is OOS).
   - Reference the Specialist's thinking above to understand *why* the VRAM/complexity requirements exist.

3. **Termination**:
   - If 3+ tiers have failed, stop.
   - If no valid alternative exists (e.g. need 80GB and A100/H100/H200 all failed), stop.

Provide your decision with reasoning, referencing the Specialist's analysis where relevant.`;

  const { object: retryDecision } = await generateObject({
    model: openai("gpt-4o"),
    schema: GpuRetryDecisionSchema,
    prompt,
  });

  return retryDecision;
}

/**
 * Convert BrokerOutput to BrevInstance for compatibility with existing code
 */
export function brokerOutputToInstance(output: BrokerOutput): BrevInstance | null {
  const gpu = getGpuByName(output.recommended_gpu);
  if (!gpu) return null;

  return {
    ...gpu,
    count: output.gpu_count,
    vram: output.recommended_vram || gpu.vram,
  };
}

/**
 * Legacy function for backwards compatibility - uses rule-based matching
 */
export function findBestInstance(
  needs: SpecialistOutput,
  inventory: BrevInstance[]
): MatchResult {
  const ARCH_COMPATIBILITY: Record<string, string[]> = {
    Any: ["Blackwell", "Hopper", "Ada", "Ampere", "Turing", "Volta", "Pascal", "Maxwell"],
    Ampere: ["Ampere", "Hopper", "Ada", "Blackwell"],
    Hopper: ["Hopper", "Blackwell"],
    Ada: ["Ada", "Hopper", "Blackwell"],
  };

  const requiredArch = needs.recommended_gpu_architecture;
  const compatibleArchs = ARCH_COMPATIBILITY[requiredArch] || ARCH_COMPATIBILITY.Any;

  const suitable = inventory
    .filter((instance) => {
      const totalVram = instance.vram * instance.count;
      if (totalVram < needs.estimated_vram_gb) return false;
      if (needs.requires_multi_gpu && instance.count < 2) return false;
      if (!compatibleArchs.includes(instance.arch)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;
      return a.vram * a.count - b.vram * b.count;
    });

  return {
    best: suitable[0] || null,
    second_best: suitable[1] || null,
  };
}

export function generateRecommendationSummary(
  needs: SpecialistOutput,
  match: MatchResult
): string {
  if (!match.best) {
    return `No suitable GPU instance found in Brev.dev inventory for ${needs.estimated_vram_gb}GB VRAM requirement with ${needs.recommended_gpu_architecture} architecture.\n\nConsider checking console.brev.dev for custom configurations or adjusting your requirements.`;
  }

  const totalVram = match.best.vram * match.best.count;
  let summary = `**Recommended from Brev.dev:** ${match.best.name}\n`;
  summary += `- VRAM: ${match.best.vram}GB${match.best.count > 1 ? ` × ${match.best.count} GPUs = ${totalVram}GB total` : ""}\n`;
  summary += `- Architecture: ${match.best.arch}\n`;
  summary += `- Price: $${match.best.price.toFixed(2)}/hr\n\n`;
  summary += `**Your Requirements:**\n`;
  summary += `- Estimated VRAM: ${needs.estimated_vram_gb}GB\n`;
  summary += `- Architecture: ${needs.recommended_gpu_architecture}\n`;
  summary += `- Multi-GPU: ${needs.requires_multi_gpu ? "Yes" : "No"}\n`;

  if (match.second_best) {
    const altTotal = match.second_best.vram * match.second_best.count;
    summary += `\n**Alternative from Brev.dev:** ${match.second_best.name} (${altTotal}GB, $${match.second_best.price.toFixed(2)}/hr)`;
  }

  return summary;
}

/**
 * Match GPU from broker output, with support for provisioning retries
 */
export async function matchGpuWithRetry(
  needs: SpecialistOutput,
  maxRetries: number = 3,
  onAttempt?: (attempt: { gpu: string; vram: number; gpuCount: number; attemptNumber: number }) => void,
  onFailure?: (failure: { gpu: string; error: string; willRetry: boolean }) => void
): Promise<{
  success: boolean;
  brokerOutput: BrokerOutput;
  finalGpu?: BrevInstance;
  attempts: Array<{ gpu: string; vram: number; gpuCount: number; success: boolean; error?: string }>;
}> {
  const attempts: Array<{ gpu: string; vram: number; gpuCount: number; success: boolean; error?: string }> = [];
  
  // Get initial recommendation from the broker
  let currentBrokerOutput = await selectGpuInstance(needs);
  
  for (let i = 0; i < maxRetries; i++) {
    const gpu = currentBrokerOutput.recommended_gpu;
    const vram = currentBrokerOutput.recommended_vram;
    const gpuCount = currentBrokerOutput.gpu_count;
    
    onAttempt?.({ gpu, vram, gpuCount, attemptNumber: i + 1 });
    
    // For now, we simulate the provisioning attempt
    // In the actual implementation, this would call attemptGpuProvisioning
    // and check if the GPU is available
    
    // Since we can't actually provision here (this is the broker logic),
    // we return the recommendation and let the caller handle provisioning
    const instance = brokerOutputToInstance(currentBrokerOutput);
    
    if (instance) {
      attempts.push({ gpu, vram, gpuCount, success: true });
      return {
        success: true,
        brokerOutput: currentBrokerOutput,
        finalGpu: instance,
        attempts,
      };
    }
    
    // If we couldn't find the GPU in catalog, it's an invalid config
    const error = `GPU ${gpu} not found in catalog`;
    attempts.push({ gpu, vram, gpuCount, success: false, error });
    
    onFailure?.({ gpu, error, willRetry: i < maxRetries - 1 });
    
    if (i < maxRetries - 1) {
      // Ask the agent to decide what to try next
      const retryDecision = await decideGpuRetry(needs, attempts.map(a => ({
        ...a,
        error: a.error || "Unknown error",
      })));
      
      if (!retryDecision.should_retry || !retryDecision.next_gpu) {
        break;
      }
      
      // Update for next iteration
      currentBrokerOutput = {
        ...currentBrokerOutput,
        recommended_gpu: retryDecision.next_gpu,
        recommended_vram: retryDecision.next_vram || currentBrokerOutput.recommended_vram,
        gpu_count: retryDecision.next_gpu_count || currentBrokerOutput.gpu_count,
      };
    }
  }
  
  return {
    success: false,
    brokerOutput: currentBrokerOutput,
    attempts,
  };
}
