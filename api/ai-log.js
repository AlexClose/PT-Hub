import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

// Logged-set shape (NOT the program-builder's {name,prescription,load} shape) — reps/weight here are
// what was actually performed (or the immediate target for a set about to be done), matching how the
// rest of the app already stores ad-hoc log rows: a single value when every set was the same ("10" /
// "135"), comma-separated when sets varied ("10,8,6" / "135,145,155").
const LoggedExerciseSchema = z.object({
  name: z.string().describe('Exercise name in plain, common gym terminology.'),
  reps: z.string().describe('Reps actually performed (or the stated target for a set about to start). Single value like "10" if all sets are/were the same; comma-separated like "10,8,6" only if sets genuinely varied. Empty string if not yet known.'),
  weight: z.string().describe('Weight actually used (or a stated target). Same single-value-vs-comma-separated rule as reps. Empty string if not yet known (e.g. bodyweight, or the coach hasn\'t reported it yet).'),
});

const ResultSchema = z.object({
  reply: z.string().describe('An EXTREMELY short glanceable confirmation - a few words, not a sentence (e.g. "Bench logged ✓" or "Added incline DB press"). The coach is actively training someone and is not reading a screen.'),
  exercises: z.array(LoggedExerciseSchema).describe('The FULL cumulative list of every exercise mentioned so far this session, in order - not just what changed in this chunk.'),
});

const SYSTEM_PROMPT = `You are transcribing a personal trainer's spoken recap of a client's workout into a structured log. You'll typically get ONE recording covering several exercises in a row (like a voice memo) - the coach taps record, talks through everything they just did (or are about to do), and taps stop. Sometimes they'll record again later to add more ("we also did calf raises at the end") - that's a fresh recording, not a continuation of the same one.

Rules:
- You'll be given the exercises logged so far (may be empty) plus the new recording's transcript. Merge the new transcript into the existing list and return the FULL updated list - never just the new part.
- A single recording can (and often will) cover MULTIPLE exercises - parse the whole transcript for every exercise mentioned, don't stop after the first one.
- Past tense ("we just did X for 3x10 at 135", "that was 8 reps at 145") = a completed set - fill in reps and weight with what was reported.
- Future/intent tense ("now let's do Y for 3x12", "next up is Z") = an exercise about to start - add it with reps set to the stated target if given, but leave weight EMPTY unless a weight was also mentioned. The coach will report the actual weight after the set, or type it in by hand.
- If the coach corrects or updates something just said ("actually make that 145", "that was 12 not 10"), UPDATE the most recently relevant exercise - don't create a duplicate entry.
- If sets genuinely varied rep/weight, use comma-separated values matching position (e.g. reps "10,8,6" with weight "135,145,155"). Otherwise use one value for both.
- Use plain, common exercise names a coach would recognize.
- Never invent an exercise, rep count, or weight that wasn't actually said. If the transcript doesn't add or change anything (small talk, unrelated speech, unclear audio), just return the list unchanged with a brief reply like "Didn't catch an exercise there."
- Keep "reply" to a handful of words - this is a glance, not a read (e.g. "3 exercises added ✓").`;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI assistant is not configured yet (missing ANTHROPIC_API_KEY on the server).' });
  }

  const { chunk, currentExercises } = req.body || {};
  const text = String(chunk || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Missing chunk' });
  }

  try {
    const client = new Anthropic();

    const systemWithContext = `${SYSTEM_PROMPT}\n\nExercises logged so far (may be empty): ${JSON.stringify(currentExercises || [])}`;

    const response = await client.messages.parse({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: systemWithContext,
      // A one-shot recording of a whole workout can run well past a single sentence.
      messages: [{ role: 'user', content: text.slice(0, 8000) }],
      output_config: { format: zodOutputFormat(ResultSchema, 'workout_log') },
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
