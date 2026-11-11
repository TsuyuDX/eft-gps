import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { mapMarkers } from "../public/features/maps.js";
import { markerIcon } from "../public/core/map-icons.js";
import { db } from "../public/core/data.js";
import { projectPoint } from "../public/core/domain.js";
const root = process.cwd();
const read = async (name) =>
  JSON.parse(await fs.readFile(path.join(root, "public/data", name), "utf8"));
db.assets = await read("assets.json");
const maps = await read("maps.json");
const report = {
  checkedAt: new Date().toISOString(),
  gameVersion: "1.3.x — exact current build not independently confirmed",
  method:
    "Structural validation plus comparison with the current TarkovHead map API. A reference match is not in-game verification.",
  maps: [],
  totals: {
    markers: 0,
    invalid: 0,
    missingIcons: 0,
    missingNames: 0,
    hazards: 0,
  },
};
const digest = (v) =>
  crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
for (const mode of ["regular", "pve"])
  for (const info of maps) {
    const slug = info.routeSlug || info.normalizedName,
      file = (mode === "pve" ? "pve/" : "") + "maps/" + slug + ".json";
    const { map } = await read(file);
    const markers = mapMarkers(map, { includeInvalid: true }),
      summary = {
        mode,
        slug,
        categories: {},
        invalid: [],
        missingIcons: [],
        missingNames: [],
        outside: 0,
        hazards:
          (map.hazards || []).length + (map.artillery?.zones || []).length,
        source: `https://www.tarkovhead.com/api/map/${slug}?gameMode=${mode}&locale=ru`,
        verification: "unconfirmed",
      };
    for (const [i, m] of markers.entries()) {
      const position = m.position;
      summary.categories[m.group] = (summary.categories[m.group] || 0) + 1;
      report.totals.markers++;
      if (
        !position ||
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.z)
      ) {
        summary.invalid.push(i);
        report.totals.invalid++;
        continue;
      }
      const p = projectPoint(position, map);
      if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) summary.outside++;
      const icon = markerIcon(m, map);
      const local = db.assets[icon] || icon;
      if (
        !local?.startsWith("/assets/") ||
        !(await fs.access(path.join(root, "public", local)).then(
          () => true,
          () => false,
        ))
      ) {
        summary.missingIcons.push({ i, group: m.group, icon });
        report.totals.missingIcons++;
      }
      if (!(m.title || m.name)) {
        summary.missingNames.push({ i, group: m.group });
        report.totals.missingNames++;
      }
    }
    report.totals.hazards += summary.hazards;
    try {
      const response = await fetch(summary.source, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error("http-" + response.status);
      const remote = (await response.json()).map;
      if (!remote) throw Error("no-map");
      const localZones = {
          hazards: map.hazards || [],
          artillery: map.artillery || null,
        },
        remoteZones = {
          hazards: remote.hazards || [],
          artillery: remote.artillery || null,
        };
      summary.hazardReferenceMatch = digest(localZones) === digest(remoteZones);
      summary.referenceHazards =
        (remote.hazards || []).length + (remote.artillery?.zones || []).length;
      summary.verification = summary.hazardReferenceMatch
        ? "reference-match-not-game-verified"
        : "reference-differs";
      const positions = (m) =>
        mapMarkers(m).map((x) => ({
          group: x.group,
          position: x.position,
          title: x.title || x.name,
        }));
      summary.markerReferenceMatch =
        digest(positions(map)) === digest(positions(remote));
      summary.categoryReference = {};
      for (const group of new Set([
        ...Object.keys(summary.categories),
        ...positions(remote).map((x) => x.group),
      ])) {
        const local = positions(map).filter((x) => x.group === group),
          fresh = positions(remote).filter((x) => x.group === group);
        const points = (list) =>
          list.map((x) => JSON.stringify(x.position)).sort();
        summary.categoryReference[group] = {
          local: local.length,
          current: fresh.length,
          coordinatesMatch: digest(points(local)) === digest(points(fresh)),
          labelsMatch:
            digest(local.map((x) => x.title).sort()) ===
            digest(fresh.map((x) => x.title).sort()),
        };
      }
    } catch (error) {
      summary.referenceError = error.message;
    }
    report.maps.push(summary);
    console.log(
      mode,
      slug,
      Object.values(summary.categories).reduce((a, b) => a + b, 0),
      summary.verification,
    );
  }
await fs.writeFile(
  "public/data/map-audit.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report.totals));
