import React, { useEffect } from "react";
import "./SeasonEffect.css";

const snowflakeCount = 50;

function createSnowflake() {
  const snowflake = document.createElement("div");
  snowflake.className = "snowflake";
  snowflake.style.left = `${Math.random() * 100}vw`;
  snowflake.style.animationDuration = `${2 + Math.random() * 3}s`;
  snowflake.style.opacity = Math.random();
  snowflake.style.fontSize = `${12 + Math.random() * 16}px`;
  snowflake.innerText = "❄";
  return snowflake;
}

const SeasonEffect = ({ effect = "snow" }) => {
  useEffect(() => {
    if (effect === "snow") {
      const snowContainer = document.createElement("div");
      snowContainer.className = "snow-container";
      document.body.appendChild(snowContainer);
      for (let i = 0; i < snowflakeCount; i++) {
        snowContainer.appendChild(createSnowflake());
      }
      return () => {
        document.body.removeChild(snowContainer);
      };
    }
    if (effect === "newyear") {
      const newYearDiv = document.createElement("div");
      newYearDiv.className = "newyear-effect";
      newYearDiv.innerHTML = "<span>🎉 Happy New Year! 🎉</span>";
      document.body.appendChild(newYearDiv);
      return () => {
        document.body.removeChild(newYearDiv);
      };
    }
  }, [effect]);

  return null;
};

export default SeasonEffect;
