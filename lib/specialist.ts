import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { SpecialistOutputSchema, type SpecialistOutput } from "@/types/agentSchemas";

export async function analyzeComputeNeeds(
  fileContents: Record<string, string>,
  userFeedback?: string,
  previousNeeds?: SpecialistOutput
): Promise<SpecialistOutput> {
  const formattedContents = Object.entries(fileContents)
    .map(([name, content]) => `--- ${name} ---\n${content}`)
    .join("\n\n");

  let prompt = `You are an NVIDIA Solutions Architect specializing in ML/AI workloads. Your job is to analyze code and provide comprehensive GPU compute recommendations.

## YOUR TASK
Analyze the provided code files and determine the exact compute requirements. You MUST show your detailed thinking process.

## THINKING PROCESS (REQUIRED)
In your "thinking" field, walk through your analysis step-by-step:

1. **File-by-File Analysis**: For each file, note what you find:
   - Dependencies (transformers, torch, tensorflow, etc.)
   - Model references (model names, architectures, parameter counts)
   - Training configurations (batch size, sequence length, epochs)
   - Data loading patterns (dataset size hints, preprocessing)

2. **Model Size Estimation**: 
   - Identify the model (e.g., "Llama-2-7B", "BERT-base", "ResNet-50")
   - Estimate parameter count
   - Calculate memory: params × precision (fp32=4B, fp16=2B, bf16=2B)
   - Add optimizer states (Adam: 2x model size for fp32, or 8 bytes/param)
   - Add gradient storage (same as model size)
   - Add activation memory (batch_size × seq_len × hidden_dim × layers × 2)

3. **VRAM Calculation**:
   - Model weights: X GB
   - Optimizer states: Y GB  
   - Gradients: Z GB
   - Activations (estimate): W GB
   - Buffer/overhead: 10-20%
   - TOTAL: Sum all with buffer

4. **Architecture Decision**:
   - Any: Basic CUDA, no special features needed
   - Ampere (A10/A100): TF32, structured sparsity, 3rd gen tensor cores
   - Ada (L4/L40): FP8, 4th gen tensor cores, video encode/decode
   - Hopper (H100): Transformer Engine, FP8, HBM3, fastest for LLMs

5. **Complexity Assessment**:
   - Low: <1B params, simple fine-tuning, inference only
   - Medium: 1-7B params, standard training, moderate datasets
   - High: 7-70B params, full training, large datasets
   - Enterprise: >70B params, multi-node, massive scale

## FILES TO ANALYZE
${formattedContents}

`;

  if (userFeedback && previousNeeds) {
    prompt += `
## USER FEEDBACK (CRITICAL - ADJUST YOUR ANALYSIS)
The user disagrees with your previous analysis:
"${userFeedback}"

Your previous analysis:
- Complexity: ${previousNeeds.project_complexity}
- VRAM: ${previousNeeds.estimated_vram_gb}GB
- Architecture: ${previousNeeds.recommended_gpu_architecture}
- Multi-GPU: ${previousNeeds.requires_multi_gpu}
- CPU Cores: ${previousNeeds.recommended_cpu_cores}
- System RAM: ${previousNeeds.recommended_system_ram_gb}GB

Carefully reconsider your analysis based on their feedback. Explain in your thinking why you're adjusting (or not adjusting) your recommendations.`;
  } else {
    prompt += `
Analyze these files thoroughly and provide your detailed compute requirements.`;
  }

  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: SpecialistOutputSchema,
    prompt,
  });

  return object;
}
