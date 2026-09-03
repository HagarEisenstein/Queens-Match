const express = require("express");

function createNotificationsRouter({ authenticate, notificationRepository, realtimeHub, now = () => new Date() }) {
  const router = express.Router();
  router.use(authenticate);

  router.get("/", async (req, res, next) => {
    try {
      res.json(await notificationRepository.listForRecipient(req.user.id));
    } catch (error) { next(error); }
  });

  router.patch("/:id/read", async (req, res, next) => {
    try {
      const result = await notificationRepository.markRead(req.params.id, req.user.id, now());
      if (!result.count) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
      return res.status(204).end();
    } catch (error) { return next(error); }
  });

  router.patch("/:id/action-completed", async (req, res, next) => {
    try {
      const result = await notificationRepository.markActionCompleted(req.params.id, req.user.id, now());
      if (!result.count) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
      return res.status(204).end();
    } catch (error) { return next(error); }
  });

  router.get("/stream", (req, res) => {
    res.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    res.write(": connected\n\n");
    const unsubscribe = realtimeHub.subscribe(req.user.id, res);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25000);
    req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
  });

  return router;
}

module.exports = { createNotificationsRouter };
