import { supabase } from './supabase';

/** Call a Supabase Edge Function with the current user's JWT and typed result. */
export async function invokeFn<T>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body ?? {} });
  if (error) {
    // Edge functions return a JSON { error } body on failure — surface it if present.
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json();
        if (j?.error) detail = j.error;
      }
    } catch {
      /* keep original message */
    }
    throw new Error(detail);
  }
  return data as T;
}
