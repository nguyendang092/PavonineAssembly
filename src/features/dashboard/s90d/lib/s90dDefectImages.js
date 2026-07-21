import { S90D_DEFECT_COLUMNS } from "./s90dDefectColumns";

export const S90D_DEFECT_IMAGE_FIELD_PREFIX = "image:";

export function createEmptyDefectImageUrls() {
  return Object.fromEntries(S90D_DEFECT_COLUMNS.map(({ key }) => [key, ""]));
}

export function createEmptyDefectImageLists() {
  return Object.fromEntries(S90D_DEFECT_COLUMNS.map(({ key }) => [key, []]));
}

export function normalizeDefectImageUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) return "";
  return url;
}

export function isDefectImageField(field) {
  return String(field ?? "").startsWith(S90D_DEFECT_IMAGE_FIELD_PREFIX);
}

export function defectKeyFromImageField(field) {
  return String(field ?? "").slice(S90D_DEFECT_IMAGE_FIELD_PREFIX.length);
}

export function normalizeDefectImageUrls(raw) {
  const urls = createEmptyDefectImageUrls();
  if (!raw || typeof raw !== "object") return urls;

  S90D_DEFECT_COLUMNS.forEach(({ key }) => {
    urls[key] = normalizeDefectImageUrl(raw[key]);
  });
  return urls;
}

/** Gom URL ảnh từ nhiều ô ca / công đoạn — giữ thứ tự, bỏ trùng. */
export function collectDefectImageLists(entries) {
  const lists = createEmptyDefectImageLists();

  (entries ?? []).forEach((entry) => {
    const map = entry?.defectImages;
    if (!map || typeof map !== "object") return;

    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      const raw = map[key];
      const candidates = Array.isArray(raw) ? raw : [raw];
      candidates.forEach((item) => {
        const url = normalizeDefectImageUrl(item);
        if (url && !lists[key].includes(url)) {
          lists[key].push(url);
        }
      });
    });
  });

  return lists;
}

export function getDefectImageUrls(imageMap, defectKey) {
  const raw = imageMap?.[defectKey];
  if (Array.isArray(raw)) {
    return raw.map(normalizeDefectImageUrl).filter(Boolean);
  }
  const single = normalizeDefectImageUrl(raw);
  return single ? [single] : [];
}
