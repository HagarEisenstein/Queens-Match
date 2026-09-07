const express = require("express");
const { AppError } = require("../middleware/errors");

function createNotificationsRouter({
  authenticate,
  notificationRepository,
  realtimeHub,
  userRepository,
  now = () => new Date(),
}) {
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

  router.post("/:id/accept-admin", async (req, res, next) => {
    try {
      const notification = await notificationRepository.findAdminInviteForRecipient(
        req.params.id,
        req.user.id
      );
      if (!notification) {
        throw new AppError(404, "NOT_FOUND", "Notification not found.");
      }
      if (notification.status !== "pending") {
        throw new AppError(
          409,
          "INVITE_ALREADY_RESOLVED",
          "This admin invitation has already been responded to."
        );
      }

      const user = await userRepository.findPublicById(req.user.id);
      if (!user) {
        throw new AppError(404, "USER_NOT_FOUND", "User not found.");
      }

      const roles = [...new Set([...(user.roles || []), "admin"])];
      const updatedUser = await userRepository.updateRoles(req.user.id, roles);
      await notificationRepository.updateAdminInviteStatus(
        req.params.id,
        req.user.id,
        "accepted",
        now()
      );

      return res.json({ notificationId: req.params.id, status: "accepted", user: updatedUser });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:id/decline-admin", async (req, res, next) => {
    try {
      const notification = await notificationRepository.findAdminInviteForRecipient(
        req.params.id,
        req.user.id
      );
      if (!notification) {
        throw new AppError(404, "NOT_FOUND", "Notification not found.");
      }
      if (notification.status !== "pending") {
        throw new AppError(
          409,
          "INVITE_ALREADY_RESOLVED",
          "This admin invitation has already been responded to."
        );
      }

      await notificationRepository.updateAdminInviteStatus(
        req.params.id,
        req.user.id,
        "declined",
        now()
      );

      return res.json({ notificationId: req.params.id, status: "declined" });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createNotificationsRouter };
