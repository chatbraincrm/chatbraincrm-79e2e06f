// High-level AI call helper that automatically uses the org's routing config
// (org key or platform OpenAI key) and applies fallback when allowed.

import { resolveAIConfig, logAIConfig, prepareAIRequestBody, ResolvedAIConfig, AICapability } from './ai-router.ts';

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-5-mini';

export interface AICallOptions {
  organizationId?: string | null;
  capability?: AICapability | string;
  model?: string;
  body: Record<string, any>;
  label?: string;
  returnRaw?: boolean;
  supabase?: any;
}

async function platformFallbackResponse(model: string, body: Record<string, any>) {
  const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  return await fetch(OPENAI_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({ ...body, model: model || DEFAULT_MODEL }),
  });
}

/**
 * Performs an AI chat completion respecting the org routing config.
 * Returns the Response. Caller is responsible for parsing JSON / handling stream.
 */
export async function aiChat(opts: AICallOptions): Promise<{
  response: Response;
  config: ResolvedAIConfig;
  usedFallback: boolean;
}> {
  const { organizationId, capability = 'agent_chat', model, body, label, supabase } = opts;

  let cfg: ResolvedAIConfig;
  if (supabase && organizationId) {
    cfg = await resolveAIConfig(supabase, organizationId, capability, model);
  } else {
    const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
    cfg = {
      endpoint: OPENAI_CHAT_ENDPOINT,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      model: model || DEFAULT_MODEL,
      provider: 'openai',
      source: 'platform_key',
      allowFallback: false,
      apiKey: openaiKey,
    };
  }

  if (label) logAIConfig(label, cfg);

  let response = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: cfg.headers,
    body: JSON.stringify(prepareAIRequestBody(body, cfg)),
  });

  let usedFallback = false;
  if (!response.ok && cfg.allowFallback && response.status !== 429 && response.status !== 401) {
    console.warn(`[${label ?? 'ai-call'}] ${cfg.provider} returned ${response.status}, falling back to platform OpenAI key`);
    response = await platformFallbackResponse(model || DEFAULT_MODEL, body);
    usedFallback = true;
  }

  return { response, config: cfg, usedFallback };
}

/** Friendly error message helper for non-ok responses. */
export async function describeAIError(response: Response, providerLabel: string): Promise<string> {
  const text = await response.text().catch(() => '');
  if (response.status === 429) return 'Limite de requisições excedido. Tente novamente em alguns segundos.';
  if (response.status === 402) {
    return 'Sua conta OpenAI está sem créditos ou bloqueada. Verifique em platform.openai.com/billing.';
  }
  if (response.status === 401 || response.status === 403) {
    return `Chave da OpenAI inválida ou sem permissão. Verifique em Integrações → IA.`;
  }
  return `Erro da OpenAI (${response.status}): ${text.slice(0, 200) || response.statusText}`;
}
