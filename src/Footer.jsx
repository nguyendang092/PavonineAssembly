import React from "react";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer
      className="w-full text-gray-900 px-4 md:px-10 py-4 relative z-0"
      style={{ backgroundColor: "#eef4ff", marginTop: 0 }}
    >
      <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-[1fr,auto,auto] items-start">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-gray-900">
            Pavonine Vina
          </h3>
          <p className="text-sm text-gray-700 mt-2 leading-relaxed">
            Lots VII-I, VII-2, and part of Lot VII-3, My Xuan B1 - Tien Hung
            Industrial Park, Phu My Ward, Ho Chi Minh City, Vietnam
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase text-gray-800">
            Liên hệ
          </h4>
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            <li>Email: info@pavonine.com</li>
            <li>Phone: +84 (0) 254 392 8888</li>
            <li>Fax: +84 (0) 254 392 8666</li>
          </ul>
        </div>
        <div className="text-right ml-auto">
          <h4 className="text-sm font-semibold uppercase text-gray-800">
            Truy cập nhanh
          </h4>
          <div className="mt-3 flex flex-wrap justify-end gap-2 text-sm">
            <span className="px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-800">
              Sản xuất
            </span>
            <span className="px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-800">
              Chất lượng
            </span>
            <span className="px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-800">
              Nhân sự
            </span>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 border-t border-gray-200 pt-4 flex flex-col md:flex-row items-center justify-between text-xs text-gray-600">
        <span>© {year} Pavonine Vina. All rights reserved.</span>
        <span className="mt-2 md:mt-0">
          Built for performance & reliability.
        </span>
      </div>
    </footer>
  );
};

export default Footer;
