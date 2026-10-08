import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

// Logged-set shape (NOT the program-builder's {name,prescription,load} shape) — reps/weight here are
// what was actually performed (or the immediate target for a set about to be done).
const LoggedExerciseSchema = z.object({
  name: z.string().describe('Exercise name in plain, common gym terminology.'),
  // IMPORTANT: this is the app's own "Sets × Reps" field (that's its literal label in the UI, and
  // how parseSets() elsewhere in the app reads it) — NOT a bare rep count. A coach saying "three by
  // twelve" or "three sets of twelve" must become "3x12" here, never just "12" or just "3" alone.
  reps: z.string().describe('The "Sets × Reps" field. Default/most common format: "SxR" like "3x12" - use this whenever a set count AND a rep count were both stated, however phrased ("three by twelve", "three sets of twelve", "three twelve-rep sets", "3x12" are all the SAME thing -> "3x12"). Only use a comma-separated per-set list like "10,8,6" when sets genuinely had DIFFERENT rep counts. Only use a bare number like "12" when truly just ONE set was done/stated with no set count. Empty string if not yet known.'),
  weight: z.string().describe('Weight actually used (or a stated target), as a plain number or comma-separated per-set list like "135,145,155" if it varied by set - this one is NOT combined with an "x", just the number(s). Empty string if not yet known (e.g. bodyweight, or the coach hasn\'t reported it yet).'),
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
- "reps" is a Sets × Reps field, not a bare rep count - see its schema description. Any spoken form of "N sets of M reps" (including "N by M") becomes "NxM". Examples: "bench press three by twelve at one thirty five" -> reps:"3x12", weight:"135". "four sets of eight pull-ups" -> reps:"4x8". "one set of twenty push-ups" -> reps:"20" (bare number is only right here because exactly one set was stated).
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
