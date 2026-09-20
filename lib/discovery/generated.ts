import { generateJson } from "@/lib/ai/json";
import { supabase } from "@/lib/supabase/server";
import type { ContentSource, DiscoveredArticle } from "./types";
import { fetchWikipediaPage, type WikipediaPage } from "./wikipedia";

/**
 * Question generation: propose topics on purpose instead of scanning feeds
 * and hoping.
 *
 * RSS was measured at roughly 10% yield through the selection gate, because
 * feeds publish discovery news and d_CuriousMind explains everyday
 * phenomena. No feed of everyday-phenomenon explainers exists to subscribe
 * to — Wonderopolis publishes exactly this format and has no RSS at all.
 *
 * Every generated question is grounded in a real Wikipedia article before it
 * enters the pipeline. An ungrounded question would become an explanation
 * written from the model's memory with no source to cite, which is how you
 * get a confident wrong answer to something like "does fire cast a shadow?".
 */

export const GENERATED_SOURCE_NAME = "Generated Questions";

const QUESTIONS_PER_RUN = Number(
  process.env.QUESTIONS_PER_GENERATION_RUN ?? 8
);

/**
 * How many recent titles to show the generator so it stops repeating itself.
 *
 * Kept small on purpose. At 100 the list dominated the prompt — and most
 * entries are RSS headlines the generator would never produce anyway, so they
 * cost tokens without preventing repeats.
 */
const EXCLUSION_WINDOW = 40;

const SYSTEM_PROMPT = `
You generate topic ideas for d_CuriousMind.

d_CuriousMind answers questions people never thought needed
answering. The reaction we want is:

  "Whoa. I've seen that a thousand times and never once
   wondered why."

Examples of our published work:

- Why do roosters crow — and why also in the afternoon?
- Why do we shiver when we are cold?
- Does fire cast a shadow?
- Why does ice crack when you pour water on it?

What these share:

1. The reader has PERSONALLY SEEN OR FELT the thing.
2. They have never once stopped to question it.
3. The real explanation is surprising, and often the
   obvious answer is wrong.

Draw from ordinary life: the human body, food and drink,
weather, household objects, animals people actually
encounter, sounds, light, sleep, water, heat and cold.

DO NOT generate:

- Anything about a discovery, study, researcher or news event.
- Anything requiring specialist knowledge to have noticed.
- Questions so famous they are cliché ("why is the sky blue",
  "why do we dream", "why is the ocean salty").
- Questions whose answer is common knowledge already.

The best question is one where the reader thinks they
already know the answer, and is wrong.

For each question also give the exact English Wikipedia
article title where the explanation is grounded. Give the
title of the article ABOUT THE PHENOMENON OR THE MECHANISM,
not a tangential one. Prefer plain titles that certainly
exist, for example "Shivering", "Yawn", "Thermoregulation",
"Rooster", "Ice".

Return JSON only, in this exact shape:

{
  "questions": [
    {
      "question": "Why do ...?",
      "wikipediaTitle": "Exact Article Title",
      "why": "one sentence: what the reader wrongly assumes, and what is actually true"
    }
  ]
}
`;

const VERIFY_PROMPT = `
You check whether a Wikipedia article is the right place to
ground the answer to a question.

Say yes when the article covers the underlying mechanism,
even if it never mentions the question's specific objects.
"Why does a metal doorknob feel colder than a wooden one?"
is correctly grounded in "Thermal conductivity" although
that article says nothing about doorknobs.

Say no only when the article is about a genuinely different
subject — for example grounding "why do roosters crow" in
"Gallic rooster", an article about a French national symbol.

Return JSON only:
{ "results": [ { "index": 1, "grounded": true } ] }
`;

interface GeneratedQuestion {
  question: string;
  wikipediaTitle: string;
  why: string;
}

/** Titles already in the pipeline, so the generator does not repeat them. */
async function recentTitles(): Promise<string[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("title, sources!inner(name)")
    .eq("sources.name", GENERATED_SOURCE_NAME)
    .order("discovered_at", { ascending: false })
    .limit(EXCLUSION_WINDOW);

  if (error) {
    // Not fatal — worst case is a repeated question, which the unique
    // constraint on (source_id, url) will reject anyway.
    console.warn(
      "[generated] Could not load recent titles:",
      error.message
    );

    return [];
  }

  return (data ?? []).map((row) => row.title);
}

async function generateQuestions(): Promise<GeneratedQuestion[]> {
  const exclude = await recentTitles();

  const parsed = await generateJson<{ questions?: GeneratedQuestion[] }>(
    "generate questions",
    SYSTEM_PROMPT,
    [
      `Generate ${QUESTIONS_PER_RUN} new questions.`,
      "",
      "Do NOT repeat or closely resemble any of these, which we have already covered:",
      "",
      exclude.length > 0
        ? exclude.map((title) => `- ${title}`).join("\n")
        : "(nothing yet)",
    ].join("\n")
  );

  return Array.isArray(parsed.questions) ? parsed.questions : [];
}

/**
 * Checks that each article actually contains the mechanism answering its
 * question — in ONE call for the whole batch, not one per question.
 *
 * This replaces a lexical overlap check that did not work: correct grounding
 * usually points at the mechanism ("Thermal conductivity and resistivity" for
 * a question about doorknobs), which shares almost no vocabulary with the
 * question. Judging relevance is a language task, so it is asked as one.
 *
 * On failure everything is allowed through: a wrong grounding produces a
 * visibly wrong draft, which the human review gate catches. Losing good
 * questions to a flaky verifier is the worse outcome.
 */
async function verifyGroundings(
  items: { question: string; page: WikipediaPage }[]
): Promise<boolean[]> {
  if (items.length === 0) return [];

  const listing = items
    .map((item, index) =>
      [
        `${index + 1}. QUESTION: ${item.question}`,
        `   ARTICLE: ${item.page.title}`,
        `   OPENING: ${item.page.extract.slice(0, 300)}`,
      ].join("\n")
    )
    .join("\n\n");

  try {
    const parsed = await generateJson<{
      results?: { index: number; grounded: boolean }[];
    }>("verify groundings", VERIFY_PROMPT, listing);

    const verdicts = new Map(
      (parsed.results ?? []).map((r) => [r.index, r.grounded])
    );

    return items.map((_, index) => verdicts.get(index + 1) !== false);
  } catch (error) {
    console.warn(
      "[generated] Grounding verification failed, allowing all through:",
      error instanceof Error ? error.message : error
    );

    return items.map(() => true);
  }
}

/** Stable, readable fragment so two questions can share a Wikipedia article. */
function questionFragment(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export const generatedQuestionsSource: ContentSource = {
  name: GENERATED_SOURCE_NAME,
  baseUrl: "https://en.wikipedia.org",

  accepts(url) {
    return url.hostname === "en.wikipedia.org";
  },

  async discover(): Promise<DiscoveredArticle[]> {
    const questions = await generateQuestions();

    if (questions.length === 0) {
      console.warn("[generated] Model returned no questions");
      return [];
    }

    const grounded: { item: GeneratedQuestion; page: WikipediaPage }[] = [];

    for (const item of questions) {
      if (!item?.question?.trim() || !item?.wikipediaTitle?.trim()) {
        continue;
      }

      const page = await fetchWikipediaPage(item.wikipediaTitle);

      if (!page) {
        console.warn(
          `[generated] Dropped "${item.question}" — no usable article "${item.wikipediaTitle}"`
        );

        continue;
      }

      grounded.push({ item, page });
    }

    const verdicts = await verifyGroundings(
      grounded.map((g) => ({ question: g.item.question, page: g.page }))
    );

    const discovered: DiscoveredArticle[] = [];

    grounded.forEach(({ item, page }, index) => {
      if (!verdicts[index]) {
        console.warn(
          `[generated] Dropped "${item.question}" — "${page.title}" judged unrelated`
        );

        return;
      }

      discovered.push({
        title: item.question.trim(),
        // The fragment keeps each question unique against the
        // (source_id, url) constraint while still pointing at the article
        // the explanation is grounded in.
        url: `${page.url}#${questionFragment(item.question)}`,
        source: GENERATED_SOURCE_NAME,
        category: "everyday",
        excerpt: item.why?.trim() || page.extract.slice(0, 400),
        discoveredAt: new Date().toISOString(),
      });
    });

    console.log(
      `[generated] ${questions.length} proposed, ${discovered.length} grounded`
    );

    return discovered;
  },
};
