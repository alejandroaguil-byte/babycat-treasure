import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';

/** Render settings per quality level, from richest to cheapest. */
export const QUALITY = {
  high: { pixelRatio: 2, shadowMap: 2048, bloom: true, tiltShift: true },
  medium: { pixelRatio: 1.5, shadowMap: 1024, bloom: true, tiltShift: true },
  low: { pixelRatio: 1, shadowMap: 512, bloom: false, tiltShift: false },
};
export const QUALITY_ORDER = ['high', 'medium', 'low'];

const TILT_BLUR = 2.2; // texels; higher = stronger miniature effect

/**
 * Paints the sky gradient behind the (premultiplied) frame after tone mapping, so
 * the pastel sky is not desaturated by it. Glows and rain over the sky survive
 * because transparent pixels are composited as rgb + sky * (1 - alpha).
 */
const SkyShader = {
  uniforms: {
    tDiffuse: { value: null },
    top: { value: new THREE.Color() },
    mid: { value: new THREE.Color() },
    bottom: { value: new THREE.Color() },
    midStop: { value: 0.5 },
  },
  vertexShader: `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform float midStop;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float t = 1.0 - vUv.y; // 0 at the top of the screen, like the CSS gradient
      vec3 sky = t < midStop ? mix(top, mid, t / midStop) : mix(mid, bottom, (t - midStop) / (1.0 - midStop));
      gl_FragColor = vec4(c.rgb + sky * (1.0 - clamp(c.a, 0.0, 1.0)), 1.0);
    }`,
};

/**
 * Post-processing pipeline: miniature tilt-shift, bloom on glowing things and a
 * vignette. Low quality renders directly. (Ambient occlusion was tried and dropped:
 * it turned additive glow sprites into dark squares and was too heavy for phones.)
 */
export class PostFX {
  constructor(renderer, scene, camera, sun) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sun = sun;
    this.composer = null;
    this.level = null;
    this.sky = null;
  }

  /** Sky for the current world: CSS-style hex stops plus the matching texture. */
  setSky(colors, texture) {
    this.sky = { colors, texture };
    this.applySky();
  }

  applySky() {
    if (!this.sky) return;
    // Direct rendering keeps the sRGB background untouched; the pipeline paints it last.
    this.scene.background = this.composer ? null : this.sky.texture;
    if (!this.skyPass) return;
    const [top, mid = top, bottom = mid] = this.sky.colors;
    const u = this.skyPass.uniforms;
    u.top.value.set(top);
    u.mid.value.set(this.sky.colors.length > 2 ? mid : top);
    u.bottom.value.set(this.sky.colors.length > 2 ? bottom : mid);
    u.midStop.value = this.sky.midStop ?? 0.55;
    // The pass works on sRGB-encoded output, so keep the colors as authored.
    for (const k of ['top', 'mid', 'bottom']) u[k].value.convertLinearToSRGB();
  }

  setQuality(level) {
    if (level === this.level) return;
    this.level = level;
    const q = QUALITY[level];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.composer?.dispose();
    this.composer = null;
    this.skyPass = null;
    this.renderer.setClearColor(0x000000, 0);
    if (!q.bloom && !q.tiltShift) {
      this.applySky();
      return;
    }

    const { width, height } = this.size();
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    // Threshold above 1 so only HDR emissive things glow, never the bright sky.
    if (q.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.4, 1.0));
    if (q.tiltShift) {
      this.tiltH = new ShaderPass(HorizontalTiltShiftShader);
      this.tiltV = new ShaderPass(VerticalTiltShiftShader);
      this.tiltH.uniforms.r.value = this.tiltV.uniforms.r.value = 0.48;
      composer.addPass(this.tiltH);
      composer.addPass(this.tiltV);
    }
    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms.offset.value = 0.95;
    vignette.uniforms.darkness.value = 1.05;
    composer.addPass(vignette);
    composer.addPass(new OutputPass());
    this.skyPass = new ShaderPass(SkyShader);
    composer.addPass(this.skyPass);
    this.composer = composer;
    this.applySky();
    this.resize();
  }

  size() {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  /** Close-ups (cutscenes) use a softer blur so the kitten stays crisp. */
  setTiltStrength(k) {
    this.tiltStrength = k;
    this.resize();
  }

  resize() {
    const { width, height } = this.size();
    this.renderer.setSize(width, height);
    if (!this.composer) return;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    const k = this.tiltStrength ?? 1;
    if (this.tiltH) {
      this.tiltH.uniforms.h.value = (TILT_BLUR * k) / width;
      this.tiltV.uniforms.v.value = (TILT_BLUR * k) / height;
    }
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

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
    if (this.elapsed < 2.5) return;
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    const idx = QUALITY_ORDER.indexOf(this.level);
    if (fps < 42 && idx < QUALITY_ORDER.length - 1) {
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
