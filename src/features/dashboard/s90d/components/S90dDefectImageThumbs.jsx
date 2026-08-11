import React from "react";
import { useReportT } from "../../productionReport/useReportTranslation";
import { getDefectImageUrls } from "../lib/s90dDefectImages";

export default function S90dDefectImageThumbs({
  imageMap,
  defectKey,
  isPercent = false,
}) {
  const rt = useReportT();
  if (isPercent) return null;

  const urls = getDefectImageUrls(imageMap, defectKey);
  if (!urls.length) return null;

  return (
    <div className="s90d-defect-image-links">
      {urls.map((url, index) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="s90d-defect-image-link"
          title={url}
        >
          {urls.length > 1
            ? rt("defectViewImageN", "Xem {{n}}", {
                n: index + 1,
              })
            : rt("defectViewImage", "Xem")}
        </a>
      ))}
    </div>
  );
}
