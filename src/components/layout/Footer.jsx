import React from "react";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full relative z-0 mt-0 bg-slate-950 text-slate-100 px-4 md:px-10 py-10 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute -top-24 -left-16 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 md:p-7">
          <div className="grid gap-8 lg:grid-cols-3 items-stretch">
            <div className="h-full">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                <span className="h-2 w-2 rounded-full bg-emerald-300 uppercase" />
                CÔNG TY TNHH PAVONINE VINA
              </div>

              <h3 className="mt-4 text-2xl md:text-3xl font-extrabold tracking-tight text-white uppercase">
                Pavonine Vina
              </h3>

              <p className="text-sm md:text-[15px] text-slate-300 mt-3 leading-relaxed max-w-xl">
                Lots VII-I, VII-2, and part of Lot VII-3, My Xuan B1 - Tien Hung
                Industrial Park, Phu My Ward, Ho Chi Minh City, Vietnam
              </p>
              <p className="text-sm md:text-[15px] text-slate-300 mt-3 leading-relaxed max-w-xl">
                MST: 3502305184
              </p>
            </div>

            <div className="h-full">
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Liên hệ
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-300">●</span>
                  <span>hr.pavonine@gmail.com</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-300">●</span>
                  <span>02546 504 369</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-300">●</span>
                  <span>
                    Địa chỉ: CÔNG TY TNHH PAVONINE VINA - KCN Mỹ Xuân B1-Tiến
                    Hùng
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-4 min-h-[250px] h-full w-full flex flex-col">
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
                Góc tuyển dụng
              </h4>
              <p className="mt-2 text-sm text-emerald-50 font-semibold">
                Chúng tôi đang tìm đồng đội mới cho nhà máy.
              </p>
              <ul className="mt-3 space-y-2 text-lg text-red-500 uppercase font-bold">
                <li className="flex items-center gap-2">
                  <span aria-hidden="true">📣</span>
                  <span>100 lao động phổ thông</span>
                </li>
              </ul>
              <ul className="mt-3 space-y-2 text-sm text-stone-50 uppercase font-bold">
                <li>• Phụ cấp</li>
                <ul className="mt-3 ml-4 space-y-2 text-xs text-stone-50 uppercase font-medium">
                  <li>• Phụ cấp chuyên cần: 600,000</li>
                  <li>• Phụ cấp xăng xe: 300,000</li>
                  <li>• Phụ cấp nhà ở: 250,000</li>
                  <li>• Thuở̛ng thâm niên: 100,000/năm</li>
                  <li>• Mừng sinh nhật 300,000</li>
                </ul>
              </ul>

              <div className="mt-4 text-xs text-emerald-100/90 space-y-1">
                <p>
                  <span className="font-semibold text-emerald-50">
                    Lịch phỏng vấn:
                  </span>{" "}
                  Thứ 2 - Thứ 6 ( 7:40 đến 17:00 )
                </p>
                <p>
                  <span className="font-semibold text-emerald-50">
                    Địa điểm:
                  </span>{" "}
                  Khu công nghiệp Mỹ Xuân B1
                </p>
                <p>
                  <span className="font-semibold text-emerald-50">
                    Hình thức:
                  </span>{" "}
                  Nộp hồ sơ tại đây hoặc phòng bảo vệ công ty.
                </p>
              </div>

              <div className="mt-auto pt-4 flex flex-wrap gap-2">
                <a
                  href="mailto:info@pavonine.com?subject=Ung%20tuyen%20tai%20Pavonine"
                  className="inline-flex items-center rounded-full border border-emerald-200/40 bg-emerald-200/20 px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-200/30 transition-colors"
                >
                  Gửi CV ngay
                </a>
                <a
                  href="tel:+842543928888"
                  className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  Hotline: 02 546 504 369
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/10 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-xs text-slate-400">
            <span>© {year} Pavonine Vina. All rights reserved.</span>
            <span>
              Built for performance, reliability, and real-time operations.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
