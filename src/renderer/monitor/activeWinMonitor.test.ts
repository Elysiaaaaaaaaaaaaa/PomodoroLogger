jest.mock('./screenshot', () => ({
    getScreen: jest.fn(),
}));

import { Monitor } from './activeWinMonitor';
import { getScreen } from './screenshot';

const mockGetScreen = getScreen as jest.Mock;

function createResult(appName: string) {
    return {
        title: appName,
        bounds: { height: 100, width: 100, x: 0, y: 0 },
        id: 123,
        memoryUsage: 100,
        owner: {
            name: appName,
            path: `/path/to/${appName}.exe`,
            processId: 123,
        },
    };
}

describe('monitor/activeWinMonitor', () => {
    let warn: jest.SpyInstance;

    beforeEach(() => {
        mockGetScreen.mockReset();
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        (window as any).api = {
            activeWin: jest.fn(),
        };
    });

    afterEach(() => {
        warn.mockRestore();
    });

    it('still notifies the listener when screenshot capture fails', async () => {
        const result = createResult('Editor');
        (window.api.activeWin as jest.Mock).mockResolvedValue(result);
        mockGetScreen.mockRejectedValue(new Error('screenshot unavailable'));
        const listener = jest.fn();
        const monitor = new Monitor(listener);
        monitor.shouldTakeScreenshot = true;

        await monitor.watch();

        expect(listener).toHaveBeenCalledWith(result);
    });
});
