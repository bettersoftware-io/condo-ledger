import type { MockDataSource } from "@cl/application";
import { AppRuntimeProvider } from "./runtime/AppRuntimeProvider";
import { AppShell } from "./components/layout/AppShell";
import { ToastProvider } from "./components/common/Toast";
import { createGeneratedDataSource } from "./mock/MockDataSource";

export function App({ data }: { data?: MockDataSource } = {}) {
  return (
    <AppRuntimeProvider data={data ?? createGeneratedDataSource()}>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AppRuntimeProvider>
  );
}
