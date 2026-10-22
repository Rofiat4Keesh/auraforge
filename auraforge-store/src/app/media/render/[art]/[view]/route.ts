import type { NextRequest } from "next/server";

/**
 * Built-in product image renderer for the demo catalog.
 * GET /media/render/<art>/<view>?accent=22F3FF  ->  an 800×800 SVG "studio render".
 *
 * Real supplier feeds provide normal photo URLs instead, so this route is only used
 * by the mock catalog. It keeps the demo store fully self-contained (no external images).
 */

export const runtime = "nodejs";

const ARTS = [
  "laptop",
  "minipc",
  "phone",
  "tablet",
  "gpu",
  "ram",
  "ssd",
  "keyboard",
  "mouse",
  "monitor",
  "headphones",
  "earbuds",
  "watch",
  "charger",
  "cable",
  "software",
  "photo",
] as const;
type Art = (typeof ARTS)[number];

function device(art: Art, a: string, body: string, edge: string): string {
  switch (art) {
    case "laptop":
      return `
        <rect x="190" y="190" width="420" height="270" rx="16" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="210" y="210" width="380" height="230" rx="6" fill="url(#screen)"/>
        <path d="M230 400 L300 330 L350 365 L430 280 L570 400 Z" fill="${a}" opacity="0.18"/>
        <circle cx="400" cy="200" r="3" fill="${a}"/>
        <path d="M140 470 L660 470 L630 510 L170 510 Z" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="355" y="478" width="90" height="10" rx="5" fill="${edge}"/>
        <line x1="180" y1="505" x2="620" y2="505" stroke="${a}" stroke-width="2" opacity="0.8"/>`;
    case "minipc":
      return `
        <rect x="250" y="260" width="300" height="300" rx="36" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="280" y="290" width="240" height="240" rx="24" fill="none" stroke="${a}" stroke-width="2" opacity="0.5"/>
        <circle cx="400" cy="410" r="62" fill="none" stroke="${a}" stroke-width="3"/>
        <circle cx="400" cy="410" r="20" fill="${a}" opacity="0.9"/>
        <rect x="300" y="520" width="200" height="6" rx="3" fill="${a}"/>`;
    case "phone":
      return `
        <rect x="300" y="150" width="200" height="420" rx="34" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="314" y="166" width="172" height="388" rx="24" fill="url(#screen)"/>
        <rect x="370" y="176" width="60" height="12" rx="6" fill="${body}"/>
        <circle cx="400" cy="380" r="54" fill="none" stroke="${a}" stroke-width="3" opacity="0.8"/>
        <path d="M376 380 L396 400 L428 362" fill="none" stroke="${a}" stroke-width="5" stroke-linecap="round"/>
        <rect x="350" y="530" width="100" height="5" rx="2.5" fill="${a}" opacity="0.7"/>`;
    case "tablet":
      return `
        <rect x="170" y="200" width="460" height="330" rx="28" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="190" y="220" width="420" height="290" rx="14" fill="url(#screen)"/>
        <path d="M230 470 C 300 330, 380 470, 450 330 S 560 300, 580 260" fill="none" stroke="${a}" stroke-width="4"/>
        <rect x="610" y="250" width="10" height="160" rx="5" fill="${a}" transform="rotate(18 615 330)"/>`;
    case "gpu":
      return `
        <rect x="130" y="260" width="540" height="240" rx="20" fill="${body}" stroke="${edge}" stroke-width="3"/>
        ${[260, 400, 540]
          .map(
            (cx) => `
          <circle cx="${cx}" cy="380" r="62" fill="#05060A" stroke="${edge}" stroke-width="3"/>
          <circle cx="${cx}" cy="380" r="62" fill="none" stroke="${a}" stroke-width="2" opacity="0.6"/>
          ${[0, 45, 90, 135, 180, 225, 270, 315].map((r) => `<path d="M${cx} 380 L${cx + 50} 365 Q${cx + 40} 395 ${cx} 380" fill="${edge}" transform="rotate(${r} ${cx} 380)"/>`).join("")}
          <circle cx="${cx}" cy="380" r="14" fill="${a}"/>`,
          )
          .join("")}
        <rect x="170" y="500" width="300" height="16" fill="${a}" opacity="0.85"/>
        <rect x="150" y="268" width="500" height="6" rx="3" fill="${a}" opacity="0.6"/>`;
    case "ram":
      return `
        ${[0, 1]
          .map(
            (i) => `
          <g transform="translate(0 ${i * 150})">
            <rect x="150" y="250" width="500" height="110" rx="10" fill="${body}" stroke="${edge}" stroke-width="3"/>
            <path d="M150 270 L260 270 L290 300 L650 300" fill="none" stroke="${a}" stroke-width="3"/>
            ${Array.from({ length: 24 }, (_, k) => `<rect x="${162 + k * 20}" y="345" width="10" height="20" fill="#C9A227" opacity="0.85"/>`).join("")}
            <text x="180" y="335" fill="${a}" font-family="monospace" font-size="18" letter-spacing="4">DDR5 · 6000</text>
          </g>`,
          )
          .join("")}`;
    case "ssd":
      return `
        <rect x="140" y="330" width="520" height="140" rx="10" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="170" y="355" width="120" height="90" rx="6" fill="#05060A" stroke="${a}" stroke-width="2"/>
        <rect x="310" y="355" width="90" height="90" rx="6" fill="#05060A" stroke="${edge}" stroke-width="2"/>
        <rect x="420" y="355" width="90" height="90" rx="6" fill="#05060A" stroke="${edge}" stroke-width="2"/>
        ${Array.from({ length: 10 }, (_, k) => `<rect x="${530 + k * 12}" y="350" width="6" height="40" fill="#C9A227"/>`).join("")}
        <circle cx="165" cy="400" r="10" fill="none" stroke="${a}" stroke-width="3"/>
        <text x="320" y="510" fill="${a}" font-family="monospace" font-size="22" letter-spacing="6">NVMe GEN4</text>`;
    case "keyboard":
      return `
        <rect x="120" y="270" width="560" height="260" rx="24" fill="${body}" stroke="${edge}" stroke-width="3"/>
        ${Array.from({ length: 5 }, (_, row) =>
          Array.from(
            { length: 12 },
            (_, col) =>
              `<rect x="${145 + col * 43}" y="${292 + row * 44}" width="36" height="36" rx="7" fill="#0A0C12" stroke="${(row + col) % 5 === 0 ? a : edge}" stroke-width="2"/>`,
          ).join(""),
        ).join("")}
        <rect x="120" y="528" width="560" height="4" fill="${a}" opacity="0.9"/>`;
    case "mouse":
      return `
        <path d="M400 180 C 520 180, 540 300, 540 420 C 540 560, 470 620, 400 620 C 330 620, 260 560, 260 420 C 260 300, 280 180, 400 180 Z" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <line x1="400" y1="185" x2="400" y2="330" stroke="${edge}" stroke-width="3"/>
        <rect x="388" y="230" width="24" height="56" rx="12" fill="#05060A" stroke="${a}" stroke-width="3"/>
        <path d="M300 520 Q400 580 500 520" fill="none" stroke="${a}" stroke-width="4"/>`;
    case "monitor":
      return `
        <rect x="120" y="170" width="560" height="340" rx="14" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="136" y="186" width="528" height="300" rx="6" fill="url(#screen)"/>
        <path d="M150 440 L280 330 L380 400 L520 260 L650 380 L650 470 L150 470 Z" fill="${a}" opacity="0.16"/>
        <rect x="380" y="510" width="40" height="80" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="290" y="586" width="220" height="16" rx="8" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="380" y="495" width="40" height="4" rx="2" fill="${a}"/>`;
    case "headphones":
      return `
        <path d="M230 430 C 230 230, 570 230, 570 430" fill="none" stroke="${body}" stroke-width="40" stroke-linecap="round"/>
        <path d="M230 430 C 230 230, 570 230, 570 430" fill="none" stroke="${edge}" stroke-width="3"/>
        <rect x="185" y="400" width="110" height="170" rx="50" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="505" y="400" width="110" height="170" rx="50" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <circle cx="240" cy="485" r="26" fill="none" stroke="${a}" stroke-width="4"/>
        <circle cx="560" cy="485" r="26" fill="none" stroke="${a}" stroke-width="4"/>`;
    case "earbuds":
      return `
        <rect x="270" y="380" width="260" height="190" rx="80" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <line x1="280" y1="450" x2="520" y2="450" stroke="${edge}" stroke-width="3"/>
        <circle cx="400" cy="505" r="6" fill="${a}"/>
        <g transform="rotate(-20 320 290)"><ellipse cx="320" cy="290" rx="44" ry="54" fill="${body}" stroke="${edge}" stroke-width="3"/><rect x="306" y="320" width="28" height="80" rx="14" fill="${body}" stroke="${edge}" stroke-width="3"/><circle cx="320" cy="285" r="12" fill="${a}"/></g>
        <g transform="rotate(20 480 290)"><ellipse cx="480" cy="290" rx="44" ry="54" fill="${body}" stroke="${edge}" stroke-width="3"/><rect x="466" y="320" width="28" height="80" rx="14" fill="${body}" stroke="${edge}" stroke-width="3"/><circle cx="480" cy="285" r="12" fill="${a}"/></g>`;
    case "watch":
      return `
        <rect x="345" y="120" width="110" height="160" rx="20" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="345" y="520" width="110" height="160" rx="20" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <circle cx="400" cy="400" r="140" fill="${body}" stroke="${edge}" stroke-width="4"/>
        <circle cx="400" cy="400" r="118" fill="url(#screen)"/>
        <circle cx="400" cy="400" r="96" fill="none" stroke="${a}" stroke-width="10" stroke-dasharray="420 200" stroke-linecap="round" transform="rotate(-90 400 400)"/>
        <text x="400" y="412" text-anchor="middle" fill="#F2F5FA" font-family="monospace" font-size="38">10:24</text>
        <rect x="538" y="380" width="16" height="40" rx="6" fill="${a}"/>`;
    case "charger":
      return `
        <rect x="290" y="240" width="220" height="280" rx="30" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <rect x="335" y="300" width="130" height="20" rx="10" fill="#05060A" stroke="${a}" stroke-width="2"/>
        <rect x="335" y="340" width="130" height="20" rx="10" fill="#05060A" stroke="${a}" stroke-width="2"/>
        <rect x="350" y="380" width="100" height="30" rx="4" fill="#05060A" stroke="${edge}" stroke-width="2"/>
        <path d="M410 430 L380 480 L405 480 L392 520 L430 462 L405 462 Z" fill="${a}"/>
        <rect x="330" y="520" width="30" height="70" rx="4" fill="${edge}"/>
        <rect x="440" y="520" width="30" height="70" rx="4" fill="${edge}"/>
        <rect x="385" y="520" width="30" height="50" rx="4" fill="${edge}"/>`;
    case "cable":
      return `
        <path d="M200 560 C 120 380, 320 260, 420 360 S 700 420, 600 240" fill="none" stroke="${body}" stroke-width="26" stroke-linecap="round"/>
        <path d="M200 560 C 120 380, 320 260, 420 360 S 700 420, 600 240" fill="none" stroke="${a}" stroke-width="3" stroke-dasharray="10 10" opacity="0.8"/>
        <rect x="170" y="550" width="60" height="90" rx="12" fill="${body}" stroke="${edge}" stroke-width="3" transform="rotate(-15 200 595)"/>
        <rect x="182" y="625" width="36" height="30" rx="8" fill="#9AA3B5" transform="rotate(-15 200 640)"/>
        <rect x="570" y="160" width="60" height="90" rx="12" fill="${body}" stroke="${edge}" stroke-width="3" transform="rotate(25 600 205)"/>
        <rect x="582" y="140" width="36" height="30" rx="8" fill="#9AA3B5" transform="rotate(25 600 155)"/>`;
    case "photo":
      // Neutral "image unavailable" card, used when a real product photo link is missing or broken.
      return `
        <rect x="200" y="230" width="400" height="300" rx="28" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <path d="M240 480 L340 380 L410 440 L470 390 L560 480 Z" fill="${a}" opacity="0.25"/>
        <circle cx="500" cy="300" r="26" fill="none" stroke="${a}" stroke-width="4" opacity="0.7"/>
        <path d="M400 150 L452 180 L452 240 L400 270 L348 240 L348 180 Z" fill="none" stroke="${a}" stroke-width="4" transform="translate(0 -40) scale(1) "/>
        <text x="400" y="590" text-anchor="middle" fill="#8B93A8" font-family="monospace" font-size="22" letter-spacing="6">IMAGE UNAVAILABLE</text>`;
    case "software":
    default:
      return `
        <rect x="230" y="170" width="340" height="460" rx="24" fill="${body}" stroke="${edge}" stroke-width="3"/>
        <path d="M400 250 L500 290 L500 380 C 500 450, 450 500, 400 520 C 350 500, 300 450, 300 380 L300 290 Z" fill="none" stroke="${a}" stroke-width="6"/>
        <path d="M360 380 L392 412 L448 350" fill="none" stroke="${a}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="290" y="560" width="220" height="10" rx="5" fill="${edge}"/>
        <rect x="320" y="585" width="160" height="10" rx="5" fill="${edge}"/>`;
  }
}

function render(art: Art, view: number, accent: string): string {
  const a = `#${accent}`;
  const alt = view === 1;
  const body = alt ? "#D9DEE8" : "#1B2030";
  const edge = alt ? "#8B93A8" : "#363E57";

  const transforms = [
    "translate(0 0)",
    "translate(400 400) rotate(-8) translate(-400 -400)",
    "translate(400 400) scale(1.75) translate(-400 -400)",
    "translate(400 430) scale(0.78) translate(-400 -400)",
  ];

  const plate =
    view === 3
      ? `<g font-family="monospace" fill="${a}" font-size="18" letter-spacing="3">
           <text x="48" y="70">AURAFORGE // ${art.toUpperCase()}</text>
           <text x="48" y="100" fill="#8B93A8" font-size="14">SPEC PLATE · ENGINEERED FOR NG</text>
           <text x="752" y="760" text-anchor="end" fill="#8B93A8" font-size="14">RC 9920648</text>
         </g>
         <rect x="40" y="40" width="720" height="720" fill="none" stroke="${a}" stroke-opacity="0.35" stroke-dasharray="6 10"/>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="${alt ? "#1A1F2E" : "#11141D"}"/>
      <stop offset="100%" stop-color="#05060A"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${a}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${a}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1020"/>
      <stop offset="60%" stop-color="#101A33"/>
      <stop offset="100%" stop-color="${a}" stop-opacity="0.45"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0 L0 0 0 40" fill="none" stroke="${a}" stroke-opacity="0.07" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <rect width="800" height="800" fill="url(#grid)"/>
  <ellipse cx="400" cy="420" rx="320" ry="260" fill="url(#glow)"/>
  <ellipse cx="400" cy="660" rx="250" ry="26" fill="#000" opacity="0.55"/>
  <g transform="${transforms[view] ?? transforms[0]}">${device(art, a, body, edge)}</g>
  ${plate}
</svg>`;
}

export async function GET(req: NextRequest, context: { params: Promise<{ art: string; view: string }> }) {
  const { art, view } = await context.params;
  const safeArt: Art = (ARTS as readonly string[]).includes(art) ? (art as Art) : "software";
  const viewIndex = Math.min(3, Math.max(0, Number.parseInt(view, 10) || 0));
  const accentParam = req.nextUrl.searchParams.get("accent") || "22F3FF";
  const accent = /^[0-9a-fA-F]{6}$/.test(accentParam) ? accentParam : "22F3FF";

  return new Response(render(safeArt, viewIndex, accent), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
