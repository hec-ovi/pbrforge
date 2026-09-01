import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MaterialEntry } from '../../db/types.js';

/** The classic material ball: lit sphere, orbit controls, tiling repeat control. */
export class SphereViewer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private material = new THREE.MeshPhysicalMaterial();
  private textures: THREE.Texture[] = [];
  private loader = new THREE.TextureLoader();

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(width, height);
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    this.camera.position.set(0, 0.4, 3);

    this.scene.background = new THREE.Color(0x101014);
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x30281e, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2, 3, 2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x66aaff, 0.6);
    rim.position.set(3, -1, -2);
    this.scene.add(rim);
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), this.material));

    const controls = new OrbitControls(this.camera, this.canvas);
    controls.enableDamping = true;
    this.renderer.setAnimationLoop(() => {
      controls.update();
      this.renderer.render(this.scene, this.camera);
    });
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
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      if (tiled) texture.repeat.set(repeat, repeat);
      this.textures.push(texture);
      return texture;
    };

    const physical = entry.physical;
    const material = this.material;
    material.map = tex(variant.maps.basecolor, true);
    material.normalMap = tex(variant.maps.normal, false);
    material.roughnessMap = tex(variant.maps.roughness, false);
    material.metalnessMap = tex(variant.maps.metallic, false);
    material.aoMap = tex(variant.maps.ao, false);
    material.displacementMap = tex(variant.maps.height, false);
    material.displacementScale = 0.02;
    material.roughness = 1;
    material.metalness = 1;
    material.emissiveMap = tex(variant.maps.emission, true);
    material.emissive.set(variant.maps.emission ? 0xffffff : 0x000000);
    material.emissiveIntensity = physical.emissiveStrength ?? 1;
    material.transmission = physical.transmission ?? 0;
    material.ior = physical.ior ?? 1.5;
    material.transparent = (physical.alphaMode ?? 'OPAQUE') === 'BLEND';
    material.color.set(physical.tint && material.transmission > 0 ? physical.tint : '#ffffff');
    material.needsUpdate = true;
  }
}
