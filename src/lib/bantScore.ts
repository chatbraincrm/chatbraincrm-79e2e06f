// Shared BANT scoring utility — used by LeadBANTTab and pipeline card.

export const BANT_DEFINITION = [
  { key: 'bant_budget' as const, weight: 25, questions: 4 },
  { key: 'bant_authority' as const, weight: 25, questions: 4 },
  { key: 'bant_need' as const, weight: 30, questions: 5 },
  { key: 'bant_timing' as const, weight: 20, questions: 4 },
];

export type BantField = typeof BANT_DEFINITION[number]['key'];

interface BantSource {
  bant_budget?: string | null;
  bant_authority?: string | null;
  bant_need?: string | null;
  bant_timing?: string | null;
}

function parseFilledCount(value: string | null | undefined, questionCount: number): number {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      let filled = 0;
      for (let i = 1; i <= questionCount; i++) {
        const v = parsed[`q${i}`];
        if (typeof v === 'string' && v.trim()) filled++;
      }
      return filled;
    }
  } catch {
    // legacy plain text counts as 1 answer
  }
  return value.trim() ? 1 : 0;
}

export function computeBantScore(lead: BantSource): number {
  let total = 0;
  for (const cat of BANT_DEFINITION) {
    const filled = parseFilledCount(lead[cat.key], cat.questions);
    total += cat.weight * (filled / cat.questions);
  }
  return Math.round(total);
}

export function getBantTier(score: number): 'high' | 'good' | 'partial' | 'low' {
  if (score >= 76) return 'high';
  if (score >= 51) return 'good';
  if (score >= 26) return 'partial';
  return 'low';
}
