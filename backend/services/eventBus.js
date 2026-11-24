const { EventEmitter } = require('events');

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

function channelForGarden(gardenId) {
  return `garden:${Number(gardenId)}`;
}

function emitEvent(gardenId, event, data = {}) {
  if (!gardenId || !event) return;
  const numericGardenId = Number(gardenId);
  const frame = {
    event,
    data: {
      gardenId: numericGardenId,
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    }
  };
  const channel = channelForGarden(numericGardenId);
  const listeners = emitter.listeners(channel);
  for (const listener of listeners) {
    try {
      listener(frame);
    } catch (err) {
      console.error(`[EventBus] Listener error on ${channel} (${event}):`, err.message);
    }
  }
}

function subscribeGarden(gardenId, handler) {
  const channel = channelForGarden(gardenId);
  emitter.on(channel, handler);
  return () => {
    emitter.off(channel, handler);
  };
}

function unsubscribeGarden(gardenId, handler) {
  emitter.off(channelForGarden(gardenId), handler);
}

function listenerCount(gardenId) {
  return emitter.listenerCount(channelForGarden(gardenId));
}

module.exports = {
  emitEvent,
  emitGardenEvent: emitEvent,
  subscribeGarden,
  unsubscribeGarden,
  listenerCount,
  emitter
};
