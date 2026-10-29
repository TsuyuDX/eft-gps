import fs from "node:fs/promises";
const output = "public/assets/secret-maps-markers";
await fs.mkdir(output, { recursive: true });
for (const file of await fs.readdir("public/assets/eft-gps-markers")) {
  if (!file.endsWith(".svg")) continue;
  const text = await fs.readFile(
    "public/assets/eft-gps-markers/" + file,
    "utf8",
  );
  const color = text.match(/hsl\([^)]+\)/)?.[0];
  let body = text.match(/<g fill="none"[^>]*>(.*?)<\/g>(?:<rect|<\/svg>)/)?.[1];
  if (!color || !body) throw Error("Invalid source icon: " + file);
  if (body.startsWith("<g transform="))
    body = body.replace(/^<g[^>]*>/, "").replace(/<\/g>$/, "");
  const frame = file.startsWith("extract_")
    ? '<path d="M22 43C17 36 5 27 5 18a17 17 0 1 1 34 0c0 9-12 18-17 25Z"/>'
    : '<circle cx="22" cy="22" r="18"/>';
  await fs.writeFile(
    output + "/" + file,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 50 50"><g fill="${color}" stroke="#15171b" stroke-width="3">${frame}</g><g fill="none" stroke="#202125" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`,
  );
}
