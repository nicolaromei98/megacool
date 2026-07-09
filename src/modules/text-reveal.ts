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

// Resolves once the display fonts have loaded. Used to re-split blocks that
// were split with a fallback font so their line breaks match the final font.
const fontsReady: Promise<void> =
  typeof document !== "undefined" && document.fonts?.ready
    ? document.fonts.ready.then(() => undefined)
    : Promise.resolve();

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
  let isRevealed = false;
  let resizeObserver: ResizeObserver | null = null;
  let unsubResize: (() => void) | null = null;
  let reflowTimer: ReturnType<typeof setTimeout> | null = null;
  let lastWidth = -1;
  let lastFontSize = "";

  const splitConfig = {
    type: "lines" as const,
    linesClass: LINE_CLASS,
    autoSplit: false,
    deepSlice: true,
    onSplit: (self: SplitText) => applyState(self),
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

  // Apply the correct static state to freshly-created lines. NEVER animates
  // here — animation is driven explicitly by play(). This is called on the
  // initial split and on every reflow re-split, so it must be idempotent.
  const applyState = (self: SplitText) => {
    applyLineWraps(self.lines);

    if (isEditor || reduced) {
      gsap.set(self.lines, { clearProps: "transform" });
      return;
    }

    // Already shown (revealed once, or currently mid-reveal): keep visible so a
    // reflow re-split can't drop it back to the hidden offset and flash.
    if ((config.once && hasPlayed) || isRevealed || playing) {
      gsap.set(self.lines, { yPercent: 0 });
      return;
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

  const reflowSplit = (force = false) => {
    if (!split || isEditor || reduced || !animatedText || !split.isSplit) return;

    const width = element.clientWidth;
    const fontSize = getComputedStyle(element).fontSize;
    if (!force && width === lastWidth && fontSize === lastFontSize) return;

    lastWidth = width;
    lastFontSize = fontSize;

    // revert() momentarily restores raw text — hide so it can't flash on screen.
    animatedText.style.visibility = "hidden";
    split.revert();
    animatedText.innerHTML = sourceHTML;
    split.split(splitConfig);
    animatedText.style.visibility = "";
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
    if (playing || isRevealed) return;
    if (!ensureSplit() || !split?.lines.length) return;

    playing = true;
    gsap.fromTo(
      split.lines,
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
  };

  const reset = () => {
    if (config.once || !split?.isSplit) return;

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
    },
    prepareHidden,
    reflowAfterFonts() {
      reflowSplit(true);
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
    once: dataset.once !== "false",
    rootMargin: dataset.rootMargin || "0px 0px -10% 0px",
    ease: dataset.ease || "expo.out",
  };

  const reveal = () => element.classList.add(READY_CLASS);

  const targets = getTargets(element, dataset);
  if (!targets.length) {
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

  let isEditor = false;
  let booted = false;

  const boot = () => {
    if (booted || isEditor || reduced) return;
    booted = true;

    // If fonts are already loaded, the initial split used the real font — line
    // breaks are correct and a fonts-ready re-split would be pure waste (and a
    // needless revert of every block). Only reflow when fonts were still
    // loading at split time and could have changed line wrapping.
    const fontsWereLoading = document.fonts?.status === "loading";

    instances.forEach((instance) => instance.start());
    reveal();

    if (fontsWereLoading) {
      fontsReady.then(() => {
        instances.forEach((instance) => instance.reflowAfterFonts());
      });
    }
  };

  handleEditor((editor) => {
    isEditor = editor;
    instances.forEach((instance) => instance.setEditor(editor));
    if (editor) reveal();
    else boot();
  });

  onMount(() => {
    if (!isEditor && !reduced) boot();
    else reveal();
  });

  onDestroy(() => {
    instances.forEach((instance) => instance.stop());
  });
}
