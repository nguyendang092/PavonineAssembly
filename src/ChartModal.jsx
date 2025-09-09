import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "react-i18next";

Modal.setAppElement("#root");

const CustomLabel2 = ({ x, y, value }) => (
  <text
    x={x}
    y={y + 20}
    fill="#ef3bf5"
    fontSize={14}
    fontWeight="bold"
    textAnchor="middle"
  >
    {value}
  </text>
);

const CustomLabel1 = ({ x, y, value }) => (
  <text
    x={x}
    y={y - 10}
    fill="#0707f2"
    fontSize={14}
    fontWeight="bold"
    textAnchor="middle"
  >
    {value}
  </text>
);

const ChartModal = ({
  isOpen,
  onClose,
  weekNumber,
  chartData = {},
  totalData = {},
  modelList = [],
  area = "",
  selectedDate = "",
}) => {
  const { t } = useTranslation();
  const [selectedModel, setSelectedModel] = useState("");

  useEffect(() => {
    if (isOpen && modelList.length > 0) {
      setSelectedModel(modelList[0]);
    } else if (!isOpen) {
      setSelectedModel("");
    }
  }, [isOpen, modelList]);

  const modelData = Array.isArray(chartData[selectedModel])
    ? chartData[selectedModel]
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Biểu đồ sản lượng"
      style={{
        content: {
          maxWidth: "1400px",
          margin: "auto",
          height: "750px",
          padding: "20px",
          backgroundColor: "#ffffff",
        },
        overlay: {
          backgroundColor: "rgba(0,0,0,0.8)",
        },
      }}
    >
      <h2 className="text-3xl font-bold mb-4 uppercase text-center">
        {t("chart.title", { week: weekNumber })} - {selectedDate}
      </h2>

      {area && (
        <h3 className="text-xl text-center font-semibold mb-4">
          {t("chart.leader", { area })}
        </h3>
      )}

      <div className="mb-4">
        <label className="font-semibold mr-2 uppercase">
          {t("chart.selectModel")}:
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1"
        >
          {modelList.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {modelData.length > 0 ? (
        <ResponsiveContainer width="100%" height={500}>
          <LineChart
            data={modelData}
            margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
          >
            <CartesianGrid
              strokeDasharray="0"
              stroke="#909091"
              vertical={false}
              horizontal={false}
            />
            <XAxis
              dataKey="label"
              interval={0}
              height={60}
              tick={({ x, y, payload }) => (
                <text
                  x={x}
                  y={y + 20}
                  textAnchor="middle"
                  fontSize={18}
                  fill="#333"
                  fontWeight="bold"
                >
                  {payload.value}
                </text>
              )}
            />
            <YAxis
              yAxisId="left"
              label={{
                value: t("chart.quantity").toUpperCase(),
                angle: -90,
                position: "insideLeft",
                offset: -10,
                fontWeight: "bold",
                fill: "#000000",
                fontFamily: "Arial",
              }}
              tick={({ x, y, payload }) => (
                <text
                  x={x - 35}
                  y={y}
                  fontSize={14}
                  fill="#000000"
                  fontWeight="bold"
                >
                  {payload.value}
                </text>
              )}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 220]}
              label={{
                value: t("chart.completeRate").toUpperCase(),
                angle: 90,
                position: "insideRight",
                offset: -10,
                fontWeight: "bold",
                fill: "#000000",
                fontFamily: "Arial",
              }}
              tick={({ x, y, payload }) => (
                <text
                  x={x + 15}
                  y={y}
                  fontSize={14}
                  fill="#333"
                  fontWeight="bold"
                >
                  {payload.value}
                </text>
              )}
            />
            <Tooltip />
            <Legend
              verticalAlign="top"
              wrapperStyle={{
                paddingBottom: "60px",
                fontSize: "18px",
                fontWeight: "bold",
                textTransform: "uppercase",
              }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="plan"
              stroke="#0707f2"
              strokeWidth={3}
              name={`${t("chart.plan")} (계획)`}
              activeDot={{ r: 6 }}
              label={CustomLabel1}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="actual"
              stroke="#ef3bf5"
              strokeWidth={3}
              name={`${t("chart.actual")} (실적)`}
              activeDot={{ r: 6 }}
              label={CustomLabel2}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-center text-gray-500 italic">{t("chart.noData")}</p>
      )}

      <button
        onClick={onClose}
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        {t("chart.close")}
      </button>
    </Modal>
  );
};

export default ChartModal;
