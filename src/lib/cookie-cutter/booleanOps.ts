import * as ClipperLib from "clipper-lib";
import { DesignElement, toPathData, pathDataToPoints } from "./designElements";

const CLIPPER_SCALE = 1000;

function pathDataToClipperPaths(pathData: string): ClipperLib.Path[] {
  const points = pathDataToPoints(pathData);
  if (points.length < 3) return [];
  
  const path: ClipperLib.Path = [];
  for (const p of points) {
    path.push({ X: Math.round(p.x * CLIPPER_SCALE), Y: Math.round(p.y * CLIPPER_SCALE) });
  }
  
  if (ClipperLib.Clipper.Orientation(path)) {
    return [path];
  } else {
    return [path.reverse()];
  }
}

function clipperPathsToPathData(paths: ClipperLib.Path[]): string {
  if (paths.length === 0) return "";
  
  let d = "";
  for (const path of paths) {
    if (path.length === 0) continue;
    const first = path[0];
    d += `M ${first.X / 1000} ${first.Y / 1000} `;
    for (let i = 1; i < path.length; i++) {
      const p = path[i];
      d += `L ${p.X / 1000} ${p.Y / 1000} `;
    }
    d += "Z ";
  }
  return d.trim();
}

export type BooleanOp = "union" | "subtract" | "intersect" | "exclude";

export async function booleanOperation(
  elements: DesignElement[],
  op: BooleanOp
): Promise<{ pathData: string; originalIds: string[] }> {
  const clipper = new ClipperLib.Clipper();
  const subjectPaths: ClipperLib.Path[] = [];
  const clipPaths: ClipperLib.Path[] = [];
  const originalIds: string[] = [];

  const pathElements = elements.filter(e => e.type === "path" || e.type === "primitive");
  
  if (pathElements.length < 2) {
    throw new Error("Selecione pelo menos 2 elementos de caminho");
  }

  if (op === "subtract") {
    const first = pathElements[0];
    const rest = pathElements.slice(1);
    
    const firstPaths = pathDataToClipperPaths(toPathData(first));
    subjectPaths.push(...firstPaths);
    originalIds.push(first.id);
    
    for (const el of rest) {
      const paths = pathDataToClipperPaths(toPathData(el));
      clipPaths.push(...paths);
      originalIds.push(el.id);
    }
    
    clipper.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
    clipper.Execute(ClipperLib.ClipType.ctDifference, subjectPaths);
    
  } else if (op === "intersect") {
    const first = pathElements[0];
    const rest = pathElements.slice(1);
    
    const firstPaths = pathDataToClipperPaths(toPathData(first));
    subjectPaths.push(...firstPaths);
    originalIds.push(first.id);
    
    for (const el of rest) {
      const paths = pathDataToClipperPaths(toPathData(el));
      clipPaths.push(...paths);
      originalIds.push(el.id);
    }
    
    clipper.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
    clipper.Execute(ClipperLib.ClipType.ctIntersection, subjectPaths);
    
  } else if (op === "exclude") {
    const first = pathElements[0];
    const rest = pathElements.slice(1);
    
    const firstPaths = pathDataToClipperPaths(toPathData(first));
    subjectPaths.push(...firstPaths);
    originalIds.push(first.id);
    
    for (const el of rest) {
      const paths = pathDataToClipperPaths(toPathData(el));
      clipPaths.push(...paths);
      originalIds.push(el.id);
    }
    
    clipper.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
    clipper.Execute(ClipperLib.ClipType.ctXor, subjectPaths);
    
  } else {
    // Union
    for (const el of pathElements) {
      const paths = pathDataToClipperPaths(toPathData(el));
      subjectPaths.push(...paths);
      originalIds.push(el.id);
    }
    
    clipper.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
    clipper.Execute(ClipperLib.ClipType.ctUnion, subjectPaths);
  }

  const resultPathData = clipperPathsToPathData(subjectPaths);
  return { pathData: resultPathData, originalIds };
}