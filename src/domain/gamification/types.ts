import type { Tables, Enums } from '@/lib/supabase/types';
import type { BadgeState, LevelProgress } from './rules';

export type AchievementRow = Tables<'achievements'>;
export type UserAchievementRow = Tables<'user_achievements'>;
export type FeedbackRow = Tables<'feedback'>;
export type FeedbackKind = Enums<'feedback_kind'>;

/** A badge as the UI shows it: definition + the viewer's progress. */
export interface Badge extends BadgeState {
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

export interface GamificationSummary {
  level: LevelProgress;
  badges: Badge[];
  /** Badge keys unlocked by THIS sync — drives the unlock toast. */
  newlyUnlocked: string[];
  xpDelta: number;
}

export type {
  AchievementDef,
  BadgeState,
  CollectionStats,
  GamificationEvent,
  GamificationState,
  LevelDef,
  LevelProgress,
} from './rules';
