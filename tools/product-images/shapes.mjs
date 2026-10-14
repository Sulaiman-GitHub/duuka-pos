// Reusable flat-style illustration pieces. Everything is drawn around the origin (0,0); the caller translates.
let n = 0;
export const uid = (p = "id") => `${p}${++n}`;
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
export const lighten = (c, t = 0.3) => mix(c, "#ffffff", t);
export const darken = (c, t = 0.25) => mix(c, "#000000", t);

export const txt = (t, x, y, size, fill = "#fff", weight = 800, extra = "") =>
  `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle" ${extra}>${esc(t)}</text>`;

const rr = (x, y, w, h, r, fill, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
export { rr };

/** Bottle with cap, neck, shoulders, liquid level, label and a shine strip. */
export function bottle({ w = 96, h = 250, neck = 34, capH = 26, neckH = 34, shoulder = 44, liquid = "#9ad0f0", empty = "#eef7fc", cap = "#1e6fd9", label = "#1e6fd9", labelText = "", labelSize = 20, labelH = 78, labelY = 20, level = 0.82, textColor = "#fff", sub = "", icon = "", pump = false, flip = false, nozzle = false, glass = false }) {
  const top = -h / 2, nx = neck / 2, bx = w / 2, y0 = top + capH, y1 = y0 + neckH, y2 = y1 + shoulder, bot = h / 2, r = 16;
  const body = `M ${-nx} ${y0} L ${-nx} ${y1} C ${-nx} ${y1 + shoulder * 0.55} ${-bx} ${y2 - shoulder * 0.55} ${-bx} ${y2} L ${-bx} ${bot - r} Q ${-bx} ${bot} ${-bx + r} ${bot} L ${bx - r} ${bot} Q ${bx} ${bot} ${bx} ${bot - r} L ${bx} ${y2} C ${bx} ${y2 - shoulder * 0.55} ${nx} ${y1 + shoulder * 0.55} ${nx} ${y1} L ${nx} ${y0} Z`;
  const id = uid("b");
  const liquidTop = y0 + (bot - y0) * (1 - level);
  let capSvg = rr(-nx - 4, top + (flip || nozzle ? 0 : 0), neck + 8, capH, 6, cap) + rr(-nx - 4, top + capH - 7, neck + 8, 7, 3, darken(cap, 0.2));
  if (pump) capSvg = rr(-6, top - 34, 12, 40, 4, darken(cap, 0.1)) + rr(-26, top - 40, 44, 14, 6, cap) + rr(-nx - 4, top + 2, neck + 8, capH - 2, 6, cap);
  if (nozzle) capSvg = rr(-nx - 4, top + 10, neck + 8, capH - 6, 6, cap) + rr(-8, top - 8, 16, 22, 5, darken(cap, 0.15)) + rr(-8, top - 8, 34, 8, 4, darken(cap, 0.15));
  if (flip) capSvg = rr(-nx - 8, top - 6, neck + 16, capH + 6, 9, cap) + rr(-nx - 8, top + capH - 12, neck + 16, 6, 3, darken(cap, 0.2));
  return `<defs><clipPath id="${id}"><path d="${body}"/></clipPath></defs>
  <path d="${body}" fill="${glass ? "#7a4a1f" : empty}"/>
  <g clip-path="url(#${id})"><rect x="${-bx}" y="${liquidTop}" width="${w}" height="${bot - liquidTop + 4}" fill="${liquid}"/>
  ${labelText || icon ? `<rect x="${-bx}" y="${labelY - labelH / 2}" width="${w}" height="${labelH}" fill="${label}"/>` : ""}
  <rect x="${-bx + 12}" y="${y2}" width="9" height="${bot - y2 - 18}" rx="4" fill="#fff" opacity="0.38"/></g>
  <path d="${body}" fill="none" stroke="${darken(liquid, 0.35)}" stroke-width="2.5" opacity="0.55"/>
  ${icon ? `<g transform="translate(0 ${labelY - (labelText ? 14 : 0)})">${icon}</g>` : ""}
  ${labelText ? txt(labelText, 0, labelY + (sub ? 2 : 8) + (icon ? 18 : 0), labelSize, textColor) : ""}${sub ? txt(sub, 0, labelY + 22 + (icon ? 18 : 0), 13, textColor, 700) : ""}
  ${capSvg}`;
}

/** Flat 3D box. `face(w,h)` draws onto the front face, centred on its own origin. */
export function box({ w = 170, h = 210, d = 34, color = "#2f6f3e", face = () => "", sideShade = 0.25, topShade = 0.18 }) {
  const x0 = -w / 2 - d / 2, y0 = -h / 2 + d * 0.3, dy = d * 0.6;
  return `<polygon points="${x0 + w},${y0} ${x0 + w + d},${y0 - dy} ${x0 + w + d},${y0 + h - dy} ${x0 + w},${y0 + h}" fill="${darken(color, sideShade)}"/>
  <polygon points="${x0},${y0} ${x0 + d},${y0 - dy} ${x0 + w + d},${y0 - dy} ${x0 + w},${y0}" fill="${lighten(color, topShade)}"/>
  <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${color}"/>
  <g transform="translate(${x0 + w / 2} ${y0 + h / 2})">${face(w, h)}</g>`;
}

/** Paper/foil bag with a crimped top. */
export function bag({ w = 150, h = 220, color = "#f4f1e8", crimp = "#d9d4c4", face = () => "", foil = false }) {
  const x = -w / 2, y = -h / 2, zig = [];
  for (let i = 0; i <= 10; i++) zig.push(`${x + (w / 10) * i},${y + (i % 2 ? 0 : 16)}`);
  const sheen = foil ? `<rect x="${x + 14}" y="${y + 34}" width="10" height="${h - 60}" rx="5" fill="#fff" opacity="0.35"/>` : "";
  return `<polygon points="${zig.join(" ")} ${x + w},${y + 30} ${x + w},${y + h - 8} ${x + w - 10},${y + h} ${x + 10},${y + h} ${x},${y + h - 8} ${x},${y + 30}" fill="${color}"/>
  <rect x="${x}" y="${y + 14}" width="${w}" height="22" fill="${crimp}" opacity="0.8"/>${sheen}
  <g transform="translate(0 ${y + h / 2 + 14})">${face(w, h)}</g>`;
}

/** Carton with a gabled top (milk, juice). */
export function carton({ w = 120, h = 200, color = "#fff", top = "#1e6fd9", face = () => "" }) {
  const x = -w / 2, y = -h / 2 + 24;
  return `<polygon points="${x},${y} ${x + w * 0.18},${y - 44} ${x + w * 0.82},${y - 44} ${x + w},${y}" fill="${lighten(top, 0.1)}"/>
  <rect x="${x + w * 0.18}" y="${y - 54}" width="${w * 0.64}" height="12" rx="3" fill="${darken(top, 0.15)}"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h - 24}" fill="${color}"/>
  <rect x="${x + w}" y="${y}" width="22" height="${h - 24}" fill="${darken(color, 0.12)}" transform="translate(-22 0)" opacity="0.55"/>
  <rect x="${x}" y="${y + h - 52}" width="${w}" height="28" fill="${top}"/>
  <g transform="translate(0 ${y + (h - 24) / 2 - 14})">${face(w, h)}</g>`;
}

export const shadow = (w = 220, y = 138) => `<ellipse cx="0" cy="${y}" rx="${w / 2}" ry="13" fill="#000" opacity="0.13"/>`;
export const sparkle = (x, y, s = 8, c = "#fff") => `<path d="M ${x} ${y - s} L ${x + s * 0.3} ${y - s * 0.3} L ${x + s} ${y} L ${x + s * 0.3} ${y + s * 0.3} L ${x} ${y + s} L ${x - s * 0.3} ${y + s * 0.3} L ${x - s} ${y} L ${x - s * 0.3} ${y - s * 0.3} Z" fill="${c}"/>`;
