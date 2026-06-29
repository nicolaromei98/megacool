import { SplitText, reduced } from "@lib/gsap";
import { Resize } from "@lib/subs";
import { onMount, onDestroy } from "@/modules/_";
import { toNumber } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

const CHAR_CLASS = "th-char";
const SPLIT_CLASS = "th-is-split";

const canSplit = () =>
  !reduced &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** data-module="text-hover" on any text element. Optional: data-shift, data-stagger, data-duration */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  const shift = toNumber(dataset.shift, 1.3);
  const stagger = toNumber(dataset.stagger, 0.01);
  const duration = toNumber(dataset.duration, 0.3);

  element.style.setProperty("--text-hover-shift", `${shift}em`);
  element.style.setProperty("--text-hover-duration", `${duration}s`);

  let split: SplitText | null = null;
  let isEditor = false;
  let offResize: (() => void) | null = null;

  const setup = () => {
    if (split || !canSplit()) return;

    split = new SplitText(element, {
      type: "chars",
      charsClass: CHAR_CLASS,
    });

    split.chars.forEach((char, i) => {
      (char as HTMLElement).style.transitionDelay = `${i * stagger}s`;
    });

    element.classList.add(SPLIT_CLASS);
  };

  const teardown = () => {
    split?.revert();
    split = null;
    element.classList.remove(SPLIT_CLASS);
  };

  const apply = () => {
    if (isEditor) return;
    if (canSplit()) setup();
    else teardown();
  };

  handleEditor((editor) => {
    isEditor = editor;
    if (editor) teardown();
    else apply();
  });

  onMount(() => {
    apply();
    offResize = Resize.add(apply);
  });

  onDestroy(() => {
    offResize?.();
    teardown();
  });
}
