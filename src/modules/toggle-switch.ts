import { onMount, onDestroy } from "@/modules/_";
import { handleEditor } from "@webflow/detect-editor";

const BTN_ATTR = "data-toggle-btn";
const ACTIVE_ATTR = "data-toggle-active";
const EXCLUDED_VALUE = "contact";

/**
 * data-module="toggle-switch" on the toggle wrapper (replaces data-toggle-init).
 *
 * Child buttons use [data-toggle-btn]; mark the default with [data-toggle-active].
 * Buttons with data-toggle-btn="contact" are excluded from the sliding indicator.
 *
 * Sets CSS custom properties --toggle-count and --toggle-active on the wrapper.
 */
export default function (element: HTMLElement, _dataset: DOMStringMap) {
  const buttons = Array.from(
    element.querySelectorAll<HTMLElement>(`[${BTN_ATTR}]`)
  );

  if (buttons.length < 2) return;

  element.style.setProperty("--toggle-count", String(buttons.length));

  const isExcluded = (btn: HTMLElement) =>
    btn.getAttribute(BTN_ATTR) === EXCLUDED_VALUE;

  const getInitialIndex = () => {
    let index = buttons.findIndex(
      (btn) => btn.hasAttribute(ACTIVE_ATTR) && !isExcluded(btn)
    );
    if (index < 0) index = buttons.findIndex((btn) => !isExcluded(btn));
    return index;
  };

  const initialIndex = getInitialIndex();
  if (initialIndex < 0) return;

  let isEditor = false;
  let activeIndex = initialIndex;
  let bound = false;

  const setActive = (index: number) => {
    activeIndex = index;
    element.style.setProperty("--toggle-active", String(index));
    buttons.forEach((btn, i) => {
      const isActive = i === index;
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      btn.toggleAttribute(ACTIVE_ATTR, isActive);
      btn.tabIndex = isActive ? 0 : -1;
    });
  };

  const onHover = (event: Event) => {
    if (isEditor) return;
    const btn = event.currentTarget as HTMLElement;
    const index = buttons.indexOf(btn);
    if (isExcluded(btn)) return;
    if (index !== activeIndex) setActive(index);
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (isEditor) return;
    const dir =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    event.preventDefault();

    let next = activeIndex;
    do {
      next = (next + dir + buttons.length) % buttons.length;
    } while (isExcluded(buttons[next]) && next !== activeIndex);

    setActive(next);
    buttons[next].focus();
  };

  const bind = () => {
    if (bound || isEditor) return;
    bound = true;

    buttons.forEach((btn) => {
      btn.addEventListener("mouseenter", onHover);
      btn.addEventListener("click", onHover);
      btn.addEventListener("keydown", onKeydown);
    });

    setActive(activeIndex);
  };

  const unbind = () => {
    if (!bound) return;
    bound = false;

    buttons.forEach((btn) => {
      btn.removeEventListener("mouseenter", onHover);
      btn.removeEventListener("click", onHover);
      btn.removeEventListener("keydown", onKeydown);
    });
  };

  handleEditor((editor) => {
    isEditor = editor;
    if (editor) unbind();
    else bind();
  });

  onMount(() => {
    if (isEditor) setActive(initialIndex);
    else bind();
  });

  onDestroy(() => unbind());
}
