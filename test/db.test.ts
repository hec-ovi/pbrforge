import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { Database } from "../src/db/Database.js";
import { MaterialsError } from "../src/db/errors.js";
import type { MaterialEntry } from "../src/db/types.js";

function entryFixture(key: string, aliases: string[] = []): MaterialEntry {
  return {
    key,
    ...(aliases.length ? { aliases } : {}),
    alignment: "tile",
    tiling: { worldSize: [3, 3] },
    physical: { breakable: false },
    variants: [
      {
        id: "1",
        resolution: [64, 64],
        maps: {
          basecolor: "assets/wall/poor/1/basecolor.png",
          normal: "assets/wall/poor/1/normal.png",
          roughness: "assets/wall/poor/1/roughness.png",
          metallic: "assets/wall/poor/1/metallic.png",
        },
      },
    ],
  };
}

describe("database contract", () => {
  let themesDir: string;
  let db: Database;

  beforeEach(() => {
    themesDir = mkdtempSync(join(tmpdir(), "materials-"));
    db = new Database(themesDir);
    db.ensureTheme("cyberpunk");
    mkdirSync(join(themesDir, "cyberpunk/assets/wall/poor/1"), {
      recursive: true,
    });
    for (const map of ["basecolor", "normal", "roughness", "metallic"]) {
      writeFileSync(
        join(themesDir, `cyberpunk/assets/wall/poor/1/${map}.png`),
        "png",
      );
    }
    db.write(entryFixture("cyberpunk/wall/poor", ["cyberpunk/wall-trim/poor"]));
  });

  it("resolves a key to its entry", () => {
    const entry = db.resolve("cyberpunk/wall/poor");
    expect(entry.alignment).toBe("tile");
    expect(entry.tiling?.worldSize).toEqual([3, 3]);
    expect(entry.variants[0].maps.basecolor).toBe(
      "assets/wall/poor/1/basecolor.png",
    );
  });

  it("resolves an alias to the same entry", () => {
    expect(db.resolve("cyberpunk/wall-trim/poor").key).toBe(
      "cyberpunk/wall/poor",
    );
  });

  it("throws E_KEY_NOT_FOUND for an unknown key", () => {
    expect(() => db.resolve("cyberpunk/wall/high_rich")).toThrowError(
      expect.objectContaining({ code: "E_KEY_NOT_FOUND" }),
    );
  });

  it("throws E_THEME_NOT_FOUND for a missing theme", () => {
    expect(() => db.resolve("medieval/wall/poor")).toThrowError(
      expect.objectContaining({ code: "E_THEME_NOT_FOUND" }),
    );
  });

  it("throws E_SCHEMA for a malformed key", () => {
    expect(() => db.resolve("not-a-key")).toThrowError(
      expect.objectContaining({ code: "E_SCHEMA" }),
    );
  });

  it("lists keys sorted with filters applied", () => {
    expect(db.list()).toEqual(["cyberpunk/wall/poor"]);
    expect(db.list({ theme: "cyberpunk", kind: "wall", tier: "poor" })).toEqual(
      ["cyberpunk/wall/poor"],
    );
    expect(db.list({ tier: "rich" })).toEqual([]);
  });

  it("refuses to overwrite an existing key without overwrite", () => {
    expect(() => db.write(entryFixture("cyberpunk/wall/poor"))).toThrowError(
      expect.objectContaining({ code: "E_KEY_EXISTS" }),
    );
    db.write(entryFixture("cyberpunk/wall/poor"), true);
  });

  it("refuses an entry whose map files are not on disk", () => {
    const entry = entryFixture("cyberpunk/roof/poor");
    entry.variants[0].maps.basecolor = "assets/roof/poor/1/basecolor.png";
    expect(() => db.write(entry)).toThrowError(
      expect.objectContaining({ code: "E_SCHEMA" }),
    );
  });

  it("typed error carries the closed-set code", () => {
    try {
      db.resolve("cyberpunk/none/none");
    } catch (e) {
      expect(e).toBeInstanceOf(MaterialsError);
      return;
    }
    expect.unreachable();
  });
});

/** The kind vocabulary the contract guarantees, aliases included. */
const KINDS = [
  "wall",
  "wall-band",
  "wall-trim",
  "column",
  "window-glass",
  "window-frame",
  "curtain",
  "door",
  "door-glass",
  "balcony-slab",
  "balcony-rail",
  "roof",
  "floor-slab",
  "parapet",
  "signage",
  "ad-screen",
  "light-fixture",
  "fire-escape",
  "aperture-frame",
  "roof-artifact",
  "plaster",
  "tile",
  "ceiling",
  "wood",
  "carpet",
  "rubber",
  "concrete",
  "metal",
  "elevator_door",
  "fabric",
  "glass",
  "sidewalk",
  "road",
  "curb",
  "highway-deck",
  "highway-support",
  "plastic",
  "ad-screen-tall",
  "letter-atlas",
  "ac-unit",
];

describe("shipped cyberpunk coverage", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const db = new Database(join(root, "themes"));

  it("resolves every guaranteed kind at all four tiers", () => {
    const missing = KINDS.flatMap((kind) =>
      ["poor", "mid", "rich", "high_rich"]
        .map((tier) => `cyberpunk/${kind}/${tier}`)
        .filter((key) => {
          try {
            return db.resolve(key).variants.length === 0;
          } catch {
            return true;
          }
        }),
    );
    expect(missing).toEqual([]);
  });

  it("ships frames, doors, trim and service metal without texture noise", async () => {
    const themeDir = db.themeDir("cyberpunk");
    const steel: Record<string, { id: string; metallic: number }> = {
      "window-frame": { id: "paint", metallic: 1 },
      door: { id: "paint", metallic: 1 },
      "wall-trim": { id: "paint", metallic: 1 },
      metal: { id: "paint", metallic: 1 },
      "fire-escape": { id: "paint", metallic: 1 },
      "roof-artifact": { id: "paint", metallic: 1 },
    };
    for (const [kind, { id, metallic }] of Object.entries(steel)) {
      for (const tier of ["poor", "mid", "rich", "high_rich"]) {
        const entry = db.resolve(`cyberpunk/${kind}/${tier}`);
        const lead = entry.variants[0];
        expect(lead.id, `${kind}/${tier}`).toBe(id);
        expect(entry.physical.metallicFactor, `${kind}/${tier}`).toBe(metallic);
        // the contract's bound: a tonal drift under two percent, which is five code values
        const paint = (
          await sharp(join(themeDir, lead.maps.basecolor)).stats()
        ).channels.slice(0, 3);
        expect(
          Math.max(...paint.map((c) => c.max - c.min)),
          `${kind}/${tier} basecolor`,
        ).toBeLessThanOrEqual(5);
        const gloss = (await sharp(join(themeDir, lead.maps.roughness)).stats())
          .channels[0];
        expect(
          gloss.max - gloss.min,
          `${kind}/${tier} roughness`,
        ).toBeLessThanOrEqual(1);
        const normal = await sharp(join(themeDir, lead.maps.normal))
          .raw()
          .toBuffer();
        const lean =
          normal
            .filter((_, i) => i % 3 !== 2)
            .reduce((sum, v) => sum + Math.abs(v - 128), 0) /
          (normal.length / 3) /
          2;
        expect(lean, `${kind}/${tier} normal`).toBeLessThan(1);
        if (
          kind === "metal" ||
          kind === "fire-escape" ||
          kind === "roof-artifact"
        ) {
          expect(entry.variants.map((variant) => variant.id)).toEqual([
            "paint",
            "zinc",
          ]);
        }
      }
    }
  });

  it("gives concrete columns restrained continuous surface detail", async () => {
    const themeDir = db.themeDir("cyberpunk");
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const entry = db.resolve(`cyberpunk/column/${tier}`);
      expect(entry.tiling?.worldSize).toEqual([1.5, 3]);
      expect(
        entry.variants.map((variant) => [
          variant.id,
          variant.class,
          variant.resolution,
        ]),
      ).toEqual([
        ["plain", "pattern", [256, 512]],
        ["cement", "pattern", [256, 512]],
      ]);
      for (const variant of entry.variants) {
        expect(variant.layout).toEqual({
          family: "continuous",
          origin: [0, 0],
          orientation: "vertical",
        });
        const stats = await sharp(
          join(themeDir, variant.maps.basecolor),
        ).stats();
        const means = stats.channels.slice(0, 3).map((channel) => channel.mean);
        expect(
          Math.max(...means),
          `${entry.key}:${variant.id} brightness`,
        ).toBeLessThan(115);
        expect(
          Math.max(...means) - Math.min(...means),
          `${entry.key}:${variant.id} chroma`,
        ).toBeLessThan(10);
        expect(
          Math.max(
            ...stats.channels
              .slice(0, 3)
              .map((channel) => channel.max - channel.min),
          ),
        ).toBeGreaterThan(5);
      }
    }
  });

  it("references only maps that are in the repo, so a fresh clone resolves every key", () => {
    // local rebrand output sits in the same tree but is never committed: the index must not point at it
    const tracked = new Set(
      execFileSync("git", ["ls-files", "themes/cyberpunk"], {
        cwd: root,
        encoding: "utf8",
      }).split("\n"),
    );
    const stray: string[] = [];
    for (const key of db.list({ theme: "cyberpunk" })) {
      for (const variant of db.resolve(key).variants) {
        for (const file of Object.values(variant.maps)) {
          if (!tracked.has(`themes/cyberpunk/${file}`))
            stray.push(`${key}:${variant.id} ${file}`);
        }
      }
    }
    expect(stray).toEqual([]);
  });

  it("leads the flat-face kinds with a solid variant, so a face that is not a whole number of tiles shows no cut joint", async () => {
    const themeDir = db.themeDir("cyberpunk");
    const offences: string[] = [];
    for (const kind of [
      "concrete",
      "plaster",
      "ceiling",
      "roof",
      "floor-slab",
    ]) {
      for (const tier of ["poor", "mid", "rich", "high_rich"]) {
        const lead = db.resolve(`cyberpunk/${kind}/${tier}`).variants[0];
        if (lead.id !== "plain")
          offences.push(`${kind}/${tier} leads with ${lead.id}`);
        // a joint reads as a hard edge across the tile; tonal drift never steps more than a few code values
        const { data, info } = await sharp(join(themeDir, lead.maps.basecolor))
          .greyscale()
          .raw()
          .toBuffer({ resolveWithObject: true });
        let step = 0;
        for (let y = 0; y < info.height; y++)
          for (let x = 1; x < info.width; x++)
            step = Math.max(
              step,
              Math.abs(data[y * info.width + x] - data[y * info.width + x - 1]),
            );
        if (step > 8) offences.push(`${kind}/${tier} basecolor steps ${step}`);
      }
    }
    expect(offences).toEqual([]);
  }, 60_000);

  it("renders every light fixture as a lamp at its own emissive strength, not as a solid lit face", async () => {
    const themeDir = db.themeDir("cyberpunk");
    const offences: string[] = [];
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const entry = db.resolve(`cyberpunk/light-fixture/${tier}`);
      const strength = entry.physical.emissiveStrength ?? 1;
      for (const variant of entry.variants) {
        const { data } = await sharp(join(themeDir, variant.maps.emission!))
          .greyscale()
          .raw()
          .toBuffer({ resolveWithObject: true });
        let clipped = 0;
        for (const px of data) if ((px / 255) * strength >= 0.99) clipped++;
        // a fixture that blows out over most of its face reads as a white rectangle, not a lamp
        const share = clipped / data.length;
        if (share > 0.25)
          offences.push(
            `${entry.key}:${variant.id} clips ${Math.round(share * 100)}% of its face`,
          );
      }
    }
    expect(offences).toEqual([]);
  }, 30_000);

  it("fits elevator-door maps to the published exact face with no photographed source", () => {
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const entry = db.resolve(`cyberpunk/elevator_door/${tier}`);
      expect(entry.alignment).toBe("exact");
      expect(entry.aspect).toEqual([1, 2]);
      expect(entry.finish).toBeUndefined();
      expect(entry.variants.map((variant) => variant.id)).toEqual([
        "split",
        "graphite",
      ]);
      for (const variant of entry.variants) {
        expect(variant.class).toBe("pattern");
        expect(variant.resolution).toEqual([512, 1024]);
      }
    }
  });

  it("fits deterministic curtains to the 1.5 x 3 m bay without stretching", () => {
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const entry = db.resolve(`cyberpunk/curtain/${tier}`);
      expect(entry.tiling?.worldSize).toEqual([1.5, 3]);
      expect(entry.finish).toBeUndefined();
      expect(
        entry.variants.map((variant) => [
          variant.id,
          variant.class,
          variant.resolution,
        ]),
      ).toEqual([
        ["blind", "pattern", [384, 768]],
        ["shade", "flat", [384, 768]],
      ]);
    }
  });

  it("ships signage as a dark casing around the separately lit glyphs", async () => {
    const themeDir = db.themeDir("cyberpunk");
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const entry = db.resolve(`cyberpunk/signage/${tier}`);
      expect(entry.tiling?.worldSize).toEqual([0.5, 0.5]);
      expect(entry.physical.metallicFactor).toBe(0);
      expect(entry.variants.map((variant) => variant.id)).toEqual([
        "casing",
        "backplate",
      ]);
      for (const variant of entry.variants) {
        expect(variant.class).toBe("flat");
        expect(variant.maps.emission).toBeUndefined();
        expect(variant.resolution).toEqual([256, 256]);
        const normal = await sharp(join(themeDir, variant.maps.normal)).stats();
        expect(normal.channels[0].min).toBe(normal.channels[0].max);
        expect(normal.channels[1].min).toBe(normal.channels[1].max);
      }
    }
  });

  it("leads ceilings with smooth dark matte paint", async () => {
    const themeDir = db.themeDir("cyberpunk");
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const entry = db.resolve(`cyberpunk/ceiling/${tier}`);
      const plain = entry.variants[0];
      expect(plain.id).toBe("plain");
      expect(plain.class).toBe("flat");
      expect(entry.physical.roughnessFactor).toBeGreaterThanOrEqual(0.58);
      expect(entry.physical.roughnessFactor).toBeLessThanOrEqual(0.7);
      const base = await sharp(join(themeDir, plain.maps.basecolor)).stats();
      expect(
        Math.max(...base.channels.slice(0, 3).map((channel) => channel.max)),
      ).toBeLessThan(70);
      const normal = await sharp(join(themeDir, plain.maps.normal))
        .raw()
        .toBuffer();
      expect(new Set(normal).size).toBe(2);
    }
  });

  it("ships floor and balcony slabs as deterministic whole-grid options", () => {
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const entry = db.resolve(`cyberpunk/floor-slab/${tier}`);
      expect(db.resolve(`cyberpunk/balcony-slab/${tier}`).key).toBe(entry.key);
      expect(entry.tiling?.worldSize).toEqual([2, 2]);
      expect(entry.finish).toBeUndefined();
      expect(
        entry.variants.map((variant) => [
          variant.id,
          variant.class,
          variant.resolution,
        ]),
      ).toEqual([
        ["plain", "pattern", [512, 512]],
        ["panel", "pattern", [512, 512]],
        ["large-slab", "pattern", [512, 512]],
      ]);
      expect(entry.variants[0].layout?.family).toBe("continuous");
      expect(entry.variants[1].layout?.moduleSize).toEqual([2, 1]);
      expect(entry.variants[2].layout?.moduleSize).toEqual([2, 2]);
    }
  });

  it("ships roofs as deterministic whole-grid options", () => {
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const entry = db.resolve(`cyberpunk/roof/${tier}`);
      expect(entry.tiling?.worldSize).toEqual([2, 2]);
      expect(entry.finish).toBeUndefined();
      expect(
        entry.variants.map((variant) => [
          variant.id,
          variant.class,
          variant.resolution,
        ]),
      ).toEqual([
        ["plain", "pattern", [512, 512]],
        ["panel", "pattern", [512, 512]],
        ["panel-square", "pattern", [512, 512]],
      ]);
      expect(entry.variants[0].layout?.family).toBe("continuous");
      expect(entry.variants[1].layout?.moduleSize).toEqual([2, 1]);
      expect(entry.variants[2].layout?.moduleSize).toEqual([2, 2]);
    }
  });

  it("publishes exact 1.4 metre facade bands without baked panel joints", async () => {
    const themeDir = db.themeDir("cyberpunk");
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const entry = db.resolve(`cyberpunk/wall-band/${tier}`);
      expect(entry.tiling?.worldSize).toEqual([4, 1.4]);
      expect(
        entry.variants.map((variant) => [
          variant.id,
          variant.class,
          variant.resolution,
        ]),
      ).toEqual([
        ["cement", "pattern", [1000, 350]],
        ["graphite", "pattern", [1000, 350]],
      ]);
      for (const variant of entry.variants) {
        expect(variant.layout).toEqual({
          family: "band",
          bandHeight: 1.4,
          origin: [0, 0],
          orientation: "horizontal",
        });
        const { data, info } = await sharp(
          join(themeDir, variant.maps.basecolor),
        )
          .greyscale()
          .raw()
          .toBuffer({ resolveWithObject: true });
        let step = 0;
        for (let y = 0; y < info.height; y++) {
          for (let x = 1; x < info.width; x++) {
            step = Math.max(
              step,
              Math.abs(data[y * info.width + x] - data[y * info.width + x - 1]),
            );
          }
        }
        expect(step, `${entry.key}:${variant.id}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it("keeps exterior service finishes neutral and below bright-white range", async () => {
    const themeDir = db.themeDir("cyberpunk");
    for (const kind of [
      "ac-unit",
      "metal",
      "fire-escape",
      "roof-artifact",
      "window-frame",
      "door",
      "wall-trim",
    ]) {
      for (const tier of ["poor", "mid", "rich", "high_rich"]) {
        const entry = db.resolve(`cyberpunk/${kind}/${tier}`);
        for (const variant of entry.variants) {
          const stats = await sharp(
            join(themeDir, variant.maps.basecolor),
          ).stats();
          const means = stats.channels
            .slice(0, 3)
            .map((channel) => channel.mean);
          expect(
            Math.max(...means),
            `${entry.key}:${variant.id} brightness`,
          ).toBeLessThan(125);
          expect(
            Math.max(...means) - Math.min(...means),
            `${entry.key}:${variant.id} chroma`,
          ).toBeLessThan(12);
        }
      }
    }
  }, 30_000);

  it("ships neutral deterministic concrete with exact two by one facade panels", async () => {
    const themeDir = db.themeDir("cyberpunk");
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const entry = db.resolve(`cyberpunk/concrete/${tier}`);
      expect(entry.tiling?.worldSize).toEqual([2, 2]);
      expect(entry.finish).toBeUndefined();
      expect(
        entry.variants.map((variant) => [
          variant.id,
          variant.class,
          variant.resolution,
        ]),
      ).toEqual([
        ["plain", "pattern", [512, 512]],
        ["panel", "pattern", [512, 512]],
        ["panel-square", "pattern", [512, 512]],
        ["panel-graphite", "pattern", [512, 512]],
      ]);

      const panel = entry.variants[1];
      expect(panel.layout).toEqual({
        family: "panel",
        moduleSize: [2, 1],
        jointWidth: 0.02,
        origin: [0, 0],
        orientation: "horizontal",
      });
      const { data, info } = await sharp(join(themeDir, panel.maps.height!))
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const pixel = (x: number, y: number) =>
        data[(y * info.width + x) * info.channels];
      expect(pixel(256, 256)).toBeLessThan(pixel(256, 128) - 10);
    }
  });

  it("ships walls only as neutral continuous fields and large panels", async () => {
    const themeDir = db.themeDir("cyberpunk");
    const rejected = new Set([
      "1",
      "2",
      "3",
      "4",
      "panel-ochre",
      "panel-bone",
      "panel-rust",
      "panel-slate",
      "panel-teal",
      "tint-slate",
      "tint-teal",
    ]);
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const entry = db.resolve(`cyberpunk/wall/${tier}`);
      expect(entry.tiling?.worldSize).toEqual([2, 2]);
      expect(entry.variants.map((variant) => variant.id)).toEqual([
        "plain",
        "panel",
        "panel-square",
        "panel-graphite",
      ]);
      for (const variant of entry.variants) {
        expect(rejected.has(variant.id), `${entry.key}:${variant.id}`).toBe(
          false,
        );
        expect(variant.layout?.origin).toEqual([0, 0]);
        const stats = await sharp(
          join(themeDir, variant.maps.basecolor),
        ).stats();
        const means = stats.channels.slice(0, 3).map((channel) => channel.mean);
        expect(
          Math.max(...means),
          `${entry.key}:${variant.id} brightness`,
        ).toBeLessThan(125);
        expect(
          Math.max(...means) - Math.min(...means),
          `${entry.key}:${variant.id} chroma`,
        ).toBeLessThan(12);
      }
      expect(entry.variants[1].layout).toEqual({
        family: "panel",
        moduleSize: [2, 1],
        jointWidth: 0.02,
        origin: [0, 0],
        orientation: "horizontal",
      });
    }
  });

  it("ships ground and highway surfaces at their published world scale", async () => {
    const themeDir = db.themeDir("cyberpunk");
    for (const tier of ["poor", "mid", "rich", "high_rich"]) {
      const sidewalk = db.resolve(`cyberpunk/sidewalk/${tier}`);
      expect(sidewalk.tiling?.worldSize).toEqual([2, 2]);
      expect(sidewalk.variants.map((variant) => variant.id)).toEqual([
        "slab",
        "plate",
        "plain",
      ]);
      expect(sidewalk.variants[0].layout).toEqual({
        family: "panel",
        moduleSize: [2, 1],
        jointWidth: 0.02,
        origin: [0, 0],
        orientation: "horizontal",
      });
      expect(sidewalk.variants[1].layout?.moduleSize).toEqual([2, 2]);

      const road = db.resolve(`cyberpunk/road/${tier}`);
      expect(road.tiling?.worldSize).toEqual([3.5, 7]);
      expect(road.variants.map((variant) => variant.id)).toEqual([
        "street",
        "highway",
        "wet",
        "worn-concrete",
      ]);
      expect(road.variants[0].layout).toEqual({
        family: "lane",
        moduleSize: [3.5, 7],
        origin: [0, 0],
        orientation: "vertical",
      });

      const deck = db.resolve(`cyberpunk/highway-deck/${tier}`);
      expect(deck.tiling?.worldSize).toEqual([3.5, 7]);
      expect(deck.variants.map((variant) => variant.id)).toEqual([
        "asphalt",
        "concrete",
      ]);
      expect(deck.variants[0].layout?.family).toBe("lane");
      expect(deck.variants[1].layout?.family).toBe("continuous");

      const support = db.resolve(`cyberpunk/highway-support/${tier}`);
      expect(support.key).toBe(`cyberpunk/concrete/${tier}`);
      expect(support.variants[0].id).toBe("plain");
      expect(support.variants[1].id).toBe("panel");
    }

    const curb = db.resolve("cyberpunk/curb/poor");
    expect(curb.tiling?.worldSize).toEqual([2, 0.15]);
    expect(curb.variants[0].layout).toEqual({
      family: "panel",
      moduleSize: [1, 0.15],
      jointWidth: 0.01,
      origin: [0, 0],
      orientation: "horizontal",
    });

    for (const kind of ["sidewalk", "road", "highway-deck", "curb"]) {
      for (const tier of ["poor", "mid", "rich", "high_rich"]) {
        const entry = db.resolve(`cyberpunk/${kind}/${tier}`);
        for (const variant of entry.variants) {
          const stats = await sharp(
            join(themeDir, variant.maps.basecolor),
          ).stats();
          const means = stats.channels
            .slice(0, 3)
            .map((channel) => channel.mean);
          expect(
            Math.max(...means),
            `${entry.key}:${variant.id} brightness`,
          ).toBeLessThan(120);
          expect(
            Math.max(...means) - Math.min(...means),
            `${entry.key}:${variant.id} chroma`,
          ).toBeLessThan(12);
        }
      }
    }
  }, 60_000);

  it("fits every shipped map to its physical face and texture budget", async () => {
    const themeDir = db.themeDir("cyberpunk");
    for (const key of db.list({ theme: "cyberpunk" })) {
      const entry = db.resolve(key);
      const shape =
        entry.alignment === "tile" ? entry.tiling!.worldSize : entry.aspect!;
      const pixelLimit = entry.alignment === "tile" ? 1024 * 1024 : 4096 * 2304;
      for (const variant of entry.variants) {
        const [width, height] = variant.resolution;
        expect(
          Math.abs(width - height * (shape[0] / shape[1])),
          `${key}:${variant.id} aspect`,
        ).toBeLessThanOrEqual(1);
        expect(width, `${key}:${variant.id} width`).toBeLessThanOrEqual(4096);
        expect(height, `${key}:${variant.id} height`).toBeLessThanOrEqual(4096);
        expect(
          width * height,
          `${key}:${variant.id} pixels`,
        ).toBeLessThanOrEqual(pixelLimit);
        const actual = await sharp(
          join(themeDir, variant.maps.basecolor),
        ).metadata();
        expect(
          [actual.width, actual.height],
          `${key}:${variant.id} file`,
        ).toEqual(variant.resolution);
      }
    }
  }, 30_000);

  it("keeps photographed finish metadata off fully procedural entries", () => {
    const offences = db
      .list({ theme: "cyberpunk" })
      .map((key) => db.resolve(key))
      .filter((entry) =>
        entry.variants.every(
          (variant) => variant.class === "flat" || variant.class === "pattern",
        ),
      )
      .filter((entry) => entry.finish !== undefined)
      .map((entry) => entry.key);
    expect(offences).toEqual([]);
  });

  it("ships every non-emissive entry matte: metallic 0 or 1, roughness never below 0.45 except glass", async () => {
    const floor = Math.floor(0.45 * 255);
    const themeDir = db.themeDir("cyberpunk");
    const offences: string[] = [];
    for (const key of db.list({ theme: "cyberpunk" })) {
      const entry = db.resolve(key);
      const glass = (entry.physical.transmission ?? 0) > 0;
      const lit = entry.variants.some((v) => v.maps.emission);
      if (glass || lit) continue;
      const metallic = entry.physical.metallicFactor ?? 0;
      if (metallic !== 0 && metallic !== 1)
        offences.push(`${key} metallic ${metallic}`);
      if ((entry.physical.roughnessFactor ?? 1) < 0.45)
        offences.push(`${key} roughness factor`);
      if (entry.finish && entry.finish.roughness[0] < 0.45)
        offences.push(`${key} finish band`);
      for (const variant of entry.variants) {
        const gloss = (
          await sharp(join(themeDir, variant.maps.roughness)).stats()
        ).channels[0];
        if (gloss.min < floor)
          offences.push(`${key}:${variant.id} roughness map ${gloss.min}`);
        const fill = (
          await sharp(join(themeDir, variant.maps.metallic)).stats()
        ).channels[0];
        if (fill.min !== fill.max || fill.min !== Math.round(metallic * 255))
          offences.push(`${key}:${variant.id} metallic map`);
      }
    }
    expect(offences).toEqual([]);
  }, 120_000);
});
