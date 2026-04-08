import React, { createContext, useContext, useState } from "react";
import LoadingBlock from "@/components/ui/LoadingBlock";

const LoadingContext = createContext();

export const useLoading = () => useContext(LoadingContext);

export const LoadingProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      {loading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] dark:bg-slate-950/85">
          <LoadingBlock />
        </div>
      )}
      {children}
    </LoadingContext.Provider>
  );
};
