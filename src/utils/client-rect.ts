import { Scroll } from "@lib/scroll";
import { Resize } from "@lib/subs";

export const clientRect = (element: HTMLElement) => {
  const bounds = element.getBoundingClientRect();

  return {
    top: bounds.top + Scroll.scroll,
    bottom: bounds.bottom + Scroll.scroll,
    width: bounds.width,
    height: bounds.height,
    left: bounds.left,
    right: bounds.right,
    wh: Resize.height,
    ww: Resize.width,
    offset: bounds.top + Scroll.scroll,
    centery: Resize.height / 2 - bounds.height / 2 - bounds.top - Scroll.scroll,
    centerx: -Resize.width / 2 + bounds.left + bounds.width / 2,
  };
};

// export const clientRectGl = (element, ratio = Gl.pixel || 1) => {
//   const bounds = clientRect(element);
//   for (const [key, value] of Object.entries(bounds))
//     bounds[key] = value * ratio;
//   return bounds;
// };
