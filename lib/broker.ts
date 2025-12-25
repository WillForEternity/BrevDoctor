import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { SpecialistOutput, BrevInstance, MatchResult, BrokerOutput } from "@/types/agentSchemas";
import { BrokerOutputSchema } from "@/types/agentSchemas";

export interface BrokerResult extends MatchResult {
  brokerOutput: BrokerOutput;
}

/**
 * LLM-powered GPU instance matcher.
 * Uses AI reasoning to select the optimal GPU configuration based on:
 * - Compute requirements from Specialist
 * - Available inventory
 * - Cost optimization
 * - Architecture compatibility
 */
export async function matchGpuInstance(
  needs: SpecialistOutput,
  inventory: BrevInstance[]
): Promise<BrokerResult> {
  const inventoryList = inventory
    .map((i) => {
      const totalVram = i.vram * i.count;
      return `- ${i.name}: ${i.vram}GB VRAM × ${i.count} GPU(s) = ${totalVram}GB total | Architecture: ${i.arch} | Price: $${i.price.toFixed(2)}/hr`;
    })
    .join("\n");

  const prompt = `You are a GPU Provisioning Broker for Brev.dev. Your job is to match compute requirements to the best available GPU instance.

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

## AVAILABLE GPU INVENTORY
${inventoryList}

## YOUR TASK
Select the BEST GPU instance for this workload. Consider:

1. **VRAM Sufficiency**: Total VRAM must meet or exceed requirement
   - For training: Add 20-30% headroom for optimizer states/activations
   - For inference: Can be closer to exact requirement

2. **Architecture Compatibility**:
   - "Any" → All architectures work
   - "Ampere" → A10G, A100 (or newer like H100)
   - "Ada" → L4, L40 (or H100 for compatibility)
   - "Hopper" → H100 only (for Transformer Engine, FP8)

3. **Multi-GPU Considerations**:
   - If multi-GPU required, select instances with count >= 2
   - Consider if NVLink is needed for training (A100/H100)
   - Multi-GPU adds communication overhead

4. **Cost Optimization**:
   - Don't over-provision (80GB for 24GB workload is wasteful)
   - Consider cost per effective VRAM-hour
   - For short runs, faster GPUs may be cheaper overall

5. **Real-World Fit**:
   - L4: Great for inference, fine-tuning small models
   - A10G: Balanced for training/inference, good value
   - A100-40GB: Standard for training, good memory
   - A100-80GB: Large models, when 40GB isn't enough
   - H100: Fastest training, required for Hopper features

## THINKING PROCESS
In your "thinking" field, explain your decision:
1. Filter inventory by architecture compatibility
2. Filter by VRAM requirement (with headroom)
3. Rank remaining options by cost-efficiency
4. Justify your final selection
5. Note any concerns or trade-offs

Provide a clear recommendation with confidence level.`;

  const { object: brokerOutput } = await generateObject({
    model: openai("gpt-4o"),
    schema: BrokerOutputSchema,
    prompt,
  });

  // Find the actual instances from inventory
  const best = inventory.find((i) => i.name === brokerOutput.recommended_instance) || null;
  const second_best = brokerOutput.alternative_instance
    ? inventory.find((i) => i.name === brokerOutput.alternative_instance) || null
    : null;

  return {
    best,
    second_best,
    brokerOutput,
  };
}

// Legacy function for backwards compatibility
export function findBestInstance(
  needs: SpecialistOutput,
  inventory: BrevInstance[]
): MatchResult {
  const ARCH_COMPATIBILITY: Record<string, string[]> = {
    Any: ["Ada", "Ampere", "Hopper", "Turing", "Volta"],
    Ampere: ["Ampere", "Hopper", "Ada"],
    Hopper: ["Hopper"],
    Ada: ["Ada", "Hopper"],
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
