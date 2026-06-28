import { SplitText, reduced } from "@lib/gsap";
import { onMount, onDestroy } from "@/modules/_";
import { handleEditor } from "@webflow/detect-editor";

const CHAR_CLASS = "th-char";

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** data-module="text-hover" on any text element. Optional: data-shift, data-stagger, data-duration */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  const shift = num(dataset.shift, 1.3);
  const stagger = num(dataset.stagger, 0.01);
  const duration = num(dataset.duration, 0.3);

  element.style.setProperty("--text-hover-shift", `${shift}em`);
  element.style.setProperty("--text-hover-duration", `${duration}s`);

  let split: SplitText | null = null;
  let isEditor = false;

  const setup = () => {
    if (split || reduced) return;

    split = new SplitText(element, {
      type: "chars",
      charsClass: CHAR_CLASS,
    });

    split.chars.forEach((char, i) => {
      (char as HTMLElement).style.transitionDelay = `${i * stagger}s`;
    });
  };

  const teardown = () => {
    split?.revert();
    split = null;
  };

  handleEditor((editor) => {
    isEditor = editor;
    if (editor) teardown();
    else setup();
  });

  onMount(() => {
    if (!isEditor) setup();
  });

  onDestroy(() => teardown());
}
