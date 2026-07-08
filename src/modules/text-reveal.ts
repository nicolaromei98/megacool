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

  if (wrapper.matches("[data-text-reveal]") || wrapper.matches(selector)) {
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
            if (config.once) hasPlayed = true;
          },
        }
      );
    }

    gsap.set(self.lines, { yPercent: config.y });
    prepared = true;
  };

  const clearSplit = (restoreText = true) => {
    if (split?.lines) gsap.killTweensOf(split.lines);

    wraps = [];
    split?.revert();
    split = null;
    srText = null;
    animatedText = null;
    hasPlayed = false;
    prepared = false;
    playing = false;
    isInView = false;

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
  });

  onMount(() => {
    instances.forEach((instance) => instance.start());
  });

  onDestroy(() => {
    instances.forEach((instance) => instance.stop());
  });
}
