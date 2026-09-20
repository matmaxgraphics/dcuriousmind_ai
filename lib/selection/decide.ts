import type { TopicScore } from "./types";

/**
 * Turns a set of dimension scores into a selection decision.
 *
 * Kept out of the AI call on purpose. When the model produced `overall`
 * itself, it behaved like an unweighted average: everyday_relevance sat at
 * 5-6 while interestingness and curiosity_gap sat at 8-9, so overall landed
 * at 7-8 and everything passed. Four dimensions outvoted the only one that
 * encodes what d_CuriousMind is.
 *
 * d_CuriousMind explains things the reader has personally witnessed and never
 * questioned — why roosters crow, why we shiver, why ice cracks. It is not a
 * science news account. So relevance to everyday life and the size of the
 * curiosity gap carry most of the weight, and a topic that fails either one
 * is rejected however fascinating it is.
 */

const WEIGHTS = {
  everydayRelevance: 0.35,
  curiosityGap: 0.3,
  surpriseFactor: 0.15,
  explainability: 0.12,
  interestingness: 0.08,
} as const;

/** A topic below this on everyday relevance is not our brand, full stop. */
export const MIN_EVERYDAY_RELEVANCE = 7;

/** Weighted score required to select. */
export const SELECTION_THRESHOLD = 7;

export interface SelectionDecision {
  overall: number;
  selected: boolean;
  rejectionReason?: string;
}

function clamp(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;

  return Math.min(10, Math.max(0, n));
}

export function computeOverall(score: TopicScore): number {
  const weighted =
    clamp(score.everydayRelevance) * WEIGHTS.everydayRelevance +
    clamp(score.curiosityGap) * WEIGHTS.curiosityGap +
    clamp(score.surpriseFactor) * WEIGHTS.surpriseFactor +
    clamp(score.explainability) * WEIGHTS.explainability +
    clamp(score.interestingness) * WEIGHTS.interestingness;

  return Math.round(weighted * 10) / 10;
}

export function decideSelection(score: TopicScore): SelectionDecision {
  const overall = computeOverall(score);

  // Hard gate 1: a story about a new discovery, study or news event is not a
  // d_CuriousMind topic even when it is genuinely fascinating.
  if (score.phenomenonType === "discovery_news") {
    return {
      overall,
      selected: false,
      rejectionReason:
        "Discovery or news story rather than an everyday phenomenon.",
    };
  }

  // Hard gate 2: the reader must recognise this from their own life.
  if (clamp(score.everydayRelevance) < MIN_EVERYDAY_RELEVANCE) {
    return {
      overall,
      selected: false,
      rejectionReason: `Everyday relevance ${score.everydayRelevance}/10 is below the ${MIN_EVERYDAY_RELEVANCE} required — not something the reader has witnessed themselves.`,
    };
  }

  if (overall < SELECTION_THRESHOLD) {
    return {
      overall,
      selected: false,
      rejectionReason: `Weighted score ${overall} is below ${SELECTION_THRESHOLD}.`,
    };
  }

  return { overall, selected: true };
}
