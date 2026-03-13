export type Color = 'red' | 'blue' | 'yellow' | 'green';

export interface BlockCell {
  r: number;
  c: number;
  color: Color;
}

export interface BlockShape {
  id: string;
  cells: BlockCell[];
}

export interface GameState {
  grid: (Color | null)[][];
  score: number;
  highScore: number;
  combo: number;
  availableBlocks: (BlockShape | null)[];
  isGameOver: boolean;
  isAdShowing: boolean;
  hasAdsEnabled: boolean;
  settings: {
    volume: number;
    vibration: boolean;
  };
}
