const BUILT_IN_ADVICE_TOPICS = Object.freeze([
  "CV / Resume Review",
  "LinkedIn Profile Review",
  "Technical Mock Interviews",
  "HR / Behavioral Mock Interviews",
  "System Design Interviews",
  "Code Review & Best Practices",
  "Portfolio / Personal Project Feedback",
]);

const MENTOR_SEARCH_INTENTS = Object.freeze([
  "find_mentor",
  "clarification_needed",
  "out_of_scope",
]);

const CAREER_STAGES = Object.freeze([
  "student",
  "new_grad",
  "first_job",
  "career_change",
  "junior",
  "mid_level",
  "senior",
  "returning_to_work",
]);

module.exports = {
  BUILT_IN_ADVICE_TOPICS,
  CAREER_STAGES,
  MENTOR_SEARCH_INTENTS,
};

