"use client";

import { reportWebVital } from "@/lib/observability/client";
import { useReportWebVitals } from "next/web-vitals";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

// Keep this callback at module scope. Next.js can replay already available
// metrics when the callback identity changes.
const handleWebVitals: ReportWebVitalsCallback = (metric) => {
  reportWebVital(metric);
};

export default function WebVitals() {
  useReportWebVitals(handleWebVitals);
  return null;
}
