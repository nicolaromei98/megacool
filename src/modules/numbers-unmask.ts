import { onDestroy, onTrack } from "@/modules/_";
import { clamp, map, toNumber } from "@utils/math";
import { reduced } from "@lib/gsap";
import { handleEditor } from "@webflow/detect-editor";

const TARGET_SELECTOR = "[data-unmask-target], .numbers";
const DEFAULT_FROM = -110;
/** Scroll progress when reveal begins (negative = starts before item enters track). */
const DEFAULT_START = -0.12;
const DEFAULT_END = 0.48;

const getTargets = (item: HTMLElement) =>
  Array.from(item.querySelectorAll<HTMLElement>(TARGET_SELECTOR));

const applyProgress = (
  target: HTMLElement,
  progress: number,
  fromPercent: number
) => {
  const p = clamp(0, 1, progress);
  const y = (1 - p) * fromPercent;
  target.style.transform = `translate3d(0, ${y}%, 0)`;
};

/** data-module="numbers-unmask" on solutions section; item: data-unmask-item; target: data-unmask-target.
 *  Optional on item: data-start (default -0.12), data-end (default 0.48), data-from (default -110). */
export default function (element: HTMLElement, _dataset: DOMStringMap) {
  const items = Array.from(
    element.querySelectorAll<HTMLElement>("[data-unmask-item], .number__w")
  );

  if (!items.length) return;

  let isEditor = false;
  const cleanups: Array<() => void> = [];
  const tracks: Array<{ destroy: () => void }> = [];
  let lastProgress = new WeakMap<HTMLElement, number>();

  const resetTargets = (
    targets: HTMLElement[],
    progress: number,
    fromPercent: number
  ) => {
    targets.forEach((target) => applyProgress(target, progress, fromPercent));
  };

  const initItem = (item: HTMLElement) => {
    const targets = getTargets(item);
    if (!targets.length) return;

    const start = toNumber(item.dataset.start, DEFAULT_START);
    const end = toNumber(item.dataset.end, DEFAULT_END);
    const from = toNumber(item.dataset.from, DEFAULT_FROM);
    const once = item.dataset.once === "true";
    const top = item.dataset.top === "top" ? "top" : "bottom";
    const bottom = item.dataset.bottom === "bottom" ? "bottom" : "top";

    let done = false;
    item.style.overflow = "hidden";
    resetTargets(targets, 0, from);

    const track = onTrack(item, {
      top,
      bottom,
      callback: (value) => {
        if (done) return;
        const progress = clamp(0, 1, map(value, start, end, 0, 1));
        const prev = lastProgress.get(item);
        if (prev === progress) return;
        lastProgress.set(item, progress);

        resetTargets(targets, progress, from);

        if (once && progress >= 1) done = true;
      },
    });
    tracks.push(track);

    cleanups.push(() => {
      targets.forEach((target) => {
        target.style.transform = "";
      });
      item.style.overflow = "";
    });
  };

  const init = () => {
    items.forEach(initItem);
  };

  const clearRuntime = () => {
    tracks.forEach((track) => track.destroy());
    tracks.length = 0;
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
    lastProgress = new WeakMap<HTMLElement, number>();
  };

  handleEditor((editor) => {
    isEditor = editor;
    clearRuntime();

    if (isEditor || reduced) {
      items.forEach((item) => {
        item.style.overflow = "hidden";
        resetTargets(getTargets(item), 1, DEFAULT_FROM);
      });
      return;
    }

    init();
  });

  onDestroy(() => {
    clearRuntime();
  });
}
