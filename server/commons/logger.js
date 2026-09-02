function write(level, message, metadata = {}) {
  process.stdout.write(`${JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  })}\n`);
}

module.exports = {
  info: (message, metadata) => write("info", message, metadata),
  warn: (message, metadata) => write("warn", message, metadata),
  error: (message, metadata) => write("error", message, metadata),
};
