// ============================================================
// ELEMENTRIS — Entry Point
// ============================================================

import { GameController } from './GameController';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

const gc       = new GameController();
const renderer = new Renderer(canvas, gc);
const input    = new InputManager(gc, canvas);

// Render loop: also drives DAS (auto-repeat) for held D-pad buttons
function renderLoop(): void {
  input.update();       // process held-button repeats
  renderer.render();
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

// Game starts on first tap (InputManager calls gc.restart() when idle)
