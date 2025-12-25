import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { BrevInstance } from "@/types/agentSchemas";

const execAsync = promisify(exec);

/**
 * Cache for the Brev token with expiration tracking
 */
let tokenCache: {
  token: string;
  expiresAt: number;
} | null = null;

/**
 * Path to Brev credentials file
 */
const BREV_CREDENTIALS_PATH = join(homedir(), ".brev", "credentials.json");

/**
 * Complete list of GPUs available on Brev.dev
 * 
 * This is the comprehensive list the agent uses to make informed GPU selection decisions.
 * Availability is determined at runtime by attempting to provision via Brev CLI.
 * 
 * Source: Brev.dev platform offerings (December 2024)
 */
export const BREV_GPU_CATALOG: BrevInstance[] = [
  // Blackwell Architecture (Latest)
  { name: "B300", vram: 192, count: 1, arch: "Blackwell", price: 0 },  // Price TBD
  { name: "B200", vram: 192, count: 1, arch: "Blackwell", price: 0 },  // Price TBD
  
  // Hopper Architecture (High-end)
  { name: "H200", vram: 141, count: 1, arch: "Hopper", price: 4.50 },
  { name: "H100", vram: 80, count: 1, arch: "Hopper", price: 3.49 },
  
  // Ampere Architecture (Workhorses)
  { name: "A100", vram: 80, count: 1, arch: "Ampere", price: 2.49 },    // A100-80GB
  { name: "A100-40GB", vram: 40, count: 1, arch: "Ampere", price: 1.89 },
  { name: "A40", vram: 48, count: 1, arch: "Ampere", price: 1.28 },
  { name: "A10", vram: 24, count: 1, arch: "Ampere", price: 0.75 },
  { name: "A10G", vram: 24, count: 1, arch: "Ampere", price: 0.75 },
  { name: "A16", vram: 16, count: 1, arch: "Ampere", price: 0.50 },
  
  // Ada Lovelace Architecture
  { name: "L40s", vram: 48, count: 1, arch: "Ada", price: 1.50 },
  { name: "L40", vram: 48, count: 1, arch: "Ada", price: 1.40 },
  { name: "L4", vram: 24, count: 1, arch: "Ada", price: 0.58 },
  { name: "RTX Pro 6000", vram: 48, count: 1, arch: "Ada", price: 1.20 },
  { name: "RTX 6000 Ada", vram: 48, count: 1, arch: "Ada", price: 1.20 },
  { name: "RTX 4000 Ada", vram: 20, count: 1, arch: "Ada", price: 0.55 },
  
  // Professional GPUs (Ampere)
  { name: "A6000", vram: 48, count: 1, arch: "Ampere", price: 0.80 },
  { name: "A5000", vram: 24, count: 1, arch: "Ampere", price: 0.50 },
  { name: "A4000", vram: 16, count: 1, arch: "Ampere", price: 0.35 },
  
  // Turing Architecture
  { name: "T4", vram: 16, count: 1, arch: "Turing", price: 0.35 },
  
  // Volta Architecture
  { name: "V100", vram: 32, count: 1, arch: "Volta", price: 2.50 },
  
  // Pascal Architecture
  { name: "P4", vram: 8, count: 1, arch: "Pascal", price: 0.25 },
  
  // Maxwell Architecture
  { name: "M60", vram: 8, count: 1, arch: "Maxwell", price: 0.30 },
];

/**
 * GPU information formatted for the agent's decision making
 */
export function getGpuCatalogDescription(): string {
  return `## Available GPUs on Brev.dev

The following GPUs are available on Brev. Select based on your VRAM requirements, architecture needs, and budget.
Note: Actual availability depends on current stock - if a GPU isn't available, try an alternative.

### Blackwell Architecture (Latest Generation)
- **B300**: 192GB VRAM - Cutting edge, best for massive models
- **B200**: 192GB VRAM - Latest generation, extreme performance

### Hopper Architecture (High Performance)
- **H200**: 141GB HBM3e - Best for LLMs, Transformer Engine, FP8
- **H100**: 80GB HBM3 - Industry standard for large-scale training, Transformer Engine

### Ampere Architecture (Workhorses)
- **A100**: 80GB HBM2e - Excellent for training, NVLink support
- **A100-40GB**: 40GB HBM2e - Good balance of performance and cost
- **A40**: 48GB - Professional GPU, good for inference and training
- **A10**: 24GB - Good all-rounder for inference and fine-tuning
- **A10G**: 24GB - AWS-optimized A10 variant
- **A16**: 16GB - Budget option with Ampere features
- **A6000**: 48GB - Professional workstation GPU
- **A5000**: 24GB - Mid-tier professional GPU
- **A4000**: 16GB - Entry-level professional GPU

### Ada Lovelace Architecture (Latest Consumer/Pro)
- **L40s**: 48GB - Optimized for inference, video AI
- **L40**: 48GB - High performance Ada GPU
- **L4**: 24GB - Best value for inference, supports FP8
- **RTX Pro 6000**: 48GB - Professional Ada GPU
- **RTX 6000 Ada**: 48GB - Workstation-class
- **RTX 4000 Ada**: 20GB - Entry professional Ada

### Turing Architecture
- **T4**: 16GB - Budget-friendly, good for inference

### Volta Architecture
- **V100**: 32GB HBM2 - Legacy but still capable for training

### Pascal Architecture
- **P4**: 8GB - Very budget option, inference only

### Maxwell Architecture
- **M60**: 8GB - Legacy GPU, basic compute

## Selection Guidelines
1. **LLM Training (7B+ params)**: H100, H200, A100-80GB, or multi-GPU setup
2. **LLM Fine-tuning**: A100-40GB, L40s, A40
3. **LLM Inference**: L4, T4, A10G (cost-effective)
4. **Computer Vision**: A10G, L4, T4
5. **Research/Experimentation**: T4, L4 (budget), A10G (balanced)

When recommending, consider:
- VRAM requirement (model size + optimizer states + activations)
- Architecture features needed (FP8, Transformer Engine, etc.)
- Cost efficiency for the workload type`;
}

/**
 * Get the GPU catalog as structured data
 */
export function getBrevInventory(): BrevInstance[] {
  return BREV_GPU_CATALOG;
}

/**
 * Find GPU by name (case-insensitive)
 */
export function getGpuByName(name: string): BrevInstance | undefined {
  return BREV_GPU_CATALOG.find(
    (gpu) => gpu.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get GPUs that meet minimum VRAM requirement
 */
export function getGpusByMinVram(minVram: number): BrevInstance[] {
  return BREV_GPU_CATALOG.filter((gpu) => gpu.vram >= minVram)
    .sort((a, b) => a.vram - b.vram);
}

/**
 * Get GPUs by architecture
 */
export function getGpusByArchitecture(arch: string): BrevInstance[] {
  return BREV_GPU_CATALOG.filter(
    (gpu) => gpu.arch.toLowerCase() === arch.toLowerCase()
  );
}

/**
 * Result of a GPU provisioning attempt
 */
export interface ProvisioningResult {
  success: boolean;
  workspaceName?: string;
  error?: string;
  errorType?: "out_of_stock" | "auth_error" | "invalid_config" | "unknown";
  suggestion?: string;
}

/**
 * Decode JWT payload without verification (for checking expiration)
 */
function decodeJWT(token: string): { exp?: number; iat?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const payload = Buffer.from(parts[1], "base64").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired or will expire soon (within 5 minutes)
 */
function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token);
  if (!decoded?.exp) return true;
  
  const now = Math.floor(Date.now() / 1000);
  const fiveMinutes = 5 * 60;
  
  // Consider expired if it expires within 5 minutes
  return decoded.exp < (now + fiveMinutes);
}

/**
 * Read token from Brev credentials file
 */
async function readTokenFromCredentials(): Promise<string | null> {
  try {
    if (!existsSync(BREV_CREDENTIALS_PATH)) {
      return null;
    }
    
    const content = await readFile(BREV_CREDENTIALS_PATH, "utf8");
    const credentials = JSON.parse(content);
    return credentials.access_token || null;
  } catch (error) {
    console.error("Failed to read Brev credentials:", error);
    return null;
  }
}

/**
 * Refresh the Brev token by running `brev login --token --skip-browser`
 * This will use the refresh token stored by Brev CLI
 */
async function refreshBrevToken(): Promise<string | null> {
    try {
    // Try to refresh using the Brev CLI
    // The CLI should have a refresh token stored and can renew automatically
    await execAsync("brev refresh", { timeout: 30000 });
    
    // Wait a moment for credentials file to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Read the new token
    const newToken = await readTokenFromCredentials();
    
    if (newToken && !isTokenExpired(newToken)) {
      const decoded = decodeJWT(newToken);
      tokenCache = {
        token: newToken,
        expiresAt: decoded?.exp || 0,
      };
      
      // Also update the environment variable for this process
      process.env.BREV_TOKEN = newToken ?? undefined;
      
      console.log("✅ Brev token refreshed successfully");
      return newToken;
    }
    
    return null;
  } catch (error) {
    console.error("Failed to refresh Brev token:", error);
    return null;
  }
}

/**
 * Get a valid Brev token, refreshing if necessary
 * This ensures we always have a fresh token before making API calls
 */
async function getValidBrevToken(): Promise<string | null> {
  // First, check environment variable
  let token: string | null = process.env.BREV_TOKEN || null;
  
  // If no token in env, try reading from credentials file
  if (!token) {
    token = await readTokenFromCredentials();
    if (token) {
      process.env.BREV_TOKEN = token;
    }
  }
  
  // If still no token, can't proceed
  if (!token) {
    return null;
  }
  
  // Check if token is expired or will expire soon
  if (isTokenExpired(token)) {
    console.log("⚠️ Brev token expired or expiring soon, refreshing...");
    const newToken = await refreshBrevToken();
    if (newToken) {
      return newToken;
    }
    
    // If refresh failed, the token might still work for a bit
    console.warn("Token refresh failed, trying with existing token");
    return token;
  }
  
  // Token is valid, cache it
  const decoded = decodeJWT(token);
  tokenCache = {
    token,
    expiresAt: decoded?.exp || 0,
  };
  
  return token;
}

/**
 * Attempt to provision a GPU via Brev CLI
 * 
 * This uses the Brev CLI to attempt to start/create a workspace.
 * If the GPU type is not available (out of stock), it will fail,
 * which informs the agent to try a different GPU.
 * 
 * Automatically handles token refresh if expired.
 */
export async function attemptGpuProvisioning(
  gpuName: string,
  gpuCount: number = 1,
  workspaceName?: string
): Promise<ProvisioningResult> {
  const brevToken = await getValidBrevToken();
  
  if (!brevToken) {
    return {
      success: false,
      error: "BREV_TOKEN not found or expired. Please run 'brev login' or set BREV_TOKEN",
      errorType: "auth_error",
      suggestion: "Run 'brev login' to authenticate or set BREV_TOKEN in your environment",
    };
  }

  const name = workspaceName || `brev-doctor-${Date.now()}`;
  
  try {
    // First, authenticate with Brev CLI using the fresh token
    await execAsync(`brev login --token "${brevToken}" --skip-browser`);
    
    // Attempt to create/start the workspace with the specified GPU
    // The exact command format may vary based on Brev CLI version
    const gpuSpec = gpuCount > 1 ? `${gpuName}x${gpuCount}` : gpuName;
    
    // Try to create a new workspace with the specified GPU
    const { stdout, stderr } = await execAsync(
      `brev create "${name}" --gpu "${gpuSpec}" --wait-for-running`
    );
    
    // Check for success indicators
    if (stdout.includes("RUNNING") || stdout.includes("running")) {
      return {
        success: true,
        workspaceName: name,
      };
    }
    
    // If we got here without error but also without "running", might be pending
    return {
      success: true,
      workspaceName: name,
      suggestion: "Workspace created but may still be starting up",
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stderr = (error as { stderr?: string }).stderr || "";
    const combinedError = `${errorMessage} ${stderr}`.toLowerCase();
    
    // Detect out of stock errors
    if (
      combinedError.includes("out of stock") ||
      combinedError.includes("no capacity") ||
      combinedError.includes("unavailable") ||
      combinedError.includes("insufficient") ||
      combinedError.includes("not available") ||
      combinedError.includes("no instances available") ||
      combinedError.includes("quota exceeded")
    ) {
      return {
        success: false,
        error: `GPU ${gpuName} is currently out of stock or unavailable`,
        errorType: "out_of_stock",
        suggestion: "Try a different GPU type or memory configuration",
      };
        }
    
    // Detect auth errors (might need token refresh)
    if (
      combinedError.includes("unauthorized") ||
      combinedError.includes("authentication") ||
      combinedError.includes("invalid token") ||
      combinedError.includes("expired")
    ) {
      // Try one more time with a fresh token
      const freshToken = await refreshBrevToken();
      if (freshToken) {
        console.log("Retrying with refreshed token...");
        return attemptGpuProvisioning(gpuName, gpuCount, workspaceName);
      }
      
      return {
        success: false,
        error: "Authentication failed with Brev CLI",
        errorType: "auth_error",
        suggestion: "Run 'brev login' to re-authenticate",
      };
  }
  
    // Detect invalid configuration
    if (
      combinedError.includes("invalid gpu") ||
      combinedError.includes("unknown gpu") ||
      combinedError.includes("not found")
    ) {
      return {
        success: false,
        error: `Invalid GPU configuration: ${gpuName}`,
        errorType: "invalid_config",
        suggestion: "Check GPU name spelling and try again",
      };
    }
    
    // Unknown error
    return {
      success: false,
      error: errorMessage,
      errorType: "unknown",
      suggestion: "Check Brev CLI is installed and configured correctly",
    };
  }
}

/**
 * Check if Brev CLI is installed and accessible
 */
export async function checkBrevCliInstalled(): Promise<boolean> {
  try {
    await execAsync("brev --version");
    return true;
  } catch {
    return false;
  }
}

/**
 * List current Brev workspaces
 * Automatically handles token refresh if expired.
 */
export async function listBrevWorkspaces(): Promise<{
  success: boolean;
  workspaces?: Array<{ name: string; status: string; gpu?: string }>;
  error?: string;
}> {
  const brevToken = await getValidBrevToken();
  
  if (!brevToken) {
    return {
      success: false,
      error: "BREV_TOKEN not found or expired",
    };
  }

  try {
    await execAsync(`brev login --token "${brevToken}" --skip-browser`);
    const { stdout } = await execAsync("brev list --json");
    
    const workspaces = JSON.parse(stdout);
    return {
      success: true,
      workspaces: workspaces.map((ws: Record<string, unknown>) => ({
        name: String(ws.name || ws.id || ""),
        status: String(ws.status || ws.state || "unknown"),
        gpu: String(ws.gpu || ws.machine_type || ""),
      })),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Stop a Brev workspace
 * Automatically handles token refresh if expired.
 */
export async function stopBrevWorkspace(workspaceName: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const brevToken = await getValidBrevToken();
  
  if (!brevToken) {
    return {
      success: false,
      error: "BREV_TOKEN not found or expired",
    };
  }

  try {
    await execAsync(`brev login --token "${brevToken}" --skip-browser`);
    await execAsync(`brev stop "${workspaceName}"`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Delete a Brev workspace
 * Automatically handles token refresh if expired.
 */
export async function deleteBrevWorkspace(workspaceName: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const brevToken = await getValidBrevToken();
  
  if (!brevToken) {
    return {
      success: false,
      error: "BREV_TOKEN not found or expired",
    };
  }

  try {
    await execAsync(`brev login --token "${brevToken}" --skip-browser`);
    await execAsync(`brev delete "${workspaceName}" --yes`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Format instance for display
 */
export function formatBrevInstance(instance: BrevInstance): string {
  const totalVram = instance.vram * instance.count;
  const gpuLabel = instance.count > 1 ? `${instance.count}x GPUs` : "1 GPU";
  const priceStr = instance.price > 0 ? `$${instance.price.toFixed(2)}/hr` : "Price TBD";
  return `${instance.name} - ${totalVram}GB VRAM (${gpuLabel}) - ${priceStr}`;
}
