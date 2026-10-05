if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  // Keep the monitoring SDK out of the initial bundle when it is unconfigured.
  void import("@/src/lib/monitoring/client").then(({ initializeClientMonitoring }) => initializeClientMonitoring()).catch(() => undefined);
}
