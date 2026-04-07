import React from "react";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-0 mt-0 w-full overflow-hidden border-t border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/90 px-4 py-10 text-slate-800 dark:border-transparent dark:from-slate-950 dark:to-slate-950 dark:text-slate-100 md:px-10">
      <div className="pointer-events-none absolute inset-0 opacity-20 dark:opacity-30">
        <div className="absolute -top-24 -left-16 h-56 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-400/20" />
        <div className="absolute -right-20 -bottom-24 h-64 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-400/20" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur-sm md:p-7 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
          <div className="grid items-stretch gap-8 lg:grid-cols-3">
            <div className="h-full">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-600/30 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-800 dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 uppercase dark:bg-emerald-300" />
                CÔNG TY TNHH PAVONINE VINA
              </div>

              <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 uppercase md:text-3xl dark:text-white">
                Pavonine Vina
              </h3>

              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 md:text-[15px] dark:text-slate-300">
                Lots VII-I, VII-2, and part of Lot VII-3, My Xuan B1 - Tien Hung
                Industrial Park, Phu My Ward, Ho Chi Minh City, Vietnam
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 md:text-[15px] dark:text-slate-300">
                MST: 3502305184
              </p>
            </div>

            <div className="h-full">
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Liên hệ
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-600 dark:text-cyan-300">●</span>
                  <span>hr.pavonine@gmail.com</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-600 dark:text-cyan-300">●</span>
                  <span>02546 504 369</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-600 dark:text-cyan-300">●</span>
                  <span>
                    Địa chỉ: CÔNG TY TNHH PAVONINE VINA - KCN Mỹ Xuân B1-Tiến
                    Hùng
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex h-full min-h-[250px] w-full flex-col rounded-xl border border-emerald-600/25 bg-emerald-50/90 p-4 dark:border-emerald-300/30 dark:bg-emerald-300/10">
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-200">
                Góc tuyển dụng
              </h4>
              <p className="mt-2 text-sm font-semibold text-emerald-900 dark:text-emerald-50">
                Chúng tôi đang tìm đồng đội mới cho nhà máy.
              </p>
              <ul className="mt-3 space-y-2 text-lg font-bold uppercase text-red-600 dark:text-red-500">
                <li className="flex items-center gap-2">
                  <span aria-hidden="true">📣</span>
                  <span>100 lao động phổ thông</span>
                </li>
              </ul>
              <ul className="mt-3 space-y-2 text-sm font-bold text-slate-800 uppercase dark:text-stone-50">
                <li>• Phụ cấp</li>
                <ul className="mt-3 ml-4 space-y-2 text-xs font-medium text-slate-700 uppercase dark:text-stone-50">
                  <li>• Phụ cấp chuyên cần: 600,000</li>
                  <li>• Phụ cấp xăng xe: 300,000</li>
                  <li>• Phụ cấp nhà ở: 250,000</li>
                  <li>• Thuở̛ng thâm niên: 100,000/năm</li>
                  <li>• Mừng sinh nhật 300,000</li>
                </ul>
              </ul>

              <div className="mt-4 space-y-1 text-xs text-emerald-900/90 dark:text-emerald-100/90">
                <p>
                  <span className="font-semibold text-emerald-950 dark:text-emerald-50">
                    Lịch phỏng vấn:
                  </span>{" "}
                  Thứ 2 - Thứ 6 ( 7:40 đến 17:00 )
                </p>
                <p>
                  <span className="font-semibold text-emerald-950 dark:text-emerald-50">
                    Địa điểm:
                  </span>{" "}
                  Khu công nghiệp Mỹ Xuân B1
                </p>
                <p>
                  <span className="font-semibold text-emerald-950 dark:text-emerald-50">
                    Hình thức:
                  </span>{" "}
                  Nộp hồ sơ tại đây hoặc phòng bảo vệ công ty.
                </p>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <a
                  href="mailto:info@pavonine.com?subject=Ung%20tuyen%20tai%20Pavonine"
                  className="inline-flex items-center rounded-full border border-emerald-600/35 bg-emerald-600/10 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-600/25 dark:border-emerald-200/40 dark:bg-emerald-200/20 dark:text-emerald-50 dark:hover:bg-emerald-200/30"
                >
                  Gửi CV ngay
                </a>
                <a
                  href="tel:+842543928888"
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-white/25 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                >
                  Hotline: 02 546 504 369
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
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
