const { aggregateOutcome } = require("../engagement/aggregateOutcome");
const {
  createPrismaFeedbackRepository,
} = require("../engagement/repositories/prismaFeedbackRepository");
const {
  createPrismaOutcomeRepository,
} = require("../engagement/repositories/prismaOutcomeRepository");
const {
  MEETING_STATUS,
} = require("../modules/scheduling/meetingStateMachine");

const ACTIVE_PENDING_STATUSES = new Set([
  MEETING_STATUS.PENDING_MENTOR_TIMES,
  MEETING_STATUS.PENDING_MENTEE_SELECTION,
]);

function isCurrentlyActive(meeting, nowMs) {
  if (ACTIVE_PENDING_STATUSES.has(meeting.status)) return true;
  if (meeting.status !== MEETING_STATUS.SCHEDULED) return false;
  if (!meeting.scheduledTime) return true;

  const scheduledTime = new Date(meeting.scheduledTime).getTime();
  return !Number.isFinite(scheduledTime) || scheduledTime >= nowMs;
}

function groupByMeeting(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const existing = grouped.get(row.meetingId);
    if (existing) existing.push(row);
    else grouped.set(row.meetingId, [row]);
  }
  return grouped;
}

function timestamp(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function createTopicSet(adviceTopics) {
  if (!Array.isArray(adviceTopics)) return new Set();
  return new Set(adviceTopics.filter((topic) => typeof topic === "string"));
}

function countMatchingTopics(mentor, selectedTopics) {
  if (!Array.isArray(mentor.adviceTopics) || selectedTopics.size === 0) {
    return 0;
  }

  const mentorTopics = new Set(mentor.adviceTopics);
  let matchCount = 0;
  for (const topic of selectedTopics) {
    if (mentorTopics.has(topic)) matchCount += 1;
  }
  return matchCount;
}

function rankMentorsByTopicRelevance(mentors, adviceTopics) {
  if (!Array.isArray(mentors) || mentors.length < 2) return mentors;

  const selectedTopics = createTopicSet(adviceTopics);
  if (selectedTopics.size === 0) return mentors;

  return mentors
    .map((mentor, originalIndex) => ({
      mentor,
      originalIndex,
      topicRelevance: countMatchingTopics(mentor, selectedTopics),
    }))
    .sort(
      (left, right) =>
        right.topicRelevance - left.topicRelevance ||
        left.originalIndex - right.originalIndex
    )
    .map(({ mentor }) => mentor);
}

function scoreMetrics(metrics) {
  // Smoothing keeps one early success or five-star review from overwhelming
  // mentors with a longer track record, while still giving new mentors a fair
  // neutral starting point.
  const successRate = (metrics.completed + 1) / (metrics.resolved + 2);
  const feedbackQuality =
    (metrics.ratingTotal + 6) / (5 * (metrics.ratingCount + 2));
  const ghostRate = metrics.ghosted / Math.max(metrics.resolved, 1);
  const offeredCapacity = Math.max(metrics.meetingsOffered, 1);
  const remainingRatio = Math.max(
    0,
    Math.min(1, (offeredCapacity - metrics.activeLoad) / offeredCapacity)
  );

  return Math.round(
    1_000_000 *
      (0.5 * successRate +
        0.3 * feedbackQuality +
        0.2 * remainingRatio -
        0.15 * ghostRate)
  );
}

function compareRanked(left, right) {
  return (
    right.topicRelevance - left.topicRelevance ||
    right.score - left.score ||
    right.metrics.completed - left.metrics.completed ||
    right.metrics.ratingCount - left.metrics.ratingCount ||
    timestamp(right.mentor.updatedAt) - timestamp(left.mentor.updatedAt) ||
    String(left.mentor.id).localeCompare(String(right.mentor.id))
  );
}

function createMetrics(mentor) {
  return {
    completed: 0,
    resolved: 0,
    ghosted: 0,
    ratingTotal: 0,
    ratingCount: 0,
    activeLoad: 0,
    meetingsOffered: mentor.meetingsOffered,
  };
}

function aggregateMeeting(outcomesByMeeting, meetingId) {
  const meetingOutcomes = outcomesByMeeting.get(meetingId) || [];
  return aggregateOutcome({
    menteeOutcome:
      meetingOutcomes.find((outcome) => outcome.role === "mentee") || null,
    mentorOutcome:
      meetingOutcomes.find((outcome) => outcome.role === "mentor") || null,
  });
}

function recordOutcome(metrics, aggregation) {
  if (aggregation.status === "completed") {
    metrics.completed += 1;
    metrics.resolved += 1;
  } else if (aggregation.status === "not_completed") {
    metrics.resolved += 1;
  }

  if (aggregation.mentorGhosted && aggregation.status !== "admin_review") {
    metrics.ghosted += 1;
  }
}

function recordMenteeFeedback(metrics, meeting, meetingFeedbacks) {
  const menteeFeedback = meetingFeedbacks.find(
    (feedback) => feedback.submittedBy === meeting.menteeId
  );
  if (
    !menteeFeedback ||
    !Number.isInteger(menteeFeedback.rating) ||
    menteeFeedback.rating < 1 ||
    menteeFeedback.rating > 5
  ) {
    return;
  }

  metrics.ratingTotal += menteeFeedback.rating;
  metrics.ratingCount += 1;
}

function collectMetrics({
  mentors,
  meetings,
  outcomesByMeeting,
  feedbacksByMeeting,
  nowMs,
}) {
  const metricsByMentor = new Map(
    mentors.map((mentor) => [mentor.userId, createMetrics(mentor)])
  );

  for (const meeting of meetings) {
    const metrics = metricsByMentor.get(meeting.mentorId);
    if (!metrics) continue;
    if (isCurrentlyActive(meeting, nowMs)) metrics.activeLoad += 1;

    const aggregation = aggregateMeeting(outcomesByMeeting, meeting.id);
    recordOutcome(metrics, aggregation);
    if (aggregation.status === "completed") {
      recordMenteeFeedback(
        metrics,
        meeting,
        feedbacksByMeeting.get(meeting.id) || []
      );
    }
  }

  return metricsByMentor;
}

async function loadEngagementHistory(prismaClient, mentorUserIds) {
  const meetings = await prismaClient.meeting.findMany({
    where: { mentorId: { in: mentorUserIds } },
    select: {
      id: true,
      mentorId: true,
      menteeId: true,
      status: true,
      scheduledTime: true,
    },
  });
  if (meetings.length === 0) return { meetings, outcomes: [], feedbacks: [] };

  const meetingIds = meetings.map((meeting) => meeting.id);
  const outcomeRepository = createPrismaOutcomeRepository(prismaClient);
  const feedbackRepository = createPrismaFeedbackRepository(prismaClient);
  const [outcomes, feedbacks] = await Promise.all([
    outcomeRepository.findByMeetingIds(meetingIds),
    feedbackRepository.findByMeetingIds(meetingIds),
  ]);

  return { meetings, outcomes, feedbacks };
}

async function rankMentorsByEngagement(
  mentors,
  { prismaClient, adviceTopics = [], now = () => new Date() } = {}
) {
  if (!Array.isArray(mentors) || mentors.length < 2) return mentors;
  if (!prismaClient) {
    throw new TypeError("prismaClient is required to rank mentors");
  }

  const selectedTopics = createTopicSet(adviceTopics);
  const topicRankedMentors = rankMentorsByTopicRelevance(
    mentors,
    adviceTopics
  );

  const mentorUserIds = Array.from(
    new Set(mentors.map((mentor) => mentor.userId).filter(Boolean))
  );
  if (mentorUserIds.length === 0) return topicRankedMentors;

  const { meetings, outcomes, feedbacks } = await loadEngagementHistory(
    prismaClient,
    mentorUserIds
  );
  if (meetings.length === 0) return topicRankedMentors;

  const outcomesByMeeting = groupByMeeting(outcomes);
  const feedbacksByMeeting = groupByMeeting(feedbacks);
  const metricsByMentor = collectMetrics({
    mentors,
    meetings,
    outcomesByMeeting,
    feedbacksByMeeting,
    nowMs: timestamp(now()),
  });

  return mentors
    .map((mentor) => {
      const metrics =
        metricsByMentor.get(mentor.userId) || createMetrics(mentor);
      return {
        mentor,
        metrics,
        score: scoreMetrics(metrics),
        topicRelevance: countMatchingTopics(mentor, selectedTopics),
      };
    })
    .sort(compareRanked)
    .map(({ mentor }) => mentor);
}

module.exports = {
  rankMentorsByEngagement,
  rankMentorsByTopicRelevance,
};
