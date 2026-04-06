import React, { useEffect, useState } from "react";
import { FaArrowCircleUp } from "react-icons/fa";
import { scrollAppToTop } from "../../utils/appScroll";

export default function BackToTop({
  threshold = 100,
  bottom = 24,
  right = 24,
  alwaysVisible = false,
  /** Đặt trong wrapper flex (không dùng fixed trên từng nút) */
  inline = false,
  /** Ref phần tử overflow scroll (vd. main trong App) — nếu không có thì dùng window */
  scrollContainerRef = null,
}) {
  const [visible, setVisible] = useState(alwaysVisible);

  useEffect(() => {
    if (alwaysVisible) {
      setVisible(true);
      return; // Skip attaching scroll listener
    }
    const onScroll = () => {
      const el = scrollContainerRef?.current;
      if (el) setVisible(el.scrollTop > threshold);
      else setVisible(window.scrollY > threshold);
    };
    const el = scrollContainerRef?.current;
    const target = el ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => target.removeEventListener("scroll", onScroll);
  }, [threshold, alwaysVisible, scrollContainerRef]);

  const scrollToTop = () => {
    scrollAppToTop(scrollContainerRef);
  };

  const positionClass = inline ? "" : "fixed";
  const style = inline ? undefined : { bottom, right };

  return visible ? (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        scrollToTop();
      }}
      aria-label="Back to top"
      title="Back to top"
      className={`${positionClass} z-50 text-blue-600 hover:text-white bg-white hover:bg-blue-600 rounded-full shadow-md p-2 transition duration-300`.trim()}
      style={style}
    >
      <FaArrowCircleUp size={18} />
    </button>
  ) : null;
}
