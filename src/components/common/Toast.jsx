import React, { useEffect } from "react";

const Toast = ({ message, onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 px-4 py-2 rounded shadow-lg text-white bg-gray-900/90 backdrop-blur-md transition-opacity duration-300 animate-fadeIn">
      {message}
    </div>
  );
};

export default Toast;
