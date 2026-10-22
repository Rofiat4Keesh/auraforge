#!/usr/bin/env node
/**
 * AURAFORGE — product image cache
 * ------------------------------------------------------------------------------------------
 * Downloads each product's genuine photo from your supplier's own image server and saves a
 * copy inside this project (public/images/products/...), so your shop shows the photo from
 * your own website instead of depending on someone else's server staying online.
 *
 *   node scripts/cache-product-images.js                    (or: npm run images:cache)
 *   node scripts/cache-product-images.js --photo-catalog path/to/products-from-photos.json
 *   node scripts/cache-product-images.js --dry-run          (check only, download nothing)
 *   node scripts/cache-product-images.js --refresh          (re-download copies this script saved before;
 *                                                            photos you saved by hand are never replaced)
 *
 * What it does, in order:
 *   1. Reads your supplier feed, src/data/products.json (made by `npm run catalog:import`).
 *      Every entry there carries the supplier's own photo link ("imageUrl").
 *   2. Only downloads from image hosts you have listed in IMAGE_SOURCE_HOSTS (your .env file).
 *      Anything else is refused and reported. List only hosts you have permission to copy from.
 *   3. Checks every download really is a picture (JPEG, PNG, WebP or GIF, by its first bytes)
 *      and is not over the size limit. Error pages saved as ".jpg" are rejected.
 *   4. Saves it as public/images/products/<category>/<product>.<jpg|png|webp|gif>.
 *      If you already put your own photo at that place, it is kept and used (never overwritten).
 *   5. Writes src/data/image-manifest.json, which the shop reads during `npm run supplier:sync`
 *      to show the saved copy. Products without a saved copy keep their supplier link, and if that
 *      fails in the browser the shop shows a neutral "IMAGE UNAVAILABLE" picture — never a photo
 *      of a different product.
 *   6. Optional (--photo-catalog): for the products typed in from your phone photos, which have no
 *      photo link, it looks for the SAME product in the supplier feed. A match needs the same model
 *      numbers, mostly the same words AND the same price (within 2%). Anything less certain is left
 *      without a photo and listed in the report, so no product ever gets a look-alike's picture.
 *   7. Prints a summary and writes scripts/image-report.json listing every product that still needs
 *      a photo, with the exact file name to save one under.
 *
 * Needs Node.js 18 or newer. No extra packages.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ------------------------------------------------------------------------------------------
// Settings
// ------------------------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
loadDotEnv(path.join(ROOT, ".env"));

const args = process.argv.slice(2);
function argValue(name) {
  const i = args.indexOf(`--${name}`);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}
const hasFlag = (name) => args.includes(`--${name}`);

const FEED_FILE = path.resolve(ROOT, argValue("feed") || "src/data/products.json");
const PHOTO_CATALOG_FILE = argValue("photo-catalog") ? path.resolve(process.cwd(), argValue("photo-catalog")) : null;
const PUBLIC_DIR = path.join(ROOT, "public");
const IMAGE_ROOT_URL = "/images/products";
const MANIFEST_FILE = path.join(ROOT, "src/data/image-manifest.json");
const REPORT_FILE = path.join(ROOT, "scripts/image-report.json");

const DRY_RUN = hasFlag("dry-run");
const REFRESH = hasFlag("refresh");
const DELAY_MS = Number(argValue("delay") || process.env.IMAGE_DOWNLOAD_DELAY_MS || "500");
const MAX_BYTES = Number(process.env.IMAGE_MAX_BYTES || String(8 * 1024 * 1024));
const TIMEOUT_MS = Number(process.env.IMAGE_TIMEOUT_MS || "20000");
const USER_AGENT = process.env.IMAGE_USER_AGENT || "AuraForgeImageCache/1.0 (+reseller product images; one request at a time)";

/** Hosts you are allowed to copy product photos from. Set IMAGE_SOURCE_HOSTS in .env (comma separated). */
const DEFAULT_HOSTS = "technocratblessingcomputers.fra1.digitaloceanspaces.com,www.technocratng.com,technocratng.com";
const ALLOWED_HOSTS = (process.env.IMAGE_SOURCE_HOSTS ?? DEFAULT_HOSTS)
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

// ------------------------------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------------------------------

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

/** Same key the shop uses for a supplier product: the last part of its web address, else its id. */
function stableKey(entry) {
  if (entry.sourceUrl) {
    try {
      const last = new URL(entry.sourceUrl).pathname.split("/").filter(Boolean).pop();
      if (last) return last.toLowerCase();
    } catch {
      /* use the id */
    }
  }
  return String(entry.id);
}

/** "/_next/image?url=https%3A%2F%2Fcdn%2Fa.jpg&w=640" -> "https://cdn/a.jpg" */
function resolveImageUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.pathname.startsWith("/_next/image") && url.searchParams.get("url")) {
    try {
      return new URL(url.searchParams.get("url"), url.origin).toString();
    } catch {
      return null;
    }
  }
  return url.toString();
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Returns a reason string if the link may not be used, or null if it is fine. */
function refuseReason(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return "not a valid web address";
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalHost(url.hostname))) {
    return "only secure (https) links are downloaded";
  }
  if (!ALLOWED_HOSTS.includes(url.host.toLowerCase()) && !ALLOWED_HOSTS.includes(url.hostname.toLowerCase())) {
    return `host "${url.host}" is not in IMAGE_SOURCE_HOSTS`;
  }
  return null;
}

/** Recognises a real picture by its first bytes. */
function sniffImage(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { ext: "png", type: "image/png" };
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return { ext: "webp", type: "image/webp" };
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.toString("ascii", 0, 6))) return { ext: "gif", type: "image/gif" };
  return null;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];

/** A photo already saved for this product (by you or an earlier run), if any. */
function findExistingFile(folder, baseName) {
  for (const ext of IMAGE_EXTS) {
    const file = path.join(PUBLIC_DIR, IMAGE_ROOT_URL, folder, `${baseName}.${ext}`);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) {
      const head = Buffer.alloc(16);
      const fd = fs.openSync(file, "r");
      fs.readSync(fd, head, 0, 16, 0);
      fs.closeSync(fd);
      if (sniffImage(head)) return { file, url: `${IMAGE_ROOT_URL}/${folder}/${baseName}.${ext}` };
    }
  }
  return null;
}

/** Downloads one picture, following redirects only to allowed hosts. */
async function download(urlString) {
  let current = urlString;
  for (let hop = 0; hop < 5; hop += 1) {
    const refused = refuseReason(current);
    if (refused) return { ok: false, reason: hop === 0 ? refused : `redirected to a link that is refused (${refused})` };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
      });
    } catch (err) {
      clearTimeout(timer);
      return { ok: false, reason: err.name === "AbortError" ? "timed out" : `could not connect (${err.cause?.code || err.message})` };
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      current = new URL(res.headers.get("location"), current).toString();
      continue;
    }
    if (!res.ok) {
      clearTimeout(timer);
      return { ok: false, reason: `server answered ${res.status}` };
    }
    const declared = Number(res.headers.get("content-length") || "0");
    if (declared > MAX_BYTES) {
      clearTimeout(timer);
      return { ok: false, reason: `file is too large (${declared} bytes)` };
    }

    let tooBig = false;
    try {
      const chunks = [];
      let total = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) {
          tooBig = true;
          await reader.cancel().catch(() => {});
          break;
        }
        chunks.push(Buffer.from(value));
      }
      if (tooBig) return { ok: false, reason: `file is too large (over ${MAX_BYTES} bytes)` };
      const buf = Buffer.concat(chunks);
      const kind = sniffImage(buf);
      if (!kind) return { ok: false, reason: `not a picture (server sent ${res.headers.get("content-type") || "unknown content"})` };
      return { ok: true, buf, kind, finalUrl: current };
    } catch (err) {
      return { ok: false, reason: err.name === "AbortError" ? "timed out" : `download failed (${err.message})` };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, reason: "too many redirects" };
}

// ------------------------------------------------------------------------------------------
// Matching phone-photo products to the supplier feed (strict on purpose)
// ------------------------------------------------------------------------------------------

const STOP_WORDS = new Set(["the", "and", "for", "with", "of", "a", "an", "in", "to", "by"]);

function words(name) {
  return slugify(name)
    .split("-")
    .filter((w) => w && !STOP_WORDS.has(w));
}

/** Words that contain a digit (model numbers like "s25", "800va", "e2225hm", "g11"). */
function modelWords(list) {
  return new Set(list.filter((w) => /\d/.test(w)));
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const v of A) if (B.has(v)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Finds the supplier entry that is the same product as a phone-photo product.
 * Rules: identical name → match. Otherwise ALL of these must hold for exactly one entry:
 *   - the same model numbers (every word containing a digit),
 *   - at least 60% of words in common,
 *   - the same selling price within 2%.
 */
function matchPhotoProduct(item, feedIndex) {
  const itemWords = words(item.name);
  const itemSlug = itemWords.join("-");
  const exact = feedIndex.filter((f) => f.wordsSlug === itemSlug);
  if (exact.length === 1) return { entry: exact[0], how: "same name" };

  const itemModels = modelWords(itemWords);
  if (itemModels.size === 0) return { entry: null, how: "name has no model number to confirm a match" };
  const candidates = feedIndex.filter((f) => {
    if (!sameSet(itemModels, f.models)) return false;
    if (jaccard(itemWords, f.words) < 0.6) return false;
    const price = Number(item.price);
    const feedPrice = Number(f.entry.sellingPriceNGN);
    if (!(price > 0) || !(feedPrice > 0)) return false;
    return Math.abs(price - feedPrice) / feedPrice <= 0.02;
  });
  if (candidates.length === 1) return { entry: candidates[0], how: "same model numbers, name and price" };
  if (candidates.length > 1) return { entry: null, how: `${candidates.length} supplier products look the same — not guessing` };
  return { entry: null, how: "no supplier product with the same model numbers and price" };
}

// ------------------------------------------------------------------------------------------
// Main
// ------------------------------------------------------------------------------------------

async function cacheOne({ label, folder, baseName, sourceUrl, mayReplace = false }, counters) {
  // A photo already saved wins. --refresh only replaces copies this script downloaded itself
  // (mayReplace); a photo you saved by hand is never overwritten.
  const existing = findExistingFile(folder, baseName);
  if (existing && !(REFRESH && mayReplace)) {
    counters.kept += 1;
    return { status: "kept", url: existing.url, file: existing.file };
  }
  if (!sourceUrl) {
    counters.noLink += 1;
    return { status: "no-link", reason: "the feed has no photo link for this product" };
  }
  const refused = refuseReason(sourceUrl);
  if (refused) {
    counters.refused += 1;
    return { status: "refused", reason: refused, sourceUrl };
  }
  if (DRY_RUN) {
    counters.wouldDownload += 1;
    return { status: "would-download", sourceUrl };
  }

  const result = await download(sourceUrl);
  await sleep(DELAY_MS);
  if (!result.ok) {
    counters.failed += 1;
    console.log(`  ✖ ${label} — ${result.reason}`);
    return { status: "failed", reason: result.reason, sourceUrl };
  }

  const dir = path.join(PUBLIC_DIR, IMAGE_ROOT_URL, folder);
  fs.mkdirSync(dir, { recursive: true });
  // Remove an older copy with a different extension so only one photo exists per product.
  if (existing && path.extname(existing.file) !== `.${result.kind.ext}`) fs.rmSync(existing.file, { force: true });
  const file = path.join(dir, `${baseName}.${result.kind.ext}`);
  fs.writeFileSync(file, result.buf);
  counters.downloaded += 1;
  console.log(`  ✔ ${label}`);
  return {
    status: "downloaded",
    url: `${IMAGE_ROOT_URL}/${folder}/${baseName}.${result.kind.ext}`,
    file,
    sourceUrl: result.finalUrl,
    contentType: result.kind.type,
    bytes: result.buf.length,
    sha256: crypto.createHash("sha256").update(result.buf).digest("hex"),
  };
}

async function main() {
  if (typeof fetch !== "function") {
    console.error("This script needs Node.js 18 or newer. Check with: node -v");
    process.exit(1);
  }
  if (!fs.existsSync(FEED_FILE)) {
    console.error(`Supplier feed not found: ${path.relative(process.cwd(), FEED_FILE)}\nRun "npm run catalog:import" first.`);
    process.exit(1);
  }

  const feed = readJson(FEED_FILE);
  if (!Array.isArray(feed)) {
    console.error("src/data/products.json must be a list of products.");
    process.exit(1);
  }

  console.log("AuraForge product image cache");
  console.log(`• Supplier feed: ${feed.length} products (${path.relative(ROOT, FEED_FILE)})`);
  console.log(`• Allowed image hosts: ${ALLOWED_HOSTS.length ? ALLOWED_HOSTS.join(", ") : "(none — nothing will be downloaded)"}`);
  if (DRY_RUN) console.log("• Dry run: checking only, nothing is downloaded or saved");
  console.log("");

  const previous = fs.existsSync(MANIFEST_FILE) ? readJson(MANIFEST_FILE) : { items: {} };
  const manifest = { generatedAt: new Date().toISOString(), items: {} };
  const report = { generatedAt: manifest.generatedAt, feed: [], photoCatalog: [] };
  const counters = { downloaded: 0, kept: 0, noLink: 0, refused: 0, failed: 0, wouldDownload: 0 };

  // ---- 1. Supplier feed --------------------------------------------------------------------
  console.log("Supplier feed products:");
  const seen = new Set();
  const feedResults = new Map();
  for (const entry of feed) {
    if (!entry || !entry.title) continue;
    const key = stableKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    const folder = slugify(entry.category || "other") || "other";
    // File name: the product's web-address name when known (stable between imports), else its title.
    const baseName = (entry.sourceUrl ? slugify(key) : slugify(entry.title)) || slugify(key) || `product-${key}`;
    const sourceUrl = resolveImageUrl(entry.imageUrl);
    const downloadedBefore = /^https?:/.test(String(previous.items?.[key]?.source || ""));
    const result = await cacheOne({ label: entry.title, folder, baseName, sourceUrl, mayReplace: downloadedBefore }, counters);
    feedResults.set(key, result);

    if (result.url) {
      manifest.items[key] = {
        path: result.url,
        source: result.status === "kept" ? previous.items?.[key]?.source || "saved-by-you" : result.sourceUrl,
        sha256: result.sha256 || previous.items?.[key]?.sha256 || null,
        savedAt: result.status === "kept" ? previous.items?.[key]?.savedAt || manifest.generatedAt : manifest.generatedAt,
      };
    }
    report.feed.push({
      key,
      title: entry.title,
      status: result.status,
      image: result.url || null,
      reason: result.reason || null,
      saveYourOwnPhotoAs: result.url ? null : `public${IMAGE_ROOT_URL}/${folder}/${baseName}.jpg`,
    });
  }

  // ---- 2. Phone-photo catalog (optional) ----------------------------------------------------
  let photoUpdated = 0;
  if (PHOTO_CATALOG_FILE) {
    if (!fs.existsSync(PHOTO_CATALOG_FILE)) {
      console.error(`\nPhoto catalog not found: ${PHOTO_CATALOG_FILE}`);
      process.exit(1);
    }
    const photoItems = readJson(PHOTO_CATALOG_FILE);
    const feedIndex = feed
      .filter((e) => e && e.title)
      .map((entry) => {
        const w = words(entry.title);
        return { entry, words: w, wordsSlug: w.join("-"), models: modelWords(w) };
      });

    console.log(`\nPhone-photo catalog: ${photoItems.length} products (${path.basename(PHOTO_CATALOG_FILE)})`);
    for (const item of photoItems) {
      // Where this catalog says the photo should live, e.g. /images/products/accessories/<slug>.jpg
      const declared = String(item.image || `${IMAGE_ROOT_URL}/${slugify(item.category)}/${item.slug}.jpg`);
      const rel = declared.replace(new RegExp(`^${IMAGE_ROOT_URL}/`), "");
      const folder = path.posix.dirname(rel);
      const baseName = path.posix.basename(rel).replace(/\.(jpe?g|png|webp|gif)$/i, "");

      const match = matchPhotoProduct(item, feedIndex);
      let result;
      if (match.entry) {
        // Re-use the supplier copy if it was just saved, so the same photo is not downloaded twice.
        const supplierCopy = feedResults.get(stableKey(match.entry.entry));
        const existingOwn = findExistingFile(folder, baseName);
        if (existingOwn) {
          counters.kept += 1;
          result = { status: "kept", url: existingOwn.url };
        } else if (supplierCopy && supplierCopy.file && fs.existsSync(supplierCopy.file) && !DRY_RUN) {
          const ext = path.extname(supplierCopy.file);
          const dir = path.join(PUBLIC_DIR, IMAGE_ROOT_URL, folder);
          fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(supplierCopy.file, path.join(dir, `${baseName}${ext}`));
          counters.downloaded += 1;
          result = { status: "downloaded", url: `${IMAGE_ROOT_URL}/${folder}/${baseName}${ext}` };
          console.log(`  ✔ ${item.name}`);
        } else {
          result = await cacheOne(
            { label: item.name, folder, baseName, sourceUrl: resolveImageUrl(match.entry.entry.imageUrl) },
            counters,
          );
        }
      } else {
        const own = findExistingFile(folder, baseName);
        if (own) {
          counters.kept += 1;
          result = { status: "kept", url: own.url };
        } else {
          counters.noLink += 1;
          result = { status: "no-match", reason: match.how };
        }
      }

      // If the saved photo turned out to be PNG/WebP, point the catalog at the real file name.
      if (result.url && result.url !== declared && !DRY_RUN) {
        item.image = result.url;
        photoUpdated += 1;
      }
      report.photoCatalog.push({
        id: item.id,
        name: item.name,
        status: result.status,
        matchedSupplierProduct: match.entry ? match.entry.entry.title : null,
        how: match.how,
        image: result.url || null,
        reason: result.reason || null,
        saveYourOwnPhotoAs: result.url ? null : `public${declared.replace(/\.(png|webp|gif|jpeg)$/i, ".jpg")}`,
      });
    }
    if (photoUpdated > 0) writeJsonAtomic(PHOTO_CATALOG_FILE, photoItems);
  }

  // ---- 3. Save manifest + report -------------------------------------------------------------
  if (!DRY_RUN) writeJsonAtomic(MANIFEST_FILE, manifest);
  writeJsonAtomic(REPORT_FILE, report);

  const missing = [...report.feed, ...report.photoCatalog].filter((r) => !r.image && r.status !== "would-download");
  console.log("\n────────────────────────────────────────");
  if (DRY_RUN) console.log(`Would download:            ${counters.wouldDownload}`);
  console.log(`Downloaded now:            ${counters.downloaded}`);
  console.log(`Already saved (kept):      ${counters.kept}`);
  console.log(`Refused (host not allowed): ${counters.refused}`);
  console.log(`Failed to download:        ${counters.failed}`);
  console.log(`No photo link / no match:  ${counters.noLink}`);
  console.log("────────────────────────────────────────");
  if (!DRY_RUN) console.log(`Saved list for the shop:   ${path.relative(ROOT, MANIFEST_FILE)} (${Object.keys(manifest.items).length} products)`);
  if (photoUpdated) console.log(`Photo catalog updated:     ${photoUpdated} image paths corrected to the real file type`);
  console.log(`Full report:               ${path.relative(ROOT, REPORT_FILE)}`);
  if (missing.length) {
    console.log(`\n${missing.length} product(s) still need a photo. For each one, the report gives the exact`);
    console.log(`file name ("saveYourOwnPhotoAs") — save a genuine photo there and run this again.`);
  }
  if (!DRY_RUN && counters.downloaded + counters.kept > 0) {
    console.log("\nNext: run `npm run supplier:sync` so the shop starts using the saved photos.");
  }
}

main().catch((err) => {
  console.error("\nImage cache stopped with an error:", err);
  process.exit(1);
});
