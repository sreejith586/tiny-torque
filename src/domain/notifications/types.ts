import type { Tables, Enums } from '@/lib/supabase/types';

export type NotificationRow = Tables<'notifications'>;
export type NotificationType = Enums<'notification_type'>;
