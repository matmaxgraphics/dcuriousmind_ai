/**
 * Wikipedia grounding for generated questions.
 *
 * Deliberately looks pages up BY TITLE rather than by keyword search. Search
 * was measured and is unreliable for this purpose:
 *
 *   "rooster crowing"    -> Gallic rooster (a French national symbol)
 *   "shadow of a flame"  -> Prince of Persia 2 (a 1993 video game)
 *   "ice cracking sound" -> Magnum (ice cream)
 *
 * The question generator knows article titles, so it supplies one and this
 * module verifies it exists, is a real article, and is actually about the
 * subject. A question that cannot be grounded is dropped rather than written
 * from the model's memory.
 */

const API = "https://en.wikipedia.org/w/api.php";

// Wikipedia asks for a descriptive user agent and returns 429 under rapid
// sequential requests — observed while testing.
const USER_AGENT =
  "CuriousMind/1.0 (editorial research; https://wikenigma.org.uk)";

const MIN_INTERVAL_MS = 400;

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const waitFor = lastRequestAt + MIN_INTERVAL_MS - Date.now();

  if (waitFor > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitFor));
  }

  lastRequestAt = Date.now();
}

export interface WikipediaPage {
  title: string;
  url: string;
  extract: string;
}

interface WikiApiPage {
  pageid?: number;
  title?: string;
  extract?: string;
  missing?: string | boolean;
  pageprops?: Record<string, string>;
}

/**
 * Fetches a page by exact title, following redirects.
 * Returns null when the page is missing, a disambiguation page, or too thin
 * to be worth grounding an explanation in.
 */
export async function fetchWikipediaPage(
  title: string
): Promise<WikipediaPage | null> {
  await throttle();

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "extracts|pageprops",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
    titles: title,
  });

  let response: Response;

  try {
    response = await fetch(`${API}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    console.warn(
      `[wikipedia] Request failed for "${title}":`,
      error instanceof Error ? error.message : error
    );

    return null;
  }

  if (!response.ok) {
    console.warn(`[wikipedia] "${title}" returned ${response.status}`);
    return null;
  }

  const payload = (await response.json()) as {
    query?: { pages?: Record<string, WikiApiPage> };
  };

  const pages = payload.query?.pages;

  if (!pages) {
    return null;
  }

  const page = Object.values(pages)[0];

  if (!page || page.missing !== undefined || !page.title) {
    console.warn(`[wikipedia] No article titled "${title}"`);
    return null;
  }

  // A disambiguation page grounds nothing.
  if (page.pageprops && "disambiguation" in page.pageprops) {
    console.warn(`[wikipedia] "${page.title}" is a disambiguation page`);
    return null;
  }

  const extract = (page.extract ?? "").trim();

  if (extract.length < 200) {
    console.warn(
      `[wikipedia] "${page.title}" extract is only ${extract.length} chars — too thin`
    );

    return null;
  }

  return {
    title: page.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(
      page.title.replace(/ /g, "_")
    )}`,
    extract,
  };
}

/*
 * A lexical overlap check was tried here and removed. Good grounding points
 * at the MECHANISM, whose article shares little vocabulary with the question:
 * "why does a metal doorknob feel colder than a wooden one?" is correctly
 * grounded in "Thermal conductivity and resistivity", which mentions neither
 * doorknobs nor wood. The check dropped 6 of 8 correctly grounded questions.
 *
 * Grounding is verified in generated.ts by asking the model instead — see
 * verifyGroundings().
 */
