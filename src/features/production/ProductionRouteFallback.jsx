import LoadingBlock from "@/components/ui/LoadingBlock";

/** Loading nhẹ trong vùng main — sidebar vẫn hiển thị. */
export default function ProductionRouteFallback() {
  return (
    <div
      className="production-route-fallback"
      aria-busy="true"
      aria-live="polite"
    >
      <LoadingBlock className="min-h-[36vh]" />
    </div>
  );
}
