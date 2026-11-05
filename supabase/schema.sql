-- 智能任务管理系统 数据库初始化脚本
-- 用法：Supabase 控制台 → SQL Editor → New query → 粘贴执行 → Run

-- 1. 建表
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  priority    text        not null default 'medium'
                          check (priority in ('high', 'medium', 'low')),
  completed   boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- 2. 列表按创建时间倒序，加个索引
create index if not exists tasks_created_at_idx
  on public.tasks (created_at desc);

-- 3. 开启行级安全（RLS）
alter table public.tasks enable row level security;

-- 4. 演示用的匿名访问策略（前端只带 anon key，不带用户登录）
--    注意：这意味着任何拿到 anon key 的人都能读写这张表。
--    正式项目应改为登录鉴权后再操作。
drop policy if exists "anon can read tasks"   on public.tasks;
drop policy if exists "anon can insert tasks" on public.tasks;
drop policy if exists "anon can update tasks" on public.tasks;
drop policy if exists "anon can delete tasks" on public.tasks;

create policy "anon can read tasks"
  on public.tasks for select
  to anon
  using (true);

create policy "anon can insert tasks"
  on public.tasks for insert
  to anon
  with check (true);

create policy "anon can update tasks"
  on public.tasks for update
  to anon
  using (true)
  with check (true);

create policy "anon can delete tasks"
  on public.tasks for delete
  to anon
  using (true);
