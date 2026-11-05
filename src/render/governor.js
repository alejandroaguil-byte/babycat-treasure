// Pure quality logic (no three.js) so it can be unit tested in Node.
export const QUALITY_ORDER = ['high', 'medium', 'low'];

// Below this the game feels choppy. Kept under 30 so devices whose display is
// capped at 30 Hz (battery saver, iOS Low Power Mode) are not downgraded for it.
const MIN_FPS = 26;
const WINDOW = 2.5; // seconds averaged per decision

/**
 * Watches the frame rate while playing and steps quality down when the device
 * struggles. Only used when the player picked "auto".
 */
export class QualityGovernor {
  constructor(onChange) {
    this.onChange = onChange;
    this.reset('high');
  }

  reset(level) {
    this.level = level;
    this.frames = 0;
    this.elapsed = 0;
    this.cooldown = 1.5;
  }

  sample(realDt) {
    if ((this.cooldown -= realDt) > 0) return;
    this.frames++;
    this.elapsed += realDt;
    if (this.elapsed < WINDOW) return;
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    const idx = QUALITY_ORDER.indexOf(this.level);
    if (fps < MIN_FPS && idx < QUALITY_ORDER.length - 1) {
      this.level = QUALITY_ORDER[idx + 1];
      this.cooldown = 2;
      this.onChange(this.level, fps);
    }
  }
}

/** Initial guess for "auto": phones and tablets start at medium. */
export function autoQuality() {
  return window.matchMedia('(pointer: coarse)').matches ? 'medium' : 'high';
}
