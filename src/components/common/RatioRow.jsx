import React from "react";

const RatioRow = ({ timeSlots, production, actual, keyName }) => {
  const getRatio = (slot) => {
    const prod = Number(production?.[keyName]?.[slot]) || 0;
    const act = Number(actual?.[keyName]?.[slot]) || 0;

    if (prod === 0) return "-";
    const ratio = (act / prod) * 100;
    return `${ratio.toFixed(1)}%`;
  };

  return (
    <tr className="bg-yellow-100 font-semibold text-yellow-900">
      <td className="border px-4 py-2">Tỉ lệ</td>
      {timeSlots.map((slot) => (
        <td key={slot} className="border px-4 py-2">
          {getRatio(slot)}
        </td>
      ))}
    </tr>
  );
};

export default RatioRow;
