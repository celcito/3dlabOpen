import { describe, it, expect } from "vitest";
import { parseOBJ } from "../objParser";

const OBJ_TWO_GROUPS = `
# Cube with two g groups
o Cube
g Bottom
v 0 0 0
v 10 0 0
v 10 10 0
v 0 10 0
f 1/1 2/1 3/1
f 1/1 3/1 4/1
g Top
v 0 0 10
v 10 0 10
v 10 10 10
v 0 10 10
f 5/1 6/1 7/1
f 5/1 7/1 8/1
`;

const OBJ_SINGLE_GROUP = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;

const OBJ_VERTEX_NORMAL = `
vn 0 0 1
v -1 -1 0
v 1 -1 0
v 0 1 0
f 1//1 2//1 3//1
`;

describe("parseOBJ", () => {
  it("creates regionMask when multiple g groups exist", async () => {
    const parsed = await parseOBJ(OBJ_TWO_GROUPS);
    expect(parsed.geometry.attributes.position.count).toBe(8);
    expect(parsed.regionMask).toBeDefined();
    const mask = parsed.regionMask!;
    const bottom = new Set([mask[0], mask[1], mask[2], mask[3]]);
    const top = new Set([mask[4], mask[5], mask[6], mask[7]]);
    expect(bottom.size).toBe(1);
    expect(top.size).toBe(1);
    expect(bottom.values().next().value).not.toBe(top.values().next().value);
    expect(parsed.objects.length).toBe(2);
  });

  it("handles OBJ without groups (single region, no mask)", async () => {
    const parsed = await parseOBJ(OBJ_SINGLE_GROUP);
    expect(parsed.geometry.attributes.position.count).toBe(3);
    expect(parsed.regionMask).toBeUndefined();
    expect(parsed.objects).toEqual([{ name: "default", color: undefined }]);
  });

  it("uses vertex normals when provided", async () => {
    const parsed = await parseOBJ(OBJ_VERTEX_NORMAL);
    expect(parsed.geometry.attributes.normal).toBeDefined();
  });

  it("copies faces into shared-indexed geometry (fan-out)", async () => {
    const parsed = await parseOBJ(OBJ_TWO_GROUPS);
    const index = parsed.geometry.index!;
    expect(index.count).toBe(12); // 4 triangles
    // All vertices referenced.
    const set = new Set<number>();
    for (let i = 0; i < index.count; i++) set.add(index.getX(i));
    expect(set.size).toBe(8);
  });

  it("throws on empty OBJ", async () => {
    await expect(parseOBJ("")).rejects.toThrow(/no vertices/);
  });
});