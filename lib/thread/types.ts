export interface ThreadTweet {
  position: number;
  text: string;
}

export interface GeneratedThread {
  title: string;
  tweets: ThreadTweet[];
  sourceUrl: string;
}