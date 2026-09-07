const crypto = require("crypto");
const prisma = require("../../commons/db");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

class PrismaAdminInviteRepository {
  constructor(prismaClient = prisma) {
    this.prisma = prismaClient;
  }

  async create({ email, invited_by, expires_at }) {
    const token = crypto.randomBytes(32).toString("hex");
    const invite = await this.prisma.adminInvite.create({
      data: {
        email,
        tokenHash: hashToken(token),
        invitedBy: invited_by,
        expiresAt: expires_at,
      },
    });
    return {
      id: invite.id,
      email: invite.email,
      invited_by: invite.invitedBy,
      expires_at: invite.expiresAt,
      created_at: invite.createdAt,
      token,
    };
  }

  async findActiveByToken(token) {
    const invite = await this.prisma.adminInvite.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!invite) return null;
    if (invite.acceptedAt) return null;
    if (invite.expiresAt <= new Date()) return null;
    return {
      id: invite.id,
      email: invite.email,
      invited_by: invite.invitedBy,
      accepted_by: invite.acceptedBy,
      expires_at: invite.expiresAt,
      accepted_at: invite.acceptedAt,
      created_at: invite.createdAt,
    };
  }

  async markAccepted(id, accepted_by) {
    const invite = await this.prisma.adminInvite.update({
      where: { id },
      data: {
        acceptedBy: accepted_by,
        acceptedAt: new Date(),
      },
    });
    return {
      id: invite.id,
      email: invite.email,
      invited_by: invite.invitedBy,
      accepted_by: invite.acceptedBy,
      expires_at: invite.expiresAt,
      accepted_at: invite.acceptedAt,
      created_at: invite.createdAt,
    };
  }
}

module.exports = { PrismaAdminInviteRepository };
