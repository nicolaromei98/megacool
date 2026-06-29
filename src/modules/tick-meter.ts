import gsap, { reduced } from "@lib/gsap";
import { Raf } from "@lib/subs";
import { onMount, onDestroy } from "@/modules/_";
import { toNumber } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

const TICK_CLASS = "smh__tick";
const CHAR_CLASS = "tm-char";
const TEXT_SELECTOR = ".eyebrow";

const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * data-module="tick-meter" on the ticks wrapper (e.g. `.smh__tick-wrap`).
 * Generates animated bars that pulse like a sound meter and reveals any
 * `[data-label]` text with letters popping in at random times.
 *
 * Optional dataset overrides: data-count, data-speed, data-width, data-plateau,
 * data-fade, data-reveal. CSS custom props --idle, --active, --min are read from
 * the wrapper (with sensible fallbacks).
 */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  const config = {
    count: Math.max(1, Math.round(toNumber(dataset.count, 70))),
    speed: toNumber(dataset.speed, 24),
    width: toNumber(dataset.width, 8),
    plateau: toNumber(dataset.plateau, 0.2),
    fade: toNumber(dataset.fade, 0.7),
    reveal: toNumber(dataset.reveal, 0.12),
  };

  const styles = getComputedStyle(element);
  const idle = styles.getPropertyValue("--idle").trim() || "#3a3a3a";
  const active = styles.getPropertyValue("--active").trim() || "#4fd6c4";
  const min = toNumber(styles.getPropertyValue("--min"), 0.22);

  const lerpColor = gsap.utils.interpolate(idle, active);
  const span = config.count + config.width * 2;

  const scope = element.parentElement ?? document;
  const labels = Array.from(scope.querySelectorAll<HTMLElement>("[data-label]"));

  const getTextEl = (label: HTMLElement): HTMLElement =>
    label.querySelector<HTMLElement>(TEXT_SELECTOR) ??
    (label.firstElementChild as HTMLElement | null) ??
    label;

  const texts = labels.map((label) => {
    const textEl = getTextEl(label);
    return (textEl.textContent ?? "").trim() || " ";
  });

  let ticks: HTMLSpanElement[] = [];
  let charEls: HTMLElement[] = [];
  let unsubscribe: (() => void) | null = null;
  let isEditor = false;
  let activeLabel = 0;
  let cycle = 0;
  let startTime = 0;

  const createTicks = () => {
    if (ticks.length) return;
    element.querySelectorAll(`.${TICK_CLASS}`).forEach((el) => el.remove());

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

  const killLabelTweens = () => {
    if (charEls.length) gsap.killTweensOf(charEls);
    charEls = [];
  };

  const restoreLabel = (label: HTMLElement, text: string) => {
    getTextEl(label).textContent = text;
  };

  const buildChars = (label: HTMLElement, text: string) => {
    const textEl = getTextEl(label);
    killLabelTweens();
    textEl.textContent = "";

    charEls = text.split("").map((char) => {
      const span = document.createElement("span");
      span.className = CHAR_CLASS;
      span.textContent = char;
      textEl.appendChild(span);
      return span;
    });

    return charEls;
  };

  const setTextInstant = (label: HTMLElement, text: string) => {
    killLabelTweens();
    restoreLabel(label, text);
  };

  const revealText = (label: HTMLElement, text: string, animate = true) => {
    const chars = buildChars(label, text);
    if (!chars.length) return;

    if (!animate || reduced) {
      gsap.set(chars, { autoAlpha: 1 });
      return;
    }

    gsap.set(chars, { autoAlpha: 0 });

    shuffle(chars).forEach((char) => {
      gsap.to(char, {
        autoAlpha: 1,
        duration: config.reveal,
        delay: Math.random() * config.fade,
        ease: "power2.out",
      });
    });
  };

  const showLabel = (index: number, animate = false) => {
    labels.forEach((label, i) => {
      if (i === index) {
        gsap.set(label, { autoAlpha: 1 });
        if (animate) revealText(label, texts[i]);
        else setTextInstant(label, texts[i]);
      } else {
        gsap.set(label, { autoAlpha: 0 });
        restoreLabel(label, texts[i]);
      }
    });
  };

  const resetLabels = () => {
    if (!labels.length) return;
    activeLabel = 0;
    showLabel(0);
  };

  const swapLabel = () => {
    if (labels.length < 2) return;

    const prev = activeLabel;
    const next = (activeLabel + 1) % labels.length;

    gsap.set(labels[prev], { autoAlpha: 0 });
    restoreLabel(labels[prev], texts[prev]);

    gsap.set(labels[next], { autoAlpha: 1 });
    revealText(labels[next], texts[next]);

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
      if (labels.length) showLabel(activeLabel);
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
    killLabelTweens();
    labels.forEach((label, i) => restoreLabel(label, texts[i]));
    removeTicks();
  });
}
