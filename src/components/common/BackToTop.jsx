import React, { useEffect, useState } from "react";
import { FaArrowCircleUp } from "react-icons/fa";

export default function BackToTop({
  threshold = 100,
  bottom = 24,
  right = 24,
  alwaysVisible = false,
}) {
  const [visible, setVisible] = useState(alwaysVisible);

  useEffect(() => {
    if (alwaysVisible) {
      setVisible(true);
      return; // Skip attaching scroll listener
    }
    const onScroll = () => setVisible(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, alwaysVisible]);

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  return visible ? (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      className="fixed z-50 text-blue-600 hover:text-white bg-white hover:bg-blue-600 rounded-full shadow-lg p-3 transition duration-300"
      style={{ bottom: bottom, right: right }}
    >
      <FaArrowCircleUp size={24} />
    </button>
  ) : null;
}
