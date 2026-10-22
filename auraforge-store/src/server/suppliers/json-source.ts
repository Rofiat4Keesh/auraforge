import { existsSync } from "fs";
import { join } from "path";
import catalog from "@/data/products.json";
import imageManifest from "@/data/image-manifest.json";
import { GENERIC_FALLBACK_IMAGE } from "@/lib/fallback-image";
import type { NormalizedCategory, NormalizedProduct, ProductSource } from "./types";

/**
 * Supplier feed read from src/data/products.json (the Technocrat price list).
 *
 * The file is produced by `node scripts/import-full-catalog.js`. Each entry looks like:
 *   { id, title, category, costPriceNGN, sellingPriceNGN, formattedPrice, imageUrl, inStock, brand?, sourceUrl? }
 * (older files that use "originalPriceNGN" instead of "costPriceNGN" still work).
 *
 * - sellingPriceNGN is used as the shop price exactly as given (your 6% markup is already in it).
 * - costPriceNGN is stored as the private cost price, so the admin editor can show your margin.
 * - Each product is matched between imports by its Technocrat web address (sourceUrl), so re-running
 *   the import updates the right product even if the numbering in the file changes.
 * - Technocrat's many small categories ("Phone Case/Pouch", "Laptop", "UPS"...) are grouped into shop
 *   departments; the original category is kept as a "Type" specification for filtering.
 * - The file has no stock counts, so in-stock items get SUPPLIER_DEFAULT_STOCK units (default 5)
 *   and out-of-stock items get 0. Adjust real quantities in Admin → Products.
 * - Brand and specifications (processor, RAM, storage, screen size…) are read from the product title,
 *   so the shop's spec filters and search work without extra data.
 *
 * - Photos: if `npm run images:cache` saved a copy of a product's photo in public/images/products,
 *   that copy is used (served from your own website). Otherwise the supplier's photo link is used.
 *
 * To update prices or add items: edit products.json, then run `npm run supplier:sync`
 * (or press "Sync now" in Admin → Supplier sync).
 */

export interface CatalogEntry {
  id: string;
  title: string;
  category: string;
  costPriceNGN?: number;
  /** Older name for costPriceNGN. */
  originalPriceNGN?: number;
  sellingPriceNGN: number;
  formattedPrice?: string;
  imageUrl: string | null;
  inStock: boolean;
  brand?: string;
  sourceUrl?: string;
}

/**
 * Shop departments. A product goes into the first department whose pattern matches its
 * Technocrat category name; if none matches, its title is checked; otherwise it keeps its own category.
 * Order matters: spare parts and accessories are checked before phones and laptops, so that a
 * "Samsung S25 screen protector" lands in Accessories, not Phones.
 */
const DEPARTMENTS: { pattern: RegExp; category: NormalizedCategory }[] = [
  {
    pattern: /spare|replacement|\blcd\b|display module|screen module|charging port|flex cable/i,
    category: {
      slug: "spare-parts",
      name: "Spare Parts",
      description: "Replacement screens and components for repairs.",
      sortOrder: 9,
    },
  },
  {
    pattern:
      /accessor|case|pouch|cover|tempered|glass|protector|charger|adapter|cable|power ?bank|\bbag\b|backpack|sleeve|stand|holder|dock|\bhub\b|strap|stylus/i,
    category: {
      slug: "accessories",
      name: "Accessories",
      description: "Cases, screen protectors, chargers, cables and everyday add-ons.",
      sortOrder: 7,
    },
  },
  {
    pattern: /laptop|notebook|desktop|all[- ]in[- ]one|workstation|mini ?pc|\bpc\b|server|computer/i,
    category: {
      slug: "laptops-computers",
      name: "Laptops & Computers",
      description: "Business laptops, gaming laptops, desktops and servers.",
      sortOrder: 1,
    },
  },
  {
    pattern: /phone|tablet|ipad|iphone/i,
    category: {
      slug: "smartphones-tablets",
      name: "Smartphones & Tablets",
      description: "Phones and tablets for work, study and play.",
      sortOrder: 2,
    },
  },
  {
    pattern:
      /graphics|\bgpu\b|processor|\bcpu\b|motherboard|\bram\b|memory|\bssd\b|hard ?drive|\bhdd\b|storage|flash|sd card|power supply|\bpsu\b|casing|cooler|cooling|component/i,
    category: {
      slug: "computer-parts",
      name: "Computer Parts & Storage",
      description: "Graphics cards, memory, storage, power supplies and core components.",
      sortOrder: 3,
    },
  },
  {
    pattern:
      /monitor|keyboard|mouse|mice|webcam|printer|scanner|toner|cartridge|\bink\b|projector|display|gaming chair|controller/i,
    category: {
      slug: "peripherals",
      name: "Monitors, Printers & Peripherals",
      description: "Monitors, printers, projectors, keyboards and mice.",
      sortOrder: 4,
    },
  },
  {
    pattern: /router|switch|access point|network|wi-?fi|wireless|repeater|extender|modem|firewall|antenna|\brack\b/i,
    category: {
      slug: "networking",
      name: "Networking",
      description: "Routers, switches, access points and network gear.",
      sortOrder: 5,
    },
  },
  {
    pattern: /\bups\b|inverter|batter(y|ies)|stabili[sz]er|surge|solar|\bpower\b/i,
    category: {
      slug: "power-backup",
      name: "Power & Backup",
      description: "UPS units, inverters, batteries and stabilisers.",
      sortOrder: 6,
    },
  },
  {
    pattern: /cctv|camera|\bdvr\b|\bnvr\b|surveillance|security/i,
    category: {
      slug: "security-cctv",
      name: "CCTV & Security",
      description: "Cameras, recorders and security systems.",
      sortOrder: 8,
    },
  },
  {
    pattern: /headphone|headset|earbud|earphone|speaker|microphone|audio|sound|smart ?watch|wearable/i,
    category: {
      slug: "audio-wearables",
      name: "Audio & Wearables",
      description: "Headphones, speakers, microphones and smartwatches.",
      sortOrder: 10,
    },
  },
  {
    pattern: /\btv\b|television/i,
    category: { slug: "tvs", name: "TVs", description: "Televisions and smart TVs.", sortOrder: 11 },
  },
  {
    pattern: /software|licen[cs]e|antivirus|\boffice\b|windows/i,
    category: {
      slug: "software-apps",
      name: "Software & Licences",
      description: "Licensed software packages and security suites.",
      sortOrder: 12,
    },
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (w) =>
    w === w.toUpperCase() && w.length <= 4 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase(),
  );
}

/** Department for a product: by its Technocrat category name first, then by its title. */
export function categoryFor(name: string, title = ""): NormalizedCategory {
  const raw = (name || "").trim();
  const usable = raw && raw.toLowerCase() !== "other";
  const byName = usable ? DEPARTMENTS.find((d) => d.pattern.test(raw)) : undefined;
  if (byName) return byName.category;
  const byTitle = DEPARTMENTS.find((d) => d.pattern.test(title));
  if (byTitle) return byTitle.category;
  const label = usable ? titleCase(raw) : "More Products";
  return { slug: slugify(label) || "more-products", name: label, description: label, sortOrder: 50 };
}

/** "hp" -> "HP", "samsung" -> "Samsung", "TP-LINK" stays "TP-LINK". */
function titleCaseBrand(brand: string): string {
  const b = brand.trim();
  if (b.length <= 3 || b === b.toUpperCase()) return b.toUpperCase();
  return b.charAt(0).toUpperCase() + b.slice(1);
}

/** Brand from the first word(s) of the title. */
export function brandFromTitle(title: string): string {
  const t = title.trim();
  if (/^(ipad|iphone|macbook|apple)\b/i.test(t)) return "Apple";
  if (/^alienware\b/i.test(t)) return "Alienware";
  if (/^hp\b/i.test(t)) return "HP";
  if (/^samsung\b/i.test(t)) return "Samsung";
  const first = t.split(/\s+/)[0] ?? "Generic";
  return first.length <= 3 ? first.toUpperCase() : first.charAt(0).toUpperCase() + first.slice(1);
}

/** Pulls filterable specifications out of a product title. Only facts present in the title are used. */
export function specsFromTitle(title: string): { key: string; value: string }[] {
  const specs: { key: string; value: string }[] = [];
  const add = (key: string, value: string | undefined) => {
    if (value && !specs.some((s) => s.key === key)) specs.push({ key, value: value.trim() });
  };

  // Processor
  const cpu =
    title.match(/Intel Core Ultra \d+ \w+/i)?.[0] ??
    title.match(/AMD Ryzen \d+(?: Pro)?/i)?.[0] ??
    title.match(/\d{1,2}(?:st|nd|rd|th) Gen Intel (?:Core )?i\d/i)?.[0] ??
    title.match(/Intel (?:Core )?i\d/i)?.[0] ??
    title.match(/\bM\d (?:Pro |Max )?Chip\b/i)?.[0]?.replace(/\s*Chip$/i, "");
  add("Processor", cpu);

  // Memory and storage, e.g. "(16GB, 512GB SSD)" or "(128GB, Wi-Fi)"
  const sizes = [...title.matchAll(/(\d+)\s?(GB|TB)(\s?SSD)?/gi)].map((m) => ({
    gb: Number(m[1]) * (m[2].toUpperCase() === "TB" ? 1024 : 1),
    text: `${m[1]}${m[2].toUpperCase()}${m[3] ? " SSD" : ""}`,
    ssd: Boolean(m[3]),
  }));
  const ssd = sizes.find((s) => s.ssd);
  if (ssd) add("Storage", ssd.text);
  const ram = sizes.find((s) => !s.ssd && s.gb <= 64 && (ssd || /laptop|elitebook|probook|alienware/i.test(title)));
  if (ram) add("RAM", ram.text);
  if (!ssd && !ram && sizes[0] && /ipad|tablet|phone/i.test(title)) add("Storage", sizes[0].text);

  add("Graphics", title.match(/\b(?:RTX|GTX|RX)\s?\d{3,4}\w*/i)?.[0]);
  add("Screen Size", title.match(/(\d{1,2}(?:\.\d)?)\s?(?:inch|")/i)?.[1]?.concat('"'));
  if (/\bwi-?fi\b/i.test(title)) add("Connectivity", "Wi-Fi");
  // Model generation for business laptop lines, e.g. "EliteBook 840 G10" -> G10
  const gen = title.match(/\bG(\d{1,2})\b/)?.[1];
  if (gen) add("Generation", `G${gen}`);

  const device = title.match(/Galaxy (S\d{2}(?:\s?(?:Ultra|\+|&\s?S\d{2}\+))?)/i)?.[1];
  if (device && /protector|glass|display|screen|module|case/i.test(title)) add("Compatible With", `Galaxy ${device}`);

  if (/tempered glass/i.test(title)) add("Type", "Tempered glass");
  if (/display module|replacement display|screen/i.test(title) && /replacement|module/i.test(title))
    add("Type", "Replacement display");

  return specs;
}

function tagsFrom(title: string, category: NormalizedCategory, brand: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[()]/g, " ")
    .split(/[\s,/&-]+/)
    .filter((w) => w.length >= 3 && !/^\d+(gb|tb)?$/.test(w));
  return [
    ...new Set([
      brand.toLowerCase(),
      ...category.name
        .toLowerCase()
        .split(/[\s&]+/)
        .filter(Boolean),
      ...words,
    ]),
  ].slice(0, 20);
}

function variantLabel(specs: { key: string; value: string }[]): string {
  const parts = ["RAM", "Storage", "Compatible With"]
    .map((key) => specs.find((s) => s.key === key)?.value)
    .filter(Boolean);
  return parts.length ? parts.join(" / ") : "Standard";
}

function describe(entry: CatalogEntry, specs: { key: string; value: string }[]): { short: string; long: string } {
  const specLine = specs
    .filter((s) => ["Processor", "RAM", "Storage", "Graphics", "Screen Size"].includes(s.key))
    .map((s) => `${s.key}: ${s.value}`)
    .join(" · ");
  const short = specLine || entry.title;
  const long = [
    entry.title + ".",
    specLine ? `Key specifications — ${specLine}.` : "",
    "Pay securely in Naira with Paystack, with delivery across Nigeria.",
    "Contact our team if you would like the full specification sheet or condition details before ordering.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { short, long };
}

/** Short, stable code made from a text (same input gives the same code every time). */
function stableCode(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return (h1.toString(36) + h2.toString(36)).toUpperCase().slice(0, 10);
}

/** The product's address on Technocrat (e.g. "hp-elitebook-840-g10"), or its id for hand-made files. */
function stableKey(entry: CatalogEntry): string {
  if (entry.sourceUrl) {
    try {
      const last = new URL(entry.sourceUrl).pathname.split("/").filter(Boolean).pop();
      if (last) return last.toLowerCase();
    } catch {
      /* fall through to the id */
    }
  }
  return String(entry.id);
}

interface ImageManifest {
  generatedAt: string | null;
  items: Record<string, { path: string; source?: string; sha256?: string | null; savedAt?: string }>;
}

/** The saved copy of this product's photo, if `npm run images:cache` stored one and the file is really there. */
export function cachedImageFor(key: string, manifest: ImageManifest = imageManifest as ImageManifest): string | null {
  const saved = manifest.items?.[key]?.path;
  if (!saved || !saved.startsWith("/images/products/") || saved.includes("..")) return null;
  return existsSync(join(process.cwd(), "public", saved)) ? saved : null;
}

export function mapEntry(entry: CatalogEntry, defaultStock: number): NormalizedProduct {
  const category = categoryFor(entry.category, entry.title);
  const brand = entry.brand?.trim() ? titleCaseBrand(entry.brand) : brandFromTitle(entry.title);
  const specs = specsFromTitle(entry.title);
  const rawCategory = (entry.category || "").trim();
  if (
    rawCategory &&
    rawCategory.toLowerCase() !== "other" &&
    !category.name.toLowerCase().includes(rawCategory.toLowerCase()) &&
    !specs.some((s) => s.key === "Type")
  ) {
    specs.push({ key: "Type", value: titleCase(rawCategory) });
  }
  const key = stableKey(entry);
  const cost = entry.costPriceNGN ?? entry.originalPriceNGN;
  const { short, long } = describe(entry, specs);
  // Only the real product photo is stored: your saved copy first, then the supplier's link.
  // If neither loads, the shop swaps in a neutral placeholder in the browser (see SafeImage),
  // so no photo of a different product is ever shown.
  const cached = cachedImageFor(key);
  const images = cached ? [cached] : entry.imageUrl ? [entry.imageUrl] : [GENERIC_FALLBACK_IMAGE];

  return {
    externalId: `TCR-${key}`,
    supplierSku: key,
    slug: slugify(entry.title),
    name: entry.title,
    brand,
    categorySlug: category.slug,
    shortDescription: short,
    description: long,
    images,
    specs,
    variants: [
      {
        sku: `TCR-${stableCode(key)}`,
        label: variantLabel(specs),
        attributes: [],
        price: Math.round(entry.sellingPriceNGN * 100),
        compareAtPrice: null,
        stock: entry.inStock ? defaultStock : 0,
        imageIndex: 0,
        stockIsEstimate: true,
      },
    ],
    tags: tagsFrom(entry.title, category, brand),
    rating: 0,
    reviewCount: 0,
    featured: false,
    costPrice: typeof cost === "number" && cost > 0 ? Math.round(cost * 100) : null,
  };
}

export class JsonCatalogSource implements ProductSource {
  readonly id = "technocrat";
  private readonly entries: CatalogEntry[];
  private readonly defaultStock: number;

  constructor(entries: CatalogEntry[] = catalog as CatalogEntry[]) {
    this.entries = entries;
    const parsed = Number(process.env.SUPPLIER_DEFAULT_STOCK ?? "5");
    this.defaultStock = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 5;
  }

  async fetchCategories(): Promise<NormalizedCategory[]> {
    const seen = new Map<string, NormalizedCategory>();
    for (const entry of this.entries) {
      const category = categoryFor(entry.category, entry.title);
      seen.set(category.slug, category);
    }
    return [...seen.values()];
  }

  async fetchProducts(): Promise<NormalizedProduct[]> {
    const valid = this.entries.filter(
      (e) => e && e.id && e.title && Number.isFinite(e.sellingPriceNGN) && e.sellingPriceNGN > 0,
    );
    // One product per Technocrat address, even if the file lists it twice.
    const byKey = new Map<string, NormalizedProduct>();
    for (const entry of valid) {
      const product = mapEntry(entry, this.defaultStock);
      if (!byKey.has(product.externalId)) byKey.set(product.externalId, product);
    }
    return [...byKey.values()];
  }
}
