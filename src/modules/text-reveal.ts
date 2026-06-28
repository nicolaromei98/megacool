import gsap, { SplitText, reduced } from "@lib/gsap";
import { onMount, onDestroy, onView } from "@/modules/_";
import { toNumber } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";
import type { Observe } from "@/modules/_/observe";

const LINE_CLASS = "tr-line";
const LINE_WRAP_CLASS = "tr-line-wrap";
const ANIMATED_CLASS = "tr-animated";
const DEFAULT_TARGET =
  ".h-h1, .h-h2, .h-h3, .paragraph, h1, h2, h3, h4, p";

type RevealConfig = {
  stagger: number;
  duration: number;
  delay: number;
  y: number;
  once: boolean;
  rootMargin: string;
  ease: string;
};

const getTargets = (wrapper: HTMLElement, dataset: DOMStringMap) => {
  const marked = Array.from(
    wrapper.querySelectorAll<HTMLElement>("[data-text-reveal]")
  );
  if (marked.length) return marked;

  const selector = dataset.target || DEFAULT_TARGET;
  const found = Array.from(wrapper.querySelectorAll<HTMLElement>(selector));
  if (found.length) return found;

  // Leaf: data-module directly on a text node (backwards compatible)
  if (wrapper.matches("[data-text-reveal]") || wrapper.matches(selector)) {
    return [wrapper];
  }

  return [];
};

const createReveal = (element: HTMLElement, config: RevealConfig) => {
  const sourceText = element.textContent ?? "";

  let split: SplitText | null = null;
  let wraps: HTMLDivElement[] = [];
  let observer: Observe | null = null;
  let srText: HTMLSpanElement | null = null;
  let animatedText: HTMLSpanElement | null = null;
  let isEditor = false;
  let hasPlayed = false;

  const setVisuallyHidden = (node: HTMLElement) => {
    node.style.position = "absolute";
    node.style.left = "-9999px";
    node.style.top = "-9999px";
    node.style.width = "1px";
    node.style.height = "1px";
    node.style.overflow = "hidden";
    node.style.whiteSpace = "nowrap";
  };

  const buildTextCopies = () => {
    if (srText || animatedText) return;

    srText = document.createElement("span");
    srText.textContent = sourceText;
    setVisuallyHidden(srText);

    animatedText = document.createElement("span");
    animatedText.className = ANIMATED_CLASS;
    animatedText.textContent = sourceText;
    animatedText.setAttribute("aria-hidden", "true");

    element.textContent = "";
    element.appendChild(srText);
    element.appendChild(animatedText);
  };

  const clearSplit = (restoreText = true) => {
    if (split?.lines) gsap.killTweensOf(split.lines);

    wraps.forEach((wrap) => {
      const line = wrap.firstElementChild;
      if (line && wrap.parentNode) {
        wrap.parentNode.insertBefore(line, wrap);
        wrap.remove();
      }
    });

    wraps = [];
    split?.revert();
    split = null;
    srText = null;
    animatedText = null;
    hasPlayed = false;

    if (restoreText) element.textContent = sourceText;
  };

  const destroyObserver = () => {
    observer?.destroy();
    observer = null;
  };

  const ensureSplit = () => {
    if (split) return true;
    buildTextCopies();
    if (!animatedText) return false;

    split = new SplitText(animatedText, {
      type: "lines",
      linesClass: LINE_CLASS,
    });

    if (!split.lines.length) {
      split.revert();
      split = null;
      return false;
    }

    split.lines.forEach((line) => {
      const wrap = document.createElement("div");
      wrap.className = LINE_WRAP_CLASS;
      line.parentNode!.insertBefore(wrap, line);
      wrap.appendChild(line);
      wraps.push(wrap);
    });

    return true;
  };

  const play = () => {
    if (isEditor || reduced) return;
    if (config.once && hasPlayed) return;
    if (!ensureSplit()) return;

    if (config.once) hasPlayed = true;

    gsap.fromTo(
      split!.lines,
      { yPercent: config.y },
      {
        yPercent: 0,
        duration: config.duration,
        delay: config.delay,
        stagger: config.stagger,
        ease: config.ease,
      }
    );
  };

  const reset = () => {
    if (config.once || !split?.lines.length) return;
    hasPlayed = false;
    gsap.killTweensOf(split.lines);
    gsap.set(split.lines, { yPercent: config.y });
  };

  const bindObserver = () => {
    if (observer || isEditor || reduced) return;

    observer = onView(element, {
      autoStart: true,
      once: config.once,
      rootMargin: config.rootMargin,
      callback: ({ isIn }) => {
        if (isIn) play();
        else reset();
      },
    });

    requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) play();
    });
  };

  const start = () => {
    if (isEditor || reduced || observer) return;
    bindObserver();
  };

  const stop = () => {
    destroyObserver();
    clearSplit();
  };

  return {
    setEditor(editor: boolean) {
      isEditor = editor;
      if (editor) stop();
      else start();
    },
    start,
    stop,
  };
};

/**
 * data-module="text-reveal" on a wrapper — finds child text automatically.
 * Optional: data-target=".h-h1, .paragraph" or mark items with data-text-reveal.
 * Leaf mode: data-module on the text element itself still works.
 */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  const baseConfig: RevealConfig = {
    stagger: toNumber(dataset.stagger, 0.08),
    duration: toNumber(dataset.duration, 1),
    delay: toNumber(dataset.delay, 0),
    y: toNumber(dataset.y, 100),
    once: dataset.once === "true",
    rootMargin: dataset.rootMargin || "0px 0px -10% 0px",
    ease: dataset.ease || "expo.out",
  };

  const targets = getTargets(element, dataset);
  if (!targets.length) return;

  const instances = targets.map((target) => {
    const d = target.dataset;
    const config: RevealConfig = {
      stagger: toNumber(d.stagger, baseConfig.stagger),
      duration: toNumber(d.duration, baseConfig.duration),
      delay: toNumber(d.delay, baseConfig.delay),
      y: toNumber(d.y, baseConfig.y),
      once:
        d.once === "true"
          ? true
          : d.once === "false"
            ? false
            : baseConfig.once,
      rootMargin: d.rootMargin || baseConfig.rootMargin,
      ease: d.ease || baseConfig.ease,
    };
    return createReveal(target, config);
  });

  handleEditor((editor) => {
    instances.forEach((instance) => instance.setEditor(editor));
  });

  onMount(() => {
    instances.forEach((instance) => instance.start());
  });

  onDestroy(() => {
    instances.forEach((instance) => instance.stop());
  });
}
