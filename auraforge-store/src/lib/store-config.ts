/**
 * Central business configuration.
 * Everything that identifies the company lives here so it can be changed in one place.
 * Values prefixed NEXT_PUBLIC_ are safe to read in both server and browser code.
 */
export const company = {
  legalName: "AURAFORGE WIDE TECHNOLOGIES LTD",
  brandName: "AuraForge",
  rcNumber: "9920648",
  tagline: "Engineered electronics. Forged for the future.",
  businessScope:
    "Manufacturing, designing, developing, assembling, buying, selling, resampling, distributing, marketing, servicing, repairing, altering and dealing in electrical and electronic devices, gadgets, computers, computer parts, accessories, peripherals, software packages and mobile applications.",
  address:
    process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "Replace with your CAC-registered office address, City, State, Nigeria",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@yourdomain.ng",
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+234 000 000 0000",
  country: "Nigeria",
} as const;

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

/** Shipping rules — configured in Naira in .env, converted to kobo here. */
export const shippingConfig = {
  flatFeeKobo: Math.round(Number(process.env.SHIPPING_FLAT_FEE_NGN || "5000") * 100),
  freeThresholdKobo: Math.round(Number(process.env.FREE_SHIPPING_THRESHOLD_NGN || "500000") * 100),
};

/** Nigerian states for the checkout form. */
export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT - Abuja",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export const policyPages = [
  { slug: "terms", title: "Terms of Service" },
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "returns", title: "Returns & Warranty" },
  { slug: "shipping", title: "Shipping & Delivery" },
] as const;
