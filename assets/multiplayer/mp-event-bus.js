// Run Escape - Multiplayer Pub/Sub Event Bus

export class MpEventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(event, fn) {
        if (!event || typeof fn !== 'function') return () => {};
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        set.add(fn);
        return () => this.off(event, fn);
    }

    off(event, fn) {
        const set = this.listeners.get(event);
        if (!set) return;
        set.delete(fn);
        if (set.size === 0) {
            this.listeners.delete(event);
        }
    }

    emit(event, payload) {
        const set = this.listeners.get(event);
        if (!set || set.size === 0) return;
        for (const fn of Array.from(set)) {
            try {
                fn(payload);
            } catch (err) {
                console.error(`[MpEventBus] Error in listener for "${event}":`, err);
            }
        }
    }

    clear() {
        this.listeners.clear();
    }
}
