import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  AP5_PRODUCTION_REPORT_CONFIG,
  S90D_PRODUCTION_REPORT_CONFIG,
} from "./productionReportConfigs";

const rulesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../firebase/database.rules.json",
);

function firebaseRulesAllowPath(path) {
  const rules = JSON.parse(readFileSync(rulesPath, "utf8"));
  const segments = path.split("/").filter(Boolean);
  let node = rules.rules;

  for (const segment of segments) {
    if (!node || typeof node !== "object") return false;
    if (node[segment]) {
      node = node[segment];
      continue;
    }
    if (node["$" + segment.replace(/^\$/, "")]) {
      node = node["$" + segment.replace(/^\$/, "")];
      continue;
    }
    const wildcard = Object.keys(node).find((key) => key.startsWith("$"));
    if (wildcard) {
      node = node[wildcard];
      continue;
    }
    return false;
  }

  return Boolean(node?.[".write"] || node?.[".read"]);
}

describe("productionReportConfigs firebase paths", () => {
  it("S90D manualEntries path is covered by database rules", () => {
    expect(
      firebaseRulesAllowPath(S90D_PRODUCTION_REPORT_CONFIG.firebaseRoot),
    ).toBe(true);
  });

  it("AP5 manualEntries path is covered by database rules", () => {
    expect(firebaseRulesAllowPath(AP5_PRODUCTION_REPORT_CONFIG.firebaseRoot)).toBe(
      true,
    );
  });
});
