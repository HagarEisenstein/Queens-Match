// Built-in list of advice topics a mentor can offer. Mentors pick from this
// list, but may also type their own custom topic (free text) — both are stored
// the same way, as strings in the mentor profile's adviceTopics array.

export const ADVICE_TOPIC_GROUPS = [
  {
    group: "Career Documents",
    topics: ["CV / Resume Review", "LinkedIn Profile Review"],
  },
  {
    group: "Interview Prep",
    topics: [
      "Technical Mock Interviews",
      "HR / Behavioral Mock Interviews",
      "System Design Interviews",
    ],
  },
  {
    group: "Technical Skills",
    topics: ["Code Review & Best Practices", "Portfolio / Personal Project Feedback"],
  },
];

// Flat list of every built-in topic, derived from the groups above.
export const ADVICE_TOPICS = ADVICE_TOPIC_GROUPS.flatMap((g) => g.topics);

// Maps each built-in topic to its group; used to group the Autocomplete
// dropdown. Custom (free-text) topics fall back to the "Custom" group.
const TOPIC_TO_GROUP = Object.fromEntries(
  ADVICE_TOPIC_GROUPS.flatMap((g) => g.topics.map((topic) => [topic, g.group]))
);

export const groupForTopic = (topic) => TOPIC_TO_GROUP[topic] || "Your own topics";

// Max length for any single topic (built-in or custom); mirrored by the
// server-side validator in server/routes/mentors.js.
export const MAX_TOPIC_LENGTH = 100;
