import { readFileSync, writeFileSync } from "node:fs";

const filePath = process.argv[2] ?? "profile/wakatime.svg";
let svg = readFileSync(filePath, "utf8");

const rectPattern = /<rect\b(?=[^>]*data-testid="lang-progress")[^>]*\/>/g;
const groupPattern =
  /<g transform="translate\([^"]+\)">\s*<circle[^>]*\/>\s*<text data-testid="lang-name"[^>]*>[\s\S]*?<\/text>\s*<\/g>/g;

const rectMatches = [...svg.matchAll(rectPattern)];
const groupMatches = [...svg.matchAll(groupPattern)];

if (rectMatches.length !== groupMatches.length) {
  throw new Error(
    `Expected progress segments and labels to match, found ${rectMatches.length} segments and ${groupMatches.length} labels.`,
  );
}

const items = rectMatches.map((rectMatch, index) => {
  const group = groupMatches[index][0];
  const language = group.match(/>\s*([^<\n]+?)\s+-\s*[^<]+<\/text>/)?.[1]?.trim();

  if (!language) {
    throw new Error(`Could not parse WakaTime language label at index ${index}.`);
  }

  return {
    rect: rectMatch[0],
    group,
    language,
  };
});

const ordered = [
  ...items.filter((item) => item.language.toLowerCase() !== "other"),
  ...items.filter((item) => item.language.toLowerCase() === "other"),
];

let nextX = 0;
const rects = ordered
  .map((item) => {
    const width = Number(item.rect.match(/width="([^"]+)"/)?.[1]);

    if (!Number.isFinite(width)) {
      throw new Error(`Could not parse WakaTime progress width for ${item.language}.`);
    }

    const x = Number(nextX.toFixed(6)).toString();
    nextX += width;

    return item.rect.replace(/x="[^"]+"/, `x="${x}"`);
  })
  .join("");

const groups = ordered
  .map((item, index) => {
    const x = index % 2 === 0 ? "25" : "182.5";
    const y = 25 + Math.floor(index / 2) * 25;

    return item.group.replace(/transform="translate\([^"]+\)"/, `transform="translate(${x}, ${y})"`);
  })
  .join("");

function replaceRange(source, matches, replacement) {
  if (matches.length === 0) {
    return source;
  }

  const start = matches[0].index;
  const end = matches[matches.length - 1].index + matches[matches.length - 1][0].length;

  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

svg = replaceRange(svg, rectMatches, rects);
svg = replaceRange(svg, [...svg.matchAll(groupPattern)], groups);

writeFileSync(filePath, svg);
