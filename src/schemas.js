/** Request validation (zod). Any failure becomes 400 VALIDATION_FAILED. */
const { z } = require('zod');
const { AppError } = require('./errors');

const questionIn = z
  .object({
    text: z.string().min(1).max(500),
    type: z.enum(['multiple_choice', 'true_false']),
    choices: z.array(z.string().min(1).max(120)),
    correct_index: z.number().int(),
    time_limit_sec: z.number().int().min(5).max(60).default(20),
  })
  .superRefine((q, ctx) => {
    const n = q.choices.length;
    let message = null;
    if (q.type === 'multiple_choice' && !(n >= 2 && n <= 4)) message = 'multiple_choice needs 2 to 4 choices';
    else if (q.type === 'true_false' && n !== 2) message = 'true_false needs exactly 2 choices';
    else if (!(q.correct_index >= 0 && q.correct_index < n)) message = 'correct_index must point to one of the choices';
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  });

const questionSetIn = z.object({
  title: z.string().min(3).max(80),
  description: z.string().max(255).nullable().optional(),
  subject: z.string().max(50).nullable().optional(),
  grade_level: z.string().max(50).nullable().optional(),
  questions: z.array(questionIn).min(1).max(50),
});

const loginRequest = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});

const sessionCreate = z.object({
  question_set_id: z.number().int(),
  duration_sec: z.number().int().min(30).max(3600).default(300),
  starting_lives: z.number().int().min(1).max(10).default(3),
});

const sessionPatch = z.object({
  status: z.enum(['playing', 'ended']),
});

const joinRequest = z.object({
  nickname: z.string().transform((v) => v.trim()).pipe(
    z.string().min(2, 'nickname must be 2 to 20 characters').max(20, 'nickname must be 2 to 20 characters')
  ),
});

const answerRequest = z.object({
  question_id: z.number().int(),
  choice_index: z.number().int().min(0).max(3),
});

const chestRequest = z.object({
  chest_offer_id: z.number().int(),
  slot_number: z.number().int().min(1).max(3),
});

/** Validate req.body. Returns clean data or throws 400 VALIDATION_FAILED. */
function parseBody(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const first = result.error.issues[0];
  const field = first.path.join('.');
  const reason = first.message || 'The input is missing or wrong.';
  throw new AppError(400, 'VALIDATION_FAILED', field ? `${field}: ${reason}` : reason);
}

/** Validate a numeric URL parameter such as /question-sets/:id */
function parseIntParam(value, name) {
  if (!/^-?\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new AppError(400, 'VALIDATION_FAILED', `${name}: must be a whole number`);
  }
  return Number(value);
}

module.exports = {
  questionSetIn, loginRequest, sessionCreate, sessionPatch, joinRequest, answerRequest, chestRequest,
  parseBody, parseIntParam,
};
