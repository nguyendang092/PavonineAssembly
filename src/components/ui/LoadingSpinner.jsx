const SIZE_CLASSES = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

/**
 * Spinner SVG dùng chung — màu theo `currentColor` (mặc định xanh, có thể `className="text-white"`).
 */
export default function LoadingSpinner({
  size = "md",
  className = "",
  "aria-label": ariaLabel = "Loading",
}) {
  const dim = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  return (
    <svg
      className={`animate-spin ${dim} text-blue-600 dark:text-blue-400 ${className}`}
      viewBox="0 0 24 24"
      aria-label={ariaLabel}
      role="status"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8z"
      />
    </svg>
  );
}
