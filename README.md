# 智能任务管理系统（Node.js + Supabase）

一个中文界面的任务管理应用：添加任务、标注优先级、切换完成状态、删除任务、按优先级筛选，列表按创建时间倒序，已完成任务显示删除线。

## 目录结构

```
task-manager/
├─ server.js              # Node.js 后端（Express + Supabase 客户端）
├─ package.json
├─ .env.example           # 环境变量模板，复制为 .env 后填自己的值
├─ .gitignore             # 已忽略 .env，避免密钥进仓库
├─ supabase/
│  └─ schema.sql          # 建表 + 索引 + RLS 策略
├─ public/
│  ├─ index.html          # 页面
│  ├─ styles.css          # 样式
│  └─ app.js              # 前端逻辑（原生 JS，无构建）
└─ data/tasks.json        # 本地演示模式下自动生成的数据文件
```

## 接口设计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/tasks?priority=all\|high\|medium\|low` | 查询任务，按创建时间倒序 |
| POST | `/api/tasks` | 新增任务，body: `{ "title": "...", "priority": "high" }` |
| PATCH | `/api/tasks/:id` | 切换完成状态，body: `{ "completed": true }` |
| DELETE | `/api/tasks/:id` | 删除任务 |
| GET | `/api/health` | 返回当前数据源（supabase / local） |

优先级存的是英文枚举：`high` / `medium` / `low`，界面上显示为 高 / 中 / 低。

## 本地运行

1. 安装依赖：

```bash
npm install
```

2. 不配 Supabase 也能先看到效果（数据存本地 `data/tasks.json`）：

```bash
npm start
```

打开 http://localhost:3000

3. 接上 Supabase：

- 在 [supabase.com](https://supabase.com) 新建项目
- 进入 SQL Editor，把 `supabase/schema.sql` 全文粘贴执行
- 到 Project Settings → API，复制 `Project URL` 和 `anon public` key
- 复制 `.env.example` 为 `.env`，填入这两个值
- 重启 `npm start`，页脚会显示「数据源：Supabase 数据库」

## 几个容易踩的坑

- **`.env` 不要提交到 GitHub**，`.gitignore` 已经忽略它；密钥泄露后要到 Supabase 后台重新生成。
- **RLS 没建策略会报 `new row violates row-level security policy`**：确认 `schema.sql` 里的四条 policy 都执行成功了。
- 表名必须是 `tasks`，字段名必须和 `schema.sql` 一致，否则接口会报列不存在。
- 数据库密码、service_role key 只留在服务端，不要写进前端代码；本项目前端用的就是 anon key，通过后端转发。
