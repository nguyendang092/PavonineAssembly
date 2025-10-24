// menuConfig.js
// Cấu hình toàn bộ menu, dropdown, route, icon, quyền truy cập...

export const menuConfig = [
  {
    key: "sanLuong",
    label: "navbar.sanLuong",
    type: "dropdown",
    children: [
      { key: "sanLuongNormal", label: "navbar.Normal", path: "/normal" },
      { key: "sanLuongNG", label: "navbar.ng", path: "/ng" },
    ],
  },
  { key: "nhietdo", label: "navbar.nhietdo", path: "/nhietdo" },
  // {
  //   key: "ap5",
  //   label: "AP5",
  //   type: "dropdown",
  //   children: [
  //     {
  //       key: "AP5 MD",
  //       label: "AP5MD",
  //       path: "/ap5md",
  //       children: [
  //         { key: "ap5mdff", label: "AP5 MD FF", path: "/ap5md/ap5mdff" },
  //         { key: "ap5mdfz", label: "AP5 MD FZ", path: "/ap5md/ap5mdfz" },
  //         { key: "ap5mdfl", label: "AP5 MD FL", path: "/ap5md/ap5mdfl" },
  //       ],
  //     },
  //     // {
  //     //   key: "AP5",
  //     //   label: "AP5",
  //     //   path: "/ap5",
  //     //   children: [
  //     //     { key: "ap5ff", label: "AP5FF", path: "/ap5/ap5ff" },
  //     //     { key: "ap5fz", label: "AP5FZ", path: "/ap5/ap5fz" },
  //     //   ],
  //     // },
  //   ],
  // },
  {
    key: "certificate",
    label: "navbar.certificate",
    type: "dropdown",
    adminOnly: true,
    children: [
      { key: "certificate1", label: "navbar.certificate1", path: "/bangkhen1" },
      { key: "certificate2", label: "navbar.certificate2", path: "/bangkhen2" },
    ],
  },
  {
    key: "leader",
    label: "navbar.leader",
    type: "dropdown",
    children: [
      { key: "ChiThanh", label: "navbar.ChiThanh", path: "/employ/ChiThanh" },
      {
        key: "NgocThanh",
        label: "navbar.NgocThanh",
        path: "/employ/NgocThanh",
      },
      { key: "Muoi", label: "navbar.Muoi", path: "/employ/Muoi" },
      //   { key: "DuyHinh", label: "navbar.DuyHinh", path: "/employ/DuyHinh" },
    ],
  },
  {
    key: "mold",
    label: "navbar.mold",
    type: "dropdown",
    children: [{ key: "mold", label: "navbar.mold", path: "/mold" }],
  },
];

// Cấu hình route cho App.jsx
export const routeConfig = [
  { path: "/normal", element: "WorkplaceChart" },
  { path: "/ng", element: "NGWorkplaceChart" },
  // { path: "/ap5md/ap5mdff", element: "Metandeco" },
  // { path: "/ap5md/ap5mdfz", element: "Metandeco" },
  // {path: "/ap5md/ap5mdfl", element: "Metandeco" },
  // { path: "/ap5/ap5ff", element: "Metandeco" },
  // { path: "/ap5/ap5fz", element: "Metandeco" },
  { path: "/bangkhen1", element: "CertificateGenerator1" },
  { path: "/bangkhen2", element: "CertificateGenerator2" },
  { path: "/nhietdo", element: "TemperatureMonitor" },
  { path: "/employ", element: "Employ" },
  { path: "/employ/:leader", element: "Employ" },
  { path: "/mold", element: "MoldManager" },
];
