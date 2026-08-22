import type { GeneratedThread } from "./types";

const MAX_TWEET_LENGTH = 280;

export function validateThread(
  thread: GeneratedThread
): string[] {
  const errors: string[] = [];

  if (
    thread.tweets.length < 5 ||
    thread.tweets.length > 7
  ) {
    errors.push(
      "Thread must contain between 5 and 7 tweets."
    );
  }

  for (const tweet of thread.tweets) {
    if (!tweet.text.trim()) {
      errors.push(
        `Tweet ${tweet.position} is empty.`
      );
    }

    if (tweet.text.length > MAX_TWEET_LENGTH) {
      errors.push(
        `Tweet ${tweet.position} exceeds 280 characters (${tweet.text.length}).`
      );
    }
  }

  return errors;
}