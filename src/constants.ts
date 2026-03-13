import { Color, BlockShape } from './types';

export const GRID_SIZE = 8;

export const COLORS: Color[] = ['red', 'blue', 'yellow', 'green'];

export const COLOR_MAP: Record<Color, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-500',
};

export const SHAPES: number[][][] = [
  [[0, 0]], // Single dot
  [[0, 0], [0, 1]], // 1x2
  [[0, 0], [1, 0]], // 2x1
  [[0, 0], [0, 1], [0, 2]], // 1x3
  [[0, 0], [1, 0], [2, 0]], // 3x1
  [[0, 0], [0, 1], [1, 0], [1, 1]], // 2x2 Square
  [[0, 0], [0, 1], [0, 2], [1, 1]], // T-shape
  [[0, 0], [1, 0], [2, 0], [1, 1]], // T-shape rotated
  [[0, 0], [0, 1], [1, 1], [1, 2]], // Z-shape
  [[0, 1], [1, 1], [1, 0], [2, 0]], // S-shape
  [[0, 0], [0, 1], [0, 2], [0, 3]], // 1x4
  [[0, 0], [1, 0], [2, 0], [3, 0]], // 4x1
  [[0, 0], [0, 1], [1, 0]], // L-small
  [[0, 0], [1, 0], [1, 1]], // L-small rotated
  // Weird shapes
  [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]], // Plus sign
  [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], // X-shape
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]], // 3x3 Frame
  [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]], // Stair shape
  [[0, 0], [1, 0], [1, 1], [2, 1]], // Small zig-zag
  [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], // Large L
  [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], // Large L rotated
  // Even weirder shapes
  [[0, 0], [0, 1], [1, 0], [2, 0], [2, 1]], // C-shape
  [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]], // Empty square (O-shape)
  [[0, 0], [1, 1], [2, 2]], // Diagonal 3
  [[0, 2], [1, 1], [2, 0]], // Diagonal 3 reverse
  [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3]], // Long zig-zag
  [[0, 1], [1, 0], [1, 1], [1, 2], [2, 0], [2, 2]], // H-shape small
  [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]], // Plus-like T
  [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]], // T-large
];

export const generateRandomBlock = (): BlockShape => {
  const shapeIndex = Math.floor(Math.random() * SHAPES.length);
  const shape = SHAPES[shapeIndex];
  
  const baseColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const isLarge = shape.length >= 5;
  // Large blocks (5+ cells) are always multi-colored. Small blocks have 50% chance.
  const isMultiColored = isLarge || Math.random() > 0.5;

  const cells = shape.map(([r, c]) => ({
    r,
    c,
    color: isMultiColored ? COLORS[Math.floor(Math.random() * COLORS.length)] : baseColor
  }));

  // Force color diversity for large blocks to satisfy the "must have another color" rule
  if (isLarge) {
    const firstColor = cells[0].color;
    const isMonochromatic = cells.every(cell => cell.color === firstColor);
    
    if (isMonochromatic) {
      // Change one random cell to a different color
      const randomIndex = Math.floor(Math.random() * cells.length);
      const otherColors = COLORS.filter(c => c !== firstColor);
      cells[randomIndex].color = otherColors[Math.floor(Math.random() * otherColors.length)];
    }
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    cells,
  };
};
