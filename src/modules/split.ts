import gsap, { SplitText } from "@lib/gsap";
import { onView } from "./_";

function setVisuallyHidden(element) {
  element.setAttribute("aria-hidden", "true");
  element.style.position = "absolute";
  element.style.left = "-9999px";
  element.style.top = "-9999px";
  element.style.width = "1px";
}

const splitText = (element) => {
  const content = element.textContent;
  element.textContent = "";

  const span = document.createElement("span");
  span.textContent = content;
  element.appendChild(span);
  setVisuallyHidden(span);

  const anotherSpan = document.createElement("span");
  anotherSpan.setAttribute("data-css", "overflow-clip");
  anotherSpan.textContent = content;
  anotherSpan.setAttribute("aria-hidden", "true");
  element.appendChild(anotherSpan);

  const splitText = new SplitText(anotherSpan, {
    type: "chars",
  });

  return splitText;
};

export default function Split(element) {
  const split = splitText(element);

  onView(element, {
    autoStart: true,
    callback: ({ isIn }) => {
      // console.log("inView", isIn);

      if (isIn) {
        gsap.to(split.chars, {
          yPercent: 0,
          stagger: 0.02,
        });
      } else {
        gsap.killTweensOf(split.chars);
        gsap.set(split.chars, {
          yPercent: 100,
        });
      }
    },
  });
}
