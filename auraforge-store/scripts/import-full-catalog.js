#!/usr/bin/env node
/**
 * Import the full Technocrat Nigeria product catalog into src/data/products.json.
 *
 *   node scripts/import-full-catalog.js              # full run (resumes automatically if interrupted)
 *   node scripts/import-full-catalog.js --fresh      # ignore saved progress and start over
 *   node scripts/import-full-catalog.js --limit 20   # optional quick test: stop after 20 products
 *   node scripts/import-full-catalog.js --delay 2000 # wait 2 s between requests (default 1200 ms)
 *
 * HOW IT WORKS
 *  The shop page (https://www.technocratng.com/shop/products) shows only the first 24 products in its
 *  HTML ("Showing 1–24 of 2430"); the rest load through the site's /api/, which the site's robots.txt
 *  asks automated tools not to use, and ?page=2 returns an empty page. So this script:
 *   1. Reads robots.txt and never requests a disallowed path (e.g. /api/).
 *   2. Collects product links from the sitemap, the shop page, and every brand/category/sort view
 *      linked from the shop (each shows its own first 24 products).
 *   3. Visits each product page (allowed by robots.txt) and follows its "More in …" / "More from …"
 *      links to find more products, until no new products turn up.
 *   4. On each product page, reads the exact title, the ₦ price, stock status, category, brand, and the
 *      image that the page actually renders (src / data-src / data-lazy-src / srcset). Next.js
 *      "/_next/image?url=…" links are decoded to the original image file URL; relative paths are made absolute.
 *   5. Applies your markup (costPrice × 1.06) and writes src/data/products.json.
 *
 *  Requests go one at a time with a pause between them, retry politely on errors, and progress is saved
 *  to scripts/.technocrat-progress.json so a long run (about an hour for ~2,400 products) can be resumed.
 *
 * Requirements: Node.js 18 or newer (uses the built-in fetch). No extra packages.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
};

const BASE_URL = (process.env.TECHNOCRAT_BASE_URL || "https://www.technocratng.com").replace(/\/+$/, "");
const SITE_HOSTS = new Set([new URL(BASE_URL).host, new URL(BASE_URL).host.replace(/^www\./, "")]);
const MARKUP = Number(process.env.CATALOG_MARKUP || "1.06");
const DELAY_MS = Number(argValue("delay") || process.env.CATALOG_DELAY_MS || "1200");
const LIMIT = argValue("limit") ? Number(argValue("limit")) : Infinity;
const FRESH = args.includes("--fresh");
const MAX_LISTING_PAGES = Number(process.env.CATALOG_MAX_LISTING_PAGES || "1500");
const TIMEOUT_MS = 30_000;
const USER_AGENT =
  process.env.CATALOG_USER_AGENT || "AuraForgeCatalogImport/1.0 (+reseller catalog sync; one request at a time)";

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_FILE = path.join(ROOT, "src", "data", "products.json");
const PROGRESS_FILE = path.join(__dirname, ".technocrat-progress.json");

const PRODUCT_PATH = /^\/shop\/(?:products|parts)\/[a-z0-9][a-z0-9-]*\/?$/i;
const LISTING_PATH = /^\/shop\/(?:products|parts)\/?$|^\/shop\/categor(?:y|ies)\/[a-z0-9-]+\/?$/i;
const LISTING_PARAMS = new Set(["brand", "category", "sort", "type", "q"]);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", naira: "₦" };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** HTML with scripts, styles and comments removed (so hidden data blobs never match text searches). */
function stripNonVisible(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

/** Visible text: tags become spaces, struck-through (old) prices are removed. */
function toText(html) {
  return decodeEntities(
    html
      .replace(/<(del|s|strike)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d|span|a|button|section|article)>/gi, " $& ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function getAttr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!match) return undefined;
  return decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
}

function sameSite(url) {
  try {
    return SITE_HOSTS.has(new URL(url).host);
  } catch {
    return false;
  }
}

/** Absolute URL on the canonical host, without hash; "/x" and "https://technocratng.com/x" both normalise. */
function normaliseUrl(href, base = BASE_URL) {
  try {
    const url = new URL(decodeEntities(href), base);
    if (SITE_HOSTS.has(url.host)) url.host = new URL(BASE_URL).host;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Turn an <img> source into a direct, absolute image file URL.
 *  - "/_next/image?url=https%3A%2F%2Fcdn...%2Fa.jpg&w=3840&q=75" -> "https://cdn.../a.jpg"
 *  - "/images/a.jpg" -> "https://www.technocratng.com/images/a.jpg"
 */
function resolveImageUrl(raw) {
  if (!raw) return null;
  const value = raw.trim().split(/\s+/)[0]; // first URL of a srcset entry
  if (!value || value.startsWith("data:")) return null;
  const absolute = normaliseUrl(value);
  if (!absolute) return null;
  const url = new URL(absolute);
  if (url.pathname.startsWith("/_next/image")) {
    const original = url.searchParams.get("url");
    return original ? normaliseUrl(original) : absolute;
  }
  return absolute;
}

function parsePrice(text) {
  if (text === undefined || text === null) return null;
  const cleaned = String(text).replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const value = Math.round(Number(cleaned));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const formatNaira = (amount) => `₦${Math.round(amount).toLocaleString("en-NG")}`;

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

/** Minimal robots.txt reader for the "User-agent: *" group: Allow / Disallow prefixes (longest match wins). */
function parseRobots(text) {
  const rules = [];
  let applies = false;
  let sawRuleInGroup = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [field, ...rest] = line.split(":");
    const key = field.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (sawRuleInGroup) {
        applies = false;
        sawRuleInGroup = false;
      }
      if (value === "*") applies = true;
    } else if (key === "allow" || key === "disallow") {
      sawRuleInGroup = true;
      if (applies && value) rules.push({ allow: key === "allow", prefix: value });
    }
  }
  return (pathname) => {
    let best = null;
    for (const rule of rules) {
      if (pathname.startsWith(rule.prefix) && (!best || rule.prefix.length > best.prefix.length)) best = rule;
    }
    return best ? best.allow : true;
  };
}

// ---------------------------------------------------------------------------
// Polite fetching
// ---------------------------------------------------------------------------

let isAllowed = () => true;
let requestCount = 0;
let lastRequestAt = 0;

async function fetchText(url, { allowMissing = false } = {}) {
  const { pathname } = new URL(url);
  if (!isAllowed(pathname)) {
    return { status: "blocked", text: "" };
  }
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const wait = lastRequestAt + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    requestCount += 1;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok) return { status: "ok", text: await response.text(), finalUrl: response.url };
      if (response.status === 404 || response.status === 410) {
        return { status: allowMissing ? "missing" : "notfound", text: "" };
      }
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000 * attempt;
        console.warn(
          `   ⚠ HTTP ${response.status} on ${url} — waiting ${Math.round(backoff / 1000)} s (try ${attempt}/4)`,
        );
        await sleep(backoff);
        continue;
      }
      return { status: `http-${response.status}`, text: "" };
    } catch (error) {
      clearTimeout(timer);
      const reason = error && error.name === "AbortError" ? "timed out" : error.message;
      console.warn(`   ⚠ ${reason} on ${url} (try ${attempt}/4)`);
      await sleep(3000 * attempt);
    }
  }
  return { status: "failed", text: "" };
}

// ---------------------------------------------------------------------------
// Page parsing
// ---------------------------------------------------------------------------

function extractLinks(html, pageUrl) {
  const products = new Set();
  const listings = new Set();
  for (const match of html.matchAll(/\shref\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    const href = match[2] ?? match[3];
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    const absolute = normaliseUrl(href, pageUrl);
    if (!absolute || !sameSite(absolute)) continue;
    const url = new URL(absolute);
    if (PRODUCT_PATH.test(url.pathname)) {
      url.search = "";
      products.add(url.toString().replace(/\/$/, ""));
    } else if (LISTING_PATH.test(url.pathname)) {
      const params = [...url.searchParams.keys()];
      if (params.every((p) => LISTING_PARAMS.has(p)) && params.length <= 2) {
        listings.add(url.toString());
      }
    }
  }
  return { products, listings };
}

function readJsonLdProduct(html) {
  for (const match of html.matchAll(
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let data;
    try {
      data = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    const nodes = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
    for (const node of nodes) {
      const type = node && node["@type"];
      if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return node;
    }
  }
  return null;
}

function metaContent(html, property) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = getAttr(tag, "property") || getAttr(tag, "name");
    if (key && key.toLowerCase() === property) return getAttr(tag, "content");
  }
  return undefined;
}

/** Every image the page renders, in document order, as direct absolute URLs. */
function renderedImages(visibleHtml) {
  const urls = [];
  for (const tag of visibleHtml.match(/<(?:img|source)\b[^>]*>/gi) || []) {
    const candidates = [getAttr(tag, "src"), getAttr(tag, "data-src"), getAttr(tag, "data-lazy-src")];
    const srcset = getAttr(tag, "srcset") || getAttr(tag, "data-srcset");
    if (srcset) {
      // take the largest candidate in the srcset
      const entries = srcset
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      candidates.push(entries[entries.length - 1]);
    }
    for (const candidate of candidates) {
      const resolved = resolveImageUrl(candidate);
      if (resolved && !urls.includes(resolved)) urls.push(resolved);
    }
  }
  return urls;
}

const IGNORED_IMAGE = /logo|brandfetch|icon|avatar|placeholder|sprite|\/assets\/|\.svg(\?|$)/i;

function parseProductPage(html, pageUrl) {
  const visible = stripNonVisible(html);
  const ld = readJsonLdProduct(html);

  // Title
  const h1Match = visible.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = h1Match ? toText(h1Match[1]) : "";
  const title = (h1Text || (ld && ld.name) || metaContent(html, "og:title") || "")
    .replace(/\s*[|–-]\s*Technocrat.*$/i, "")
    .trim();

  // Text that follows the title (the buy box), used for price / stock
  const afterTitle = toText(h1Match ? visible.slice(h1Match.index) : visible);

  // Price: structured data first, then the first ₦ amount after the title, then meta tags
  const offer = ld && (Array.isArray(ld.offers) ? ld.offers[0] : ld.offers);
  let costPrice = parsePrice(offer && (offer.price ?? offer.lowPrice));
  if (!costPrice) {
    const m = afterTitle.match(/(?:₦|NGN)\s*([\d,]+(?:\.\d{1,2})?)/i);
    costPrice = m ? parsePrice(m[1]) : null;
  }
  if (!costPrice) costPrice = parsePrice(metaContent(html, "product:price:amount"));

  // Stock
  let inStock;
  const availability = offer && String(offer.availability || "");
  if (availability) {
    inStock = /InStock|LimitedAvailability|PreOrder/i.test(availability);
  } else {
    const window = afterTitle.slice(0, 3000);
    const m = window.match(/\b(out of stock|sold out|unavailable|in stock|available)\b/i);
    inStock = m ? /^(in stock|available)$/i.test(m[1]) : true;
  }

  // Category and brand ("More in Laptops", "More from HP") — read from the text of that one heading/link only
  const labelAfter = (phrase, max) => {
    const m = visible.match(new RegExp(`${phrase}\\s*(?:<[^>]+>\\s*)*([^<]{1,${max}})<`, "i"));
    return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : "";
  };
  const ldCategory = ld && typeof ld.category === "string" ? ld.category : undefined;
  const category = (ldCategory || labelAfter("More in", 60) || "").trim() || "Other";

  const ldBrand = ld && (typeof ld.brand === "string" ? ld.brand : ld.brand && ld.brand.name);
  const moreFrom = [null, labelAfter("More from", 40)];
  const brandLink = visible.match(/[?&]brand=([a-z0-9-]+)/i);
  const brand = (ldBrand || (moreFrom && moreFrom[1]) || (brandLink && brandLink[1]) || "").trim();

  // Image: the product's own rendered image (first real product image on the page)
  const images = renderedImages(visible).filter((u) => !IGNORED_IMAGE.test(u));
  const ldImage =
    ld && (Array.isArray(ld.image) ? ld.image[0] : typeof ld.image === "object" ? ld.image.url : ld.image);
  const ogImage = metaContent(html, "og:image");
  const imageUrl =
    images.find((u) => /\/products?\//i.test(u)) ||
    resolveImageUrl(ldImage) ||
    resolveImageUrl(ogImage) ||
    images[0] ||
    null;

  return { title, costPrice, inStock, category, brand, imageUrl, sourceUrl: pageUrl };
}

function readSiteTotal(html) {
  const m = toText(stripNonVisible(html)).match(/Showing\s+[\d,]+\s*[–-]\s*[\d,]+\s+of\s+([\d,]+)/i);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

// ---------------------------------------------------------------------------
// Progress (resume support)
// ---------------------------------------------------------------------------

function loadProgress() {
  if (FRESH || !fs.existsSync(PROGRESS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveProgress(state) {
  const data = {
    savedAt: new Date().toISOString(),
    siteTotal: state.siteTotal,
    products: [...state.products.entries()],
    visitedProducts: [...state.visitedProducts],
    visitedListings: [...state.visitedListings],
    productQueue: [...state.productQueue],
    listingQueue: [...state.listingQueue],
    skipped: state.skipped,
  };
  const tmp = `${PROGRESS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, PROGRESS_FILE);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function buildOutput(products) {
  const list = [...products.values()].filter((p) => p.title && p.costPrice);
  return list.map((p, index) => {
    const sellingPriceNGN = Math.round(p.costPrice * MARKUP);
    return {
      id: String(index + 1),
      title: p.title,
      category: p.category,
      costPriceNGN: p.costPrice,
      sellingPriceNGN,
      formattedPrice: formatNaira(sellingPriceNGN),
      imageUrl: p.imageUrl,
      inStock: p.inStock,
      brand: p.brand || undefined,
      sourceUrl: p.sourceUrl,
    };
  });
}

function writeOutput(items) {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  const tmp = `${OUTPUT_FILE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(items, null, 2)}\n`);
  fs.renameSync(tmp, OUTPUT_FILE);
}

// ---------------------------------------------------------------------------
// Main crawl
// ---------------------------------------------------------------------------

async function main() {
  const started = Date.now();
  console.log(`\nTechnocrat catalog import → ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log(`Site: ${BASE_URL}   Markup: ×${MARKUP}   Delay: ${DELAY_MS} ms between requests\n`);

  // 1. robots.txt
  const robots = await fetchText(`${BASE_URL}/robots.txt`, { allowMissing: true });
  if (robots.status === "ok") {
    isAllowed = parseRobots(robots.text);
    console.log("✔ robots.txt read — disallowed paths (such as /api/) will not be requested");
  } else {
    console.log("• No robots.txt found — continuing politely");
  }

  // 2. State (resume if possible)
  const saved = loadProgress();
  const state = {
    siteTotal: saved?.siteTotal ?? null,
    products: new Map(saved?.products ?? []),
    visitedProducts: new Set(saved?.visitedProducts ?? []),
    visitedListings: new Set(saved?.visitedListings ?? []),
    productQueue: new Set(saved?.productQueue ?? []),
    listingQueue: new Set(saved?.listingQueue ?? []),
    skipped: saved?.skipped ?? [],
  };
  if (saved) {
    console.log(`↻ Resuming: ${state.products.size} products already saved, ${state.productQueue.size} queued`);
  }

  const queueProduct = (url) => {
    if (!state.visitedProducts.has(url)) state.productQueue.add(url);
  };
  const queueListing = (url) => {
    if (!state.visitedListings.has(url) && state.visitedListings.size + state.listingQueue.size < MAX_LISTING_PAGES) {
      state.listingQueue.add(url);
    }
  };

  let stopRequested = false;
  process.on("SIGINT", () => {
    if (stopRequested) process.exit(130);
    stopRequested = true;
    console.log("\n⏸ Stopping after the current page and saving progress… (press Ctrl+C again to quit immediately)");
  });

  if (!saved) {
    // 3. Seeds: sitemap + main shop pages
    const sitemap = await fetchText(`${BASE_URL}/sitemap.xml`, { allowMissing: true });
    if (sitemap.status === "ok") {
      let fromSitemap = 0;
      for (const m of sitemap.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        const url = normaliseUrl(m[1]);
        if (!url || !sameSite(url)) continue;
        const { pathname, searchParams } = new URL(url);
        if (PRODUCT_PATH.test(pathname)) {
          queueProduct(url.replace(/\/$/, ""));
          fromSitemap += 1;
        } else if (LISTING_PATH.test(pathname) && [...searchParams.keys()].every((p) => LISTING_PARAMS.has(p))) {
          queueListing(url);
        }
      }
      console.log(`✔ Sitemap: ${fromSitemap} product links`);
    }
    queueListing(`${BASE_URL}/shop/products`);
    queueListing(`${BASE_URL}/shop/parts`);
  }

  // 4. Crawl: listing pages first (cheap discovery), then product pages
  let pagesSinceSave = 0;
  const reportEvery = 25;

  while (!stopRequested && (state.listingQueue.size > 0 || state.productQueue.size > 0)) {
    if (state.products.size >= LIMIT) break;

    if (state.listingQueue.size > 0) {
      const url = state.listingQueue.values().next().value;
      state.listingQueue.delete(url);
      state.visitedListings.add(url);
      const page = await fetchText(url);
      if (page.status === "ok") {
        const total = readSiteTotal(page.text);
        const isMainShop = /^\/shop\/products\/?$/.test(new URL(url).pathname) && new URL(url).search === "";
        if (total && isMainShop && total !== state.siteTotal) {
          state.siteTotal = total;
          console.log(`✔ The shop reports ${total.toLocaleString("en-NG")} products in total`);
        }
        const links = extractLinks(page.text, url);
        links.products.forEach(queueProduct);
        links.listings.forEach(queueListing);
      }
    } else {
      const url = state.productQueue.values().next().value;
      state.productQueue.delete(url);
      state.visitedProducts.add(url);
      const page = await fetchText(url);
      if (page.status === "ok") {
        const product = parseProductPage(page.text, url);
        if (product.title && product.costPrice) {
          state.products.set(url, product);
        } else {
          state.skipped.push({ url, reason: !product.title ? "no title found" : "no price found" });
        }
        const links = extractLinks(page.text, url);
        links.products.forEach(queueProduct);
        links.listings.forEach(queueListing);
      } else if (page.status !== "blocked") {
        state.skipped.push({ url, reason: page.status });
      }

      if (state.visitedProducts.size % reportEvery === 0) {
        const of = state.siteTotal ? ` of ~${state.siteTotal.toLocaleString("en-NG")}` : "";
        const minutes = ((Date.now() - started) / 60000).toFixed(1);
        console.log(
          `  … ${state.products.size.toLocaleString("en-NG")}${of} products saved · ${state.productQueue.size} queued · ${minutes} min`,
        );
      }
    }

    pagesSinceSave += 1;
    if (pagesSinceSave >= 20) {
      saveProgress(state);
      pagesSinceSave = 0;
    }
  }

  saveProgress(state);

  // 5. Write products.json
  const items = buildOutput(state.products).slice(0, Number.isFinite(LIMIT) ? LIMIT : undefined);
  if (items.length === 0) {
    console.error("\n✖ No products could be read, so src/data/products.json was NOT changed.");
    console.error("  Check your internet connection, then run the script again.");
    process.exit(1);
  }
  writeOutput(items);

  const finished = state.listingQueue.size === 0 && state.productQueue.size === 0;
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  const withImages = items.filter((i) => i.imageUrl).length;
  const outOfStock = items.filter((i) => !i.inStock).length;
  const categories = new Set(items.map((i) => i.category)).size;

  console.log("\n──────────────────────────────────────────────");
  console.log(`✔ Saved ${items.length.toLocaleString("en-NG")} products to src/data/products.json`);
  console.log("──────────────────────────────────────────────");
  if (state.siteTotal) console.log(`  Shop's own total:   ${state.siteTotal.toLocaleString("en-NG")}`);
  console.log(`  With an image:      ${withImages.toLocaleString("en-NG")}`);
  console.log(`  Out of stock:       ${outOfStock.toLocaleString("en-NG")}`);
  console.log(`  Categories:         ${categories}`);
  console.log(`  Pages skipped:      ${state.skipped.length}`);
  console.log(`  Requests made:      ${requestCount.toLocaleString("en-NG")} in ${minutes} min`);

  if (!finished) {
    console.log("\n⏸ The run was stopped before every page was visited. Run the same command again to continue.");
  } else {
    if (state.siteTotal && items.length < state.siteTotal) {
      console.log(
        `\n• ${(state.siteTotal - items.length).toLocaleString("en-NG")} products the shop lists were not reachable through public product pages`,
      );
      console.log("  (only through the site's /api/, which its robots.txt asks tools not to use).");
    }
    fs.rmSync(PROGRESS_FILE, { force: true });
    console.log("\nNext step: npm run supplier:sync   (loads these products into your store)");
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\n✖ Import failed:", error);
    process.exit(1);
  });
}

module.exports = { parseProductPage, extractLinks, resolveImageUrl, parsePrice, parseRobots, formatNaira };
