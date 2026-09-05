export interface Point2D {
  x: number;
  y: number;
}

/**
 * Computes the 2D Convex Hull of a set of 2D points using Andrew's Monotone Chain algorithm.
 * Returns the vertices of the convex hull ordered along the perimeter (counter-clockwise).
 * If points count <= 2, returns the points array directly.
 */
export function compute2DConvexHull<T extends Point2D>(points: T[]): T[] {
  if (points.length <= 2) {
    return [...points];
  }

  // Sort points primarily by x-coordinate, secondarily by y-coordinate
  const sorted = [...points].sort((a, b) => {
    if (Math.abs(a.x - b.x) > 1e-9) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  // Cross product of OA and OB vectors: (A.x - O.x)*(B.y - O.y) - (A.y - O.y)*(B.x - O.x)
  // Positive if O -> A -> B turns counter-clockwise, negative if clockwise, 0 if collinear.
  const cross = (o: Point2D, a: Point2D, b: Point2D): number => {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  };

  // Build lower hull
  const lower: T[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  // Build upper hull
  const upper: T[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove the last point of each half because it is repeated at the beginning of the other half
  lower.pop();
  upper.pop();

  const hull = lower.concat(upper);
  return hull.length > 0 ? hull : sorted;
}
