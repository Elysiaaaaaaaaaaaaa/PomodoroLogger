# tasks.json 说明

`tasks.json` 用于给外部程序读取任务维度的数据（项目/列表/卡片及用时），不需要解析 NeDB 原始文件。

## 文件位置

- 开发环境：`./db/tasks.json`
- 生产环境（Windows）：`%APPDATA%/PomodoroLogger/db/tasks.json`

## 更新时机

- 应用启动后会全量导出一次
- 对看板、列表、卡片进行新增、编辑或删除操作后自动重新导出（带防抖）

## 顶层结构

```json
{
  "version": 1,
  "exportedAt": 1714521600000,
  "boards": []
}
```

- `version`: 导出格式版本
- `exportedAt`: 导出时间（毫秒时间戳）
- `boards`: 看板数组

## boards 结构

```json
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
          "spentTimeInHour": {
            "actual": 1.5,
            "estimated": 2
          },
          "sessionIds": ["sess1", "sess2"],
          "createdTime": 1714435200000
        }
      ]
    }
  ]
}
```

关键字段：

- `board.spentHours`: 看板累计耗时（小时）
- `list.cards`: 该列表下的任务卡片
- `card.spentTimeInHour.actual`: 卡片实际耗时（小时）
- `card.spentTimeInHour.estimated`: 卡片预估耗时（小时）
- `card.sessionIds`: 关联番茄钟记录 ID 列表

## 常见读取方式

### 1) 每个项目总任务数 + 总耗时

- 任务数：`sum(board.lists[*].cards.length)`
- 总耗时：优先用 `board.spentHours`

### 2) 每个任务已用时（小时/分钟）

- 来自 `card.spentTimeInHour.actual`
- 可按 `h = floor(actual)`，`m = round((actual - h) * 60)` 转成小时分钟

## 注意事项

- `tasks.json` 是面向任务视图的聚合结果，推荐外部程序优先读取它。
- 不建议直接读取 `cards.nedb` / `lists.nedb` / `kanban.nedb`（内部日志格式）。
- 应用不再生成 `sessions.json`；若需要番茄钟明细，请读 `session.nedb`（NeDB 格式）或使用应用内导出 JSON 功能。
