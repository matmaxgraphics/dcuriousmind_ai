import { supabase } from "@/lib/supabase/server";

/**
 * Looks up a source row by name. Returns null when there is no such row, so a
 * source registered in code but not yet seeded into the database is skipped
 * rather than failing the whole discovery run.
 */
export async function getSourceByName(name: string) {
  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("name", name)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to find source "${name}": ${error.message}`
    );
  }

  return data;
}