import { createContext, useRef, type ReactNode } from "react";
import type { AppRuntime, MockDataSource } from "@cl/application";
import { createMockDataSource } from "../mock/MockDataSource";
import { createAppRuntime } from "./createAppRuntime";

export const AppRuntimeContext = createContext<AppRuntime | null>(null);

export function AppRuntimeProvider({
  children,
  data,
}: {
  children: ReactNode;
  data?: MockDataSource;
}) {
  const ref = useRef<AppRuntime | null>(null);
  if (ref.current === null) {
    ref.current = createAppRuntime({ data: data ?? createMockDataSource() });
  }
  return (
    <AppRuntimeContext.Provider value={ref.current}>
      {children}
    </AppRuntimeContext.Provider>
  );
}
