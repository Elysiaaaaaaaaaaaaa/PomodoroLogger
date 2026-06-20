jest.mock('active-win', () => jest.fn());
jest.mock('child_process', () => ({
    execFile: jest.fn(),
}));

const mockActiveWin = require('active-win') as jest.Mock;
const mockExecFile = require('child_process').execFile as jest.Mock;
const originalPlatform = process.platform;

function loadActiveWinModule(): typeof import('./activeWin') {
    jest.resetModules();
    jest.doMock('active-win', () => mockActiveWin);
    jest.doMock('child_process', () => ({
        execFile: mockExecFile,
    }));
    return require('./activeWin');
}

describe('main/activeWin', () => {
    let warn: jest.SpyInstance;
    let log: jest.SpyInstance;

    beforeEach(() => {
        mockActiveWin.mockReset();
        mockExecFile.mockReset();
        mockExecFile.mockImplementation((_file, _args, _options, callback) => {
            callback(new Error('fallback unavailable'), '', '');
        });
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        log = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
        warn.mockRestore();
        log.mockRestore();
    });

    it('queries the active window even before startup initialization completes', async () => {
        const result = {
            owner: { name: 'Editor', processId: 1, path: 'Editor.exe' },
            title: 'notes',
        };
        mockActiveWin.mockResolvedValue(result);

        const { activeWin } = loadActiveWinModule();

        await expect(activeWin()).resolves.toBe(result);
        expect(mockActiveWin).toHaveBeenCalledWith({ screenRecordingPermission: false });
    });

    it('retries after initialization fails once', async () => {
        const result = {
            owner: { name: 'Browser', processId: 2, path: 'Browser.exe' },
            title: 'docs',
        };
        mockActiveWin.mockRejectedValueOnce(new Error('native module not ready'));
        mockActiveWin.mockResolvedValue(result);

        const { activeWin, initActiveWin } = loadActiveWinModule();
        await initActiveWin();

        await expect(activeWin()).resolves.toBe(result);
        expect(mockActiveWin).toHaveBeenCalledTimes(2);
    });

    it('falls back to a Windows foreground-window query when active-win native deps are missing', async () => {
        Object.defineProperty(process, 'platform', {
            value: 'win32',
        });
        const result = {
            platform: 'windows',
            title: 'notes.txt',
            id: 123,
            owner: {
                name: 'Editor',
                processId: 42,
                path: 'C:\\Tools\\Editor.exe',
            },
            bounds: { x: 10, y: 20, width: 800, height: 600 },
            memoryUsage: 1000,
        };
        mockActiveWin.mockRejectedValue(new Error("Cannot find module 'ffi-napi'"));
        mockExecFile.mockImplementation((_file, _args, _options, callback) => {
            callback(null, JSON.stringify(result), '');
        });

        const { activeWin } = loadActiveWinModule();

        await expect(activeWin()).resolves.toEqual(result);
        expect(mockExecFile).toHaveBeenCalled();
    });

    it('preserves non-ASCII window titles when using the Windows fallback', async () => {
        Object.defineProperty(process, 'platform', {
            value: 'win32',
        });
        const readableTitle = '中文标题 - Microsoft Edge';
        const mojibakeTitle = '���ı��� - Microsoft Edge';
        mockActiveWin.mockRejectedValue(new Error("Cannot find module 'ffi-napi'"));
        mockExecFile.mockImplementation((_file, args, _options, callback) => {
            const script = args[args.length - 1];
            const title = script.includes('[Console]::OutputEncoding')
                ? readableTitle
                : mojibakeTitle;
            callback(
                null,
                JSON.stringify({
                    title,
                    platform: 'windows',
                    id: 123,
                    owner: {
                        name: 'Microsoft Edge',
                        processId: 42,
                        path: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                    },
                    bounds: { x: 10, y: 20, width: 800, height: 600 },
                    memoryUsage: 1000,
                }),
                ''
            );
        });

        const { activeWin } = loadActiveWinModule();

        await expect(activeWin()).resolves.toMatchObject({
            title: readableTitle,
        });
    });
});
