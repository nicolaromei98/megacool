import gsap, { SplitText, reduced } from "@lib/gsap";
import { onMount, onDestroy, onView } from "@/modules/_";
import { handleEditor } from "@webflow/detect-editor";
import type { Observe } from "@/modules/_/observe";

const LINE_CLASS = "tr-line";
const LINE_WRAP_CLASS = "tr-line-wrap";
const ANIMATED_CLASS = "tr-animated";

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** data-module="text-reveal" — line-by-line reveal on scroll into view */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  const stagger = num(dataset.stagger, 0.08);
  const duration = num(dataset.duration, 1);
  const delay = num(dataset.delay, 0);
  const y = num(dataset.y, 100);
  const once = dataset.once !== "false";
  const rootMargin = dataset.rootMargin || "0px 0px -10% 0px";
  const ease = dataset.ease || "expo.out";
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
    if (isEditor || reduced || (once && hasPlayed)) return;
    if (!ensureSplit()) return;

    hasPlayed = true;

    gsap.fromTo(
      split!.lines,
      { yPercent: y },
      {
        yPercent: 0,
        duration,
        delay,
        stagger,
        ease,
      }
    );
  };

  const reset = () => {
    if (once || !split?.lines.length) return;
    hasPlayed = false;
    gsap.killTweensOf(split.lines);
    gsap.set(split.lines, { yPercent: y });
  };

  const bindObserver = () => {
    if (observer || isEditor || reduced) return;

    observer = onView(element, {
      autoStart: true,
      once,
      rootMargin,
      callback: ({ isIn }) => {
        if (isIn) play();
        else reset();
      },
    });

    // Above-the-fold fallback for first paint timing.
    requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) play();
    });
  };

  handleEditor((editor) => {
    isEditor = editor;

    if (editor) {
      destroyObserver();
      clearSplit();
      return;
    }

    bindObserver();
  });

  onMount(() => {
    bindObserver();
  });

  onDestroy(() => {
    destroyObserver();
    clearSplit();
  });
}
