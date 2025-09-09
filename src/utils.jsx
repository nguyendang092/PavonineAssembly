export const areaKeyMapping = {
  "Ngọc Thành": "NgocThanh",
  "Chí Thành": "ChiThanh",
  "Duy Hinh": "DuyHinh",
  "Muội": "Muoi",
};

export const getAreaKey = (areaName) =>
  areaKeyMapping[areaName] || areaName.replace(/\s+/g, "").replace(/\/+/g, "_");
