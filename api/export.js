const SB_URL = 'https://oneykldgivaqcrqmrqha.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uZXlrbGRnaXZhcWNycW1ycWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTQ4NTYsImV4cCI6MjA5MzU3MDg1Nn0.Os-XjWM6nJuFOLLQhBUH0DUL40So-jkpXGx9iBequyw';

// Secret key — include as ?key=... in the request URL
const EXPORT_KEY = 'pthub_9r4xw2m8k6j3';

const HEADERS = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
};

function maxWeight(str) {
  if (!str) return 0;
  return Math.max(0, ...String(str).split(/[,\/\s]+/).map(v => parseFloat(v) || 0));
}

async function query(table, params) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}${params}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Supabase error: ${res.status} on ${table}`);
  return res.json();
}

export default async function handler(req, res) {
  // CORS — Chris can fetch from any environment
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  const { id, key } = req.query;

  if (!key || key !== EXPORT_KEY) {
    return res.status(403).json({ error: 'Invalid or missing key' });
  }
  if (!id) {
    return res.status(400).json({ error: 'Missing client id parameter' });
  }

  try {
    const [clientRows, sessions, exerciseLogs, runPrograms] = await Promise.all([
      query('clients', `?id=eq.${id}&select=*`),
      query('sessions', `?client_id=eq.${id}&order=created_at.desc`),
      query('exercise_logs', `?client_id=eq.${id}&order=session_date.desc`),
      query('run_programs', `?select=id,name,weeks`),
    ]);

    if (!clientRows || clientRows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const c = clientRows[0];

    // Attach run program if assigned
    const runProgram = c.run_program_id
      ? runPrograms.find(p => p.id === c.run_program_id) || null
      : null;

    // Build personal records from exercise_logs
    const prs = {};
    exerciseLogs.forEach(log => {
      const w = maxWeight(log.weight);
      if (!prs[log.exercise_name] || w > prs[log.exercise_name].weight) {
        prs[log.exercise_name] = { weight: w, date: log.session_date, reps: log.reps };
      }
    });

    const payload = {
      meta: {
        exported_at: new Date().toISOString(),
        client_id: c.id,
        version: '1',
      },
      profile: {
        name: `${c.first} ${c.last || ''}`.trim(),
        level: c.level || null,
        age: c.age || null,
        schedule: c.schedule || null,
        run_schedule: c.run_schedule || null,
        goals: c.goals || null,
        notes: c.notes || null,
        package: {
          size: c.package_size || 0,
          remaining: c.remaining || 0,
        },
        run_program: runProgram ? {
          name: runProgram.name,
          current_week: c.run_program_week || 1,
          runs_done_this_week: c.run_week_done || 0,
          total_weeks: (runProgram.weeks || []).length,
        } : null,
      },
      program: c.structured_program || null,
      exercise_history: c.exercise_history || {},
      personal_records: prs,
      sessions: sessions.map(s => ({
        date: s.date,
        note: s.note || null,
        exercises: (s.workout || []).map(e => ({
          name: e.name,
          reps: e.reps || null,
          weight: e.weight || null,
        })),
      })),
      exercise_logs: exerciseLogs.map(l => ({
        date: l.session_date,
        exercise: l.exercise_name,
        reps: l.reps || null,
        weight: l.weight ? maxWeight(l.weight) : null,
        day_name: l.day_name || null,
      })),
    };

    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data', detail: err.message });
  }
}
