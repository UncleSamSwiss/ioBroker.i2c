export class Delay {
    private started = false;
    private cancelled = false;
    private timeout?: any;

    private reject?: (reason?: any) => void;

    constructor(private ms: number) {}

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

export class Polling {
    private enabled = false;
    private delay?: Delay;

    constructor(private callback: PollingCallback) {}

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
            } catch (error) {
                // delay got cancelled, let's break out of the loop
                break;
            }
        }
    }

    stop(): void {
        this.enabled = false;
        this.delay?.cancel();
    }
}
