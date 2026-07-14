/** Minimal 3D vector helpers, used by the §5 satellite sunlit test. */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function scale(a: Vector3, s: number): Vector3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function subtract(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function magnitude(a: Vector3): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}
