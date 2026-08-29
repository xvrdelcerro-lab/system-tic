'use client';

type Listener = (...args: any[]) => void;

class SimpleEventEmitter {
  private events: Record<string, Listener[]> = {};

  on(eventName: string, listener: Listener): void {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(listener);
  }

  off(eventName: string, listener: Listener): void {
    if (!this.events[eventName]) {
      return;
    }
    this.events[eventName] = this.events[eventName].filter(l => l !== listener);
  }

  emit(eventName: string, ...args: any[]): void {
    if (this.events[eventName]) {
        this.events[eventName].forEach(listener => listener(...args));
    }
  }
}

export const errorEmitter = new SimpleEventEmitter();
