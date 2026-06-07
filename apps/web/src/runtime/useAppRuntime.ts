import { useContext } from "react";
import { AppRuntimeContext } from "./AppRuntimeProvider";
import type { AppRuntime } from "@cl/application";

export function useAppRuntime(): AppRuntime {
  const rt = useContext(AppRuntimeContext);
  if (!rt) throw new Error("useAppRuntime must be used within <AppRuntimeProvider>");
  return rt;
}
