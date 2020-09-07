"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Delay = void 0;
class Delay {
    constructor(ms) {
        this.ms = ms;
        this.started = false;
        this.cancelled = false;
    }
    runAsnyc() {
        if (this.started) {
            throw new Error(`Can't run delay twice!`);
        }
        this.started = true;
        return new Promise((resolve, reject) => {
            if (this.cancelled) {
                return;
            }
            this.reject = reject;
            this.timeout = setTimeout(resolve, this.ms);
        });
    }
    cancel() {
        if (!this.started || this.cancelled) {
            return;
        }
        this.cancelled = true;
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        if (this.reject) {
            this.reject(new Error('Cancelled'));
        }
    }
}
exports.Delay = Delay;
//# sourceMappingURL=async.js.map