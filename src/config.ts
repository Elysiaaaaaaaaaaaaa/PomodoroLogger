/* istanbul ignore file */
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import shortid from 'shortid';

const appdataDir =
    process.env.APPDATA ||
    (process.platform === 'darwin'
        ? process.env.HOME + '/Library/Preferences'
        : process.env.HOME + '/.local/share');

/** Fallback when not running from a packaged app (development / unpacked `electron .`). */
const fallbackUserDataDir = join(appdataDir, 'PomodoroLogger');

/**
 * Packaged app: persist under the install/root folder (writable if install path is writable).
 * Uses `resourcesPath` so main, renderer and Web Workers resolve the same path without ipc.
 *
 * macOS: `*.app/Contents/Resources` → go up two levels to the `.app` folder.
 */
function packagedBaseBesideInstall(): string {
    const resourcesPath = process.resourcesPath;
    if (resourcesPath) {
        const installRoot =
            process.platform === 'darwin'
                ? dirname(dirname(resourcesPath))
                : dirname(resourcesPath);
        return join(installRoot, 'PomodoroLogger');
    }
    try {
        // Fallback if `resourcesPath` is missing but we're still packaged.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { app } = require('electron') as typeof import('electron');
        if (app?.isPackaged) {
            return join(dirname(app.getPath('exe')), 'PomodoroLogger');
        }
    } catch {
        /* not Electron */
    }

    return fallbackUserDataDir;
}

export const baseDir =
    process.env.NODE_ENV === 'production' ? packagedBaseBesideInstall() : fallbackUserDataDir;
if (!existsSync(baseDir)) {
    mkdirSync(baseDir);
}

const dbDir = process.env.NODE_ENV !== 'test' ? 'db' : '__test__db';
const dbBkDir = process.env.NODE_ENV !== 'test' ? 'db-bk' : '__test__db-bk';
const scDir = process.env.NODE_ENV !== 'test' ? 'screenshots' : '__test__screenshots';
export const dbBaseDir = process.env.NODE_ENV === 'production' ? join(baseDir, dbDir) : dbDir;
export const dbBkBaseDir = process.env.NODE_ENV === 'production' ? join(baseDir, dbBkDir) : dbBkDir;
export const screenshotDir = process.env.NODE_ENV === 'production' ? join(baseDir, scDir) : scDir;

if (!existsSync(dbBaseDir)) {
    mkdirSync(dbBaseDir);
}

if (!existsSync(screenshotDir)) {
    mkdirSync(screenshotDir);
}

export const dbPaths = {
    projectDB: join(dbBaseDir, 'projects.nedb'),
    sessionDB: join(dbBaseDir, 'session.nedb'),
    settingDB: join(dbBaseDir, 'setting.nedb'),
    kanbanDB: join(dbBaseDir, 'kanban.nedb'),
    cardsDB: join(dbBaseDir, 'cards.nedb'),
    listsDB: join(dbBaseDir, 'lists.nedb'),
    moveDB: join(dbBaseDir, 'moveCard.nedb'),
};

if (process.env.NODE_ENV === 'test') {
    for (const key in dbPaths) {
        // @ts-ignore
        dbPaths[key] = `${dbPaths[key]}${shortid.generate()}`;
    }
}

let asarDirName;
let dir = __dirname;
let oldDir = undefined;
while (!dir.endsWith('.asar')) {
    if (oldDir === dir) {
        break;
    }

    oldDir = dir;
    dir = dirname(dir);
}

if (dir.endsWith('.asar')) {
    asarDirName = dirname(dir);
}

export const env = {
    electronAsarDir: asarDirName ? join(asarDirName, 'electron.asar') : undefined,
    appAsarDir: asarDirName ? join(asarDirName, 'app.asar') : undefined,
};

export const modelPath = {
    knnPath: join(dbBaseDir, 'modelKnn.json'),
};

export const DEBUG_TIME_SCALE = 120;
export const __DEV__ = process.env.NODE_ENV === 'development';
