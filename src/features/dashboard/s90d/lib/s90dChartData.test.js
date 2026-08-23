import { describe, expect, it } from "vitest";

import { AP5_BOARD_SPECS } from "./s90dManualEntryReportConfig";

import { buildProductCodeYieldItems } from "./s90dChartData";



describe("buildProductCodeYieldItems", () => {

  const processDetails = [

    {

      process: "ASSEMBLY",

      boardRows: [

        {

          productCode: "AP5FF",

          totalQty: 100,

          okQty: 95,

          yieldPct: 95,

        },

        {

          productCode: "AP5FZ",

          totalQty: 80,

          okQty: 72,

          yieldPct: 90,

        },

        {

          productCode: "AP5FL",

          totalQty: 0,

          okQty: 0,

          yieldPct: 0,

        },

      ],

    },

  ];



  it("returns invalid yield when AP5 chain is incomplete", () => {

    const items = buildProductCodeYieldItems(processDetails, {

      boardSpecs: AP5_BOARD_SPECS,

      processes: ["PRESS", "MC", "HAIRLINE", "ANODIZING", "ASSEMBLY"],

      requireFullProcessChain: true,

    });



    expect(items).toHaveLength(3);

    expect(items[0]).toMatchObject({

      productCode: "AP5FF",

      yieldPct: null,

      cumulativeYieldPct: null,

      isValid: false,

      hasData: true,

    });

    expect(items[1]).toMatchObject({

      productCode: "AP5FZ",

      yieldPct: null,

      isValid: false,

    });

    expect(items[2]).toMatchObject({

      productCode: "AP5FL",

      yieldPct: null,

      isValid: false,

      hasData: false,

    });

  });



  it("computes cumulative yield when every process has data", () => {

    const multiProcessDetails = [

      {

        process: "PRESS",

        boardRows: [

          { productCode: "AP5FF", totalQty: 100, okQty: 95, yieldPct: 95 },

          { productCode: "AP5FZ", totalQty: 0, okQty: 0, yieldPct: 0 },

        ],

      },

      {

        process: "MC",

        boardRows: [

          { productCode: "AP5FF", totalQty: 95, okQty: 90, yieldPct: 94.7 },

          { productCode: "AP5FZ", totalQty: 0, okQty: 0, yieldPct: 0 },

        ],

      },

      {

        process: "HAIRLINE",

        boardRows: [

          { productCode: "AP5FF", totalQty: 90, okQty: 85, yieldPct: 94.4 },

          { productCode: "AP5FZ", totalQty: 0, okQty: 0, yieldPct: 0 },

        ],

      },

      {

        process: "ANODIZING",

        boardRows: [

          { productCode: "AP5FF", totalQty: 85, okQty: 82, yieldPct: 96.5 },

          { productCode: "AP5FZ", totalQty: 0, okQty: 0, yieldPct: 0 },

        ],

      },

      {

        process: "ASSEMBLY",

        boardRows: [

          { productCode: "AP5FF", totalQty: 82, okQty: 74, yieldPct: 90.2 },

          { productCode: "AP5FZ", totalQty: 0, okQty: 0, yieldPct: 0 },

        ],

      },

    ];



    const items = buildProductCodeYieldItems(multiProcessDetails, {

      boardSpecs: AP5_BOARD_SPECS,

      processes: ["PRESS", "MC", "HAIRLINE", "ANODIZING", "ASSEMBLY"],

      requireFullProcessChain: true,

    });



    const ap5ff = items.find((item) => item.productCode === "AP5FF");

    expect(ap5ff?.isValid).toBe(true);

    expect(ap5ff?.yieldPct).toBe(90.2);

    expect(ap5ff?.cumulativeYieldPct).toBe(90.2);

  });



  it("returns invalid yield when MC is zero even if assembly has data", () => {

    const details = [

      {

        process: "PRESS",

        boardRows: [

          { productCode: "AP5FF", totalQty: 100, okQty: 95, yieldPct: 95 },

        ],

      },

      {

        process: "MC",

        boardRows: [

          { productCode: "AP5FF", totalQty: 0, okQty: 0, yieldPct: null },

        ],

      },

      {

        process: "HAIRLINE",

        boardRows: [

          { productCode: "AP5FF", totalQty: 0, okQty: 0, yieldPct: null },

        ],

      },

      {

        process: "ANODIZING",

        boardRows: [

          { productCode: "AP5FF", totalQty: 0, okQty: 0, yieldPct: null },

        ],

      },

      {

        process: "ASSEMBLY",

        boardRows: [

          { productCode: "AP5FF", totalQty: 90, okQty: 81, yieldPct: 90 },

        ],

      },

    ];



    const items = buildProductCodeYieldItems(details, {

      boardSpecs: AP5_BOARD_SPECS,

      processes: ["PRESS", "MC", "HAIRLINE", "ANODIZING", "ASSEMBLY"],

      requireFullProcessChain: true,

    });



    const ap5ff = items.find((item) => item.productCode === "AP5FF");

    expect(ap5ff?.yieldPct).toBeNull();

    expect(ap5ff?.isValid).toBe(false);

  });



  it("returns empty when fewer than two board specs", () => {

    expect(

      buildProductCodeYieldItems(processDetails, {

        boardSpecs: [{ productCode: "AP5FF" }],

      }),

    ).toEqual([]);

  });



  it("returns empty for S90D sub-code chart yields", () => {
    const s90dDetails = [
      {
        process: "ASSEMBLY",
        boardRows: [
          {
            codeSlot: "D",
            productCode: "S90D INZI",
            totalQty: 100,
            okQty: 91,
            yieldPct: 93.1,
          },
          {
            codeSlot: "E",
            productCode: "S90D MXC",
            totalQty: 100,
            okQty: 73,
            yieldPct: 91.8,
          },
        ],
      },
    ];

    expect(
      buildProductCodeYieldItems(s90dDetails, {
        usesProductSubCodes: true,
        boardSpecs: [
          { productCode: "S90D INZI", label: "S90D INZI" },
          { productCode: "S90D MXC", label: "S90D MXC" },
        ],
        processes: ["PRESS", "HAIRLINE", "ANODIZING", "ASSEMBLY"],
      }),
    ).toEqual([]);
  });

});


