import { EventEmitter } from "events";
import type { Notification } from "@shared/schema";

export interface NotificationEvent {
  userId: string;
  notification: Notification;
}

// In-process pub/sub for newly-persisted notifications. Single-process only;
// swap for Redis pub/sub if the app is ever scaled horizontally.
class NotificationBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
  }

  publish(event: NotificationEvent): void {
    this.emit("notification", event);
  }
}

export const notificationBus = new NotificationBus();
