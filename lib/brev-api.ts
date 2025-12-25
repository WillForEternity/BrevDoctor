import type { BrevInstance } from "@/types/agentSchemas";

/**
 * Brev GPU Instance Inventory
 * 
 * This inventory is based on Brev.dev's publicly available GPU instances.
 * Pricing is approximate and may vary. For accurate pricing, visit:
 * https://console.brev.dev or https://brev.nvidia.com
 * 
 * Last updated: December 2024
 * Source: Brev.dev platform offerings
 */
const BREV_GPU_INVENTORY: BrevInstance[] = [
  // NVIDIA L4 (Ada Lovelace) - Great for inference
  { name: "L4", vram: 24, count: 1, arch: "Ada", price: 0.58 },
  { name: "L4x2", vram: 24, count: 2, arch: "Ada", price: 1.16 },
  { name: "L4x4", vram: 24, count: 4, arch: "Ada", price: 2.32 },
  
  // NVIDIA A10G (Ampere) - Balanced performance
  { name: "A10G", vram: 24, count: 1, arch: "Ampere", price: 0.75 },
  { name: "A10Gx2", vram: 24, count: 2, arch: "Ampere", price: 1.50 },
  { name: "A10Gx4", vram: 24, count: 4, arch: "Ampere", price: 3.00 },
  
  // NVIDIA T4 (Turing) - Budget option
  { name: "T4", vram: 16, count: 1, arch: "Turing", price: 0.35 },
  { name: "T4x2", vram: 16, count: 2, arch: "Turing", price: 0.70 },
  { name: "T4x4", vram: 16, count: 4, arch: "Turing", price: 1.40 },
  
  // NVIDIA A100 (Ampere) - High-end training
  { name: "A100-40GB", vram: 40, count: 1, arch: "Ampere", price: 1.89 },
  { name: "A100-40GBx2", vram: 40, count: 2, arch: "Ampere", price: 3.78 },
  { name: "A100-40GBx4", vram: 40, count: 4, arch: "Ampere", price: 7.56 },
  { name: "A100-80GB", vram: 80, count: 1, arch: "Ampere", price: 2.49 },
  { name: "A100-80GBx2", vram: 80, count: 2, arch: "Ampere", price: 4.98 },
  { name: "A100-80GBx4", vram: 80, count: 4, arch: "Ampere", price: 9.96 },
  { name: "A100-80GBx8", vram: 80, count: 8, arch: "Ampere", price: 19.92 },
  
  // NVIDIA H100 (Hopper) - Latest & most powerful
  { name: "H100-80GB", vram: 80, count: 1, arch: "Hopper", price: 3.49 },
  { name: "H100-80GBx2", vram: 80, count: 2, arch: "Hopper", price: 6.98 },
  { name: "H100-80GBx4", vram: 80, count: 4, arch: "Hopper", price: 13.96 },
  { name: "H100-80GBx8", vram: 80, count: 8, arch: "Hopper", price: 27.92 },
];

/**
 * Fetches GPU inventory from Brev.
 * 
 * Note: Brev currently uses CLI-based management and doesn't have a public 
 * REST API for instance types. This function returns curated inventory based
 * on Brev's available offerings.
 * 
 * For live availability and exact pricing, users should check:
 * - Brev Console: https://console.brev.dev
 * - NVIDIA Brev: https://brev.nvidia.com
 */
export async function getBrevInventory(): Promise<BrevInstance[]> {
  // If a Brev API endpoint becomes available in the future, we can fetch from it
  const brevApiUrl = process.env.BREV_API_URL;
  const brevApiKey = process.env.BREV_API_KEY;
  
  if (brevApiUrl && brevApiKey) {
    try {
      const res = await fetch(brevApiUrl, {
        headers: {
          Authorization: `Bearer ${brevApiKey}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      });
      
      if (res.ok) {
        const data = await res.json();
        
        if (Array.isArray(data.instances || data)) {
          const instances = data.instances || data;
          return instances.map((item: Record<string, unknown>) => ({
            name: String(item.name || item.instance_type || item.id || "Unknown"),
            vram: Number(item.vram || item.gpu_memory_gb || item.memory_gb || 0),
            count: Number(item.count || item.gpu_count || item.num_gpus || 1),
            arch: String(item.arch || item.architecture || item.gpu_arch || "Unknown"),
            price: Number(item.price || item.price_per_hour || item.hourly_price || 0),
          }));
        }
      }
    } catch (error) {
      console.warn("Failed to fetch from Brev API, using curated inventory:", error);
    }
  }
  
  // Return curated Brev inventory
  // This is based on publicly available Brev GPU offerings
  return BREV_GPU_INVENTORY;
}

/**
 * Get instance by name
 */
export function getBrevInstanceByName(name: string): BrevInstance | undefined {
  return BREV_GPU_INVENTORY.find(
    (instance) => instance.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get all available GPU architectures
 */
export function getAvailableArchitectures(): string[] {
  return [...new Set(BREV_GPU_INVENTORY.map((i) => i.arch))];
}

/**
 * Format instance for display
 */
export function formatBrevInstance(instance: BrevInstance): string {
  const totalVram = instance.vram * instance.count;
  const gpuLabel = instance.count > 1 ? `${instance.count}x GPUs` : "1 GPU";
  return `${instance.name} - ${totalVram}GB VRAM (${gpuLabel}) - $${instance.price.toFixed(2)}/hr`;
}
