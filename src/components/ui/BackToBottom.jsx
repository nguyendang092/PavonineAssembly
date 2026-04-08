import React, { useEffect, useState } from "react";
import { FaArrowCircleDown } from "react-icons/fa";
import { scrollAppToBottom } from "@/utils/appScroll";

export default function BackToBottom({
  threshold = 100,
  bottom = 24,
  right = 24,
  alwaysVisible = false,
  /** Đặt trong wrapper flex (không dùng fixed trên từng nút) */
  inline = false,
  /** Ref phần tử overflow scroll — nếu không có thì dùng window */
  scrollContainerRef = null,
}) {
  const [visible, setVisible] = useState(alwaysVisible);

  useEffect(() => {
    if (alwaysVisible) {
      setVisible(true);
      return;
    }
    const onScroll = () => {
      const el = scrollContainerRef?.current;
      if (el) {
        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        setVisible(el.scrollTop < max - threshold);
      } else {
        const docMax = Math.max(
          0,
          Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
          ) - window.innerHeight,
        );
        setVisible(window.scrollY < docMax - threshold);
      }
    };
    const el = scrollContainerRef?.current;
    const target = el ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => target.removeEventListener("scroll", onScroll);
  }, [threshold, alwaysVisible, scrollContainerRef]);

  const scrollToBottom = () => {
    scrollAppToBottom(scrollContainerRef);
  };

  const positionClass = inline ? "" : "fixed";
  const style = inline ? undefined : { bottom, right };

  return visible ? (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        scrollToBottom();
      }}
      aria-label="Scroll to bottom"
      title="Scroll to bottom"
      className={`${positionClass} z-50 rounded-full bg-white p-2 text-cyan-700 shadow-md ring-1 ring-cyan-500/50 transition duration-300 hover:bg-cyan-600 hover:text-white hover:ring-cyan-400 dark:bg-slate-800 dark:text-cyan-400 dark:ring-cyan-500/40 dark:hover:bg-cyan-600 dark:hover:text-white`.trim()}
      style={style}
    >
      <FaArrowCircleDown size={18} />
    </button>
  ) : null;
}
