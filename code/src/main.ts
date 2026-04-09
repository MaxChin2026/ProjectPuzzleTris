// ============================================================
// ELEMENTRIS — Entry Point
// ============================================================

import { GameController } from './GameController';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

const gc      = new GameController();
const renderer = new Renderer(canvas, gc);
const _input   = new InputManager(gc, canvas);

// Render loop independent of game loop (always at ~60fps)
function renderLoop(): void {
  renderer.render();
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

// Ready to play
// Game starts on first tap (InputManager calls gc.restart() on idle state tap)
