import { watch, writeFile } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { dbBaseDir, dbPaths } from '../config';
import { AsyncDB } from '../utils/dbHelper';
import { DBs, loadDBs } from './db';
import type { Card, KanbanBoard, List } from '../renderer/components/Kanban/type';

const tasksExportPath = join(dbBaseDir, 'tasks.json');

type CardExport = {
    _id: string;
    title: string;
    content: string;
    spentTimeInHour: { actual: number; estimated: number };
    sessionIds: string[];
    createdTime?: number;
};

type ListExport = {
    _id: string;
    title: string;
    cards: CardExport[];
};

type BoardExport = {
    _id: string;
    name: string;
    description: string;
    spentHours: number;
    lists: ListExport[];
};

type TasksExport = {
    version: number;
    exportedAt: number;
    boards: BoardExport[];
};

export async function exportTasks() {
    await loadDBs();
    const boards = (await new AsyncDB(DBs.kanbanDB).find({}, {})) as KanbanBoard[];
    const allLists = (await new AsyncDB(DBs.listsDB).find({}, {})) as List[];
    const allCards = (await new AsyncDB(DBs.cardsDB).find({}, {})) as Card[];

    const listMap = new Map(allLists.map((l) => [l._id, l]));
    const cardMap = new Map(allCards.map((c) => [c._id, c]));

    const boardExports: BoardExport[] = boards.map((board) => ({
        _id: board._id,
        name: board.name,
        description: board.description,
        spentHours: board.spentHours,
        lists: board.lists
            .map((listId) => {
                const list = listMap.get(listId);
                if (!list) return null;
                return {
                    _id: list._id,
                    title: list.title,
                    cards: list.cards
                        .map((cardId) => {
                            const card = cardMap.get(cardId);
                            if (!card) return null;
                            return {
                                _id: card._id,
                                title: card.title,
                                content: card.content,
                                spentTimeInHour: card.spentTimeInHour,
                                sessionIds: card.sessionIds,
                                createdTime: card.createdTime,
                            } as CardExport;
                        })
                        .filter((c): c is CardExport => c !== null),
                } as ListExport;
            })
            .filter((l): l is ListExport => l !== null),
    }));

    const data: TasksExport = {
        version: 1,
        exportedAt: Date.now(),
        boards: boardExports,
    };
    await promisify(writeFile)(tasksExportPath, JSON.stringify(data, null, 2), {
        encoding: 'utf-8',
    });
}

export function getTasksExportPath() {
    return tasksExportPath;
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleTasksExport() {
    if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        exportTasks().catch((err) => console.error('failed to sync tasks', err));
    }, 2000);
}

export function watchTaskFiles() {
    const filesToWatch = [dbPaths.kanbanDB, dbPaths.cardsDB, dbPaths.listsDB];
    for (const filePath of filesToWatch) {
        watch(filePath, () => scheduleTasksExport());
    }
}
