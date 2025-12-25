import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { SpecialistOutput, BrevInstance, MatchResult, BrokerOutput, GpuRetryDecision } from "@/types/agentSchemas";
import { BrokerOutputSchema, GpuRetryDecisionSchema } from "@/types/agentSchemas";
import { getGpuCatalogDescription, getGpuByName, BREV_GPU_CATALOG } from "@/lib/brev-api";

export interface BrokerResult extends MatchResult {
  brokerOutput: BrokerOutput;
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
  needs: SpecialistOutput
): Promise<BrokerOutput> {
  const gpuCatalog = getGpuCatalogDescription();

  const prompt = `You are a GPU Provisioning Expert for Brev.dev. Your job is to select the optimal GPU for the given compute requirements.

## COMPUTE REQUIREMENTS (from Specialist Analysis)
- **VRAM Needed**: ${needs.estimated_vram_gb}GB
- **Recommended Architecture**: ${needs.recommended_gpu_architecture}
- **Multi-GPU Required**: ${needs.requires_multi_gpu ? "Yes" : "No"}
- **Project Complexity**: ${needs.project_complexity}
- **CPU Cores Needed**: ${needs.recommended_cpu_cores}
- **System RAM Needed**: ${needs.recommended_system_ram_gb}GB
- **Disk Space Needed**: ${needs.estimated_disk_space_gb}GB

## SPECIALIST'S REASONING
${needs.complexity_reasoning}

${gpuCatalog}

## YOUR TASK
Select the BEST GPU for this workload. Consider:

1. **VRAM Sufficiency**: 
   - Total VRAM must meet or exceed requirement
   - For training: Add 20-30% headroom for optimizer states/activations
   - For inference: Can be closer to exact requirement

2. **Architecture Compatibility**:
   - "Any" → All architectures work
   - "Ampere" → A10G, A100, A40, or newer (Hopper, Ada)
   - "Ada" → L4, L40, L40s, RTX Ada series (or Hopper for compat)
   - "Hopper" → H100, H200 only (for Transformer Engine, FP8)

3. **Multi-GPU Considerations**:
   - If multi-GPU required, specify gpu_count >= 2
   - Consider if NVLink is needed (A100/H100 for training)

4. **Cost Optimization**:
   - Don't over-provision (80GB for 24GB workload is wasteful)
   - Consider cost per effective VRAM-hour
   - For short runs, faster GPUs may be cheaper overall

5. **Practical Recommendations**:
   - L4, T4: Great for inference, fine-tuning small models ($$$)
   - A10G, A10: Balanced for training/inference, good value ($$)
   - L40s, A40, A6000: Solid training with 48GB ($$$)
   - A100-40GB: Standard for training, when 24-48GB isn't enough ($$$$)
   - A100-80GB: Large models, when 40GB isn't enough ($$$$$)
   - H100: Fastest training, required for Hopper features ($$$$$$)
   - H200: Maximum VRAM for massive models ($$$$$$$)

## IMPORTANT
- Select a specific GPU name from the catalog
- If the primary choice might be out of stock, also provide an alternative
- Be practical about what's likely to be available

Provide your recommendation with confidence level.`;

  const { object: brokerOutput } = await generateObject({
    model: openai("gpt-4o"),
    schema: BrokerOutputSchema,
    prompt,
  });

  return brokerOutput;
}

/**
 * When a GPU provisioning fails (e.g., out of stock), ask the agent to decide
 * what GPU to try next.
 */
export async function decideGpuRetry(
  needs: SpecialistOutput,
  failedAttempts: Array<{ gpu: string; vram: number; gpuCount: number; error: string }>
): Promise<GpuRetryDecision> {
  const gpuCatalog = getGpuCatalogDescription();
  
  const failedAttemptsStr = failedAttempts
    .map((a, i) => `${i + 1}. ${a.gpu} (${a.vram}GB × ${a.gpuCount}) - Failed: ${a.error}`)
    .join("\n");

  const prompt = `You are a GPU Provisioning Expert for Brev.dev. A provisioning attempt has failed and you need to decide what to try next.

## COMPUTE REQUIREMENTS
- **VRAM Needed**: ${needs.estimated_vram_gb}GB
- **Recommended Architecture**: ${needs.recommended_gpu_architecture}
- **Multi-GPU Required**: ${needs.requires_multi_gpu ? "Yes" : "No"}
- **Project Complexity**: ${needs.project_complexity}

## FAILED PROVISIONING ATTEMPTS
${failedAttemptsStr}

${gpuCatalog}

## YOUR TASK
Based on the failed attempts, decide what GPU to try next:

1. **If the GPU was out of stock**: Try a similar GPU with comparable specs
   - If H100 failed, try A100-80GB or L40s
   - If A100 failed, try A40, L40s, or H100
   - If L4 failed, try T4 or A10G

2. **Consider alternatives that meet requirements**:
   - Same or more VRAM
   - Compatible architecture
   - Different GPU type that's more likely to be available

3. **Know when to stop**:
   - If 3+ different GPUs have failed, consider stopping
   - If no suitable alternatives exist, should_retry = false

Provide your decision with reasoning.`;

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
