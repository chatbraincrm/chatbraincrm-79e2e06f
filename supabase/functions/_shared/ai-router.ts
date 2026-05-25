// Shared AI router: resolves which provider/endpoint/key to use based on org_ai_routing
// + org_ai_credentials. Falls back to platform-level OpenAI key when external key missing.

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_EMBEDDINGS_ENDPOINT = 'https://api.openai.com/v1/embeddings';
const OPENAI_TRANSCRIPTIONS_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_MODEL = 'gpt-5-mini';

export type AICapability =
  | 'agent_chat'
  | 'sales_copilot'
  | 'audio_transcription'
  | 'image_vision'
  | 'content_generation'
  | 'analysis_insights'
  | 'embeddings';

export interface ResolvedAIConfig {
  endpoint: string;
  headers: Record<string, string>;
  model: string;
  provider: 'openai' | string;
  source: 'external_key' | 'platform_key' | 'fallback_platform';
  allowFallback: boolean;
  apiKey: string;
}

/**
 * Maps legacy Lovable/Google-prefixed model names to OpenAI equivalents.
 */
const MODEL_MAP_TO_OPENAI: Record<string, string> = {
  'google/gemini-3-flash-preview': 'gpt-5-mini',
  'google/gemini-3.1-pro-preview': 'gpt-5',
  'google/gemini-2.5-flash': 'gpt-5-mini',
  'google/gemini-2.5-flash-lite': 'gpt-5-nano',
  'google/gemini-2.5-pro': 'gpt-5',
  'openai/gpt-5': 'gpt-5',
  'openai/gpt-5-mini': 'gpt-5-mini',
  'openai/gpt-5-nano': 'gpt-5-nano',
  'openai/gpt-5.2': 'gpt-5.2',
};

function adaptModelForOpenAI(model: string): string {
  if (!model) return DEFAULT_MODEL;
  if (MODEL_MAP_TO_OPENAI[model]) return MODEL_MAP_TO_OPENAI[model];
  if (model.startsWith('openai/')) return model.slice('openai/'.length);
  if (model.startsWith('google/')) return DEFAULT_MODEL;
  if (model.includes('/')) return model.split('/').pop()!;
  return model;
}

export function prepareAIRequestBody(body: Record<string, any>, cfg: ResolvedAIConfig): Record<string, any> {
  const payload: Record<string, any> = { ...body, model: cfg.model };

  if (String(cfg.model || '').match(/^(gpt-5|o[0-9])/)) {
    if (payload.max_tokens !== undefined && payload.max_completion_tokens === undefined) {
      payload.max_completion_tokens = payload.max_tokens;
    }
    delete payload.max_tokens;
    if (payload.temperature !== undefined && payload.temperature !== 1) {
      delete payload.temperature;
    }
  }

  return payload;
}

function buildOpenAIConfig(
  apiKey: string,
  model: string,
  allowFallback: boolean,
  source: ResolvedAIConfig['source'],
): ResolvedAIConfig {
  return {
    endpoint: OPENAI_CHAT_ENDPOINT,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    model: adaptModelForOpenAI(model),
    provider: 'openai',
    source,
    allowFallback,
    apiKey,
  };
}

/**
 * Resolves AI configuration for an organization.
 * - Reads org_ai_routing for the given capability.
 * - Uses org OpenAI credential if available, otherwise falls back to platform OPENAI_API_KEY.
 */
export async function resolveAIConfig(
  supabase: any,
  organizationId: string | null | undefined,
  capability: AICapability | string = 'agent_chat',
  preferredModel?: string,
): Promise<ResolvedAIConfig> {
  const platformKey = Deno.env.get('OPENAI_API_KEY') || '';
  const defaultConfig = buildOpenAIConfig(platformKey, preferredModel || DEFAULT_MODEL, false, 'platform_key');

  if (!organizationId) return defaultConfig;

  try {
    const { data: routing } = await supabase
      .from('org_ai_routing')
      .select('provider, model, fallback_to_lovable')
      .eq('organization_id', organizationId)
      .eq('capability', capability)
      .maybeSingle();

    const routedModel = routing?.model || preferredModel || DEFAULT_MODEL;
    const allowFallback = routing?.fallback_to_lovable !== false;
    const provider = ((routing?.provider || 'openai') as string).toLowerCase();

    // 'lovable' routing entries are transparently redirected to OpenAI
    const targetProvider = provider === 'lovable' ? 'openai' : provider;

    if (targetProvider === 'openai') {
      const { data: cred } = await supabase
        .from('org_ai_credentials')
        .select('api_key_encrypted')
        .eq('organization_id', organizationId)
        .eq('provider', 'openai')
        .maybeSingle();

      const orgKey = cred?.api_key_encrypted as string | undefined;
      if (orgKey) {
        return buildOpenAIConfig(orgKey, routedModel, allowFallback, 'external_key');
      }
      return buildOpenAIConfig(platformKey, routedModel, false, 'platform_key');
    }

    // Other providers: try to load credential
    const { data: cred } = await supabase
      .from('org_ai_credentials')
      .select('api_key_encrypted')
      .eq('organization_id', organizationId)
      .eq('provider', targetProvider)
      .maybeSingle();

    const apiKey = cred?.api_key_encrypted as string | undefined;

    if (!apiKey) {
      if (allowFallback) {
        console.warn(`[ai-router] No ${targetProvider} key for org ${organizationId} (cap=${capability}), using OpenAI platform key`);
        return buildOpenAIConfig(platformKey, preferredModel || DEFAULT_MODEL, false, 'fallback_platform');
      }
      throw new Error(`Sem chave de API para o provedor "${targetProvider}". Cadastre em Integrações ou ative o fallback.`);
    }

    // For now all external providers go through OpenAI endpoint
    return buildOpenAIConfig(apiKey, routedModel, allowFallback, 'external_key');
  } catch (err: any) {
    if (err?.message?.startsWith('Sem chave') || err?.message?.startsWith('Provedor')) {
      throw err;
    }
    console.warn('[ai-router] Lookup failed, using OpenAI platform key:', err);
    return defaultConfig;
  }
}

/**
 * Returns embeddings config (always OpenAI).
 */
export async function resolveEmbeddingsConfig(
  supabase: any,
  organizationId: string | null | undefined,
): Promise<ResolvedAIConfig> {
  const cfg = await resolveAIConfig(supabase, organizationId, 'embeddings', 'text-embedding-3-small');
  return { ...cfg, endpoint: OPENAI_EMBEDDINGS_ENDPOINT, model: cfg.model || 'text-embedding-3-small' };
}

/**
 * Returns transcription config (always OpenAI).
 */
export async function resolveTranscriptionConfig(
  supabase: any,
  organizationId: string | null | undefined,
): Promise<ResolvedAIConfig> {
  const cfg = await resolveAIConfig(supabase, organizationId, 'audio_transcription', 'gpt-4o-transcribe');
  return { ...cfg, endpoint: OPENAI_TRANSCRIPTIONS_ENDPOINT, model: cfg.model || 'gpt-4o-transcribe' };
}

export function logAIConfig(label: string, cfg: ResolvedAIConfig) {
  console.log(`[${label}] AI Provider: ${cfg.provider} | Model: ${cfg.model} | Source: ${cfg.source}`);
}
