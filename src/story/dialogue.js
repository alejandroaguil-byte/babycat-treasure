// Dialogue player: a bottom box with portrait, name pill, typewriter text and skip button.
// Each line is voiced (spoken, chirps or silent) through the VoiceEngine.

import './dialogue.css';
import { CHARACTERS } from './characters.js';

const BASE_CPS = 32;
const TICK_MS = 16;
const LETTER = /[\p{L}\p{N}]/u;
const UNKNOWN = { name: '', emoji: '💬', color: '#8a8a8a', voice: { rate: 1 } };
const ABSORBED = ['pointerdown', 'pointerup', 'pointermove', 'click', 'touchstart', 'touchend', 'wheel', 'contextmenu'];

/** Plays story scenes line by line; scenes requested while one is playing are queued. */
export class DialoguePlayer {
  constructor({ voice, getVoiceMode, getVolume, getLabels }) {
    this.voice = voice;
    this.getVoiceMode = getVoiceMode;
    this.getVolume = getVolume;
    this.getLabels = getLabels;
    this.el = null;
    this.queue = Promise.resolve();
    this._active = false;
    this.skipped = false;
    this.line = null;
    this.onKey = (e) => this.handleKey(e);
  }

  /** True while a scene is playing. */
  get active() {
    return this._active;
  }

  /** Plays a scene; resolves 'done' or 'skipped'. Waits for any scene already playing. */
  play(lines, { lang = 'en' } = {}) {
    const run = this.queue.then(() => this.runScene(Array.isArray(lines) ? lines : [], lang));
    this.queue = run.catch(() => {});
    return run;
  }

  /** Ends the whole scene immediately. */
  skip() {
    if (!this._active) return;
    this.skipped = true;
    this.voice?.cancel();
    this.line?.finish();
  }

  async runScene(lines, lang) {
    if (!lines.length) return 'done';
    this.build();
    this.skipped = false;
    this._active = true;
    const labels = this.getLabels?.() ?? {};
    this.skipBtn.textContent = labels.skip ?? '';
    this.nextEl.setAttribute('aria-label', labels.next ?? '');
    this.el.hidden = false;
    this.box.classList.remove('dlg-pop');
    void this.box.offsetWidth; // restart the pop-in animation
    this.box.classList.add('dlg-pop');
    window.addEventListener('keydown', this.onKey, true);
    try {
      for (const line of lines) {
        if (this.skipped) break;
        await this.playLine(line, lang);
      }
    } finally {
      window.removeEventListener('keydown', this.onKey, true);
      this.voice?.cancel();
      this.line = null;
      this.el.hidden = true;
      this._active = false;
    }
    return this.skipped ? 'skipped' : 'done';
  }

  /** Types one line out, voices it, then waits for the player to advance. */
  playLine({ speaker, text = '' }, lang) {
    const character = CHARACTERS[speaker] ?? { ...UNKNOWN, name: String(speaker ?? '') };
    const chars = Array.from(String(text));
    const rate = character.voice?.rate || 1;
    const cps = BASE_CPS * rate;
    let mode = this.getVoiceMode?.() ?? 'off';
    if (mode === 'spoken' && !this.voice?.hasSpeech(lang)) mode = 'chirps';
    const volume = Math.max(0, Math.min(1, this.getVolume?.() ?? 1));

    this.box.style.setProperty('--dlg-color', character.color);
    this.box.setAttribute('aria-label', character.name);
    this.emojiEl.textContent = character.emoji;
    this.nameEl.textContent = character.name;
    this.nameEl.hidden = !character.name;
    this.nextEl.hidden = true;
    this.portrait.classList.add('dlg-talking');

    return new Promise((resolve) => {
      const start = performance.now();
      let shown = -1;
      let letters = 0;
      let typing = true;
      let speaking = mode === 'spoken';
      let timer = null;

      const render = (n) => {
        if (n === shown) return;
        shown = n;
        this.revealedEl.textContent = chars.slice(0, n).join('');
        this.restEl.textContent = chars.slice(n).join('');
      };
      const settle = () => {
        if (typing || speaking || this.line !== state) return;
        this.portrait.classList.remove('dlg-talking');
        this.nextEl.hidden = false;
      };
      const tick = () => {
        const n = Math.min(chars.length, Math.floor(((performance.now() - start) / 1000) * cps));
        if (mode === 'chirps') {
          let due = false;
          for (let i = Math.max(shown, 0); i < n; i++) if (LETTER.test(chars[i]) && ++letters % 2 === 1) due = true;
          // At most one syllable per tick so a slow frame never bursts several at once.
          if (due) this.voice?.chirp(speaker, { volume });
        }
        render(n);
        if (n >= chars.length) revealAll();
        else timer = setTimeout(tick, TICK_MS);
      };
      const revealAll = () => {
        clearTimeout(timer);
        render(chars.length);
        typing = false;
        settle();
      };
      const state = {
        advance: () => {
          if (typing) return revealAll();
          state.finish();
        },
        finish: () => {
          clearTimeout(timer);
          if (this.line === state) this.line = null;
          if (speaking) this.voice?.cancel();
          this.portrait.classList.remove('dlg-talking');
          resolve();
        },
      };
      this.line = state;
      render(0);
      if (speaking) {
        this.voice.speak(String(text), speaker, { lang, volume }).then(() => {
          speaking = false;
          settle();
        });
      }
      if (chars.length) tick();
      else revealAll();
    });
  }

  handleKey(e) {
    if (!this._active) return;
    if (e.code !== 'Space' && e.code !== 'Enter' && e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    // Holding the key must not fast-forward through the whole scene.
    if (e.repeat) return;
    if (document.activeElement === this.skipBtn) this.skip();
    else this.line?.advance();
  }

  /** Creates the overlay DOM once. */
  build() {
    if (this.el) return;
    const el = (tag, cls, parent) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      parent?.appendChild(node);
      return node;
    };
    this.el = el('div', 'dlg-overlay');
    this.el.hidden = true;
    this.box = el('div', 'dlg-box', this.el);
    this.box.setAttribute('role', 'dialog');
    this.portrait = el('div', 'dlg-portrait', this.box);
    this.emojiEl = el('span', 'dlg-emoji', this.portrait);
    this.emojiEl.setAttribute('aria-hidden', 'true');
    const body = el('div', 'dlg-body', this.box);
    this.nameEl = el('div', 'dlg-name', body);
    const textEl = el('p', 'dlg-text', body);
    this.revealedEl = el('span', '', textEl);
    // Unrevealed text keeps its space so the box never jumps while typing.
    this.restEl = el('span', 'dlg-rest', textEl);
    this.nextEl = el('span', 'dlg-next', this.box);
    this.nextEl.textContent = '▶';
    this.nextEl.setAttribute('role', 'img');
    this.skipBtn = el('button', 'dlg-skip', this.box);
    this.skipBtn.type = 'button';

    // Keep every pointer gesture away from the game canvas and window listeners.
    for (const type of ABSORBED) this.el.addEventListener(type, (e) => e.stopPropagation());
    this.box.addEventListener('click', () => this.line?.advance());
    this.skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skip();
    });
    document.body.appendChild(this.el);
  }
}
