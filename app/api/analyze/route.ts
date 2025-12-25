import { auth } from "@/lib/auth";
import { streamObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { getBrevInventory } from "@/lib/brev-api";
import { getRepoTree, getMultipleFileContents } from "@/lib/github";
import { ScoutOutputSchema, SpecialistOutputSchema, BrokerOutputSchema } from "@/types/agentSchemas";
import type { RepoMeta, SpecialistOutput, ScoutOutput, BrokerOutput } from "@/types/agentSchemas";

export const maxDuration = 90;

export async function POST(req: Request) {
  const session = await auth();
  
  if (!session?.accessToken) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { repoMeta, userFeedback, previousNeeds } = await req.json() as { 
    repoMeta: RepoMeta; 
    userFeedback?: string; 
    previousNeeds?: SpecialistOutput;
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

        // Step 6: Broker - GPU matching
        send({
          type: "step_update",
          step: { id: "match", status: "running", startTime: Date.now() },
        });

        const inventory = await getBrevInventory();
        
        // Use rule-based matching for reliability
        // TODO: Reintroduce LLM broker once streaming issues are resolved
        const { findBestInstance } = await import("@/lib/broker");
        const match = findBestInstance(specialistResult, inventory);

        // Generate thoughtful reasoning
        let brokerThinking = `**Architecture Filtering**\n`;
        brokerThinking += `Required: ${specialistResult.recommended_gpu_architecture}\n`;
        brokerThinking += `Compatible architectures identified based on requirements.\n\n`;
        
        brokerThinking += `**VRAM Analysis**\n`;
        brokerThinking += `Base requirement: ${specialistResult.estimated_vram_gb}GB\n`;
        brokerThinking += `Added 20-30% headroom for optimizer states and activations\n`;
        brokerThinking += `Effective target: ~${Math.ceil(specialistResult.estimated_vram_gb * 1.25)}GB\n\n`;
        
        if (specialistResult.requires_multi_gpu) {
          brokerThinking += `**Multi-GPU Requirement**\n`;
          brokerThinking += `Project requires multiple GPUs. Filtered to multi-GPU configurations.\n\n`;
        }
        
        brokerThinking += `**Cost Optimization**\n`;
        brokerThinking += `Evaluated ${inventory.length} GPU configurations.\n`;
        brokerThinking += `Sorted viable options by price (lowest first).\n`;
        brokerThinking += `Selected most cost-effective option that meets all requirements.\n\n`;
        
        if (match.best) {
          brokerThinking += `**Final Selection: ${match.best.name}**\n`;
          brokerThinking += `• VRAM: ${match.best.vram}GB × ${match.best.count} = ${match.best.vram * match.best.count}GB total\n`;
          brokerThinking += `• Architecture: ${match.best.arch}\n`;
          brokerThinking += `• Price: $${match.best.price.toFixed(2)}/hour\n`;
          brokerThinking += `• Best value for ${specialistResult.project_complexity} complexity workload`;
        } else {
          brokerThinking += `**No Match Found**\n`;
          brokerThinking += `No GPU in inventory meets the requirements of ${specialistResult.estimated_vram_gb}GB VRAM with ${specialistResult.recommended_gpu_architecture} architecture.`;
        }

        const brokerResult = {
          thinking: brokerThinking,
          recommended_instance: match.best?.name || "",
          alternative_instance: match.second_best?.name,
          match_confidence: match.best ? (match.best.vram * match.best.count >= specialistResult.estimated_vram_gb * 1.3 ? "High" : "Medium") as const : "Low" as const,
          cost_optimization_notes: match.best 
            ? `This is the most cost-effective option at $${match.best.price.toFixed(2)}/hr. ${match.second_best ? `Alternative available at $${match.second_best.price.toFixed(2)}/hr for more headroom.` : ""}`
            : "Consider custom configurations at console.brev.dev",
        };

        // Stream broker updates
        send({
          type: "broker_stream",
          thinking: brokerThinking,
          recommendedInstance: brokerResult.recommended_instance,
          alternativeInstance: brokerResult.alternative_instance,
          matchConfidence: brokerResult.match_confidence,
          costNotes: brokerResult.cost_optimization_notes,
        });

        const best = match.best;
        const second_best = match.second_best;
        const matchReasoning = brokerThinking;

        send({
          type: "step_update",
          step: {
            id: "match",
            status: "complete",
            endTime: Date.now(),
            data: {
              inventoryChecked: inventory.length,
              matchReasoning,
              brokerThinking: brokerResult.thinking,
              matchConfidence: brokerResult.match_confidence,
              costNotes: brokerResult.cost_optimization_notes,
            },
          },
        });

        // Send final result
        send({
          type: "complete",
          result: {
            success: !!best,
            match: { best, second_best },
            needs: specialistResult,
            recommendation: matchReasoning,
            brokerOutput: brokerResult,
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
