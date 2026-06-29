import gsap, { reduced } from "@lib/gsap";
import { Raf } from "@lib/subs";
import { onMount, onDestroy } from "@/modules/_";
import { toNumber } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

const TICK_CLASS = "smh__tick";

/**
 * data-module="tick-meter" on the ticks wrapper (e.g. `.smh__tick-wrap`).
 * Generates animated bars that pulse like a sound meter and cross-fades any
 * `[data-label]` elements found in the same component on each pass.
 *
 * Optional dataset overrides: data-count, data-speed, data-width, data-plateau,
 * data-blur, data-fade. CSS custom props --idle, --active, --min are read from
 * the wrapper (with sensible fallbacks).
 */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  const config = {
    count: Math.max(1, Math.round(toNumber(dataset.count, 70))),
    speed: toNumber(dataset.speed, 24),
    width: toNumber(dataset.width, 8),
    plateau: toNumber(dataset.plateau, 0.2),
    blur: toNumber(dataset.blur, 12),
    fade: toNumber(dataset.fade, 0.7),
  };

  const styles = getComputedStyle(element);
  const idle = styles.getPropertyValue("--idle").trim() || "#3a3a3a";
  const active = styles.getPropertyValue("--active").trim() || "#4fd6c4";
  const min = toNumber(styles.getPropertyValue("--min"), 0.22);

  const lerpColor = gsap.utils.interpolate(idle, active);
  const span = config.count + config.width * 2;

  // Labels live alongside the wrap inside the same component.
  const scope = element.parentElement ?? document;
  const labels = Array.from(scope.querySelectorAll<HTMLElement>("[data-label]"));

  let ticks: HTMLSpanElement[] = [];
  let unsubscribe: (() => void) | null = null;
  let isEditor = false;
  let activeLabel = 0;
  let cycle = 0;
  let startTime = 0;

  const createTicks = () => {
    if (ticks.length) return;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < config.count; i++) {
      const tick = document.createElement("span");
      tick.className = TICK_CLASS;
      fragment.appendChild(tick);
      ticks.push(tick);
    }
    element.appendChild(fragment);
  };

  const removeTicks = () => {
    ticks.forEach((tick) => tick.remove());
    ticks = [];
  };

  const resetLabels = () => {
    if (!labels.length) return;
    activeLabel = 0;
    gsap.killTweensOf(labels);
    gsap.set(labels, { autoAlpha: 0, filter: `blur(${config.blur}px)` });
    gsap.set(labels[activeLabel], { autoAlpha: 1, filter: "blur(0px)" });
  };

  const swapLabel = () => {
    if (labels.length < 2) return;

    const next = (activeLabel + 1) % labels.length;

    gsap.to(labels[activeLabel], {
      autoAlpha: 0,
      filter: `blur(${config.blur}px)`,
      duration: config.fade,
      ease: "power2.out",
    });

    gsap.to(labels[next], {
      autoAlpha: 1,
      filter: "blur(0px)",
      duration: config.fade,
      ease: "power2.out",
    });

    activeLabel = next;
  };

  const render = () => {
    const time = (performance.now() - startTime) / 1000;
    const travelled = time * config.speed;
    const currentCycle = Math.floor(travelled / span);

    if (currentCycle !== cycle) {
      cycle = currentCycle;
      swapLabel();
    }

    const head = (travelled % span) - config.width;

    for (let i = 0; i < ticks.length; i++) {
      const distance = Math.abs(i - head) / config.width;
      let falloff = 0;

      if (distance <= config.plateau) {
        falloff = 1;
      } else if (distance < 1) {
        falloff = (1 - distance) / (1 - config.plateau);
      }

      const tick = ticks[i];
      tick.style.transform = `scaleY(${min + (1 - min) * falloff})`;
      tick.style.backgroundColor = lerpColor(falloff);
    }
  };

  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
  };

  const start = () => {
    if (unsubscribe || isEditor || reduced) return;
    cycle = 0;
    startTime = performance.now();
    unsubscribe = Raf.add(render);
  };

  const staticState = () => {
    ticks.forEach((tick) => {
      tick.style.transform = `scaleY(${min})`;
      tick.style.backgroundColor = idle;
    });
  };

  createTicks();
  resetLabels();

  handleEditor((editor) => {
    isEditor = editor;
    if (editor || reduced) {
      stop();
      staticState();
    } else {
      start();
    }
  });

  onMount(() => {
    if (!isEditor && !reduced) start();
    else staticState();
  });

  onDestroy(() => {
    stop();
    gsap.killTweensOf(labels);
    removeTicks();
  });
}
