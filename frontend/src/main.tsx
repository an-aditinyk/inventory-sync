import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "./components/ui/toaster";
import { App } from "./App";
import { ensureSession } from "./lib/api";
import "./index.css";

// Provision a demo session up front so the first API calls are authenticated.
ensureSession().catch(() => {});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router>
          <App />
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
