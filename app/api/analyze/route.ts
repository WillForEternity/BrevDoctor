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
          prompt: `You are an expert Systems Architect for AI/ML Infrastructure.
    
Your task: Analyze the repository file structure to identify the files that reveal the **true compute scale** of the project.

We need to answer: "What hardware does this ACTUALLY run on?"

Priority Selection Strategy:
1. **Infrastructure & Execution**: Look for shell scripts, Makefiles, Dockerfiles, or \`.slurm\` scripts. These often contain flags like \`--gpus all\`, \`--memory=64g\`, or specific GPU types (e.g., "A100").
2. **Documentation**: README.md is critical. Look for "Hardware Requirements", "Installation", or "Benchmarks".
3. **Configuration**: config.yaml, pyproject.toml, requirements.txt.
4. **Core Logic**: Main training loops (train.py), model definitions (model.py).

Ignore:
- Standard boilerplate (LICENSE, .gitignore)
- Frontend/UI code
- Test suites (unless they are the main entry point)
- Data/Assets

Here is the file list:
${fileTree.join("\n")}

Select the top 8 files that will give the most accurate signal on compute requirements (VRAM, VCPU, RAM). Justify your selection based on expected information gain.`,
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

        let specialistPrompt = `You are a Senior NVIDIA AI Systems Architect. Your goal is to determine the **safe and optimal** GPU hardware for a given codebase.
You must look beyond simple parameter counting and analyze the *system architecture*, *dependencies*, and *implied scale*.

## REPOSITORY CONTEXT
- **Repository**: ${repoMeta.owner}/${repoMeta.repo}
- **Branch**: ${repoMeta.branch || "main"}
- **Total Files Scanned**: ${fileTree.length}

## SCOUT AI'S FILE SELECTION REASONING
The Scout AI analyzed the repository structure and selected the following files for deep analysis.
**Scout's reasoning for file selection:**
${scoutResult.reasoning}

**Selected Files:**
${scoutResult.selected_paths.map(p => `- ${p}`).join('\n')}

This context helps you understand *why* these specific files were chosen and what signals the Scout detected in the repository structure.

## AVAILABLE GPU OPTIONS (for context)
${getGpuCatalogDescription()}

## YOUR TASK
Analyze the provided code files and documentation to determine compute requirements.
CRITICAL: If the project is a framework, distributed system, or training pipeline, you must provision for the *workload*, not just the model weights.

## ANALYSIS FRAMEWORK (Execute in "thinking" field)

1. **Context & Scope Extraction (The "Readme Test")**:
   - **Explicit Claims**: Does the README mention "A100", "H100", "Multi-GPU", "Distributed", or specific VRAM amounts? **Trust these over code estimation.**
   - **Execution Evidence**: Look for flags in scripts/docs: \`--gpus all\`, \`batch_size=4096\`, \`fp16\`.
   - **Project Archetype**:
     - *Toy/Demo*: <1GB VRAM.
     - *Research/Fine-tuning*: 16-24GB VRAM (A10G, L4).
     - *Production Training*: 40-80GB+ VRAM (A100, H100).
     - *Distributed System*: Multi-GPU required.

2. **Workload Analysis**:
   - **LLM/NLP**: High VRAM for weights + KV cache.
   - **CV/Diffusion**: High VRAM for activations (batch size sensitive).
   - **RL/Robotics**: **Massive CPU-RAM usage**, Experience Replay buffers (can be 10GB+ VRAM/RAM), parallel environments.
   - **Scientific/Graph**: Large matrices, memory-bound.

3. **Compute Calculation (The "Safety" Rule)**:
   - **Base Overhead**: PyTorch/TF + CUDA Context = **~1-2GB allocated immediately**. Never estimate below this.
   - **Model Weights**: Estimate if possible.
   - **Training Overhead**: Optimizer (2x weights), Gradients (1x), **Activations** (often 5-10x weights for large batches).
   - **Buffer**: Always add 20-30% buffer.

4. **Architecture Selection**:
   - **Ampere (A10/A100)**: Safe default for most modern DL (TF32 support).
   - **Hopper (H100)**: Only if FP8 or "Transformer Engine" mentioned.
   - **Ada (L4/L40)**: Good for inference or video.

5. **Sanity Check**:
   - If your calculation is < 4GB but the project says "Deep Reinforcement Learning", **you are wrong**. Bump to minimum viable workstation GPU (A10G/L4).
   - If "Distributed" is mentioned, requires_multi_gpu MUST be true.

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
        
        // Use full catalog from shared library to ensure consistency
        const gpuCatalog = getGpuCatalogDescription();

        const brokerPrompt = `You are a Strategic Infrastructure Advisor for Brev.dev.
        
## MISSION
Select the GPU that guarantees **success** and **stability** for the user's project, while optimizing cost *only if safe to do so*.

## REPOSITORY CONTEXT
- **Repository**: ${repoMeta.owner}/${repoMeta.repo}
- **Branch**: ${repoMeta.branch || "main"}
- **Total Files in Repo**: ${fileTree.length}

## SCOUT AI'S ANALYSIS
The Scout AI identified these as the most relevant files for compute analysis:
${scoutResult.selected_paths.map(p => `- ${p}`).join('\n')}

**Scout's reasoning**: ${scoutResult.reasoning}

## SPECIALIST'S COMPUTE ANALYSIS
The Specialist analyzed the code and determined:

**Full Analysis Thinking:**
${specialistResult.thinking}

**Key Findings:**
- **Estimated VRAM Needed**: ${specialistResult.estimated_vram_gb}GB
- **Recommended Architecture**: ${specialistResult.recommended_gpu_architecture}
- **Multi-GPU Required**: ${specialistResult.requires_multi_gpu ? "Yes" : "No"}
- **Project Complexity**: ${specialistResult.project_complexity}
- **Complexity Reasoning**: ${specialistResult.complexity_reasoning}
- **Recommended CPU Cores**: ${specialistResult.recommended_cpu_cores}
- **Recommended System RAM**: ${specialistResult.recommended_system_ram_gb}GB
- **Estimated Disk Space**: ${specialistResult.estimated_disk_space_gb}GB
- **Setup Commands**: ${specialistResult.setup_commands.length > 0 ? specialistResult.setup_commands.join(', ') : 'None specified'}

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

            // Ask the agent to decide what GPU to try next, passing full context
            const retryDecision = await decideGpuRetry(
              specialistResult,
              provisioningAttempts.map(a => ({
                gpu: a.gpu,
                vram: a.vram,
                gpuCount: a.gpuCount,
                error: a.error || "Unknown error",
              })),
              {
                repoMeta,
                scoutReasoning: scoutResult.reasoning,
                selectedFiles: scoutResult.selected_paths,
              }
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
