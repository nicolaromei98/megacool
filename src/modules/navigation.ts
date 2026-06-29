import { onMount, onDestroy } from "@/modules/_";
import { Scroll } from "@lib/scroll";
import { handleEditor } from "@webflow/detect-editor";

const STATUS_ATTR = "data-navigation-status";
const ACTIVE = "active";
const NOT_ACTIVE = "not-active";

/**
 * data-module="navigation" on the element that also carries
 * `data-navigation-status` (the fullscreen nav wrapper).
 *
 * Wires up `[data-navigation-toggle="toggle"]` and
 * `[data-navigation-toggle="close"]` buttons plus the ESC key, and locks
 * Lenis scrolling while the menu is open.
 */
export default function (element: HTMLElement, _dataset: DOMStringMap) {
  let isEditor = false;
  let bound = false;

  const isOpen = () => element.getAttribute(STATUS_ATTR) === ACTIVE;

  const setStatus = (status: string) => {
    element.setAttribute(STATUS_ATTR, status);
    if (isEditor) return;
    if (status === ACTIVE) Scroll.stop();
    else Scroll.start();
  };

  const open = () => setStatus(ACTIVE);
  const close = () => setStatus(NOT_ACTIVE);
  const toggle = () => (isOpen() ? close() : open());

  const toggleButtons = Array.from(
    document.querySelectorAll<HTMLElement>('[data-navigation-toggle="toggle"]')
  );
  const closeButtons = Array.from(
    document.querySelectorAll<HTMLElement>('[data-navigation-toggle="close"]')
  );

  const onToggleClick = () => toggle();
  const onCloseClick = () => close();
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isOpen()) close();
  };

  const bind = () => {
    if (bound || isEditor) return;
    bound = true;
    toggleButtons.forEach((btn) => btn.addEventListener("click", onToggleClick));
    closeButtons.forEach((btn) => btn.addEventListener("click", onCloseClick));
    document.addEventListener("keydown", onKeydown);
  };

  const unbind = () => {
    if (!bound) return;
    bound = false;
    toggleButtons.forEach((btn) =>
      btn.removeEventListener("click", onToggleClick)
    );
    closeButtons.forEach((btn) => btn.removeEventListener("click", onCloseClick));
    document.removeEventListener("keydown", onKeydown);
  };

  if (!element.getAttribute(STATUS_ATTR)) {
    element.setAttribute(STATUS_ATTR, NOT_ACTIVE);
  }

  handleEditor((editor) => {
    isEditor = editor;
    if (editor) {
      unbind();
      element.setAttribute(STATUS_ATTR, NOT_ACTIVE);
    } else {
      bind();
    }
  });

  onMount(() => {
    if (!isEditor) bind();
  });

  onDestroy(() => {
    unbind();
    if (!isEditor && isOpen()) Scroll.start();
  });
}
