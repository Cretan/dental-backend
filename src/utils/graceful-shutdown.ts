const SHUTDOWN_TIMEOUT_MS = 30_000;

/**
 * Registers SIGTERM and SIGINT handlers that gracefully destroy Strapi
 * (closing the HTTP server and database connections) before exiting.
 *
 * A safety timeout forces process.exit(1) if shutdown takes longer
 * than SHUTDOWN_TIMEOUT_MS (30 seconds).
 *
 * Must be called at the end of the bootstrap phase, after all other
 * setup is complete.
 */
export function setupGracefulShutdown(strapi: any): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      strapi.log.warn(`[SHUTDOWN] Duplicate ${signal} received, ignoring`);
      return;
    }
    isShuttingDown = true;

    strapi.log.info(
      `[SHUTDOWN] ${signal} received, starting graceful shutdown...`
    );

    // Force exit timeout — unref so it doesn't keep the event loop alive
    const forceExitTimer = setTimeout(() => {
      strapi.log.error(
        '[SHUTDOWN] Graceful shutdown timed out, forcing exit'
      );
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref();

    try {
      // Destroy Strapi (closes HTTP server + DB connections)
      await strapi.destroy();
      strapi.log.info('[SHUTDOWN] Strapi destroyed successfully');
    } catch (error) {
      strapi.log.error(
        '[SHUTDOWN] Error during shutdown:',
        error instanceof Error ? error.message : String(error)
      );
    }

    clearTimeout(forceExitTimer);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  strapi.log.info('[SHUTDOWN] Graceful shutdown handlers registered');
}
