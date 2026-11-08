// zod at the boundary (D-013): the `quests.rule` jsonb is data a migration seeds, so it is parsed
// (never trusted) before the rules run on it — a malformed row is skipped, not thrown.
import { z } from 'zod';

export const QUEST_RULE_KINDS = ['event_count', 'event_days'] as const;

export const questRuleSchema = z
  .object({
    kind: z.enum(QUEST_RULE_KINDS).default('event_count'),
    event: z.string().min(1).max(80),
    threshold: z.number().int().positive().max(10_000),
  })
  .passthrough();
export type QuestRule = z.infer<typeof questRuleSchema>;

export function parseQuestRule(rule: unknown): QuestRule | null {
  const parsed = questRuleSchema.safeParse(rule);
  return parsed.success ? parsed.data : null;
}
