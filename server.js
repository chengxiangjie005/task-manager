require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------
// 数据源：优先使用 Supabase；没配置 .env 时降级为本地演示模式
// ---------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

const supabase = useSupabase ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');
const PRIORITIES = ['高', '中', '低'];

function readLocal() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('读取本地数据失败：', err.message);
    return [];
  }
}

function writeLocal(list) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

// ---------------------------------------------------------------
// 公共校验
// ---------------------------------------------------------------
function normalizeTitle(input) {
  if (typeof input !== 'string') return null;
  const title = input.trim();
  if (!title || title.length > 200) return null;
  return title;
}

function normalizePriority(input) {
  if (input === undefined || input === null || input === '') return '中';
  return PRIORITIES.includes(input) ? input : null;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 健康检查：前端用它显示当前数据源
app.get('/api/health', (req, res) => {
  res.json({ mode: useSupabase ? 'supabase' : 'local' });
});

// 列表（支持按优先级筛选，按创建时间倒序）
app.get('/api/tasks', async (req, res) => {
  const priority = req.query.priority;
  const filter = priority && priority !== 'all' ? priority : null;

  if (filter && !PRIORITIES.includes(filter)) {
    return res.status(400).json({ error: '优先级参数不合法' });
  }

  try {
    if (useSupabase) {
      let query = supabase
        .from('tasks')
        .select('id,title,priority,completed,created_at')
        .order('created_at', { ascending: false });
      if (filter) query = query.eq('priority', filter);

      const { data, error } = await query;
      if (error) throw error;
      return res.json(data ?? []);
    }

    let list = readLocal();
    if (filter) list = list.filter((t) => t.priority === filter);
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return res.json(list);
  } catch (err) {
    console.error('查询任务失败：', err.message);
    return res.status(500).json({ error: '查询任务失败：' + err.message });
  }
});

// 新增
app.post('/api/tasks', async (req, res) => {
  const title = normalizeTitle(req.body?.title);
  const priority = normalizePriority(req.body?.priority);

  if (!title) return res.status(400).json({ error: '任务标题不能为空，且不超过 200 字' });
  if (!priority) return res.status(400).json({ error: '优先级必须是 高 / 中 / 低' });

  try {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ title, priority, completed: false })
        .select('id,title,priority,completed,created_at')
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    const task = {
      id: 'local-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8),
      title,
      priority,
      completed: false,
      created_at: new Date().toISOString(),
    };
    const list = readLocal();
    list.push(task);
    writeLocal(list);
    return res.status(201).json(task);
  } catch (err) {
    console.error('新增任务失败：', err.message);
    return res.status(500).json({ error: '新增任务失败：' + err.message });
  }
});

// 切换完成状态
app.patch('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const completed = req.body?.completed;

  if (typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed 必须是布尔值' });
  }

  try {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('tasks')
        .update({ completed })
        .eq('id', id)
        .select('id,title,priority,completed,created_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: '任务不存在' });
      return res.json(data);
    }

    const list = readLocal();
    const target = list.find((t) => t.id === id);
    if (!target) return res.status(404).json({ error: '任务不存在' });
    target.completed = completed;
    writeLocal(list);
    return res.json(target);
  } catch (err) {
    console.error('更新任务失败：', err.message);
    return res.status(500).json({ error: '更新任务失败：' + err.message });
  }
});

// 删除
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    if (useSupabase) {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      return res.status(204).end();
    }

    const list = readLocal();
    const index = list.findIndex((t) => t.id === id);
    if (index === -1) return res.status(404).json({ error: '任务不存在' });
    list.splice(index, 1);
    writeLocal(list);
    return res.status(204).end();
  } catch (err) {
    console.error('删除任务失败：', err.message);
    return res.status(500).json({ error: '删除任务失败：' + err.message });
  }
});

app.listen(PORT, () => {
  console.log('服务已启动：http://localhost:' + PORT);
  if (useSupabase) {
    console.log('数据源：Supabase（' + SUPABASE_URL + '）');
  } else {
    console.log('数据源：本地演示模式（未检测到 .env 中的 SUPABASE_URL / SUPABASE_ANON_KEY）');
  }
});
