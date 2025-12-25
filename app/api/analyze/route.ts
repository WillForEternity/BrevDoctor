import { auth } from "@/lib/auth";
import { streamObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { getBrevInventory, getGpuCatalogDescription, attemptGpuProvisioning, getGpuByName } from "@/lib/brev-api";
import { getRepoTree, getMultipleFileContents } from "@/lib/github";
import { ScoutOutputSchema, SpecialistOutputSchema, BrokerOutputSchema, GpuRetryDecisionSchema } from "@/types/agentSchemas";
import type { RepoMeta, SpecialistOutput, ScoutOutput, BrokerOutput } from "@/types/agentSchemas";
import { selectGpuInstance, decideGpuRetry, brokerOutputToInstance, findBestInstance } from "@/lib/broker";

export const maxDuration = 120; // Allow longer for provisioning retries

export async function POST(req: Request) {
  const session = await auth();
  
  if (!session?.accessToken) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { repoMeta, userFeedback, previousNeeds, attemptProvisioning = false } = await req.json() as { 
    repoMeta: RepoMeta; 
    userFeedback?: string; 
    previousNeeds?: SpecialistOutput;
    attemptProvisioning?: boolean;
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Step 1: Auth complete
        send({
          type: "step_update",
          step: { id: "auth", status: "complete", endTime: Date.now() },
        });

        // Step 2: Scan repository
        send({
          type: "step_update",
          step: { id: "scan", status: "running", startTime: Date.now() },
        });

        const fileTree = await getRepoTree(
          session.accessToken!,
          repoMeta.owner,
          repoMeta.repo,
          repoMeta.branch || "main"
        );

        if (fileTree.length === 0) {
          send({
            type: "error",
            error: "Repository appears to be empty or inaccessible.",
          });
          controller.close();
          return;
        }

        send({
          type: "step_update",
          step: {
            id: "scan",
            status: "complete",
            endTime: Date.now(),
            data: { totalFiles: fileTree.length, fileTree },
          },
        });

        // Step 3: Scout AI - Stream the reasoning
        send({
          type: "step_update",
          step: { id: "scout", status: "running", startTime: Date.now() },
        });

        let scoutResult: ScoutOutput | null = null;
        let partialScoutReasoning = "";

        const scoutStream = streamObject({
          model: openai("gpt-4o"),
          schema: ScoutOutputSchema,
          prompt: `You are an AI Scout for a GPU provisioning tool called Brev Doctor. 
    
Your task: Given a list of file paths from a repository, select up to 8 files that are most likely to contain key configuration, architecture, or dependency information for training an ML model.

Priority files to look for:
- requirements.txt, pyproject.toml, setup.py, environment.yml (dependencies)
- Dockerfile, docker-compose.yml (container configs)
- config.yaml, config.json, *.cfg files (training configs)
- train.py, main.py, run.py (entry points)
- model.py, architecture.py, network.py (model definitions)
- README.md (may contain hardware requirements)

Ignore:
- Test files (test_*, *_test.py)
- Documentation (docs/*, *.md except README)
- Images, data files, checkpoints
- IDE configs (.vscode, .idea)
- Git files (.git/*)

Here is the list of file paths:
${fileTree.join("\n")}

Analyze these ${fileTree.length} file paths and select the most relevant ones for GPU compute estimation. Provide detailed reasoning about why you selected each file.`,
        });

        for await (const partial of scoutStream.partialObjectStream) {
          if (partial.reasoning && partial.reasoning !== partialScoutReasoning) {
            partialScoutReasoning = partial.reasoning;
            send({
              type: "scout_stream",
              reasoning: partial.reasoning,
              selectedFiles: partial.selected_paths || [],
            });
          }
        }

        const finalScoutResult = await scoutStream.object;
        scoutResult = finalScoutResult;

        send({
          type: "step_update",
          step: {
            id: "scout",
            status: "complete",
            endTime: Date.now(),
            data: {
              scoutReasoning: scoutResult.reasoning,
              selectedFiles: scoutResult.selected_paths,
            },
          },
        });

        // Step 4: Fetch file contents
        send({
          type: "step_update",
          step: { id: "fetch", status: "running", startTime: Date.now() },
        });

        const fileContents = await getMultipleFileContents(
          session.accessToken!,
          repoMeta.owner,
          repoMeta.repo,
          scoutResult.selected_paths,
          repoMeta.branch || "main"
        );

        send({
          type: "step_update",
          step: {
            id: "fetch",
            status: "complete",
            endTime: Date.now(),
            data: { fileContents },
          },
        });

        // Step 5: Specialist analysis - Stream the thinking
        send({
          type: "step_update",
          step: { id: "analyze", status: "running", startTime: Date.now() },
        });

        const formattedContents = Object.entries(fileContents)
          .map(([name, content]) => `--- ${name} ---\n${content}`)
          .join("\n\n");

        let specialistResult: SpecialistOutput | null = null;
        let lastThinking = "";

        let specialistPrompt = `You are an NVIDIA Solutions Architect specializing in ML/AI workloads. Your job is to analyze code and provide comprehensive GPU compute recommendations.

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
          specialistPrompt += `
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
          specialistPrompt += `
Analyze these files thoroughly and provide your detailed compute requirements.`;
        }

        const specialistStream = streamObject({
          model: openai("gpt-4o"),
          schema: SpecialistOutputSchema,
          prompt: specialistPrompt,
        });

        for await (const partial of specialistStream.partialObjectStream) {
          // Stream thinking as it's being generated
          if (partial.thinking && partial.thinking !== lastThinking) {
            lastThinking = partial.thinking;
            send({
              type: "specialist_stream",
              thinking: partial.thinking,
              estimatedVram: partial.estimated_vram_gb,
              architecture: partial.recommended_gpu_architecture,
              multiGpu: partial.requires_multi_gpu,
              setupCommands: partial.setup_commands,
              complexity: partial.project_complexity,
              complexityReasoning: partial.complexity_reasoning,
              cpuCores: partial.recommended_cpu_cores,
              systemRam: partial.recommended_system_ram_gb,
              diskSpace: partial.estimated_disk_space_gb,
            });
          }
        }

        const finalSpecialistResult = await specialistStream.object;
        specialistResult = finalSpecialistResult;

        send({
          type: "step_update",
          step: {
            id: "analyze",
            status: "complete",
            endTime: Date.now(),
            data: {
              specialistThinkingStream: specialistResult.thinking,
              computeAnalysis: {
                estimatedVram: specialistResult.estimated_vram_gb,
                architecture: specialistResult.recommended_gpu_architecture,
                multiGpu: specialistResult.requires_multi_gpu,
                setupCommands: specialistResult.setup_commands,
                complexity: specialistResult.project_complexity,
                complexityReasoning: specialistResult.complexity_reasoning,
                cpuCores: specialistResult.recommended_cpu_cores,
                systemRam: specialistResult.recommended_system_ram_gb,
                diskSpace: specialistResult.estimated_disk_space_gb,
              },
            },
          },
        });

        // Step 6: Broker - GPU selection with full catalog knowledge
        send({
          type: "step_update",
          step: { id: "match", status: "running", startTime: Date.now() },
        });

        const inventory = getBrevInventory();
        
        // Streamlined GPU catalog - concise but complete
        const gpuCatalogConcise = `## AVAILABLE GPUs (sorted by VRAM)
| GPU | VRAM | Arch | $/hr | Best For |
|-----|------|------|------|----------|
| T4 | 16GB | Turing | 0.35 | Budget inference |
| P4 | 8GB | Pascal | 0.25 | Basic inference |
| A4000 | 16GB | Ampere | 0.35 | Entry workstation |
| A10/A10G | 24GB | Ampere | 0.75 | Balanced training/inference |
| L4 | 24GB | Ada | 0.58 | Best value inference, FP8 |
| A5000 | 24GB | Ampere | 0.50 | Mid-tier professional |
| V100 | 32GB | Volta | 2.50 | Legacy training |
| A100-40GB | 40GB | Ampere | 1.89 | Standard training |
| L40/L40s | 48GB | Ada | 1.40-1.50 | High perf inference |
| A40 | 48GB | Ampere | 1.28 | Training + inference |
| A6000 | 48GB | Ampere | 0.80 | Professional workstation |
| A100 | 80GB | Ampere | 2.49 | Large model training |
| H100 | 80GB | Hopper | 3.49 | Fastest, Transformer Engine |
| H200 | 141GB | Hopper | 4.50 | Maximum VRAM |
| B200/B300 | 192GB | Blackwell | TBD | Cutting edge |`;

        // Use LLM-based selection with concise GPU catalog
        const brokerPrompt = `You are a GPU Provisioning Expert for Brev.dev. Select the optimal GPU.

## REQUIREMENTS
- VRAM: ${specialistResult.estimated_vram_gb}GB
- Architecture: ${specialistResult.recommended_gpu_architecture}
- Multi-GPU: ${specialistResult.requires_multi_gpu ? "Yes" : "No"}
- Complexity: ${specialistResult.project_complexity}

${gpuCatalogConcise}

## SELECTION RULES
1. VRAM must be >= requirement (add 20-30% headroom for training)
2. Architecture compatibility: Any=all work, Ampere=A10/A100+, Ada=L4/L40+, Hopper=H100/H200 only
3. Don't over-provision (no H100 for 8GB workload)
4. Always provide alternative_gpu as fallback
5. Popular GPUs (L4, T4, A10G) are usually more available

Be concise in thinking. Select the best cost-effective GPU that meets requirements.`;

        let brokerResult: BrokerOutput;
        let lastStreamState = "";
        let streamUpdateCount = 0;

        // Send initial "starting" message
        send({
          type: "broker_stream",
          thinking: "Starting GPU selection analysis...",
          status: "starting",
        });

        const brokerStream = streamObject({
          model: openai("gpt-4o"),
          schema: BrokerOutputSchema,
          prompt: brokerPrompt,
        });

        for await (const partial of brokerStream.partialObjectStream) {
          // Create a state signature to detect ANY change
          const currentState = JSON.stringify({
            thinking: partial.thinking?.slice(-100), // Last 100 chars to detect changes
            gpu: partial.recommended_gpu,
            vram: partial.recommended_vram,
            count: partial.gpu_count,
            alt: partial.alternative_gpu,
            conf: partial.match_confidence,
          });

          // Update on ANY change, not just thinking
          if (currentState !== lastStreamState) {
            lastStreamState = currentState;
            streamUpdateCount++;
            
            send({
              type: "broker_stream",
              thinking: partial.thinking || "Analyzing GPU options...",
              recommendedGpu: partial.recommended_gpu,
              recommendedVram: partial.recommended_vram,
              gpuCount: partial.gpu_count,
              alternativeGpu: partial.alternative_gpu,
              matchConfidence: partial.match_confidence,
              costNotes: partial.cost_optimization_notes,
              status: "streaming",
              updateCount: streamUpdateCount,
            });
          }
        }

        brokerResult = await brokerStream.object;
        
        // Send completion signal
        send({
          type: "broker_stream",
          thinking: brokerResult.thinking,
          recommendedGpu: brokerResult.recommended_gpu,
          recommendedVram: brokerResult.recommended_vram,
          gpuCount: brokerResult.gpu_count,
          alternativeGpu: brokerResult.alternative_gpu,
          matchConfidence: brokerResult.match_confidence,
          costNotes: brokerResult.cost_optimization_notes,
          status: "complete",
        });

        // Convert broker output to BrevInstance for compatibility
        const recommendedInstance = getGpuByName(brokerResult.recommended_gpu);
        const alternativeInstance = brokerResult.alternative_gpu && brokerResult.alternative_gpu !== 'none'
          ? getGpuByName(brokerResult.alternative_gpu) 
          : null;

        // Build match result
        const best = recommendedInstance ? {
          ...recommendedInstance,
          count: brokerResult.gpu_count,
        } : null;

        const second_best = alternativeInstance ? {
          ...alternativeInstance,
          count: brokerResult.gpu_count,
        } : null;

        // Generate broker thinking summary
        let brokerThinking = brokerResult.thinking;
        
        if (best) {
          brokerThinking += `\n\n**Final Selection: ${best.name}${best.count > 1 ? ` × ${best.count}` : ''}**\n`;
          brokerThinking += `• VRAM: ${best.vram}GB${best.count > 1 ? ` × ${best.count} = ${best.vram * best.count}GB total` : ''}\n`;
          brokerThinking += `• Architecture: ${best.arch}\n`;
          brokerThinking += `• Price: $${best.price.toFixed(2)}/hour\n`;
        }

        send({
          type: "step_update",
          step: {
            id: "match",
            status: "complete",
            endTime: Date.now(),
            data: {
              inventoryChecked: inventory.length,
              matchReasoning: brokerThinking,
              brokerThinking: brokerResult.thinking,
              matchConfidence: brokerResult.match_confidence,
              costNotes: brokerResult.cost_optimization_notes,
            },
          },
        });

        // Optional Step 7: Attempt GPU provisioning if requested
        let provisioningResult = null;
        const provisioningAttempts: Array<{
          gpu: string;
          vram: number;
          gpuCount: number;
          success: boolean;
          error?: string;
          errorType?: string;
        }> = [];

        if (attemptProvisioning && best) {
          send({
            type: "step_update",
            step: { id: "provision", status: "running", startTime: Date.now() },
          });

          const MAX_RETRIES = 3;
          let currentGpu = best.name;
          let currentVram = best.vram;
          let currentCount = best.count;
          
          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            send({
              type: "provisioning_attempt",
              attempt: attempt + 1,
              gpu: currentGpu,
              vram: currentVram,
              gpuCount: currentCount,
            });

            const result = await attemptGpuProvisioning(
              currentGpu,
              currentCount
            );

            provisioningAttempts.push({
              gpu: currentGpu,
              vram: currentVram,
              gpuCount: currentCount,
              success: result.success,
              error: result.error,
              errorType: result.errorType,
            });

            if (result.success) {
              provisioningResult = result;
              send({
                type: "provisioning_success",
                workspaceName: result.workspaceName,
                gpu: currentGpu,
                vram: currentVram,
                gpuCount: currentCount,
              });
              break;
            }

            // Provisioning failed - notify and decide whether to retry
            send({
              type: "provisioning_failed",
              attempt: attempt + 1,
              gpu: currentGpu,
              error: result.error,
              errorType: result.errorType,
              willRetry: attempt < MAX_RETRIES - 1 && result.errorType === "out_of_stock",
            });

            // Only retry on out of stock errors
            if (result.errorType !== "out_of_stock" || attempt >= MAX_RETRIES - 1) {
              break;
            }

            // Ask the agent to decide what GPU to try next
            const retryDecision = await decideGpuRetry(
              specialistResult,
              provisioningAttempts.map(a => ({
                gpu: a.gpu,
                vram: a.vram,
                gpuCount: a.gpuCount,
                error: a.error || "Unknown error",
              }))
            );

            send({
              type: "retry_decision",
              thinking: retryDecision.thinking,
              shouldRetry: retryDecision.should_retry,
              nextGpu: retryDecision.next_gpu,
              fallbackReason: retryDecision.fallback_reason,
            });

            if (!retryDecision.should_retry || !retryDecision.next_gpu) {
              break;
            }

            // Update for next attempt
            currentGpu = retryDecision.next_gpu;
            currentVram = retryDecision.next_vram || currentVram;
            currentCount = retryDecision.next_gpu_count || currentCount;
          }

          send({
            type: "step_update",
            step: {
              id: "provision",
              status: provisioningResult?.success ? "complete" : "error",
              endTime: Date.now(),
              data: {
                provisioningAttempts,
                provisionedWorkspace: provisioningResult?.workspaceName,
              },
            },
          });
        }

        // Send final result
        send({
          type: "complete",
          result: {
            success: !!best,
            match: { best, second_best },
            needs: specialistResult,
            recommendation: brokerThinking,
            brokerOutput: brokerResult,
            provisioning: attemptProvisioning ? {
              attempted: true,
              success: provisioningResult?.success || false,
              workspaceName: provisioningResult?.workspaceName,
              attempts: provisioningAttempts,
            } : undefined,
          },
        });

        controller.close();
      } catch (error) {
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error occurred",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
