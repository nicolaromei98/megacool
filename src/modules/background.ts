import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  ACESFilmicToneMapping,
  WebGLRenderTarget,
  DepthTexture,
  DepthFormat,
  UnsignedShortType,
  LinearFilter,
  OrthographicCamera,
  ShaderMaterial,
  PlaneGeometry,
  Mesh,
  MeshStandardMaterial,
  InstancedMesh,
  InstancedBufferAttribute,
  DynamicDrawUsage,
  Raycaster,
  Object3D,
  Group,
  Vector2,
  Vector3,
  Color,
  FogExp2,
  AmbientLight,
  DirectionalLight,
  RectAreaLight,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

import { onMount, onDestroy } from "@/modules/_";
import { Raf, Resize } from "@lib/subs";
import gsap from "@lib/gsap";
import { handleEditor } from "@webflow/detect-editor";

import vertexShader from "@/gl/shards/vertex.glsl";
import fragmentShader from "@/gl/shards/fragment.glsl";

/**
 * WebGL animated "shards" background.
 *
 * Wire it up by adding `data-module="background"` to a Webflow div. The div
 * acts as the container — the canvas is injected into it and sized to it, so
 * give the div an explicit width/height (e.g. position it full-bleed behind
 * your hero). Pointer events on the canvas are disabled so content above it
 * stays clickable.
 *
 * Optional data attributes:
 *   data-base-color      hex   blade base/emissive color (default #0E2D2A)
 *   data-highlight-color hex   hover highlight color (default #275956)
 */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  let started = false;
  let teardown: (() => void) | null = null;

  const start = () => {
    if (started) return;
    started = true;
    teardown = setup(element, dataset);
  };

  const stop = () => {
    if (!started) return;
    started = false;
    teardown?.();
    teardown = null;
  };

  // Disable the scene inside the Webflow Designer; run it on the published
  // site. handleEditor fires the callback immediately with the current state.
  handleEditor((isEditor) => {
    if (isEditor) stop();
    else start();
  });

  onMount(() => {
    if (!started) start();
  });

  onDestroy(() => stop());
}

function setup(element: HTMLElement, dataset: DOMStringMap) {
  const getSize = () => {
    const w = element.clientWidth || window.innerWidth;
    const h = element.clientHeight || window.innerHeight;
    return { width: w, height: h };
  };

  let { width, height } = getSize();
  const pixelRatio = Math.min(window.devicePixelRatio, 2);

  /** -- <canvas> */
  const canvas = document.createElement("canvas");
  canvas.classList.add("webgl-background");
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    display: "block",
    pointerEvents: "none",
  });
  if (getComputedStyle(element).position === "static") {
    element.style.position = "relative";
  }
  element.appendChild(canvas);

  /** -- <renderer> */
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.setClearColor(new Color("#84A2A1"), 1);

  /** -- <camera> */
  const fovNum = 1200;
  const fovFor = (h: number) => Math.atan(h / 2 / fovNum) * 2 * (180 / Math.PI);
  const camera = new PerspectiveCamera(fovFor(height), width / height, 1, 2000);
  camera.position.z = fovNum;

  /** -- <scene> */
  const scene = new Scene();

  const params = {
    fogColor: "#84A2A1",
    fogDensity: 0.00068,
    ambientColor: "#3a6b7a",
    ambientIntensity: 0.4,
    directionalColor: "#3a6b7a",
    directionalIntensity: 1.99,
    directional2Color: "#3a6b7a",
    directional2Intensity: 0.6,
    rectColor: "#ffffff",
    rectIntensity: 5,
    rectWidth: 1360,
    rectHeight: 995,
  };

  scene.fog = new FogExp2(new Color(params.fogColor), params.fogDensity);

  const ambient = new AmbientLight(
    new Color(params.ambientColor),
    params.ambientIntensity
  );
  scene.add(ambient);

  const directional = new DirectionalLight(
    new Color(params.directionalColor),
    params.directionalIntensity
  );
  directional.position.set(-430, 520, 1140);
  directional.target.position.set(-60, -570, 910);
  scene.add(directional, directional.target);

  const directional2 = new DirectionalLight(
    new Color(params.directional2Color),
    params.directional2Intensity
  );
  directional2.position.set(-520, -180, -20);
  directional2.target.position.set(-50, 30, 310);
  scene.add(directional2, directional2.target);

  RectAreaLightUniformsLib.init();
  const rectAreaLight = new RectAreaLight(
    new Color(params.rectColor),
    params.rectIntensity,
    params.rectWidth,
    params.rectHeight
  );
  rectAreaLight.position.set(100, 580, 750);
  rectAreaLight.lookAt(new Vector3(0, -200, 520));
  scene.add(rectAreaLight);

  /** -- <shards> */
  const shards = createShards(scene, dataset);

  /** -- <post processing> */
  const post = createPost({ renderer, scene, camera, width, height, pixelRatio });

  /** -- <mouse> */
  const mouse = new Vector2();
  const onMouseMove = (e: MouseEvent) => {
    const rect = element.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = ((e.clientY - rect.top) / rect.height) * -2 + 1;
  };
  window.addEventListener("mousemove", onMouseMove);

  /** -- <visibility> pause rendering while the container is scrolled out of
   * view (recommended in the interactivity skill — disable expensive Raf work
   * when the element isn't visible). Nothing is on screen, so no visual change. */
  let inView = true;
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
    },
    { threshold: 0 }
  );
  visibilityObserver.observe(element);

  /** -- <intro reveal> (replaces the original Loader.animateShards) */
  const introTween = playIntro(shards);

  /** -- <loop> */
  const startTime = performance.now();
  const unsubscribeRaf = Raf.add(() => {
    if (document.hidden || !inView) return;
    const elapsed = (performance.now() - startTime) * 0.001;
    shards.update(elapsed, mouse, camera);
    post.render();
  });

  /** -- <resize> */
  const unsubscribeResize = Resize.add(() => {
    const size = getSize();
    width = size.width;
    height = size.height;

    camera.fov = fovFor(height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    post.resize(width, height);
  });

  /** -- <cleanup> */
  return () => {
    introTween?.kill();
    unsubscribeRaf();
    unsubscribeResize();
    visibilityObserver.disconnect();
    window.removeEventListener("mousemove", onMouseMove);

    shards.destroy();
    post.destroy();

    ambient.dispose?.();
    directional.dispose?.();
    directional2.dispose?.();
    rectAreaLight.dispose?.();
    scene.fog = null;

    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  };
}

/* -------------------------------------------------------------------------- */
/* Shards — the instanced ring of swaying blades                              */
/* -------------------------------------------------------------------------- */

function createShards(scene: Scene, dataset: DOMStringMap) {
  const params = {
    count: 256,
    radiusX: 1850,
    radiusZ: 1500,
    centerX: -510,
    centerY: 140,
    centerZ: -640,
    ringRotationX: -158,
    ringRotationY: -118,
    ringRotationZ: 6,
    wavePower: 114,
    waveFrequency: 4.3,
    bladeWidth: 900,
    bladeHeight: 450,
    bladeDepth: 2,
    bladeRadius: 1,
    bladeSegments: 2,
    rotationX: 0,
    rotationY: 90,
    rotationZ: -27,
    baseColor: dataset.baseColor || "#0E2D2A",
    emissiveColor: dataset.baseColor || "#0E2D2A",
    emissiveIntensity: 1.5,
    metalness: 0.3,
    roughness: 0.4,
    swayPower: 20,
    swaySpeed: 1.2,
    parallaxX: 30,
    parallaxY: 20,
    highlightColor: dataset.highlightColor || "#275956",
    highlightPower: 0.2,
    highlightLerp: 0.18,
    introYOffset: 220,
  };

  const material = new CustomShaderMaterial({
    baseMaterial: MeshStandardMaterial,
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSwayPower: { value: params.swayPower },
      uSwaySpeed: { value: params.swaySpeed },
      uBladeHeight: { value: params.bladeHeight },
      uHighlightColor: { value: new Color(params.highlightColor) },
      uHighlightPower: { value: params.highlightPower },
      uIntroYOffset: { value: params.introYOffset },
    },
    color: new Color(params.baseColor),
    emissive: new Color(params.emissiveColor),
    emissiveIntensity: params.emissiveIntensity,
    metalness: params.metalness,
    roughness: params.roughness,
    fog: true,
    transparent: true,
    alphaTest: 0.01,
    depthWrite: true,
  }) as unknown as MeshStandardMaterial & {
    uniforms: Record<string, { value: any }>;
  };

  const geometry = new RoundedBoxGeometry(
    params.bladeWidth,
    params.bladeHeight,
    params.bladeDepth,
    params.bladeSegments,
    params.bladeRadius
  );
  geometry.translate(0, params.bladeHeight / 2, 0);

  const phases = new Float32Array(params.count);
  for (let i = 0; i < params.count; i++) phases[i] = Math.random();
  geometry.setAttribute("aPhase", new InstancedBufferAttribute(phases, 1));

  const hoverAmounts = new Float32Array(params.count);
  const hoverAttr = new InstancedBufferAttribute(hoverAmounts, 1);
  hoverAttr.setUsage(DynamicDrawUsage);
  geometry.setAttribute("aHoverAmount", hoverAttr);

  const introAmounts = new Float32Array(params.count);
  const introAttr = new InstancedBufferAttribute(introAmounts, 1);
  introAttr.setUsage(DynamicDrawUsage);
  geometry.setAttribute("aIntroAmount", introAttr);

  const group = new Group();
  scene.add(group);

  const mesh = new InstancedMesh(geometry, material, params.count);
  mesh.frustumCulled = false;
  group.add(mesh);

  const DEG = Math.PI / 180;
  group.position.set(params.centerX, params.centerY, params.centerZ);
  group.rotation.set(
    params.ringRotationX * DEG,
    params.ringRotationY * DEG,
    params.ringRotationZ * DEG
  );

  const dummy = new Object3D();
  const tau = Math.PI * 2;
  const rotX = params.rotationX * DEG;
  const rotY = params.rotationY * DEG;
  const rotZ = params.rotationZ * DEG;
  for (let i = 0; i < params.count; i++) {
    const angle = (i / params.count) * tau;
    const waveY = Math.sin(angle * params.waveFrequency) * params.wavePower;
    dummy.position.set(
      Math.cos(angle) * params.radiusX,
      waveY,
      Math.sin(angle) * params.radiusZ
    );
    dummy.rotation.set(rotX, -angle + Math.PI / 2 + rotY, rotZ);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  const mouseParallax = new Vector2(0, 0);
  const raycaster = new Raycaster();
  const prevMouse = new Vector2(NaN, NaN);
  let hoveredId = -1;

  const update = (elapsed: number, mouse: Vector2, camera: PerspectiveCamera) => {
    material.uniforms.uTime.value = elapsed;

    const targetX = mouse.x * params.parallaxX;
    const targetY = mouse.y * params.parallaxY;
    const parallaxMoving =
      Math.abs(targetX - mouseParallax.x) > 0.01 ||
      Math.abs(targetY - mouseParallax.y) > 0.01;
    mouseParallax.x += (targetX - mouseParallax.x) * 0.05;
    mouseParallax.y += (targetY - mouseParallax.y) * 0.05;
    mesh.position.x = mouseParallax.x;
    mesh.position.y = mouseParallax.y;

    // Raycast only when the pointer moved or the parallax is still settling.
    // When everything is idle the hovered blade can't change, so the costly
    // 256-instance raycast is skipped — the hover fade below still runs every
    // frame, so the visual result is identical.
    const pointerMoved = mouse.x !== prevMouse.x || mouse.y !== prevMouse.y;
    prevMouse.copy(mouse);
    if (pointerMoved || parallaxMoving) {
      mesh.updateWorldMatrix(true, false);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(mesh, false);
      hoveredId = hits.length > 0 ? hits[0].instanceId ?? -1 : -1;
    }

    const lerp = params.highlightLerp;
    let dirty = false;
    for (let i = 0; i < hoverAmounts.length; i++) {
      const target = i === hoveredId ? 1 : 0;
      const current = hoverAmounts[i];
      const next = current + (target - current) * lerp;
      if (Math.abs(next - current) > 0.0005) {
        hoverAmounts[i] = next;
        dirty = true;
      } else if (current !== target) {
        hoverAmounts[i] = target;
        dirty = true;
      }
    }
    if (dirty) hoverAttr.needsUpdate = true;
  };

  const destroy = () => {
    group.remove(mesh);
    scene.remove(group);
    geometry.dispose();
    material.dispose();
    mesh.dispose();
  };

  return { params, introAmounts, introAttr, update, destroy };
}

type Shards = ReturnType<typeof createShards>;

function playIntro(
  shards: Shards,
  { duration = 1.2, stagger = 2, ease = "power3.out" } = {}
) {
  const { count } = shards.params;
  const amounts = shards.introAmounts;
  const attr = shards.introAttr;

  for (let i = 0; i < count; i++) amounts[i] = 0;
  attr.needsUpdate = true;

  const targets = Array.from({ length: count }, () => ({ v: 0 }));

  return gsap.to(targets, {
    v: 1,
    duration,
    ease,
    stagger: stagger / Math.max(1, count - 1),
    onUpdate: () => {
      for (let i = 0; i < count; i++) amounts[i] = targets[i].v;
      attr.needsUpdate = true;
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Post-processing — half-res Gaussian blur + depth-of-field composite        */
/* -------------------------------------------------------------------------- */

function createPost(opts: {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  width: number;
  height: number;
  pixelRatio: number;
}) {
  const { renderer, scene, camera } = opts;

  const physical = (w: number, h: number) => ({
    w: Math.max(1, Math.floor(w * opts.pixelRatio)),
    h: Math.max(1, Math.floor(h * opts.pixelRatio)),
  });

  let { w, h } = physical(opts.width, opts.height);

  const renderTarget = new WebGLRenderTarget(w, h, { samples: 2 });
  renderTarget.stencilBuffer = false;
  renderTarget.depthTexture = new DepthTexture(w, h);
  renderTarget.depthTexture.format = DepthFormat;
  renderTarget.depthTexture.type = UnsignedShortType;

  let bw = Math.max(1, Math.floor(w / 2));
  let bh = Math.max(1, Math.floor(h / 2));

  const blurTargetH = new WebGLRenderTarget(bw, bh, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  const blurTargetV = new WebGLRenderTarget(bw, bh, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });

  const blurVertex = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;
  const blurFragment = /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform vec2 uTexelSize;
    uniform vec2 uDirection;
    uniform float uBlurStrength;
    void main() {
      float w0 = 0.227027;
      float w1 = 0.1945946;
      float w2 = 0.1216216;
      float w3 = 0.054054;
      float w4 = 0.016216;
      vec2 stepSize = uTexelSize * uDirection * uBlurStrength;
      vec4 c = texture2D(tDiffuse, vUv) * w0;
      c += texture2D(tDiffuse, vUv + stepSize * 1.0) * w1;
      c += texture2D(tDiffuse, vUv - stepSize * 1.0) * w1;
      c += texture2D(tDiffuse, vUv + stepSize * 2.0) * w2;
      c += texture2D(tDiffuse, vUv - stepSize * 2.0) * w2;
      c += texture2D(tDiffuse, vUv + stepSize * 3.0) * w3;
      c += texture2D(tDiffuse, vUv - stepSize * 3.0) * w3;
      c += texture2D(tDiffuse, vUv + stepSize * 4.0) * w4;
      c += texture2D(tDiffuse, vUv - stepSize * 4.0) * w4;
      gl_FragColor = c;
    }
  `;

  const blurScene = new Scene();
  const blurMaterialH = new ShaderMaterial({
    toneMapped: false,
    uniforms: {
      tDiffuse: { value: null },
      uTexelSize: { value: new Vector2(1 / bw, 1 / bh) },
      uDirection: { value: new Vector2(1, 0) },
      uBlurStrength: { value: 4 },
    },
    vertexShader: blurVertex,
    fragmentShader: blurFragment,
  });
  const blurMaterialV = new ShaderMaterial({
    toneMapped: false,
    uniforms: {
      tDiffuse: { value: null },
      uTexelSize: { value: new Vector2(1 / bw, 1 / bh) },
      uDirection: { value: new Vector2(0, 1) },
      uBlurStrength: { value: 4 },
    },
    vertexShader: blurVertex,
    fragmentShader: blurFragment,
  });
  const blurMesh = new Mesh(new PlaneGeometry(2, 2), blurMaterialH);
  blurScene.add(blurMesh);

  const outputScene = new Scene();
  const outputCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const outputMaterial = new ShaderMaterial({
    toneMapped: true,
    uniforms: {
      tScene: { value: renderTarget.texture },
      tDepth: { value: renderTarget.depthTexture },
      tBlur: { value: blurTargetV.texture },
      cameraNear: { value: camera.near },
      cameraFar: { value: camera.far },
      uDebugDepth: { value: 0.0 },
      uInvert: { value: 0.0 },
      uFocusDistance: { value: 0.0 },
      uFocusRange: { value: 0.0 },
      uFocusFalloff: { value: 0.4 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      #include <packing>
      varying vec2 vUv;
      uniform sampler2D tScene;
      uniform sampler2D tDepth;
      uniform sampler2D tBlur;
      uniform float cameraNear;
      uniform float cameraFar;
      uniform float uDebugDepth;
      uniform float uInvert;
      uniform float uFocusDistance;
      uniform float uFocusRange;
      uniform float uFocusFalloff;

      float readDepth(sampler2D depthSampler, vec2 coord) {
        float fragCoordZ = texture2D(depthSampler, coord).x;
        float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
        return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar);
      }

      void main() {
        if (uDebugDepth > 0.5) {
          float d = readDepth(tDepth, vUv);
          float v = mix(1.0 - d, d, uInvert);
          gl_FragColor = vec4(vec3(v), 1.0);
          return;
        }
        float d = readDepth(tDepth, vUv);
        float dist = abs(d - uFocusDistance);
        float blurMix = smoothstep(uFocusRange, uFocusRange + uFocusFalloff, dist);
        vec4 sceneCol = texture2D(tScene, vUv);
        vec4 blurCol = texture2D(tBlur, vUv);
        gl_FragColor = mix(sceneCol, blurCol, blurMix);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const outputMesh = new Mesh(new PlaneGeometry(2, 2), outputMaterial);
  outputScene.add(outputMesh);

  const render = () => {
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);

    blurMesh.material = blurMaterialH;
    blurMaterialH.uniforms.tDiffuse.value = renderTarget.texture;
    renderer.setRenderTarget(blurTargetH);
    renderer.render(blurScene, outputCamera);

    blurMesh.material = blurMaterialV;
    blurMaterialV.uniforms.tDiffuse.value = blurTargetH.texture;
    renderer.setRenderTarget(blurTargetV);
    renderer.render(blurScene, outputCamera);

    renderer.setRenderTarget(null);
    renderer.render(outputScene, outputCamera);
  };

  const resize = (width: number, height: number) => {
    const p = physical(width, height);
    w = p.w;
    h = p.h;
    bw = Math.max(1, Math.floor(w / 2));
    bh = Math.max(1, Math.floor(h / 2));

    renderTarget.setSize(w, h);
    blurTargetH.setSize(bw, bh);
    blurTargetV.setSize(bw, bh);

    blurMaterialH.uniforms.uTexelSize.value.set(1 / bw, 1 / bh);
    blurMaterialV.uniforms.uTexelSize.value.set(1 / bw, 1 / bh);
  };

  const destroy = () => {
    outputMesh.geometry.dispose();
    outputMaterial.dispose();
    blurMesh.geometry.dispose();
    blurMaterialH.dispose();
    blurMaterialV.dispose();
    blurTargetH.dispose();
    blurTargetV.dispose();
    renderTarget.dispose();
  };

  return { render, resize, destroy };
}
