export interface TopicScore {
  interestingness: number;
  curiosityGap: number;
  everydayRelevance: number;
  surpriseFactor: number;
  explainability: number;
  overall: number;
  reason: string;
}