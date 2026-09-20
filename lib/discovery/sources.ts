import type { ContentSource } from "./types";
import { createRssSource, hostMatches } from "./rss";
import { generatedQuestionsSource } from "./generated";

/**
 * The registered content sources.
 *
 * Every `name` here must match a row in the `sources` table — see
 * sql/06_seed_sources.sql. A source with no matching row is skipped with a
 * warning rather than failing the run, and a row with `active = false` is
 * skipped too, which is the kill switch if a feed starts misbehaving.
 */

/** Wikenigma — the "what don't we know?" pillar. */
const wikenigma = createRssSource({
  name: "Wikenigma",
  baseUrl: "https://wikenigma.org.uk",
  feedUrl: "https://wikenigma.org.uk/feed.php",
  category: "unknowns",
  accepts(url) {
    if (!hostMatches(url, "wikenigma.org.uk")) return false;
    // Only article pages, not index or navigation pages.
    if (!url.pathname.startsWith("/content/")) return false;
    if (url.searchParams.has("idx")) return false;

    return true;
  },
});

/** ScienceDaily — Strange & Offbeat. Weird discoveries. */
const scienceDaily = createRssSource({
  name: "ScienceDaily Strange & Offbeat",
  baseUrl: "https://www.sciencedaily.com",
  feedUrl: "https://www.sciencedaily.com/rss/strange_offbeat.xml",
  category: "strange",
  accepts(url) {
    if (!hostMatches(url, "sciencedaily.com")) return false;
    // Individual releases live under /releases/<year>/...
    return url.pathname.startsWith("/releases/");
  },
});

/** ScienceAlert — accessible, curiosity-friendly science. */
const scienceAlert = createRssSource({
  name: "ScienceAlert",
  baseUrl: "https://www.sciencealert.com",
  feedUrl: "https://www.sciencealert.com/feed",
  category: "science",
  accepts(url) {
    if (!hostMatches(url, "sciencealert.com")) return false;
    // Drop the feed's own link and the site root.
    if (url.pathname === "/" || url.pathname.startsWith("/feed")) return false;

    return true;
  },
});

/** Smithsonian — history, archaeology, culture and science. */
const smithsonian = createRssSource({
  name: "Smithsonian Magazine",
  baseUrl: "https://www.smithsonianmag.com",
  feedUrl: "https://www.smithsonianmag.com/rss/latest_articles/",
  category: "history",
  accepts(url) {
    if (!hostMatches(url, "smithsonianmag.com")) return false;
    if (url.pathname === "/") return false;

    return true;
  },
});

/** Discover Magazine — surprising science, the "did you know?" pillar. */
const discoverMagazine = createRssSource({
  name: "Discover Magazine",
  baseUrl: "https://www.discovermagazine.com",
  feedUrl: "https://www.discovermagazine.com/rss/all",
  category: "science",
  accepts(url) {
    if (!hostMatches(url, "discovermagazine.com")) return false;
    if (url.pathname === "/") return false;

    return true;
  },
});

/**
 * Mental Floss — the closest thing to an everyday-phenomenon feed that
 * actually publishes RSS. Measured yield through the selection gate was the
 * best of any feed tested ("Is It Really Illegal to Burn Money?" passes,
 * "The Best Coffee Cities in America, Ranked" does not), and it carries ~80
 * items per fetch, so even a low pass rate produces candidates.
 */
const mentalFloss = createRssSource({
  name: "Mental Floss",
  baseUrl: "https://www.mentalfloss.com",
  feedUrl: "https://www.mentalfloss.com/rss.xml",
  category: "everyday",
  accepts(url) {
    if (!hostMatches(url, "mentalfloss.com")) return false;
    if (url.pathname === "/") return false;

    return true;
  },
});

export const contentSources: ContentSource[] = [
  generatedQuestionsSource,
  mentalFloss,
  wikenigma,
  scienceDaily,
  scienceAlert,
  smithsonian,
  discoverMagazine,
];
