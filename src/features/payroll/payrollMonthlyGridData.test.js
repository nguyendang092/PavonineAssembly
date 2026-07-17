import { describe, expect, it } from "vitest";
import {
  canonicalPayrollMonthRowId,
  collectPayrollMonthSortedEmployeeIds,
  comparePayrollMonthRowsByDepartment,
  buildPayrollMonthIdentityIndexes,
  applyPayrollMonthCanonicalKeysToChunks,
  matchesPayrollMonthRowFilter,
  payrollMonthRepresentativeEmployee,
  resolvePayrollMonthDayEmployee,
} from "@/features/payroll/payrollMonthlyGridData";
import {
  buildChunkByDateFromSerialized,
  serializePayrollMonthChunkForWorker,
} from "@/features/payroll/payrollMonthChunkSerialize";

function makeChunk(employees, dateKey = "2026-01-10") {
  const slim = employees.map((e) => ({
    ...e,
    monthEmployeeKey: e.monthEmployeeKey ?? e.mnv ?? e.id,
  }));
  const lookup = new Map();
  for (const e of slim) {
    for (const key of [
      e.id,
      e.monthEmployeeKey,
      e.mnv,
      e.businessId,
    ].filter(Boolean)) {
      if (!lookup.has(String(key))) lookup.set(String(key), e);
    }
  }
  return {
    dateKey,
    employees: slim,
    byId: new Map(slim.map((e) => [e.id, e])),
    byMonthEmployeeKey: new Map(
      slim.map((e) => [e.monthEmployeeKey || e.id, e]),
    ),
    rowLookup: lookup,
  };
}

describe("payrollMonthlyGridData employee resolution", () => {
  const firebaseId = "-OxTestPushKey123";
  const mnv = "NV001";
  const rep = {
    id: firebaseId,
    mnv,
    hoVaTen: "Nguyen Van A",
  };

  it("resolvePayrollMonthDayEmployee — tìm theo Firebase id khi rowId là MNV", () => {
    const chunk = makeChunk([
      {
        id: firebaseId,
        mnv: "",
        monthEmployeeKey: firebaseId,
        gioVao: "08:00",
        gioRa: "17:00",
        caLamViec: "S1",
      },
    ]);

    const emp = resolvePayrollMonthDayEmployee(chunk, mnv, rep);
    expect(emp?.gioVao).toBe("08:00");
    expect(emp?.id).toBe(firebaseId);
  });

  it("collectPayrollMonthSortedEmployeeIds — gộp 1 dòng khi cùng Firebase id", () => {
    const dayWithMnv = makeChunk(
      [
        {
          id: firebaseId,
          mnv,
          monthEmployeeKey: mnv,
          stt: 1,
        },
      ],
      "2026-01-10",
    );
    const dayWithoutMnv = makeChunk(
      [
        {
          id: firebaseId,
          mnv: "",
          monthEmployeeKey: firebaseId,
          stt: 1,
        },
      ],
      "2026-01-11",
    );

    const ids = collectPayrollMonthSortedEmployeeIds([
      dayWithMnv,
      dayWithoutMnv,
    ]);
    expect(ids).toEqual([mnv]);
  });

  it("resolvePayrollMonthDayEmployee — Firebase key emp_{MNV}", () => {
    const chunk = makeChunk([
      {
        id: "emp_200611",
        mnv: "",
        monthEmployeeKey: "200611",
        gioVao: "07:34",
        gioRa: "20:03",
        caLamViec: "S1",
      },
    ]);

    const emp = resolvePayrollMonthDayEmployee(chunk, "200611", {
      mnv: "200611",
    });
    expect(emp?.gioVao).toBe("07:34");
  });

  it("canonicalPayrollMonthRowId — tách dòng khi cùng MNV khác Firebase id", () => {
    const fbA = "-OxPersonA";
    const fbB = "-OxPersonB";
    const mnvCode = "200611";
    const chunks = [
      makeChunk(
        [
          { id: fbA, mnv: mnvCode, stt: 328, hoVaTen: "Tran A" },
          { id: fbB, mnv: mnvCode, stt: 341, hoVaTen: "Tran B" },
        ],
        "2026-06-12",
      ),
    ];
    const indexes = buildPayrollMonthIdentityIndexes(chunks);

    expect(canonicalPayrollMonthRowId(chunks[0].employees[0], indexes)).toBe(
      `${mnvCode}__${fbA}`,
    );
    expect(canonicalPayrollMonthRowId(chunks[0].employees[1], indexes)).toBe(
      `${mnvCode}__${fbB}`,
    );

    const ids = collectPayrollMonthSortedEmployeeIds(chunks);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(`${mnvCode}__${fbA}`);
    expect(ids).toContain(`${mnvCode}__${fbB}`);
  });

  it("payrollMonthRepresentativeEmployee — STT nhỏ nhất trong tháng cho từng dòng", () => {
    const fbA = "-OxPersonA";
    const mnvCode = "200611";
    const rowId = `${mnvCode}__${fbA}`;
    const chunks = [
      makeChunk(
        [{ id: fbA, mnv: mnvCode, stt: 341, hoVaTen: "Tran A" }],
        "2026-06-01",
      ),
      makeChunk(
        [{ id: fbA, mnv: mnvCode, stt: 328, hoVaTen: "Tran A" }],
        "2026-06-12",
      ),
    ];

    const rep = payrollMonthRepresentativeEmployee(chunks, rowId);
    expect(rep?.stt).toBe(328);
    expect(rep?.hoVaTen).toBe("Tran A");
  });

  it("resolvePayrollMonthDayEmployee — rowId tách chỉ khớp đúng Firebase id", () => {
    const fbA = "-OxPersonA";
    const fbB = "-OxPersonB";
    const mnvCode = "200611";
    const chunk = makeChunk(
      [
        { id: fbA, mnv: mnvCode, gioVao: "07:34", gioRa: "20:03" },
        { id: fbB, mnv: mnvCode, gioVao: "08:00", gioRa: "17:00" },
      ],
      "2026-06-12",
    );

    const empA = resolvePayrollMonthDayEmployee(
      chunk,
      `${mnvCode}__${fbA}`,
      { mnv: mnvCode, id: fbA },
    );
    const empB = resolvePayrollMonthDayEmployee(
      chunk,
      `${mnvCode}__${fbB}`,
      { mnv: mnvCode, id: fbB },
    );

    expect(empA?.gioVao).toBe("07:34");
    expect(empB?.gioVao).toBe("08:00");
  });

  it("payrollMonthRepresentativeEmployee — boPhan mới nhất theo ngày gần nhất", () => {
    const fbId = "-OxPersonA";
    const mnvCode = "200611";
    const chunks = [
      makeChunk(
        [{ id: fbId, mnv: mnvCode, stt: 328, boPhan: "SX Cũ" }],
        "2026-06-01",
      ),
      makeChunk(
        [{ id: fbId, mnv: mnvCode, stt: 328, boPhan: "SX Mới" }],
        "2026-06-12",
      ),
    ];

    const rep = payrollMonthRepresentativeEmployee(chunks, mnvCode);
    expect(rep?.boPhan).toBe("SX Mới");
    expect(rep?.boPhanAll).toEqual(expect.arrayContaining(["SX Cũ", "SX Mới"]));
  });

  it("matchesPayrollMonthRowFilter — hiện khi lọc BP cũ hoặc BP mới trong tháng", () => {
    const rep = {
      hoVaTen: "Tran A",
      mnv: "200611",
      boPhan: "SX Mới",
      boPhanAll: ["SX Cũ", "SX Mới"],
    };
    const norm = (v) => String(v ?? "").trim();

    expect(
      matchesPayrollMonthRowFilter(rep, {
        searchTerm: "",
        departmentFilter: "SX Cũ",
        normalizeDepartment: norm,
      }),
    ).toBe(true);
    expect(
      matchesPayrollMonthRowFilter(rep, {
        searchTerm: "",
        departmentFilter: "SX Mới",
        normalizeDepartment: norm,
      }),
    ).toBe(true);
    expect(
      matchesPayrollMonthRowFilter(rep, {
        searchTerm: "",
        departmentFilter: "Kho",
        normalizeDepartment: norm,
      }),
    ).toBe(false);
  });

  it("matchesPayrollMonthRowFilter — lọc nhiều bộ phận (OR)", () => {
    const rep = {
      hoVaTen: "Tran A",
      mnv: "200611",
      boPhan: "SX Mới",
      boPhanAll: ["SX Cũ", "SX Mới"],
    };
    const norm = (v) => String(v ?? "").trim();

    expect(
      matchesPayrollMonthRowFilter(rep, {
        searchTerm: "",
        departmentFilters: ["SX Cũ", "Kho"],
        normalizeDepartment: norm,
      }),
    ).toBe(true);
    expect(
      matchesPayrollMonthRowFilter(rep, {
        searchTerm: "",
        departmentFilters: ["Kho", "QC"],
        normalizeDepartment: norm,
      }),
    ).toBe(false);
    expect(
      matchesPayrollMonthRowFilter(rep, {
        searchTerm: "",
        departmentFilters: [],
        normalizeDepartment: norm,
      }),
    ).toBe(true);
  });

  it("applyPayrollMonthCanonicalKeysToChunks — gán monthEmployeeKey và rebuild index", () => {
    const fbA = "-OxA";
    const fbB = "-OxB";
    const mnvCode = "200611";
    const chunk = makeChunk(
      [
        { id: fbA, mnv: mnvCode, stt: 328, boPhan: "SX Cũ" },
        { id: fbB, mnv: mnvCode, stt: 341, boPhan: "Kho" },
      ],
      "2026-06-12",
    );

    applyPayrollMonthCanonicalKeysToChunks([chunk]);

    expect(chunk.employees[0].monthEmployeeKey).toBe(`${mnvCode}__${fbA}`);
    expect(chunk.employees[1].monthEmployeeKey).toBe(`${mnvCode}__${fbB}`);
    expect(chunk.byId.get(fbA)?.mnv).toBe(mnvCode);
    expect(resolvePayrollMonthDayEmployee(chunk, `${mnvCode}__${fbA}`)?.stt).toBe(
      328,
    );
  });

  it("serialize worker round-trip — giữ tra cứu theo Firebase id và MNV", () => {
    const fbId = "-OxWorker";
    const mnvCode = "200629";
    const chunk = makeChunk(
      [{ id: fbId, mnv: mnvCode, gioVao: "07:30", boPhan: "SX Mới" }],
      "2026-06-17",
    );
    applyPayrollMonthCanonicalKeysToChunks([chunk]);

    const serialized = serializePayrollMonthChunkForWorker(chunk);
    const rebuilt = buildChunkByDateFromSerialized([serialized]).get("2026-06-17");

    expect(resolvePayrollMonthDayEmployee(rebuilt, mnvCode)?.gioVao).toBe(
      "07:30",
    );
    expect(resolvePayrollMonthDayEmployee(rebuilt, fbId)?.gioVao).toBe("07:30");
  });

  it("comparePayrollMonthRowsByDepartment — sắp BP A→Z, cùng BP theo STT", () => {
    const kho = { boPhan: "Kho", stt: 50 };
    const sx = { boPhan: "Sản xuất", stt: 10 };
    const sx2 = { boPhan: "Sản xuất", stt: 5 };
    const empty = { boPhan: "", stt: 1 };

    expect(comparePayrollMonthRowsByDepartment(kho, sx)).toBeLessThan(0);
    expect(comparePayrollMonthRowsByDepartment(sx2, sx)).toBeLessThan(0);
    expect(comparePayrollMonthRowsByDepartment(sx, empty)).toBeLessThan(0);
  });
});
