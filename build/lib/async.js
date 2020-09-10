"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Polling = exports.Delay = void 0;
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
class Polling {
    constructor(callback) {
        this.callback = callback;
        this.enabled = false;
    }
    runAsync(interval, minInterval) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.enabled) {
                return;
            }
            this.enabled = true;
            interval = Math.max(interval, minInterval || 1);
            while (this.enabled) {
                yield this.callback();
                try {
                    this.delay = new Delay(interval);
                    yield this.delay.runAsnyc();
                }
                catch (error) {
                    // delay got cancelled, let's break out of the loop
                    break;
                }
            }
        });
    }
    stop() {
        var _a;
        this.enabled = false;
        (_a = this.delay) === null || _a === void 0 ? void 0 : _a.cancel();
    }
}
exports.Polling = Polling;
//# sourceMappingURL=async.js.map