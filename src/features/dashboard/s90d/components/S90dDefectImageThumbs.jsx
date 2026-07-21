import React from "react";
import { useTranslation } from "react-i18next";
import { getDefectImageUrls } from "../lib/s90dDefectImages";

export default function S90dDefectImageThumbs({
  imageMap,
  defectKey,
  isPercent = false,
}) {
  const { t } = useTranslation();
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
            ? t("s90dReport.defectViewImageN", "Xem {{n}}", {
                n: index + 1,
              })
            : t("s90dReport.defectViewImage", "Xem")}
        </a>
      ))}
    </div>
  );
}
