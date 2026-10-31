import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as managedClient } from '../integrations/supabase/client';
import type { Database } from './trading-database.types';

// Preserve the existing application's schema contract during Cloud migration.
// This reuses the managed session/client; it does not create tables or migrate data.
export const supabase = managedClient as unknown as SupabaseClient<Database>;