import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MaterialEntry } from '../../db/types.js';

export type LightingPresetKey = 'studio' | 'neon' | 'sunset' | 'lab' | 'dramatic' | 'overhead';

export interface LightingPreset {
  name: string;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  keyColor: number;
  keyIntensity: number;
  keyPos: [number, number, number];
  fillColor: number;
  fillIntensity: number;
  fillPos: [number, number, number];
  rimColor: number;
  rimIntensity: number;
  rimPos: [number, number, number];
}

export const LIGHTING_PRESETS: Record<LightingPresetKey, LightingPreset> = {
  studio: {
    name: 'Studio',
    hemiSky: 0xbfd4ff,
    hemiGround: 0x30281e,
    hemiIntensity: 0.9,
    keyColor: 0xffffff,
    keyIntensity: 2.2,
    keyPos: [-2, 3, 2],
    fillColor: 0xffe8d6,
    fillIntensity: 0.8,
    fillPos: [3, 1, 2],
    rimColor: 0x66aaff,
    rimIntensity: 0.8,
    rimPos: [3, -1, -2],
  },
  neon: {
    name: 'Cyberpunk Neon',
    hemiSky: 0x002244,
    hemiGround: 0x1a0022,
    hemiIntensity: 0.6,
    keyColor: 0x00f0ff,
    keyIntensity: 3.0,
    keyPos: [-2.5, 2.5, 2],
    fillColor: 0x8800ff,
    fillIntensity: 1.5,
    fillPos: [-1, -2, 2],
    rimColor: 0xff0066,
    rimIntensity: 3.2,
    rimPos: [3, 0.5, -2],
  },
  sunset: {
    name: 'Sunset',
    hemiSky: 0x445577,
    hemiGround: 0x442211,
    hemiIntensity: 0.7,
    keyColor: 0xff8833,
    keyIntensity: 3.4,
    keyPos: [-3.5, 1.2, 2],
    fillColor: 0xffbb66,
    fillIntensity: 0.8,
    fillPos: [1, 2, 2],
    rimColor: 0x2266cc,
    rimIntensity: 1.2,
    rimPos: [3, 0, -2.5],
  },
  lab: {
    name: 'High-Key Lab',
    hemiSky: 0xffffff,
    hemiGround: 0xaaaaaa,
    hemiIntensity: 1.4,
    keyColor: 0xffffff,
    keyIntensity: 2.6,
    keyPos: [-2, 4, 3],
    fillColor: 0xffffff,
    fillIntensity: 2.0,
    fillPos: [2, 3, 2],
    rimColor: 0xffffff,
    rimIntensity: 1.2,
    rimPos: [0, -2, -3],
  },
  dramatic: {
    name: 'Dramatic Rim',
    hemiSky: 0x151520,
    hemiGround: 0x0a0a10,
    hemiIntensity: 0.3,
    keyColor: 0xffffff,
    keyIntensity: 1.2,
    keyPos: [-3, 1, 0],
    fillColor: 0x1a2a4a,
    fillIntensity: 0.4,
    fillPos: [1, -2, 2],
    rimColor: 0x00d2ff,
    rimIntensity: 4.0,
    rimPos: [2.8, 1.2, -2.8],
  },
  overhead: {
    name: 'Overhead Sun',
    hemiSky: 0x99bbdd,
    hemiGround: 0x554433,
    hemiIntensity: 0.9,
    keyColor: 0xfffaed,
    keyIntensity: 3.8,
    keyPos: [0.5, 5, 0.5],
    fillColor: 0x887766,
    fillIntensity: 0.7,
    fillPos: [0, -4, 1],
    rimColor: 0x6688aa,
    rimIntensity: 0.6,
    rimPos: [0, 1, -3],
  },
};

export type BackgroundMode = 'dark' | 'grid' | 'gray' | 'void';

/** The classic material ball: lit sphere, orbit controls, preview lighting presets, tiling repeat control. */
export class SphereViewer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private material = new THREE.MeshPhysicalMaterial();
  private mesh: THREE.Mesh;
  private textures: THREE.Texture[] = [];
  private loader = new THREE.TextureLoader();

  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;

  currentPreset: LightingPresetKey = 'studio';
  isAutoRotating = false;
  isWireframe = false;
  currentBackground: BackgroundMode = 'dark';

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage-canvas';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    this.camera.position.set(0, 0.4, 3);

    this.scene.background = new THREE.Color(0x101014);

    // Lighting setup
    this.hemiLight = new THREE.HemisphereLight(0xbfd4ff, 0x30281e, 0.9);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    this.keyLight.position.set(-2, 3, 2);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xffe8d6, 0.8);
    this.fillLight.position.set(3, 1, 2);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0x66aaff, 0.8);
    this.rimLight.position.set(3, -1, -2);
    this.scene.add(this.rimLight);

    // Geometry
    const geometry = new THREE.SphereGeometry(1, 128, 128);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    // Controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 2.0;

    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });

    this.setLightingPreset('studio');
  }

  setLightingPreset(key: LightingPresetKey): void {
    const preset = LIGHTING_PRESETS[key] || LIGHTING_PRESETS.studio;
    this.currentPreset = key;

    this.hemiLight.color.setHex(preset.hemiSky);
    this.hemiLight.groundColor.setHex(preset.hemiGround);
    this.hemiLight.intensity = preset.hemiIntensity;

    this.keyLight.color.setHex(preset.keyColor);
    this.keyLight.intensity = preset.keyIntensity;
    this.keyLight.position.set(...preset.keyPos);

    this.fillLight.color.setHex(preset.fillColor);
    this.fillLight.intensity = preset.fillIntensity;
    this.fillLight.position.set(...preset.fillPos);

    this.rimLight.color.setHex(preset.rimColor);
    this.rimLight.intensity = preset.rimIntensity;
    this.rimLight.position.set(...preset.rimPos);
  }

  toggleAutoRotate(): boolean {
    this.isAutoRotating = !this.isAutoRotating;
    this.controls.autoRotate = this.isAutoRotating;
    return this.isAutoRotating;
  }

  setAutoRotate(enabled: boolean): void {
    this.isAutoRotating = enabled;
    this.controls.autoRotate = enabled;
  }

  toggleWireframe(): boolean {
    this.isWireframe = !this.isWireframe;
    this.material.wireframe = this.isWireframe;
    this.material.needsUpdate = true;
    return this.isWireframe;
  }

  setWireframe(enabled: boolean): void {
    this.isWireframe = enabled;
    this.material.wireframe = enabled;
    this.material.needsUpdate = true;
  }

  setBackgroundMode(mode: BackgroundMode): void {
    this.currentBackground = mode;
    if (mode === 'dark') {
      this.scene.background = new THREE.Color(0x101014);
    } else if (mode === 'void') {
      this.scene.background = new THREE.Color(0x050507);
    } else if (mode === 'gray') {
      this.scene.background = new THREE.Color(0x282830);
    } else if (mode === 'grid') {
      this.scene.background = new THREE.Color(0x0c0c10);
    }
  }

  resetCamera(): void {
    this.camera.position.set(0, 0.4, 3);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  load(theme: string, entry: MaterialEntry, variantIndex = 0, repeat = 2): void {
    for (const texture of this.textures) texture.dispose();
    this.textures = [];
    const variant = entry.variants[Math.min(variantIndex, entry.variants.length - 1)];
    const tiled = entry.alignment === 'tile';
    const tex = (file: string | undefined, srgb: boolean): THREE.Texture | null => {
      if (!file) return null;
      const texture = this.loader.load(`/themes/${theme}/${file}`);
      if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = tiled ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      if (tiled) texture.repeat.set(repeat, repeat);
      this.textures.push(texture);
      return texture;
    };

    const physical = entry.physical || {};
    const material = this.material;
    material.map = tex(variant.maps.basecolor, true);
    material.normalMap = tex(variant.maps.normal, false);
    material.roughnessMap = tex(variant.maps.roughness, false);
    material.metalnessMap = tex(variant.maps.metallic, false);
    material.aoMap = tex(variant.maps.ao, false);
    material.displacementMap = tex(variant.maps.height, false);
    material.alphaMap = tex(variant.maps.opacity, false);
    material.displacementScale = 0.02;
    material.roughness = physical.roughnessFactor ?? 1;
    material.metalness = physical.metallicFactor ?? 1;
    material.emissiveMap = tex(variant.maps.emission, true);
    material.emissive.set(variant.maps.emission ? 0xffffff : 0x000000);
    material.emissiveIntensity = physical.emissiveStrength ?? 1;
    material.transmission = physical.transmission ?? 0;
    material.ior = physical.ior ?? 1.5;
    material.transparent = (physical.alphaMode ?? 'OPAQUE') === 'BLEND';
    material.alphaTest = (physical.alphaMode ?? 'OPAQUE') === 'MASK' ? 0.5 : 0;
    material.color.set(physical.tint && material.transmission > 0 ? physical.tint : '#ffffff');
    material.wireframe = this.isWireframe;
    material.needsUpdate = true;
  }
}
