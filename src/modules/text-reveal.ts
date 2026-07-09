import gsap, { SplitText, reduced } from "@lib/gsap";
import { Resize } from "@lib/subs";
import { onMount, onDestroy, onView } from "@/modules/_";
import { toNumber } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";
import type { Observe } from "@/modules/_/observe";

const LINE_CLASS = "tr-line";
const LINE_WRAP_CLASS = "tr-line-wrap";
const ANIMATED_CLASS = "tr-animated";
const READY_CLASS = "tr-ready";
const REFLOW_DEBOUNCE_MS = 150;
const DEFAULT_TARGET =
  ".h-h1, .h-h2, .h-h3, .h-h4, .h-h5, .h-h6, .paragraph, h1, h2, h3, h4, h5, h6, p";

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

  if (wrapper.matches("[data-text-reveal]") || wrapper.matches(selector)) {
    return [wrapper];
  }

  // Leaf mode: data-module on the text node itself — animate it even when it
  // isn't covered by DEFAULT_TARGET (e.g. h5 on the partnership accordion).
  if (wrapper.dataset.module === "text-reveal") {
    return [wrapper];
  }

  return [];
};

const createReveal = (element: HTMLElement, config: RevealConfig) => {
  const sourceHTML = element.innerHTML.trim();

  let split: SplitText | null = null;
  let wraps: HTMLDivElement[] = [];
  let observer: Observe | null = null;
  let srText: HTMLSpanElement | null = null;
  let animatedText: HTMLSpanElement | null = null;
  let isEditor = false;
  let hasPlayed = false;
  let prepared = false;
  let playing = false;
  let isInView = false;
  let isRevealed = false;
  let resizeObserver: ResizeObserver | null = null;
  let unsubResize: (() => void) | null = null;
  let reflowTimer: ReturnType<typeof setTimeout> | null = null;
  let lastWidth = -1;
  let lastFontSize = "";

  const splitConfig = {
    type: "lines" as const,
    linesClass: LINE_CLASS,
    autoSplit: true,
    deepSlice: true,
    onSplit: (self: SplitText) => handleSplit(self),
  };

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
    srText.innerHTML = sourceHTML;
    setVisuallyHidden(srText);

    animatedText = document.createElement("span");
    animatedText.className = ANIMATED_CLASS;
    animatedText.innerHTML = sourceHTML;
    animatedText.setAttribute("aria-hidden", "true");
    animatedText.style.display = "block";
    animatedText.style.width = "100%";

    element.innerHTML = "";
    element.appendChild(srText);
    element.appendChild(animatedText);
  };

  const applyLineWraps = (lines: Element[]) => {
    wraps = [];
    lines.forEach((line) => {
      const wrap = document.createElement("div");
      wrap.className = LINE_WRAP_CLASS;
      line.parentNode!.insertBefore(wrap, line);
      wrap.appendChild(line);
      wraps.push(wrap);
    });
  };

  const handleSplit = (self: SplitText) => {
    applyLineWraps(self.lines);

    if (isEditor || reduced) {
      gsap.set(self.lines, { clearProps: "transform" });
      return;
    }

    if (config.once && hasPlayed) {
      gsap.set(self.lines, { yPercent: 0 });
      return;
    }

    if (isRevealed) {
      gsap.set(self.lines, { yPercent: 0 });
      return;
    }

    if (isInView) {
      playing = true;
      return gsap.fromTo(
        self.lines,
        { yPercent: config.y },
        {
          yPercent: 0,
          duration: config.duration,
          delay: config.delay,
          stagger: config.stagger,
          ease: config.ease,
          onComplete: () => {
            playing = false;
            isRevealed = true;
            if (config.once) hasPlayed = true;
          },
        }
      );
    }

    gsap.set(self.lines, { yPercent: config.y });
    prepared = true;
  };

  const unbindReflow = () => {
    if (reflowTimer) {
      clearTimeout(reflowTimer);
      reflowTimer = null;
    }
    resizeObserver?.disconnect();
    resizeObserver = null;
    unsubResize?.();
    unsubResize = null;
  };

  const reflowSplit = () => {
    if (!split || isEditor || reduced || !animatedText || !split.isSplit) return;

    const width = element.clientWidth;
    const fontSize = getComputedStyle(element).fontSize;
    if (width === lastWidth && fontSize === lastFontSize) return;

    lastWidth = width;
    lastFontSize = fontSize;

    split.revert();
    animatedText.innerHTML = sourceHTML;
    split.split(splitConfig);
  };

  const scheduleReflow = () => {
    if (reflowTimer) clearTimeout(reflowTimer);
    reflowTimer = setTimeout(() => {
      reflowTimer = null;
      reflowSplit();
    }, REFLOW_DEBOUNCE_MS);
  };

  const bindReflow = () => {
    unbindReflow();
    lastWidth = element.clientWidth;
    lastFontSize = getComputedStyle(element).fontSize;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleReflow);
      resizeObserver.observe(element);
    }

    unsubResize = Resize.add(scheduleReflow);
    document.fonts?.ready.then(scheduleReflow);
  };

  const clearSplit = (restoreText = true) => {
    if (split?.lines) gsap.killTweensOf(split.lines);

    unbindReflow();
    wraps = [];
    split?.revert();
    split = null;
    srText = null;
    animatedText = null;
    hasPlayed = false;
    prepared = false;
    playing = false;
    isInView = false;
    isRevealed = false;
    lastWidth = -1;
    lastFontSize = "";

    if (restoreText) element.innerHTML = sourceHTML;
  };

  const destroyObserver = () => {
    observer?.destroy();
    observer = null;
  };

  const ensureSplit = () => {
    if (split?.isSplit) return true;
    buildTextCopies();
    if (!animatedText) return false;

    split = new SplitText(animatedText, splitConfig);

    if (!split.lines.length) {
      split.revert();
      split = null;
      return false;
    }

    return true;
  };

  const prepareHidden = () => {
    if (prepared || isEditor || reduced) return;
    ensureSplit();
  };

  const play = () => {
    if (isEditor || reduced) return;
    if (config.once && hasPlayed) return;
    if (playing) return;
    if (!ensureSplit()) return;

    isInView = true;
    split!.split(splitConfig);
  };

  const reset = () => {
    if (config.once || !split?.isSplit) return;

    isInView = false;
    isRevealed = false;
    playing = false;
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
  };

  const start = () => {
    if (isEditor || reduced || observer) return;
    prepareHidden();
    bindReflow();
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
    prepareHidden,
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
    once: dataset.once !== "false",
    rootMargin: dataset.rootMargin || "0px 0px -10% 0px",
    ease: dataset.ease || "expo.out",
  };

  // Reveal the wrapper only after the instances have applied their hidden
  // state (CSS keeps it hidden until now). This prevents the flash of
  // fully-visible text before the JS bundle runs and splits it.
  const reveal = () => element.classList.add(READY_CLASS);

  const targets = getTargets(element, dataset);
  if (!targets.length) {
    // Empty or misconfigured wrapper — still reveal so anti-FOUC CSS doesn't
    // hide content until the 4s failsafe.
    reveal();
    return;
  }

  const instances = targets.map((target) => {
    const d = target.dataset;
    const config: RevealConfig = {
      stagger: toNumber(d.stagger, baseConfig.stagger),
      duration: toNumber(d.duration, baseConfig.duration),
      delay: toNumber(d.delay, baseConfig.delay),
      y: toNumber(d.y, baseConfig.y),
      once:
        d.once === "false"
          ? false
          : d.once === "true"
            ? true
            : baseConfig.once,
      rootMargin: d.rootMargin || baseConfig.rootMargin,
      ease: d.ease || baseConfig.ease,
    };
    return createReveal(target, config);
  });

  handleEditor((editor) => {
    instances.forEach((instance) => instance.setEditor(editor));
    reveal();
  });

  onMount(() => {
    instances.forEach((instance) => instance.start());
    reveal();
  });

  onDestroy(() => {
    instances.forEach((instance) => instance.stop());
  });
}
