import { createBrowserClient } from "@supabase/ssr";

/** Browser client, for the recovery pages that have to exchange a code in the browser. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
