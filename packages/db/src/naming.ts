// Irregular tokens that do not follow plain camel boundaries. Map is applied
// in BOTH directions so the transform is lossless. Order matters: longest first.
const IRREGULAR: Array<[camel: string, snake: string]> = [
  ["URDistribution", "_ur_distribution"],
  ["I18n", "_i18n"],
  ["2F24", "_2_f24"],
  ["PO", "_po"],
];

export function toSnake(camel: string): string {
  let s = camel;
  for (const [c, snake] of IRREGULAR) s = s.split(c).join(` ${snake} `);
  s = s
    .split(" ")
    .map((seg) =>
      seg.startsWith("_")
        ? seg
        : seg
            .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
            .replace(/([a-z])([0-9])/g, "$1_$2"),
    )
    .join("");
  return s.replace(/__+/g, "_").replace(/^_/, "").toLowerCase();
}

export function toCamel(snake: string): string {
  // Reverse via the known irregular snake forms first, then standard.
  const rev: Array<[snake: string, camel: string]> = [
    ["_ur_distribution", "URDistribution"],
    ["_i18n", "I18n"],
    ["_2_f24", "2F24"],
    ["_po", "PO"],
  ];
  let s = snake;
  for (const [sn, c] of rev) s = s.split(sn).join(` ${c} `);
  return s
    .split(" ")
    .map((seg) =>
      seg.includes("_") || /^[a-z0-9]+$/.test(seg)
        ? seg.replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase())
        : seg,
    )
    .join("");
}
