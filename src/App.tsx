/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, RotateCcw, Volume2, VolumeX, Smartphone, Trophy, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Color, BlockShape, GameState } from './types';
import { GRID_SIZE, COLOR_MAP, COLORS, generateRandomBlock } from './constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DRAG_OFFSET_Y = 60;

function BlockDisplay({ block, size = 20, className }: { block: BlockShape; size?: number; className?: string }) {
  const minR = Math.min(...block.cells.map(c => c.r));
  const maxR = Math.max(...block.cells.map(c => c.r));
  const minC = Math.min(...block.cells.map(c => c.c));
  const maxC = Math.max(...block.cells.map(c => c.c));
  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;

  return (
    <div 
      className={cn("grid gap-[2px]", className)}
      style={{ 
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        width: 'fit-content'
      }}
    >
      {Array(rows).fill(0).map((_, r) => (
        Array(cols).fill(0).map((_, c) => {
          const cell = block.cells.find(cell => cell.r === r + minR && cell.c === c + minC);
          return (
            <div 
              key={`${r}-${c}`} 
              className={cn(
                "rounded-sm shadow-sm transition-colors duration-200",
                cell ? COLOR_MAP[cell.color] : "bg-transparent"
              )}
              style={{ width: size, height: size }}
            />
          );
        })
      ))}
    </div>
  );
}

interface Particle {
  id: string;
  x: number;
  y: number;
  color: Color;
  vx: number;
  vy: number;
}

interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const savedHighScore = localStorage.getItem('colorblock-highscore');
    return {
      grid: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
      score: 0,
      highScore: savedHighScore ? parseInt(savedHighScore) : 0,
      combo: 0,
      availableBlocks: [generateRandomBlock(), generateRandomBlock(), generateRandomBlock()],
      isGameOver: false,
      isAdShowing: false,
      hasAdsEnabled: true,
      settings: {
        volume: 0.5,
        vibration: true,
      },
    };
  });

  const [draggedBlock, setDraggedBlock] = useState<{ block: BlockShape; index: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragPositionRef = useRef({ x: 0, y: 0 });
  const dragOverlayRef = useRef<HTMLDivElement>(null);
  const lastHoveredPosRef = useRef<{ r: number; c: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [hoveredCells, setHoveredCells] = useState<{ r: number; c: number; color: Color }[]>([]);
  const [clearingCells, setClearingCells] = useState<Set<string>>(new Set());
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [isShaking, setIsShaking] = useState(false);
  const [gridFlash, setGridFlash] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  // Particle animation loop
  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles(prev => prev
        .map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.5, // Gravity
        }))
        .filter(p => p.y < window.innerHeight && p.x > 0 && p.x < window.innerWidth)
      );
    }, 16);
    return () => clearInterval(interval);
  }, [particles.length]);

  // Floating text cleanup
  useEffect(() => {
    if (floatingTexts.length === 0) return;
    const timeout = setTimeout(() => {
      setFloatingTexts(prev => prev.slice(1));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [floatingTexts.length]);

  const createParticles = (r: number, c: number, color: Color) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const cellSize = rect.width / GRID_SIZE;
    const centerX = rect.left + c * cellSize + cellSize / 2;
    const centerY = rect.top + r * cellSize + cellSize / 2;

    const newParticles: Particle[] = [];
    const count = 6 + (gameState.combo * 2);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 10;
      newParticles.push({
        id: Math.random().toString(),
        x: centerX,
        y: centerY,
        color,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const addFloatingText = (x: number, y: number, text: string, color: string = 'text-white') => {
    setFloatingTexts(prev => [...prev, {
      id: Math.random().toString(),
      x,
      y,
      text,
      color
    }]);
  };

  // Save high score
  useEffect(() => {
    if (gameState.score > gameState.highScore) {
      setGameState(prev => ({ ...prev, highScore: prev.score }));
      localStorage.setItem('colorblock-highscore', gameState.score.toString());
    }
  }, [gameState.score, gameState.highScore]);

  const playSound = useCallback((type: 'place' | 'clear' | 'gameover' | 'combo') => {
    if (gameState.settings.volume === 0) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    gain.gain.setValueAtTime(gameState.settings.volume * 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    if (type === 'place') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'clear') {
      // Satisfying "pop" and ascending notes
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      gain2.gain.setValueAtTime(gameState.settings.volume * 0.1, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      
      osc.start();
      osc2.start(ctx.currentTime + 0.05);
      osc.stop(ctx.currentTime + 0.2);
      osc2.stop(ctx.currentTime + 0.4);
    } else if (type === 'combo') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  }, [gameState.settings.volume]);

  const triggerVibration = useCallback((pattern: number | number[] = 50) => {
    if (gameState.settings.vibration && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, [gameState.settings.vibration]);

  const checkClears = useCallback((grid: (Color | null)[][]) => {
    const cellsToClear: { r: number; c: number; color: Color }[] = [];
    const clearingSet = new Set<string>();

    // Check Connected Color Groups (Size >= 5)
    const visited = new Set<string>();
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const color = grid[r][c];
        const key = `${r},${c}`;
        if (color && !visited.has(key)) {
          const group: { r: number; c: number }[] = [];
          const queue: { r: number; c: number }[] = [{ r, c }];
          visited.add(key);

          while (queue.length > 0) {
            const curr = queue.shift()!;
            group.push(curr);

            const neighbors = [
              { r: curr.r - 1, c: curr.c },
              { r: curr.r + 1, c: curr.c },
              { r: curr.r, c: curr.c - 1 },
              { r: curr.r, c: curr.c + 1 },
            ];

            for (const n of neighbors) {
              const nKey = `${n.r},${n.c}`;
              if (
                n.r >= 0 && n.r < GRID_SIZE &&
                n.c >= 0 && n.c < GRID_SIZE &&
                grid[n.r][n.c] === color &&
                !visited.has(nKey)
              ) {
                visited.add(nKey);
                queue.push(n);
              }
            }
          }

          if (group.length >= 5) {
            group.forEach(cell => {
              const cellKey = `${cell.r},${cell.c}`;
              if (!clearingSet.has(cellKey)) {
                cellsToClear.push({ ...cell, color });
                clearingSet.add(cellKey);
              }
            });
          }
        }
      }
    }

    return cellsToClear;
  }, []);

  const canPlaceBlock = useCallback((grid: (Color | null)[][], block: BlockShape, startR: number, startC: number) => {
    const minR = Math.min(...block.cells.map(c => c.r));
    const minC = Math.min(...block.cells.map(c => c.c));

    for (const cell of block.cells) {
      const r = startR + (cell.r - minR);
      const c = startC + (cell.c - minC);
      if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE || grid[r][c] !== null) {
        return false;
      }
    }
    return true;
  }, []);

  const checkGameOver = useCallback((grid: (Color | null)[][], availableBlocks: (BlockShape | null)[]) => {
    const activeBlocks = availableBlocks.filter((b): b is BlockShape => b !== null);
    if (activeBlocks.length === 0) return false;

    for (const block of activeBlocks) {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (canPlaceBlock(grid, block, r, c)) {
            return false;
          }
        }
      }
    }
    return true;
  }, [canPlaceBlock]);

  // Refactor handlePlaceBlock to be cleaner with the delay
  const handlePlaceBlockRefined = (r: number, c: number) => {
    if (!draggedBlock) return;
    const blockIndex = draggedBlock.index;

    if (canPlaceBlock(gameState.grid, draggedBlock.block, r, c)) {
      const newGrid = gameState.grid.map(row => [...row]);
      const minR = Math.min(...draggedBlock.block.cells.map(c => c.r));
      const minC = Math.min(...draggedBlock.block.cells.map(c => c.c));

      draggedBlock.block.cells.forEach((cell) => {
        newGrid[r + (cell.r - minR)][c + (cell.c - minC)] = cell.color;
      });

      const clearedCells = checkClears(newGrid);
      let newScore = gameState.score + draggedBlock.block.cells.length;
      let newCombo = gameState.combo;

      const finishTurn = (finalGrid: (Color | null)[][], finalScore: number, finalCombo: number) => {
        setGameState(prev => {
          const newAvailableBlocks = [...prev.availableBlocks];
          newAvailableBlocks[blockIndex] = null;

          if (newAvailableBlocks.every(b => b === null)) {
            newAvailableBlocks[0] = generateRandomBlock();
            newAvailableBlocks[1] = generateRandomBlock();
            newAvailableBlocks[2] = generateRandomBlock();
          }

          const isGameOver = checkGameOver(finalGrid, newAvailableBlocks);

          if (isGameOver) {
            playSound('gameover');
            triggerVibration([100, 50, 100, 50, 100]);
          }

          return {
            ...prev,
            grid: finalGrid,
            score: finalScore,
            combo: finalCombo,
            availableBlocks: newAvailableBlocks,
            isGameOver,
            isAdShowing: isGameOver && prev.hasAdsEnabled,
          };
        });
      };

      if (clearedCells.length > 0) {
        const clearingSet = new Set(clearedCells.map(cell => `${cell.r},${cell.c}`));
        setClearingCells(clearingSet);
        
        newCombo += 1;
        const points = clearedCells.length * 10 * newCombo;
        newScore += points;

        clearedCells.forEach(cell => createParticles(cell.r, cell.c, cell.color));
        setIsShaking(true);
        if (newCombo > 2) setGridFlash(true);
        
        setTimeout(() => {
          setIsShaking(false);
          setGridFlash(false);
        }, 300);

        if (gridRef.current) {
          const rect = gridRef.current.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          addFloatingText(centerX, centerY, `+${points}`, 'text-yellow-400 text-4xl');
          
          if (newCombo > 1) {
            setTimeout(() => {
              const comboText = newCombo >= 5 ? 'ULTRA COMBO!!!' : newCombo >= 3 ? 'MEGA COMBO!!' : 'COMBO!';
              const comboColor = newCombo >= 5 ? 'text-red-500' : newCombo >= 3 ? 'text-orange-500' : 'text-emerald-400';
              addFloatingText(centerX, centerY - 60, `${newCombo} ${comboText}`, `${comboColor} font-black text-5xl`);
              playSound('combo');
            }, 150);
          }

          const isPerfectClear = newGrid.every(row => row.every(cell => cell === null));
          if (isPerfectClear) {
            setTimeout(() => {
              addFloatingText(centerX, centerY + 60, "PERFECT CLEAR!!!", "text-white font-black text-6xl drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]");
              newScore += 1000;
              playSound('combo');
              triggerVibration([100, 100, 100, 100, 100]);
            }, 300);
          }
        }

        playSound('clear');
        triggerVibration([50, 30, 50]);

        setTimeout(() => {
          clearedCells.forEach(cell => {
            newGrid[cell.r][cell.c] = null;
          });
          setClearingCells(new Set());
          finishTurn(newGrid, newScore, newCombo);
        }, 500);
      } else {
        newCombo = 0;
        playSound('place');
        triggerVibration(30);
        finishTurn(newGrid, newScore, newCombo);
      }

      setDraggedBlock(null);
      setHoveredCells([]);
    }
  };

  const onDragStart = (e: React.MouseEvent | React.TouchEvent, block: BlockShape, index: number) => {
    if (gameState.isGameOver || clearingCells.size > 0) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragPositionRef.current = { x: clientX, y: clientY };
    lastHoveredPosRef.current = null;
    
    // Calculate block center to offset the drag correctly
    const minR = Math.min(...block.cells.map(c => c.r));
    const maxR = Math.max(...block.cells.map(c => c.r));
    const minC = Math.min(...block.cells.map(c => c.c));
    const maxC = Math.max(...block.cells.map(c => c.c));
    
    const rows = maxR - minR + 1;
    const cols = maxC - minC + 1;
    
    // The block is scaled by 1.5 and base size is 24 in overlay
    const cellSize = 24 * 1.5;
    
    const offset = {
      x: (cols * cellSize) / 2,
      y: (rows * cellSize) / 2,
    };
    
    setDragOffset(offset);
    setDraggedBlock({ block, index });

    // We need to wait for the next tick for the ref to be available if we were just setting draggedBlock
    // But since we are in an event handler, we can just update it in onDragMove
  };

  const onDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!draggedBlock) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragPositionRef.current = { x: clientX, y: clientY };

    // Direct DOM update for maximum smoothness
    if (dragOverlayRef.current) {
      const x = clientX - dragOffset.x;
      const y = clientY - dragOffset.y - DRAG_OFFSET_Y;
      dragOverlayRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.5)`;
    }

    if (gridRef.current) {
      const gridRect = gridRef.current.getBoundingClientRect();
      const cellSize = gridRect.width / GRID_SIZE;
      
      const targetX = clientX;
      const targetY = clientY - DRAG_OFFSET_Y;

      const minR = Math.min(...draggedBlock.block.cells.map(c => c.r));
      const maxR = Math.max(...draggedBlock.block.cells.map(c => c.r));
      const minC = Math.min(...draggedBlock.block.cells.map(c => c.c));
      const maxC = Math.max(...draggedBlock.block.cells.map(c => c.c));
      
      const rows = maxR - minR + 1;
      const cols = maxC - minC + 1;

      const r = Math.floor((targetY - (rows * cellSize / 2) - gridRect.top + cellSize / 2) / cellSize);
      const c = Math.floor((targetX - (cols * cellSize / 2) - gridRect.left + cellSize / 2) / cellSize);

      // Only update React state if the grid position changed to avoid unnecessary re-renders
      if (!lastHoveredPosRef.current || lastHoveredPosRef.current.r !== r || lastHoveredPosRef.current.c !== c) {
        lastHoveredPosRef.current = { r, c };
        
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
          if (canPlaceBlock(gameState.grid, draggedBlock.block, r, c)) {
            setHoveredCells(draggedBlock.block.cells.map((cell) => ({ 
              r: r + (cell.r - minR), 
              c: c + (cell.c - minC),
              color: cell.color
            })));
          } else {
            setHoveredCells([]);
          }
        } else {
          setHoveredCells([]);
        }
      }
    }
  }, [draggedBlock, gameState.grid, canPlaceBlock, dragOffset]);

  const onDragEnd = useCallback(() => {
    if (!draggedBlock) return;

    if (gridRef.current) {
      const gridRect = gridRef.current.getBoundingClientRect();
      const cellSize = gridRect.width / GRID_SIZE;
      
      const targetX = dragPositionRef.current.x;
      const targetY = dragPositionRef.current.y - DRAG_OFFSET_Y;

      const minR = Math.min(...draggedBlock.block.cells.map(c => c.r));
      const maxR = Math.max(...draggedBlock.block.cells.map(c => c.r));
      const minC = Math.min(...draggedBlock.block.cells.map(c => c.c));
      const maxC = Math.max(...draggedBlock.block.cells.map(c => c.c));
      
      const rows = maxR - minR + 1;
      const cols = maxC - minC + 1;

      const r = Math.floor((targetY - (rows * cellSize / 2) - gridRect.top + cellSize / 2) / cellSize);
      const c = Math.floor((targetX - (cols * cellSize / 2) - gridRect.left + cellSize / 2) / cellSize);

      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
        handlePlaceBlockRefined(r, c);
      }
    }

    setDraggedBlock(null);
    setHoveredCells([]);
  }, [draggedBlock, handlePlaceBlockRefined]);

  useEffect(() => {
    if (draggedBlock) {
      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('mouseup', onDragEnd);
      window.addEventListener('touchmove', onDragMove, { passive: false });
      window.addEventListener('touchend', onDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('touchend', onDragEnd);
    };
  }, [draggedBlock, onDragMove, onDragEnd]);

  const resetGame = () => {
    setGameState(prev => ({
      ...prev,
      grid: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
      score: 0,
      combo: 0,
      availableBlocks: [generateRandomBlock(), generateRandomBlock(), generateRandomBlock()],
      isGameOver: false,
      isAdShowing: false,
    }));
    setClearingCells(new Set());
    setParticles([]);
    setFloatingTexts([]);
  };

  const removeAds = () => {
    setGameState(prev => ({ ...prev, hasAdsEnabled: false, isAdShowing: false }));
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans flex flex-col items-center p-4 select-none touch-none overflow-hidden">
      {/* Particles Overlay */}
      {particles.map(p => (
        <div 
          key={p.id}
          className={cn("fixed w-2 h-2 rounded-full pointer-events-none z-[60]", COLOR_MAP[p.color])}
          style={{ left: p.x, top: p.y }}
        />
      ))}

      {/* Floating Texts */}
      <AnimatePresence>
        {floatingTexts.map(ft => (
          <motion.div
            key={ft.id}
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: -100, scale: 1.5 }}
            exit={{ opacity: 0 }}
            className={cn("fixed pointer-events-none z-[70] text-2xl font-black italic", ft.color)}
            style={{ left: ft.x, top: ft.y }}
          >
            {ft.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Header */}
      <div className="w-full max-w-md flex flex-col items-center mb-8">
        <div className="w-full flex justify-between items-start mb-2">
          <h1 className="text-xl font-black tracking-tighter text-emerald-500 uppercase">ColorBlock</h1>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-stone-900 rounded-full hover:bg-stone-800 transition-colors border border-white/5"
          >
            <Settings size={18} />
          </button>
        </div>
        
        <div className="flex flex-col items-center">
          <motion.div 
            key={gameState.score}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl font-mono font-black tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
          >
            {gameState.score}
          </motion.div>
          
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5 text-stone-500 text-xs font-bold uppercase tracking-widest">
              <Trophy size={12} className="text-yellow-500" />
              <span>Best: {gameState.highScore}</span>
            </div>
            
            {gameState.combo > 1 && (
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-sm text-yellow-400 font-black italic uppercase"
              >
                {gameState.combo} COMBO!
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <motion.div 
        ref={gridRef}
        animate={isShaking ? { 
          x: [0, -10, 10, -10, 10, 0],
          y: [0, 5, -5, 5, -5, 0],
          scale: gameState.combo > 3 ? [1, 1.05, 1] : 1
        } : {}}
        transition={{ duration: 0.3 }}
        className={cn(
          "relative w-full aspect-square max-w-md bg-stone-900 rounded-2xl p-2 grid grid-cols-9 gap-1 shadow-2xl border border-white/10 transition-colors duration-200",
          gridFlash && "bg-white/20"
        )}
      >
        {gameState.grid.map((row, r) => 
          row.map((cell, c) => {
            const hovered = hoveredCells.find(h => h.r === r && h.c === c);
            const isClearing = clearingCells.has(`${r},${c}`);
            return (
              <div 
                key={`${r}-${c}`}
                className={cn(
                  "w-full h-full rounded-sm transition-all duration-150 relative overflow-hidden",
                  cell ? COLOR_MAP[cell] : (hovered ? `${COLOR_MAP[hovered.color]} opacity-40 scale-95 ring-2 ring-white/30` : "bg-stone-800/50")
                )}
              >
                {isClearing && (
                  <div className="absolute inset-0 animate-ping bg-white/50 rounded-sm z-10" />
                )}
                {(cell || hovered) && (
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                )}
              </div>
            );
          })
        )}
      </motion.div>

      {/* Available Blocks */}
      <div className="mt-6 w-full max-w-md flex justify-around items-center h-40 bg-stone-900/30 rounded-3xl border border-white/5 p-4">
        {gameState.availableBlocks.map((block, i) => (
          <div 
            key={i} 
            className="w-28 h-28 flex items-center justify-center relative touch-none"
            onMouseDown={(e) => block && onDragStart(e, block, i)}
            onTouchStart={(e) => block && onDragStart(e, block, i)}
          >
            {block ? (
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "cursor-grab active:cursor-grabbing transition-opacity duration-100",
                  draggedBlock?.index === i ? "opacity-0" : "opacity-100"
                )}
              >
                <BlockDisplay block={block} size={22} />
              </motion.div>
            ) : (
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-stone-800" />
            )}
          </div>
        ))}
      </div>

      {/* Dragging Overlay */}
      {draggedBlock && (
        <div 
          ref={dragOverlayRef}
          className="fixed pointer-events-none z-50 will-change-transform"
          style={{
            left: 0,
            top: 0,
            transform: `translate3d(${dragPositionRef.current.x - dragOffset.x}px, ${dragPositionRef.current.y - dragOffset.y - DRAG_OFFSET_Y}px, 0) scale(1.5)`,
            transformOrigin: 'top left'
          }}
        >
          <BlockDisplay block={draggedBlock.block} size={24} className="drop-shadow-2xl" />
        </div>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-stone-900 w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-white/10"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-stone-800 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {gameState.settings.volume > 0 ? <Volume2 size={20} /> : <VolumeX size={20} />}
                      <span className="font-medium">Volume</span>
                    </div>
                    <span className="text-stone-400">{Math.round(gameState.settings.volume * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    value={gameState.settings.volume}
                    onChange={(e) => setGameState(prev => ({
                      ...prev,
                      settings: { ...prev.settings, volume: parseFloat(e.target.value) }
                    }))}
                    className="w-full accent-emerald-500 h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Smartphone size={20} className={cn(!gameState.settings.vibration && "opacity-20")} />
                    <span className="font-medium">Vibration</span>
                  </div>
                  <button 
                    onClick={() => setGameState(prev => ({
                      ...prev,
                      settings: { ...prev.settings, vibration: !prev.settings.vibration }
                    }))}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      gameState.settings.vibration ? "bg-emerald-500" : "bg-stone-800"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      gameState.settings.vibration ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>

                <button 
                  onClick={resetGame}
                  className="w-full py-4 bg-stone-800 hover:bg-stone-700 rounded-2xl flex items-center justify-center gap-2 font-bold transition-colors border border-white/5"
                >
                  <RotateCcw size={20} />
                  Reset Game
                </button>

                {gameState.hasAdsEnabled && (
                  <button 
                    onClick={removeAds}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    Remove Ads ($1.99)
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over / Ad Modal */}
      <AnimatePresence>
        {(gameState.isGameOver || gameState.isAdShowing) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-8 text-center"
          >
            {gameState.isAdShowing ? (
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
              >
                <div className="h-48 bg-emerald-500 flex items-center justify-center">
                  <div className="text-white text-4xl font-black italic">COOL AD</div>
                </div>
                <div className="p-6 text-stone-900">
                  <h3 className="text-xl font-bold mb-2">Awesome Game 2</h3>
                  <p className="text-stone-500 mb-6">Download now and get 1000 free coins!</p>
                  <button 
                    onClick={() => setGameState(prev => ({ ...prev, isAdShowing: false }))}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold"
                  >
                    Close Ad
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-8">
                <motion.h2 
                  initial={{ y: -20 }}
                  animate={{ y: 0 }}
                  className="text-6xl font-black text-red-500 drop-shadow-lg"
                >
                  GAME OVER
                </motion.h2>
                
                <div className="space-y-2">
                  <div className="text-stone-400 uppercase tracking-widest text-sm">Final Score</div>
                  <div className="text-7xl font-mono font-bold">{gameState.score}</div>
                </div>

                <div className="flex flex-col gap-4">
                  <button 
                    onClick={resetGame}
                    className="px-12 py-5 bg-emerald-500 hover:bg-emerald-400 rounded-full text-2xl font-bold shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    Play Again
                  </button>
                  {gameState.hasAdsEnabled && (
                    <button 
                      onClick={removeAds}
                      className="text-stone-400 hover:text-white transition-colors"
                    >
                      Remove Ads to skip game over ads
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
