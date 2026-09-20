/**
 * How a topic relates to the reader.
 *
 * - everyday_phenomenon: something they have seen or felt themselves and
 *   never questioned. This is what d_CuriousMind exists for.
 * - discovery_news: a new study, finding, species, event or announcement.
 *   Novel to the world, not familiar to the reader. Rejected outright.
 * - general_interest: interesting, familiar-ish, but not a phenomenon the
 *   reader has personally observed. Allowed through on merit.
 */
export type PhenomenonType =
  | "everyday_phenomenon"
  | "discovery_news"
  | "general_interest";

export interface TopicScore {
  phenomenonType: PhenomenonType;
  interestingness: number;
  curiosityGap: number;
  everydayRelevance: number;
  surpriseFactor: number;
  explainability: number;
  /** Computed in code by decideSelection, not by the model. */
  overall: number;
  reason: string;
}
