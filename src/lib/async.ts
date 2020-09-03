export class Delay {
    private started = false;
    private cancelled = false;
    private timeout?: NodeJS.Timeout;

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
