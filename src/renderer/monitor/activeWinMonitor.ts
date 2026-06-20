import type { BaseResult } from 'active-win';
import { getScreen } from './screenshot';
export type ActiveWinListener = (result?: BaseResult, screenshot?: string) => void;
export class Monitor {
    timer?: any;
    screenshotTimer?: number;
    intervalTimeout: number;
    listener: ActiveWinListener;
    screenshotInterval: number | undefined;
    shouldTakeScreenshot: boolean = false;
    private missingActiveWinCount: number = 0;
    constructor(
        listener: ActiveWinListener,
        interval: number = 5000,
        screenshotInterval: number | undefined = undefined
    ) {
        this.timer = undefined;
        this.intervalTimeout = interval;
        this.listener = listener;
        this.screenshotInterval = screenshotInterval;
    }

    get isRunning() {
        return !!this.timer;
    }

    start = () => {
        if (this.timer) {
            return;
        }

        this.timer = setInterval(this.watch, this.intervalTimeout);
        if (this.screenshotInterval) {
            this.screenshotTimer = window.setInterval(() => {
                this.shouldTakeScreenshot = true;
            }, this.screenshotInterval);
        }

        this.watch();
    };

    watch = async () => {
        let data: BaseResult | undefined;
        try {
            data = await window.api.activeWin();
        } catch (e) {
            console.warn('Cannot read active window.', e);
        }

        if (!data) {
            this.missingActiveWinCount += 1;
            if (this.missingActiveWinCount === 1 || this.missingActiveWinCount % 60 === 0) {
                console.warn('Active window data is unavailable; app usage will not be recorded.');
            }
            return;
        }

        this.missingActiveWinCount = 0;
        if (this.shouldTakeScreenshot) {
            this.shouldTakeScreenshot = false;
            try {
                const screenshot = await getScreen(500);
                this.listener(data, screenshot);
                return;
            } catch (e) {
                console.warn('Cannot take screenshot; app usage will still be recorded.', e);
            }
        }

        try {
            this.listener(data);
        } catch (e) {
            console.error(e);
        }
    };

    stop = () => {
        clearInterval(this.timer);
        if (this.screenshotTimer != null) {
            clearInterval(this.screenshotTimer);
        }
        this.timer = undefined;
    };
}
