import * as THREE from "three";

export interface ParsedOBJ {
  geometry: THREE.BufferGeometry;
  regionMask?: Uint8Array;
  suggestedColors?: string[];
  objects: { name: string; color?: string }[];
}

const GROUP_COLORS = [
  "#632CE5",
  "#FF1744",
  "#00FF41",
  "#D500F9",
  "#FF9100",
  "#FF4081",
  "#FFEA00",
  "#2979FF",
];

/**
 * Parses a Wavefront .obj (optionally with `g` groups / `usemtl` names) into a
 * merged geometry. When `g`/`o` groups are present, a per-vertex regionMask is
 * produced so downstream auto-segmentation can start from real groups.
 */
export async function parseOBJ(text: string): Promise<ParsedOBJ> {
  const positions: number[] = [];

  let currentGroup = "default";
  const rawFaces: { v: number }[][] = [];
  const faceGroups: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    const key = parts[0];
    const args = parts.slice(1);

    switch (key) {
      case "v":
        positions.push(parseFloat(args[0]), parseFloat(args[1]), parseFloat(args[2]));
        break;
      case "g":
      case "o":
        currentGroup = args[0] || "default";
        break;
      case "usemtl":
        currentGroup = args[0] || currentGroup;
        break;
      case "f": {
        const vertexCount = positions.length / 3;
        const face = args.map((token) => {
          const rawIndex = parseInt(token.split("/")[0], 10);
          return { v: rawIndex < 0 ? vertexCount + rawIndex : rawIndex - 1 };
        });
        if (face.length >= 3) {
          rawFaces.push(face);
          faceGroups.push(currentGroup);
        }
        break;
      }
    }
  }

  if (positions.length === 0 || rawFaces.length === 0) {
    throw new Error("OBJ contains no vertices/faces");
  }

  // Face-level groups → output-vertex groups.
  const finalPos: number[] = [];
  const indexMap = new Map<string, number>();
  const finalIndices: number[] = [];
  const vertexGroup = new Map<number, string>(); // outVertexIndex -> group name
  const groupNames: string[] = [];

  const getGroup = (name: string) => {
    if (!groupNames.includes(name)) groupNames.push(name);
    return name;
  };

  rawFaces.forEach((face, fi) => {
    const groupName = getGroup(faceGroups[fi]);
    for (let i = 1; i < face.length - 1; i++) {
      const triangle = [face[0], face[i], face[i + 1]];
      if (triangle.some((corner) => corner.v < 0 || corner.v >= positions.length / 3)) continue;
      for (const corner of triangle) {
        const key = `${corner.v}:${groupName}`;
        let out = indexMap.get(key);
        if (out === undefined) {
          out = finalPos.length / 3;
          indexMap.set(key, out);
          finalPos.push(positions[corner.v * 3], positions[corner.v * 3 + 1], positions[corner.v * 3 + 2]);
        }
        finalIndices.push(out);
        vertexGroup.set(out, groupName);
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(finalPos, 3));
  geometry.setIndex(finalIndices);
  geometry.computeVertexNormals();
  geometry.center();
  geometry.computeBoundingBox();

  const hasGroups = groupNames.length > 1 || groupNames[0] !== "default";
  const objects = groupNames.map((name, i) => ({
    name,
    color: hasGroups ? GROUP_COLORS[i % GROUP_COLORS.length] : undefined,
  }));

  if (!hasGroups) {
    return { geometry, objects };
  }

  const groupToRegion = new Map<string, number>();
  groupNames.forEach((name, i) => groupToRegion.set(name, i + 1));
  const regionMask = new Uint8Array(finalPos.length / 3);
  const suggestedColors: string[] = [];
  for (let vi = 0; vi < finalPos.length / 3; vi++) {
    const g = vertexGroup.get(vi) || "default";
    const regionId = groupToRegion.get(g)!;
    regionMask[vi] = regionId;
    const color = objects[regionId - 1].color;
    if (color && !suggestedColors.includes(color)) suggestedColors.push(color);
  }

  return { geometry, regionMask, suggestedColors, objects };
}
