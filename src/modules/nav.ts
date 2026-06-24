import { Raf, Resize } from "@/lib/subs";
import State from "@lib/hey";

export default function (element: HTMLElement, dataset: any) {
  // console.log("nav", element);

  // setInterval(() => {
  //   console.log("count", count++);
  // }, 1000);

  State.on("PAGE", (data) => {
    console.log("page changed");
  });
}
