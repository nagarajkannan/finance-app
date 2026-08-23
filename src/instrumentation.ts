/** How often the server looks for schedules whose snapshot is due. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Starts the snapshot scheduler inside the server process, so automatic
 * snapshots do not depend on anybody opening the app.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SNAPSHOT_SCHEDULER === "off") return;

  const { runDueSnapshots } = await import("@/lib/server/snapshots");
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runDueSnapshots();
    } catch (error) {
      console.error("Scheduled snapshot run failed", error);
    } finally {
      running = false;
    }
  };

  void tick();
  setInterval(() => void tick(), CHECK_INTERVAL_MS).unref();
}
