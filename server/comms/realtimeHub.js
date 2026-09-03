function createRealtimeHub() {
  const clients = new Map();

  function subscribe(userId, response) {
    const userClients = clients.get(userId) || new Set();
    userClients.add(response);
    clients.set(userId, userClients);
    return () => {
      userClients.delete(response);
      if (userClients.size === 0) clients.delete(userId);
    };
  }

  function publish(userId, notification) {
    for (const response of clients.get(userId) || []) {
      response.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
    }
  }

  return { subscribe, publish };
}

module.exports = { createRealtimeHub };
