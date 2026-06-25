/**
 * Web host entry. Mounts the React app with the shared QueryClient + router.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { createQueryClient } from "@flatspace/shared/lib";
import { DialogProvider, ToastProvider } from "@flatspace/shared/ui";
import { App } from "./App.tsx";
import "./index.css";

const queryClient = createQueryClient();
const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <DialogProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </DialogProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
