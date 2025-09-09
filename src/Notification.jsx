import React, { useState, useEffect } from "react";
import "./animations.css"; // import CSS animation

// Notification component
const Notification = ({ message, type = "info", onClose }) => {
  const [hide, setHide] = useState(false);

  // 3s sau tự ẩn animation rồi call onClose
  useEffect(() => {
    const timer1 = setTimeout(() => setHide(true), 2700);
    const timer2 = setTimeout(() => onClose(), 3000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onClose]);

  return (
    <div
      className={`notification ${type} ${hide ? "hide" : ""}`}
      onClick={() => {
        setHide(true);
        setTimeout(onClose, 300);
      }}
      role="alert"
      aria-live="assertive"
    >
      {message}
    </div>
  );
};

export default Notification;
