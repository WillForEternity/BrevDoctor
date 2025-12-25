import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { ScoutOutputSchema, type ScoutOutput } from "@/types/agentSchemas";

export async function scoutRepo(filePaths: string[]): Promise<ScoutOutput> {
  const { object } = await generateObject({
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
${filePaths.join("\n")}

Analyze these ${filePaths.length} file paths and select the most relevant ones for GPU compute estimation.`,
  });

  return object;
}
