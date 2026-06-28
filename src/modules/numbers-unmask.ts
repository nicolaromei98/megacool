import { onDestroy, onTrack } from "@/modules/_";
import { clamp, map } from "@utils/math";
import { reduced } from "@lib/gsap";
import { handleEditor } from "@webflow/detect-editor";

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
};

const applyProgress = (
  target: HTMLElement,
  progress: number,
  fromPercent: number
) => {
  const p = clamp(0, 1, progress);
  const y = (1 - p) * fromPercent;
  target.style.transform = `translate3d(0, ${y}%, 0)`;
};

/** data-module="numbers-unmask" on solutions section; item: data-unmask-item; target: data-unmask-target */
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
    const targets = Array.from(
      item.querySelectorAll<HTMLElement>("[data-unmask-target], .numbers")
    );
    if (!targets.length) return;

    const start = num(item.dataset.start, 0);
    const end = num(item.dataset.end, 0.48);
    const from = num(item.dataset.from, -110);
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
        const targets = Array.from(
          item.querySelectorAll<HTMLElement>("[data-unmask-target], .numbers")
        );
        item.style.overflow = "hidden";
        resetTargets(targets, 1, -110);
      });
      return;
    }

    init();
  });

  onDestroy(() => {
    clearRuntime();
  });
}
