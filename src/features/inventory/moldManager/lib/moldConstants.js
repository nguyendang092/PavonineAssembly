export const MOLD_COLUMNS = [
  "No",
  "Subsidiary",
  "Model",
  "Production Name",
  "Mold Code",
  "Asset No.",
  "Mold Size (W*D*H)",
  "Tooling Weight",
  "Date",
  "Location",
  "Status",
  "Type",
  "Pavonine Model",
  "Shot Counter",
  "Molds per Product",
  "NamePlate",
  "Process",
  "PM Image",
];

export const MOLD_IMAGE_COLUMNS = new Set(["NamePlate", "PM Image", "Process"]);

export const MOLD_COLUMN_TRANSLATION_KEYS = {
  No: "no",
  Subsidiary: "subsidiary",
  Model: "model",
  "Production Name": "productionName",
  "Mold Code": "moldCode",
  "Asset No.": "assetNo",
  "Mold Size (W*D*H)": "moldSize",
  "Tooling Weight": "toolingWeight",
  Date: "date",
  "Date Received": "dateReceived",
  "Date Released": "dateReleased",
  Location: "location",
  Status: "status",
  Type: "type",
  "Pavonine Model": "pavonineModel",
  "Shot Counter": "shotCounter",
  "Molds per Product": "moldsPerProduct",
  Warehouse: "warehouse",
  Vendor: "vendor",
  NamePlate: "namePlate",
  Notes: "notes",
  "PM Image": "pmImage",
  Process: "process",
};

export const MOLD_PAGE_SIZE = 10;

/** Ngưỡng SHOT tham chiếu (1M) — thanh tiến trình & cảnh báo bảo trì */
export const MOLD_SHOT_REFERENCE_MAX = 1_000_000;
/** Ngưỡng hiển thị trên hồ sơ chi tiết (theo quy trình PM) */
export const MOLD_SHOT_MAINTENANCE_THRESHOLD = 600_000;
export const MOLD_SHOT_WARN_RATIO = 0.8;
export const MOLD_SHOT_CRITICAL_RATIO = 0.95;

export const MOLD_STATUS = {
  ACTIVE: "active",
  MAINTENANCE: "maintenance",
  STOPPED: "stopped",
};

/** Giá trị rỗng = tự suy ra theo SHOT / vị trí / ghi chú */
export const MOLD_STATUS_OPTIONS = [
  { value: "", labelKey: "statusAuto" },
  { value: MOLD_STATUS.ACTIVE, labelKey: "statusActive" },
  { value: MOLD_STATUS.MAINTENANCE, labelKey: "statusMaintenance" },
  { value: MOLD_STATUS.STOPPED, labelKey: "statusStopped" },
];

export const MOLD_STATUS_VALUES = new Set(Object.values(MOLD_STATUS));

export const MOLD_TYPE_STYLES = {
  PRESS: "press",
  "SMALL PRESS": "small-press",
  MOLD: "mold",
};
