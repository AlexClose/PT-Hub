import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

// Exercise shape mirrors the app's own {name, prescription, load} program-day format, plus a
// superset_group the client collapses into the app's "SS<n>: " tag convention before handing the
// result to the existing program editor (_parseExForEdit) — this endpoint never touches the DB
// directly, it only proposes a plan the coach reviews/saves through the normal editor.
const ExerciseSchema = z.object({
  name: z.string().describe('Exercise name in plain, common gym terminology (e.g. "Barbell Back Squat", "Dumbbell Bench Press").'),
  prescription: z.string().describe('Sets/reps as the coach said it, e.g. "3x10", "4x8", "3 sets of 12-15".'),
  load: z.string().describe('Weight/load if mentioned, else an empty string.'),
  superset_group: z.number().int().nullable().describe('Same integer for exercises the coach wants paired back-to-back as a superset; null for standalone exercises.'),
});

const ResultSchema = z.object({
  reply: z.string().describe('A short, natural, spoken-style reply to the coach - one or two sentences, like a text message.'),
  exercises: z.array(ExerciseSchema).describe("The FULL current plan for this day, in order, reflecting the coach's latest intent - not just what changed this turn."),
});

const SYSTEM_PROMPT = `You are a knowledgeable strength & conditioning coach's assistant, helping a personal trainer build or adjust ONE day of a client's workout program through natural conversation - often spoken via voice-to-text while driving or actively training someone, so keep replies SHORT (1-2 sentences, casual, like a text).

Rules:
- Always return the FULL current exercise list for the day, not just what changed this turn - the coach may add, remove, reorder, or replace exercises across multiple messages, and you must track cumulative state.
- Use plain, common exercise names a coach would recognize (e.g. "Romanian Deadlift", "Cable Row") - the app has its own fuzzy matching for demo videos, so exact phrasing isn't critical, just keep it recognizable.
- Only group exercises into a superset when the coach explicitly says to pair/superset them - most exercises are standalone (superset_group: null).
- If the coach asks for your opinion or a suggestion ("what do you think", "should I add something"), give a real, specific answer - don't just ask a clarifying question back. Default to a sensible, confident suggestion.
- If something's ambiguous, make a reasonable coaching judgment call rather than stopping to ask - they can always correct you next message.
- "prescription" is free text exactly as a coach would say it, e.g. "3x10", "4x8".`;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI assistant is not configured yet (missing ANTHROPIC_API_KEY on the server).' });
  }

  const { dayName, currentExercises, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  try {
    const client = new Anthropic();

    const systemWithContext = `${SYSTEM_PROMPT}\n\nDay name: ${dayName || 'Untitled'}\nCurrent plan JSON (may be an empty array if nothing's been added yet): ${JSON.stringify(currentExercises || [])}`;

    // Keep the request bounded - a building session is a short back-and-forth, not a long chat.
    const apiMessages = messages.slice(-40).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 4000),
    }));

    const response = await client.messages.parse({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: systemWithContext,
      messages: apiMessages,
      output_config: { format: zodOutputFormat(ResultSchema, 'workout_plan') },
    });

    if (!response.parsed_output) {
      return res.status(502).json({ error: 'AI response could not be parsed' });
    }

    res.status(200).json(response.parsed_output);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI request failed', detail: err.message });
  }
}
