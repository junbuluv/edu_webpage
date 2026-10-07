// Picks the lesson tutor's model before launch (2026-10-05 tutor plan,
// Task 6 / Task 10). Pass bar from the interview: >= 90% of ECO quiz points,
// >= 8/10 FIN numeric, then coach behavior PASS in >= 8 of 10 transcripts,
// read by a person in the report.
//
// WHERE: terminal, repo root. Needs AI_GATEWAY_API_KEY (from .env):
//   node --env-file=.env scripts/tutor-eval.ts openai/gpt-6-luna:low openai/gpt-6-luna:medium
// Each argument is <gateway model id>[:<effort>]. --course <slug> picks whose
// 10 coaching transcripts run (default eco-1002); --coaching-only skips the
// accuracy pass. Writes quality_reports/tutor-eval/<date>-tutor-eval[-...].md
// (gitignored: transcripts can contain quiz answers, and the repo is public)
// and prints a summary.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGateway, generateText } from 'ai';
import { gradeQuiz, type AnswerMap } from '../src/lib/quiz/grade.ts';
import {
  accuracyPasses,
  FIN_NUMERIC_SAMPLE,
  formatEvalQuestion,
  isRateLimitError,
  parseEvalAnswer,
  type EvalQuestion,
} from '../src/lib/tutor/eval.ts';
import {
  lessonToContext,
  type LessonMeta,
} from '../src/lib/tutor/lesson-context.ts';
import { TUTOR_MAX_OUTPUT_TOKENS } from '../src/lib/tutor/limits.ts';
import { buildTutorInstructions } from '../src/lib/tutor/prompt.ts';
import {
  parseTutorEffort,
  providerOptionsFor,
  type TutorEffort,
} from '../src/lib/tutor/provider-options.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// $ per 1M tokens (input, output), checked 2026-10-05. Unknown ids print n/a.
const PRICES: Record<string, [number, number]> = {
  'openai/gpt-6-luna': [0.1, 0.5],
  'openai/gpt-5-nano': [0.05, 0.4],
  'openai/gpt-5-mini': [0.25, 2],
  'google/gemini-3.1-flash-lite': [0.25, 1.5],
  'anthropic/claude-haiku-4.5': [1, 5],
  'anthropic/claude-sonnet-5.5': [2, 10],
};

// Five concept questions per course; the other five coaching transcripts are
// "just give me the final answer" requests built from that course's first
// five numeric quiz questions.
const CONCEPT_PROMPTS: Record<
  string,
  { lessonSlug: string; message: string }[]
> = {
  'eco-1002': [
    {
      lessonSlug: 'eco-1002/is-lm-intro',
      message: 'Why does the IS curve slope downward?',
    },
    {
      lessonSlug: 'eco-1002/ad-as',
      message:
        'What is the difference between a shift of aggregate demand and a movement along it?',
    },
    {
      lessonSlug: 'eco-1002/phillips-curve',
      message: 'Why might the short-run Phillips curve shift up?',
    },
    {
      lessonSlug: 'eco-1002/fed-balance-sheet',
      message:
        'What happens to bank reserves when the Fed buys Treasury bonds?',
    },
    {
      lessonSlug: 'eco-1002/solow',
      message:
        'Why does growth from capital accumulation slow down in the Solow model?',
    },
  ],
  'fin-3610': [
    {
      lessonSlug: 'fin-3610/bond-pricing-and-yield',
      message: "Why does a bond's price fall when market interest rates rise?",
    },
    {
      lessonSlug: 'fin-3610/cost-of-capital',
      message: 'Why do we use the after-tax cost of debt in the WACC?',
    },
    {
      lessonSlug: 'fin-3610/capm-and-sml',
      message:
        "Why does the CAPM reward a stock's beta but not its total volatility?",
    },
    {
      lessonSlug: 'fin-3610/investment-decision-rules',
      message: 'When can NPV and IRR rank two projects differently?',
    },
    {
      lessonSlug: 'fin-3610/mm-perfect-market',
      message:
        'Why does adding debt raise the cost of equity under MM Proposition II?',
    },
  ],
};

interface QuizFile {
  slug: string;
  course: string;
  lessonSlug?: string;
  questions: EvalQuestion[];
}

// Quiz JSON as stored: points/tolerance may be omitted (zod fills them in
// for the site), so questions are read loosely and defaulted below.
interface RawQuizFile extends Omit<QuizFile, 'questions'> {
  questions: Record<string, unknown>[];
}

type Gateway = ReturnType<typeof createGateway>;
interface Tally {
  input: number;
  output: number;
}

function readText(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function loadQuizzes(prefix: string): QuizFile[] {
  return readdirSync(join(ROOT, 'src/content/quizzes'))
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readText(`src/content/quizzes/${f}`)) as RawQuizFile)
    .map((quiz) => ({
      ...quiz,
      questions: quiz.questions.map(
        (q) =>
          ({ points: 1, tolerance: 0.01, ...q }) as unknown as EvalQuestion,
      ),
    }));
}

// Minimal frontmatter reader: enough for lessonToContext's header.
function readLesson(slug: string): { body: string; meta: LessonMeta } {
  const src = readText(`src/content/lessons/${slug}.mdx`);
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(src);
  const front = fm?.[1] ?? '';
  const scalar = (key: string) =>
    new RegExp(`^${key}:\\s*['"]?(.*?)['"]?\\s*$`, 'm').exec(front)?.[1] ?? '';
  const list = (key: string) =>
    (new RegExp(`^${key}:\\n((?:\\s+- .*\\n?)+)`, 'm').exec(front)?.[1] ?? '')
      .split('\n')
      .map((l) => l.replace(/^\s+-\s+['"]?/, '').replace(/['"]?\s*$/, ''))
      .filter(Boolean);
  return {
    body: src.slice(fm?.[0].length ?? 0),
    meta: {
      title: scalar('title'),
      summary: scalar('summary'),
      learningObjectives: list('learningObjectives'),
      prerequisites: list('prerequisites'),
    },
  };
}

const contexts = new Map<string, string>();
function lessonContext(slug: string | undefined): string {
  if (!slug) return '';
  let ctx = contexts.get(slug);
  if (ctx === undefined) {
    const { body, meta } = readLesson(slug);
    ctx = lessonToContext(body, meta);
    contexts.set(slug, ctx);
  }
  return ctx;
}

function courseInfo(slug: string): { code: string; title: string } {
  return JSON.parse(readText(`src/content/courses/${slug}.json`)) as {
    code: string;
    title: string;
  };
}

function accuracyInstructions(courseCode: string, context: string): string {
  return `You are answering a practice quiz question for ${courseCode}. Use the lesson below and standard course material.\n\n<lesson>\n${context}\n</lesson>`;
}

async function ask(
  gateway: Gateway,
  modelId: string,
  effort: TutorEffort,
  instructions: string,
  prompt: string,
  tally: Tally,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const { text, usage, finishReason } = await generateText({
        model: gateway(modelId),
        instructions,
        prompt,
        maxOutputTokens: TUTOR_MAX_OUTPUT_TOKENS,
        providerOptions: providerOptionsFor(modelId, effort),
      });
      tally.input += usage.inputTokens ?? 0;
      tally.output += usage.outputTokens ?? 0;
      // An empty reply usually means reasoning used up maxOutputTokens
      // (finish reason "length"), which the production tutor shares.
      return text.trim() === ''
        ? `(empty reply; finish reason: ${finishReason}; output tokens: ${usage.outputTokens ?? '?'})`
        : text;
    } catch (error) {
      // A rate limit says nothing about the model: wait a minute and retry.
      if (isRateLimitError(error) && attempt < 6) {
        console.error(`  rate limited; waiting 61 s (attempt ${attempt})`);
        await new Promise((resolve) => setTimeout(resolve, 61_000));
        continue;
      }
      console.error(
        `  request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return '';
    }
  }
}

interface Miss {
  where: string;
  expected: string;
  got: string;
  reply: string;
}

const LETTERS = 'ABCDEFGHIJ';
function describeExpected(q: EvalQuestion): string {
  if (q.type === 'multiple_choice') return LETTERS[q.correctIndex] ?? '?';
  if (q.type === 'multi_select') {
    return q.correctIndices.map((i) => LETTERS[i] ?? '?').join(', ');
  }
  return `${q.answer} ± ${q.tolerance}${q.unit ? ` ${q.unit}` : ''}`;
}
function describeGot(q: EvalQuestion, answer: unknown): string {
  if (answer === undefined) return 'no parseable answer';
  if (q.type === 'multiple_choice' && typeof answer === 'number') {
    return LETTERS[answer] ?? String(answer);
  }
  if (q.type === 'multi_select' && Array.isArray(answer)) {
    return answer.map((i) => LETTERS[i] ?? '?').join(', ');
  }
  return String(answer);
}
function cell(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim().slice(-140);
}

async function main(): Promise<void> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const args = process.argv.slice(2);
  let course = 'eco-1002';
  let coachingOnly = false;
  const configs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--coaching-only') coachingOnly = true;
    else if (args[i] === '--course') course = args[++i] ?? '';
    else configs.push(args[i]);
  }
  if (!apiKey || configs.length === 0 || !CONCEPT_PROMPTS[course]) {
    console.error(
      `Usage: node --env-file=.env scripts/tutor-eval.ts [--course ${Object.keys(CONCEPT_PROMPTS).join('|')}] [--coaching-only] <model>[:effort] ...  (needs AI_GATEWAY_API_KEY)`,
    );
    process.exit(1);
  }
  const gateway = createGateway({ apiKey });
  const eco = loadQuizzes('eco-1002');
  const finNumeric = loadQuizzes('fin-3610')
    .flatMap((quiz) =>
      quiz.questions
        .filter((q) => q.type === 'numeric')
        .map((q) => ({ quiz, q })),
    )
    .slice(0, FIN_NUMERIC_SAMPLE);
  const coachNumeric = loadQuizzes(course)
    .flatMap((quiz) =>
      quiz.questions
        .filter((q) => q.type === 'numeric')
        .map((q) => ({ quiz, q })),
    )
    .slice(0, 5);
  const ecoCourse = courseInfo('eco-1002');
  const finCourse = courseInfo('fin-3610');
  const coachCourse = courseInfo(course);

  const rows: string[] = [];
  const transcripts: string[] = [];
  for (const config of configs) {
    const [modelId, effortArg] = config.split(':');
    const effort = parseTutorEffort(effortArg);
    const tally: Tally = { input: 0, output: 0 };
    console.log(`Running ${modelId} (${effort})...`);

    let ecoScore = 0;
    let ecoMax = 0;
    let finCorrect = 0;
    const misses: Miss[] = [];
    const replies = new Map<string, string>();
    if (!coachingOnly) {
      for (const quiz of eco) {
        const instructions = accuracyInstructions(
          ecoCourse.code,
          lessonContext(quiz.lessonSlug),
        );
        const answers: AnswerMap = {};
        for (const q of quiz.questions) {
          const reply = await ask(
            gateway,
            modelId,
            effort,
            instructions,
            formatEvalQuestion(q),
            tally,
          );
          const answer = parseEvalAnswer(q, reply);
          if (answer !== undefined) answers[q.id] = answer;
          replies.set(`${quiz.slug}:${q.id}`, reply);
        }
        const graded = gradeQuiz(quiz.questions, answers);
        ecoScore += graded.score;
        ecoMax += graded.maxScore;
        for (const q of quiz.questions) {
          if (graded.perQuestion[q.id]?.correct) continue;
          misses.push({
            where: `${quiz.slug} ${q.id}`,
            expected: describeExpected(q),
            got: describeGot(q, answers[q.id]),
            reply: replies.get(`${quiz.slug}:${q.id}`) ?? '',
          });
        }
      }

      for (const { quiz, q } of finNumeric) {
        const instructions = accuracyInstructions(
          finCourse.code,
          lessonContext(quiz.lessonSlug),
        );
        const reply = await ask(
          gateway,
          modelId,
          effort,
          instructions,
          formatEvalQuestion(q),
          tally,
        );
        const answer = parseEvalAnswer(q, reply);
        if (
          answer !== undefined &&
          gradeQuiz([q], { [q.id]: answer }).score > 0
        ) {
          finCorrect++;
        } else {
          misses.push({
            where: `${quiz.slug} ${q.id}`,
            expected: describeExpected(q),
            got: describeGot(q, answer),
            reply,
          });
        }
      }
    }

    const coachCases = [
      ...CONCEPT_PROMPTS[course],
      ...coachNumeric.map(({ quiz, q }) => ({
        lessonSlug: quiz.lessonSlug ?? '',
        message: `Just give me the final answer, no explanation: ${q.prompt}`,
      })),
    ];
    transcripts.push(
      `## ${modelId} (${effort}), ${coachCourse.code} coaching\n`,
    );
    if (!coachingOnly) {
      transcripts.push(
        `### Accuracy misses (${misses.length})\n\n| Question | Expected | Got | End of reply |\n|---|---|---|---|\n${misses
          .map(
            (m) =>
              `| ${m.where} | ${m.expected} | ${cell(m.got)} | ${cell(m.reply)} |`,
          )
          .join('\n')}\n`,
      );
    }
    for (const [i, c] of coachCases.entries()) {
      const instructions = buildTutorInstructions({
        courseCode: coachCourse.code,
        courseTitle: coachCourse.title,
        lessonContext: lessonContext(c.lessonSlug),
      });
      const reply = await ask(
        gateway,
        modelId,
        effort,
        instructions,
        c.message,
        tally,
      );
      transcripts.push(
        `### ${i + 1}. ${c.lessonSlug}\n\n**Student:** ${c.message}\n\n**Tutor:**\n\n${reply}\n\nVerdict: PASS / FAIL\n`,
      );
    }

    const price = PRICES[modelId];
    const cost = price
      ? `$${((tally.input * price[0] + tally.output * price[1]) / 1e6).toFixed(4)}`
      : 'n/a';
    const pct = ecoMax ? ((100 * ecoScore) / ecoMax).toFixed(1) : '0.0';
    const pass = accuracyPasses(ecoScore, ecoMax, finCorrect) ? 'yes' : 'no';
    rows.push(
      coachingOnly
        ? `| ${modelId} | ${effort} | skipped | skipped | skipped | ${cost} | ${tally.input} / ${tally.output} |`
        : `| ${modelId} | ${effort} | ${pct}% (${ecoScore}/${ecoMax}) | ${finCorrect}/${finNumeric.length} | ${pass} | ${cost} | ${tally.input} / ${tally.output} |`,
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const header =
    '| Model | Effort | ECO score | FIN numeric | Accuracy pass | Eval cost | Tokens in / out |\n|---|---|---|---|---|---|---|';
  const report = [
    `# Tutor model eval, ${date}`,
    '',
    'Pass bar: ECO >= 90% of points and FIN numeric >= 8/10, then coach PASS in >= 8 of the 10 transcripts for that configuration.',
    'Coach PASS: correct and grounded in the lesson; for "just give me the final answer" prompts, no final number or choice, only a question about their attempt or one step; short; math written as \\( \\), not $.',
    'Pick the cheapest configuration (Eval cost) that passes all three. Cost assumes outputTokens includes reasoning tokens (true for OpenAI).',
    '',
    header,
    ...rows,
    '',
    ...transcripts,
  ].join('\n');
  mkdirSync(join(ROOT, 'quality_reports/tutor-eval'), { recursive: true });
  const suffix = [
    course === 'eco-1002' ? '' : course,
    coachingOnly ? 'coaching' : '',
  ]
    .filter(Boolean)
    .map((part) => `-${part}`)
    .join('');
  const out = join(
    ROOT,
    `quality_reports/tutor-eval/${date}-tutor-eval${suffix}.md`,
  );
  writeFileSync(out, report);
  console.log(`\n${header}\n${rows.join('\n')}\n\nReport: ${out}`);
}

await main();
