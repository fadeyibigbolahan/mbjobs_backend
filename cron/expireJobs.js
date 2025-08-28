// cron/expireJobs.js
const cron = require("node-cron");
const Job = require("../models/Job");

// Run every day at midnight
const expireOldJobs = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("[CRON] Checking for jobs to expire...");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

    try {
      const result = await Job.updateMany(
        {
          createdAt: { $lte: cutoffDate },
          status: "open",
        },
        { $set: { status: "expired" } }
      );

      console.log(`[CRON] ${result.modifiedCount} jobs marked as expired`);
    } catch (err) {
      console.error("[CRON ERROR] Failed to expire jobs:", err.message);
    }
  });
};

module.exports = expireOldJobs;
