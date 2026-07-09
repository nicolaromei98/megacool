import { onMount } from "@/modules/_";

const BTN_ATTR = "data-toggle-btn";
const ACTIVE_ATTR = "data-toggle-active";
const EXCLUDED_VALUE = "contact";

/**
 *
 * Child buttons use [data-toggle-btn]; mark the default with [data-toggle-active].
 * Buttons with data-toggle-btn="contact" are excluded from the sliding indicator.
 *
 * The indicator is placed once on the button linking to the current page (or the
 * [data-toggle-active] default) and does not move on hover/interaction.
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

  const normalizePath = (path: string) =>
    path.replace(/\/+$/, "").toLowerCase() || "/";

  const getHref = (btn: HTMLElement) => {
    const anchor =
      (btn instanceof HTMLAnchorElement ? btn : null) ??
      btn.closest("a") ??
      btn.querySelector("a");
    return anchor?.getAttribute("href") ?? null;
  };

  // The button whose link points at the current page starts active, so the
  // sliding indicator is already placed there on load.
  const getCurrentPageIndex = () => {
    const current = normalizePath(window.location.pathname);
    return buttons.findIndex((btn) => {
      if (isExcluded(btn)) return false;
      const href = getHref(btn);
      if (!href) return false;
      try {
        return normalizePath(new URL(href, window.location.origin).pathname) === current;
      } catch {
        return false;
      }
    });
  };

  const getInitialIndex = () => {
    let index = getCurrentPageIndex();
    if (index >= 0) return index;
    index = buttons.findIndex(
      (btn) => btn.hasAttribute(ACTIVE_ATTR) && !isExcluded(btn)
    );
    if (index < 0) index = buttons.findIndex((btn) => !isExcluded(btn));
    return index;
  };

  const initialIndex = getInitialIndex();
  if (initialIndex < 0) return;

  const setActive = (index: number) => {
    element.style.setProperty("--toggle-active", String(index));
    buttons.forEach((btn, i) => {
      const isActive = i === index;
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      btn.toggleAttribute(ACTIVE_ATTR, isActive);
    });
  };

  onMount(() => setActive(initialIndex));
}
