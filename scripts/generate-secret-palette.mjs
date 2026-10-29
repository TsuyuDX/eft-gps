import fs from "node:fs/promises";
// Recolour the shared component rules under an explicit session-only scope.
const sources = ["style.css", "gps.css", "quests.css", "workspace.css"];
const allowed =
  /^(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|box-shadow|text-shadow|fill|stroke|accent-color|scrollbar-color|filter)$/;
function splitTop(text, separator = ",") {
  let quote = "",
    depth = 0,
    start = 0,
    out = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== "\\") quote = "";
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "(" || c === "[") depth++;
    if (c === ")" || c === "]") depth--;
    if (c === separator && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}
function tint(hex, property) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join("");
  if (h.length !== 6 && h.length !== 8) return hex;
  const alpha = h.slice(6),
    r = parseInt(h.slice(0, 2), 16) / 255,
    g = parseInt(h.slice(2, 4), 16) / 255,
    b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    diff = max - min;
  let hue =
    diff === 0
      ? 0
      : max === r
        ? 60 * (((g - b) / diff) % 6)
        : max === g
          ? 60 * ((b - r) / diff + 2)
          : 60 * ((r - g) / diff + 4);
  hue = (hue + 360) % 360;
  const surface = property.startsWith("background"),
    edge = /border|outline|scrollbar/.test(property),
    shadow = property.includes("shadow") || property === "filter";
  let result;
  if (shadow) {
    result = max < 0.2 ? "#000000" : "#72adff";
  } else if (surface) {
    result = max < 0.12 ? "#1c2028" : max < 0.35 ? "#252b35" : "#333b49";
  } else if (edge) {
    result = "#475365";
  } else if (diff > 0.15 && hue >= 75 && hue < 165) {
    result = "#5ad9ae";
  } else if (diff > 0.15 && hue >= 165 && hue < 260) {
    result = "#81b7ff";
  } else if (diff > 0.15 && hue >= 260 && hue < 330) {
    result = "#c6a5ff";
  } else if (diff > 0.15 && (hue < 25 || hue >= 330)) {
    result = "#ff818c";
  } else {
    result = max > 0.78 ? "#f1f4f9" : max > 0.4 ? "#b7c1d0" : "#8592a5";
  }
  return result + alpha;
}
function scope(selector) {
  selector = selector.trim();
  if (selector.startsWith(":root"))
    return selector.replace(":root", ".secret-maps-theme");
  if (/^html(?=[.#:\s]|$)/.test(selector))
    return selector.replace(/^html/, "html.secret-maps-theme");
  return ".secret-maps-theme " + selector;
}
function compile(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "",
    start = 0,
    quote = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === quote && css[i - 1] !== "\\") quote = "";
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === ";" && css.slice(start, i).trim().startsWith("@")) {
      start = i + 1;
      continue;
    }
    if (c !== "{") continue;
    const head = css.slice(start, i).trim();
    let depth = 1,
      j = i + 1,
      innerQuote = "";
    for (; j < css.length && depth; j++) {
      const x = css[j];
      if (innerQuote) {
        if (x === innerQuote && css[j - 1] !== "\\") innerQuote = "";
        continue;
      }
      if (x === '"' || x === "'") {
        innerQuote = x;
        continue;
      }
      if (x === "{") depth++;
      if (x === "}") depth--;
    }
    if (depth) throw Error("Unbalanced CSS");
    const body = css.slice(i + 1, j - 1);
    if (/^@(media|supports|container|layer)\b/.test(head)) {
      const nested = compile(body);
      if (nested) out += head + "{\n" + nested + "}\n";
    } else if (!head.startsWith("@")) {
      const declarations = splitTop(body, ";").flatMap((part) => {
        const at = part.indexOf(":");
        if (at < 0) return [];
        const key = part.slice(0, at).trim(),
          value = part.slice(at + 1).trim();
        if (!allowed.test(key) || !/#(?:[a-f\d]{3,8})\b/i.test(value))
          return [];
        return [
          key +
            ":" +
            value.replace(/#[a-f\d]{3,8}\b/gi, (hex) => tint(hex, key)),
        ];
      });
      if (declarations.length)
        out +=
          splitTop(head).map(scope).join(",\n") +
          "{" +
          declarations.join(";") +
          "}\n";
    }
    i = j - 1;
    start = j;
  }
  return out;
}
let output =
  "/* Generated scoped palette for every shared EFT GPS component. */\n";
for (const source of sources)
  output +=
    "/* " +
    source +
    " */\n" +
    compile(await fs.readFile("public/" + source, "utf8"));
await fs.writeFile("public/secret-palette.css", output);
console.log("Scoped palette:", output.length, "bytes");
