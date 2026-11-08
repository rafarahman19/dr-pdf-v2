"use client";

import React, { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { AppSettingsProvider } from "@/hooks/use-app-settings";

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore registration failure in restricted environments
      });
    }
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user">
        <AppSettingsProvider>
          <ServiceWorkerRegistrar />
          {children}
        </AppSettingsProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
