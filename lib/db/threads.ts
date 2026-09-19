import { supabase } from "@/lib/supabase/server";

import type { GeneratedThread } from "@/lib/thread/types";

export async function saveThread(
  draftId: string,
  thread: GeneratedThread
) {
  const { data: threadData, error: threadError } =
    await supabase
      .from("threads")
      .insert({
        draft_id: draftId,
        title: thread.title,
        source_url: thread.sourceUrl,
      })
      .select()
      .single();

  if (threadError) {
    throw new Error(
      `Failed to save thread: ${threadError.message}`
    );
  }

  const tweets = thread.tweets.map((tweet) => ({
    thread_id: threadData.id,
    position: tweet.position,
    text: tweet.text,
  }));

  const { data: tweetData, error: tweetError } =
    await supabase
      .from("thread_tweets")
      .insert(tweets)
      .select();

  if (tweetError) {
    // Avoid leaving a thread without its tweets.
    await supabase
      .from("threads")
      .delete()
      .eq("id", threadData.id);

    throw new Error(
      `Failed to save thread tweets: ${tweetError.message}`
    );
  }

  return {
    thread: threadData,
    tweets: tweetData,
  };
}

export async function getThreadByDraftId(draftId: string) {
  // Deliberately not maybeSingle(): that errors when a draft has more than one
  // thread, which is exactly the state this check exists to detect. Take the
  // newest and let the caller skip.
  const { data, error } = await supabase
    .from("threads")
    .select()
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(
      `Failed to fetch thread by draft id: ${error.message}`
    );
  }

  return data?.[0] ?? null;
}