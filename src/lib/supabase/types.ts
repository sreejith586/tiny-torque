// Shared Supabase type helpers. One of the two places allowed to import
// @supabase/* (D-007): src/lib/supabase/* and src/domain/*/repo.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, TablesInsert, TablesUpdate, Enums } from '@/types/supabase';

export type Client = SupabaseClient<Database>;
export type { Database, Tables, TablesInsert, TablesUpdate, Enums };
