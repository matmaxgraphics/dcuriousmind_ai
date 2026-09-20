import { supabase } from "@/lib/supabase/server";
import {
  getCredentials,
  getAuthenticatedUser,
  postTweet,
  XApiError,
} from "./x-client";

export const MAX_TWEET_LENGTH = 280;

export class PublishError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** How many tweets made it out before the failure. */
    readonly posted: number = 0
  ) {
    super(message);
    this.name = "PublishError";
  }
}

export interface PublishResult {
  threadId: string;
  xThreadId: string;
  username: string;
  posted: number;
  resumed: number;
  url: string;
}

interface ThreadTweetRow {
  id: string;
  position: number;
  text: string;
  x_tweet_id: string | null;
}

/**
 * Publishes an approved thread to X.
 *
 * Deliberately separate from generation: nothing in the AI pipeline can reach
 * this function, so a successful generation can never cause a post.
 *
 * Each tweet's returned id is written to the database immediately, before the
 * next one is sent. That is what makes a failed publish resumable without
 * double-posting: a retry skips every tweet that already carries an id.
 */
export async function publishThread(
  threadId: string
): Promise<PublishResult> {
  const credentials = getCredentials();

  if (!credentials) {
    throw new PublishError(
      "X credentials are not configured. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN and X_ACCESS_TOKEN_SECRET.",
      503
    );
  }

  const { data: thread, error } = await supabase
    .from("threads")
    .select("id, title, status, x_thread_id, thread_tweets (id, position, text, x_tweet_id)")
    .eq("id", threadId)
    .single();

  if (error || !thread) {
    throw new PublishError("Thread not found.", 404);
  }

  if (thread.status === "published") {
    throw new PublishError(
      "This thread has already been published.",
      409
    );
  }

  // The approval gate. Only a human moving a thread to `approved` in the
  // dashboard can make it publishable.
  if (thread.status !== "approved") {
    throw new PublishError(
      `Only approved threads can be published. This one is "${thread.status}".`,
      409
    );
  }

  const tweets: ThreadTweetRow[] = Array.isArray(thread.thread_tweets)
    ? [...thread.thread_tweets].sort((a, b) => a.position - b.position)
    : [];

  if (tweets.length === 0) {
    throw new PublishError("This thread has no tweets.", 400);
  }

  const overLong = tweets.filter(
    (tweet) => tweet.text.length > MAX_TWEET_LENGTH
  );

  if (overLong.length > 0) {
    throw new PublishError(
      `Tweet ${overLong[0].position} is ${overLong[0].text.length} characters, over the ${MAX_TWEET_LENGTH} limit.`,
      400
    );
  }

  // Confirm which account we are about to post as. Cheap, and it means the
  // result can state the handle rather than assuming it.
  const me = await getAuthenticatedUser(credentials);

  let previousTweetId: string | undefined;
  let posted = 0;
  let resumed = 0;

  for (const tweet of tweets) {
    // Already sent on an earlier attempt — don't post it twice.
    if (tweet.x_tweet_id) {
      previousTweetId = tweet.x_tweet_id;
      resumed++;
      continue;
    }

    try {
      const result = await postTweet(credentials, tweet.text, previousTweetId);

      // Record before continuing, so a crash on the next tweet cannot lose
      // track of what has already gone out.
      const { error: saveError } = await supabase
        .from("thread_tweets")
        .update({ x_tweet_id: result.id })
        .eq("id", tweet.id);

      if (saveError) {
        throw new PublishError(
          `Tweet ${tweet.position} was posted (id ${result.id}) but could not be recorded: ${saveError.message}. Record it manually before retrying, or the retry will post it again.`,
          500,
          posted
        );
      }

      previousTweetId = result.id;
      posted++;
    } catch (err) {
      if (err instanceof PublishError) {
        throw err;
      }

      const message =
        err instanceof XApiError ? err.message : "Unknown publishing error";
      const status = err instanceof XApiError ? err.status : 500;

      throw new PublishError(
        `Failed on tweet ${tweet.position} of ${tweets.length}: ${message} ${
          posted > 0
            ? `${posted} tweet(s) were already posted; retrying will resume from tweet ${tweet.position}.`
            : "Nothing was posted."
        }`,
        status,
        posted
      );
    }
  }

  const rootTweetId = tweets[0].x_tweet_id ?? previousTweetId;

  if (!rootTweetId) {
    throw new PublishError(
      "Published, but the root tweet id is missing.",
      500,
      posted
    );
  }

  // Only now, with every tweet confirmed out and recorded, does the thread
  // become 'published'. The database CHECK constraint also refuses this
  // update if x_thread_id were somehow null.
  const { error: statusError } = await supabase
    .from("threads")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      x_thread_id: rootTweetId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  if (statusError) {
    throw new PublishError(
      `All ${posted} tweet(s) were posted, but the thread could not be marked published: ${statusError.message}`,
      500,
      posted
    );
  }

  return {
    threadId,
    xThreadId: rootTweetId,
    username: me.username,
    posted,
    resumed,
    url: `https://x.com/${me.username}/status/${rootTweetId}`,
  };
}
