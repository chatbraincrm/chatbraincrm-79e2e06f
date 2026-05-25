// Helper compartilhado para resolver a chave de IA de uma organização.
// Cada organização pode ter chaves próprias da OpenAI / Anthropic / Gemini
// salvas em `org_ai_credentials` (modelo white-label).
// O roteador `org_ai_routing` decide qual provedor usar para cada capacidade.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AICapability =
  | "agent_chat"
  | "sales_copilot"
  | "audio_transcription"
  | "image_vision"
  | "content_generation"
  | "analysis_insights"
  | "embeddings";

export type AIProvider = "openai" | "anthropic" | "gemini";

export interface ResolvedAIProvider {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  fallbackToLovable: boolean; // kept for compat — always false now
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Defaults — usados quando a org não definiu roteamento explícito.
const DEFAULT_ROUTING: Record<AICapability, { provider: AIProvider; model?: string }> = {
  agent_chat:           { provider: "openai", model: "gpt-5-mini" },
  sales_copilot:        { provider: "openai", model: "gpt-5-mini" },
  audio_transcription:  { provider: "openai", model: "whisper-1" },
  image_vision:         { provider: "openai", model: "gpt-5-mini" },
  content_generation:   { provider: "openai", model: "gpt-5-mini" },
  analysis_insights:    { provider: "openai", model: "gpt-5-mini" },
  embeddings:           { provider: "openai", model: "text-embedding-3-small" },
};

export async function resolveAIProvider(
  organizationId: string,
  capability: AICapability,
): Promise<ResolvedAIProvider> {
  const supabase = adminClient();

  // 1) Lê roteamento da org (se existir).
  const { data: routing } = await supabase
    .from("org_ai_routing")
    .select("provider, model, fallback_to_lovable")
    .eq("organization_id", organizationId)
    .eq("capability", capability)
    .maybeSingle();

  // 'lovable' provider in DB is transparently remapped to 'openai'
  const rawProvider = (routing?.provider || DEFAULT_ROUTING[capability].provider) as string;
  const mappedProvider: AIProvider = rawProvider === "lovable" ? "openai" : rawProvider as AIProvider;

  const wanted = {
    provider: mappedProvider,
    model: routing?.model || DEFAULT_ROUTING[capability].model,
    fallback: routing?.fallback_to_lovable ?? true,
  };

  // 2) Tenta chave da org primeiro.
  const { data: cred } = await supabase
    .from("org_ai_credentials")
    .select("api_key_encrypted, model_default")
    .eq("organization_id", organizationId)
    .eq("provider", wanted.provider)
    .maybeSingle();

  if (cred?.api_key_encrypted) {
    return {
      provider: wanted.provider,
      apiKey: cred.api_key_encrypted,
      model: wanted.model || cred.model_default || undefined,
      fallbackToLovable: false,
    };
  }

  // 3) Tenta secret global de plataforma (OPENAI_API_KEY).
  const envName = `${wanted.provider.toUpperCase()}_API_KEY`;
  const envKey = Deno.env.get(envName);
  if (envKey) {
    return { provider: wanted.provider, apiKey: envKey, model: wanted.model, fallbackToLovable: false };
  }

  throw new Error(`Provedor ${wanted.provider} não tem chave configurada para a organização ${organizationId}`);
}

export async function logRouterFailure(
  organizationId: string,
  capability: AICapability,
  provider: AIProvider,
  statusCode: number | null,
  errorMessage: string,
  fellBackTo?: AIProvider,
) {
  try {
    const supabase = adminClient();
    await supabase.from("ai_router_failures").insert({
      organization_id: organizationId,
      capability,
      provider,
      status_code: statusCode,
      error_message: errorMessage.slice(0, 500),
      fell_back_to: fellBackTo ?? null,
    });
  } catch (e) {
    console.error("[ai-credentials] failed to log router failure", e);
  }
}
