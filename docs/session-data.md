# 数据导出说明

应用运行时会在数据库目录下自动维护两个 JSON 文件，供外部程序直接读取。

## 文件路径

| 文件 | 内容 |
|---|---|
| `tasks.json` | 看板、列表、任务卡片及其用时（推荐） |
| `sessions.json` | 原始番茄钟记录（底层数据） |

- 开发环境：`./db/tasks.json`、`./db/sessions.json`
- 生产环境（Windows）：`%APPDATA%/PomodoroLogger/db/tasks.json`

## tasks.json — 任务视图（推荐）

适用于"xx项目有xx个任务，已使用了xx小时"这类需求。

### 更新时机

- 应用启动时全量导出一次
- `kanban.nedb`、`cards.nedb`、`lists.nedb` 任一文件变化后 2 秒内重新导出（防抖）

### 数据结构

```
boards[]
  └── _id, name, description, spentHours
  └── lists[]
        └── _id, title
        └── cards[]
              └── _id, title, content
              └── spentTimeInHour.actual   ← 实际使用小时数
              └── spentTimeInHour.estimated ← 估算小时数
              └── sessionIds               ← 关联的番茄钟 ID 列表
              └── createdTime              ← 创建时间（ms 时间戳）
```

### 文件示例

```json
{
  "version": 1,
  "exportedAt": 1714521600000,
  "boards": [
    {
      "_id": "board1",
      "name": "我的项目",
      "description": "",
      "spentHours": 3.5,
      "lists": [
        {
          "_id": "list1",
          "title": "进行中",
          "cards": [
            {
              "_id": "card1",
              "title": "实现登录功能",
              "content": "支持用户名密码登录",
              "spentTimeInHour": { "actual": 1.5, "estimated": 2.0 },
              "sessionIds": ["sess1", "sess2"],
              "createdTime": 1714435200000
            }
          ]
        }
      ]
    }
  ]
}
```

### 读取示例（Node.js）

```js
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./db/tasks.json', 'utf-8'));

for (const board of data.boards) {
  const totalCards = board.lists.reduce((n, l) => n + l.cards.length, 0);
  const h = Math.floor(board.spentHours);
  const m = Math.round((board.spentHours - h) * 60);
  console.log(`[${board.name}] ${totalCards} 个任务，已用 ${h}h${m}m`);

  for (const list of board.lists) {
    for (const card of list.cards) {
      const ah = Math.floor(card.spentTimeInHour.actual);
      const am = Math.round((card.spentTimeInHour.actual - ah) * 60);
      console.log(`  - [${list.title}] ${card.title}：已用 ${ah}h${am}m`);
    }
  }
}
```

### 读取示例（Python）

```python
import json, os
from datetime import timedelta

path = os.path.expandvars(r"%APPDATA%\PomodoroLogger\db\tasks.json")
data = json.load(open(path, encoding="utf-8"))

for board in data["boards"]:
    total_cards = sum(len(l["cards"]) for l in board["lists"])
    spent = timedelta(hours=board["spentHours"])
    print(f"[{board['name']}] {total_cards} 个任务，已用 {spent}")
    for lst in board["lists"]:
        for card in lst["cards"]:
            t = timedelta(hours=card["spentTimeInHour"]["actual"])
            print(f"  [{lst['title']}] {card['title']}：已用 {t}")
```

---

## sessions.json — 原始番茄钟记录

每条记录对应一个完整的番茄钟周期，包含各应用的使用时长明细。

### 更新时机

- 应用启动时
- 每次番茄钟完成（`addSession`）或删除（`removeSession`）后

### 关键字段

- `startTime`: 开始时间（ms 时间戳）
- `spentTimeInHour`: 会话时长（小时）
- `isRotten`: 是否为烂番茄
- `boardId`: 关联的看板 ID
- `apps`: 按应用名聚合的使用明细

---

## 注意事项

- 请勿直接解析 `session.nedb`、`cards.nedb` 等 NeDB 原始文件（行日志格式，含脏数据）
- `tasks.json` 中 `spentHours`（看板级别）与各卡片 `actual` 之和可能有出入，以卡片级数据为准
