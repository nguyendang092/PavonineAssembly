export const HTML_TO_IMAGE_MAX_EDGE = 8192;

export function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

export function fitExportPixelRatio(
  width,
  height,
  desired = 2,
  maxEdge = HTML_TO_IMAGE_MAX_EDGE,
) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const limit = Math.max(1, Number(maxEdge) || HTML_TO_IMAGE_MAX_EDGE);
  const fitted = Math.min(desired, limit / w, limit / h);
  return Math.max(0.25, fitted);
}

function shouldUnlockOverflow(el) {
  if (!(el instanceof HTMLElement)) return false;
  const st = getComputedStyle(el);
  return (
    st.overflow !== "visible" ||
    st.overflowX !== "visible" ||
    st.overflowY !== "visible" ||
    st.maxHeight !== "none"
  );
}

function unlockElement(el, saved) {
  if (!(el instanceof HTMLElement)) return;
  saved.push({
    el,
    overflow: el.style.overflow,
    overflowX: el.style.overflowX,
    overflowY: el.style.overflowY,
    maxHeight: el.style.maxHeight,
  });
  el.style.setProperty("overflow", "visible", "important");
  el.style.setProperty("overflow-x", "visible", "important");
  el.style.setProperty("overflow-y", "visible", "important");
  el.style.maxHeight = "none";
}

function unlockOverflowForCapture(node) {
  const saved = [];
  unlockElement(node, saved);
  node.querySelectorAll("*").forEach((el) => {
    if (shouldUnlockOverflow(el)) unlockElement(el, saved);
  });
  let parent = node.parentElement;
  while (parent && parent !== document.body) {
    if (shouldUnlockOverflow(parent)) unlockElement(parent, saved);
    parent = parent.parentElement;
  }
  return () => {
    saved.forEach(({ el, overflow, overflowX, overflowY, maxHeight }) => {
      el.style.removeProperty("overflow");
      el.style.removeProperty("overflow-x");
      el.style.removeProperty("overflow-y");
      el.style.overflow = overflow;
      el.style.overflowX = overflowX;
      el.style.overflowY = overflowY;
      el.style.maxHeight = maxHeight;
    });
  };
}

function measureNode(node) {
  const width = Math.ceil(
    Math.max(node.scrollWidth, node.offsetWidth, node.clientWidth, 1),
  );
  const height = Math.ceil(
    Math.max(node.scrollHeight, node.offsetHeight, node.clientHeight, 1),
  );
  return { width, height };
}

export async function exportNodeToPng(node, options = {}) {
  if (!node) throw new Error("Missing export node");
  const {
    filter,
    pixelRatio = 2,
    extraHeight = 32,
    backgroundColor = "#ffffff",
  } = options;

  const restore = unlockOverflowForCapture(node);
  try {
    await waitForPaint();
    const { width, height: rawHeight } = measureNode(node);
    const height = rawHeight + extraHeight;
    const pr = fitExportPixelRatio(width, height, pixelRatio);
    const { toPng } = await import("html-to-image");
    return await toPng(node, {
      cacheBust: true,
      pixelRatio: pr,
      width,
      height,
      backgroundColor,
      style: {
        overflow: "visible",
        maxHeight: "none",
        height: `${height}px`,
        width: `${width}px`,
      },
      filter,
    });
  } finally {
    restore();
  }
}

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
