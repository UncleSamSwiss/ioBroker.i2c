/**
 * A class representing a delay that can be run asynchronously and cancelled.
 */
export class Delay {
    private started = false;
    private cancelled = false;
    private timeout?: any;

    private reject?: (reason?: any) => void;

    /**
     * Creates a new Delay instance.
     *
     * @param ms The delay duration in milliseconds
     */
    constructor(private ms: number) {}

    /**
     * Runs the delay asynchronously.
     *
     * @returns A promise that resolves after the delay duration
     */
    public runAsnyc(): Promise<void> {
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

    /**
     * Cancels the delay if it is running.
     */
    public cancel(): void {
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

export type PollingCallback = () => Promise<void>;

/**
 * A class that manages polling by repeatedly executing a callback function at specified intervals.
 * Note: the polling will not be exactly on the interval, as the time taken by the callback is included.
 */
export class Polling {
    private enabled = false;
    private delay?: Delay;

    /**
     * Creates a new Polling instance.
     *
     * @param callback The callback function to be executed during polling
     */
    constructor(private callback: PollingCallback) {}

    /**
     * Starts the polling process asynchronously.
     *
     * @param interval The interval between each callback execution in milliseconds
     * @param minInterval The minimum interval to enforce between executions in milliseconds
     * @returns A promise that resolves when polling starts
     */
    async runAsync(interval: number, minInterval?: number): Promise<void> {
        if (this.enabled) {
            return;
        }

        this.enabled = true;
        interval = Math.max(interval, minInterval || 1);
        while (this.enabled) {
            await this.callback();
            try {
                this.delay = new Delay(interval);
                await this.delay.runAsnyc();
            } catch {
                // delay got cancelled, let's break out of the loop
                break;
            }
        }
    }

    /**
     * Stops the polling process.
     */
    stop(): void {
        this.enabled = false;
        this.delay?.cancel();
    }
}
