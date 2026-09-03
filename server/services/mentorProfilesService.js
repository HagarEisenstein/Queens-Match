const prisma = require("../commons/db");

const userSelect = {
  id: true,
  username: true,
  fullName: true,
  photoUrl: true,
  job: true,
  workplace: true,
  yearsExperience: true,
  githubUrl: true,
  linkedinUrl: true,
};

const profileInclude = {
  user: { select: userSelect },
};

async function getMentors() {
  return prisma.mentorProfile.findMany({
    where: { user: { roles: { has: "mentor" } } },
    include: profileInclude,
    orderBy: { updatedAt: "desc" },
  });
}

async function getMentorById(id) {
  return prisma.mentorProfile.findFirst({
    where: { id, user: { roles: { has: "mentor" } } },
    include: profileInclude,
  });
}

async function getMentorByUserId(userId) {
  return prisma.mentorProfile.findUnique({
    where: { userId },
    include: profileInclude,
  });
}

async function upsertMentorProfile(userId, data) {
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.code = "NOT_FOUND";
      throw error;
    }

    await transaction.user.update({
      where: { id: userId },
      data: { roles: Array.from(new Set([...user.roles, "mentor"])) },
    });

    return transaction.mentorProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      include: profileInclude,
    });
  });
}

module.exports = {
  getMentors,
  getMentorById,
  getMentorByUserId,
  upsertMentorProfile,
};
