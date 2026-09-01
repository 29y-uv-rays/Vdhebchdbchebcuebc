import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Chess } from 'chess.js';
import dotenv from 'dotenv';
import {
  AnalyzeMoveRequestBody,
  GameCoachSummaryRequestBody,
  isValidGameCoachSummaryResponse,
  isValidMoveCoachResponse,
  validateAnalyzeMoveRequest,
  validateGameCoachSummaryRequest,
} from './src/engine/apiValidation';
import { callNvidiaJson } from './src/engine/aiProvider';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const DEFAULT_NIM_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';

app.use(express.json());

type ProviderSource = 'nvidia-nim' | 'heuristic';

interface ProvenanceMeta {
  source: ProviderSource;
  model: string;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  warnings?: string[];
}

function withProvenance<T extends object>(payload: T, meta: ProvenanceMeta): T & ProvenanceMeta {
  return {
    ...payload,
    ...meta,
    warnings: meta.warnings && meta.warnings.length > 0 ? meta.warnings : undefined,
  };
}

function sendValidationError(
  res: Response,
  code: string,
  error: string,
  details: Array<{ field: string; issue: string }>
): Response {
  return res.status(400).json({ error, code, details });
}

function formatEvalPawns(cp: number): string {
  return (cp / 100).toFixed(2);
}

function classifySeverity(evalLossCp: number): string {
  const absLoss = Math.max(0, evalLossCp);
  if (absLoss <= 15) return 'excellent';
  if (absLoss <= 40) return 'small-inaccuracy';
  if (absLoss <= 90) return 'inaccuracy';
  if (absLoss <= 200) return 'mistake';
  return 'blunder';
}

function buildDeterministicMoveContext(input: {
  color: 'w' | 'b';
  sanPlayed: string;
  bestSan: string;
  evalBefore: number;
  evalAfter: number;
  evalLossCp: number;
}): { severity: string; swingDirection: string; preSummary: string } {
  const severity = classifySeverity(input.evalLossCp);
  const deltaWhiteCp = input.evalAfter - input.evalBefore;
  const playerDeltaCp = input.color === 'w' ? deltaWhiteCp : -deltaWhiteCp;
  const swingDirection = playerDeltaCp > 0 ? 'improved' : playerDeltaCp < 0 ? 'worsened' : 'unchanged';
  const preSummary = `Deterministic engine context: ${input.sanPlayed} vs ${input.bestSan}. Player eval change ${formatEvalPawns(
    playerDeltaCp
  )} pawns (${swingDirection}); centipawn loss ${Math.max(0, Math.round(input.evalLossCp))}; severity=${severity}.`;

  return { severity, swingDirection, preSummary };
}

function createChessFromFen(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

function safeMove(chess: Chess, san: string) {
  try {
    return chess.move(san);
  } catch {
    return null;
  }
}

function ensureLegalMove(fenBefore: string, san: string, field: 'sanPlayed' | 'bestSan'):
  | { ok: true }
  | { ok: false; detail: { field: string; issue: string } } {
  const chess = createChessFromFen(fenBefore);
  if (!chess) {
    return { ok: false, detail: { field: 'fenBefore', issue: 'must be a valid FEN position' } };
  }

  const move = safeMove(chess, san);
  if (!move) {
    return {
      ok: false,
      detail: {
        field,
        issue: `illegal SAN move "${san}" for the provided position`,
      },
    };
  }

  return { ok: true };
}

function sanitizeConsequenceLine(fenBefore: string, line: string[] | undefined): { line: string[]; warnings: string[] } {
  if (!line || line.length === 0) {
    return { line: [], warnings: [] };
  }

  const chess = createChessFromFen(fenBefore);
  if (!chess) {
    return { line: [], warnings: [] };
  }

  const sanitized: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < line.length; i++) {
    const san = line[i].trim();
    const move = safeMove(chess, san);
    if (!move) {
      warnings.push(`consequenceLine truncated at index ${i} due to illegal SAN move "${line[i]}".`);
      break;
    }
    sanitized.push(move.san);
  }

  return { line: sanitized, warnings };
}

function heuristicMoveResponse(body: AnalyzeMoveRequestBody, continuationLine: string[]): Record<string, unknown> {
  return {
    whatPlayed: `You played ${body.sanPlayed}.`,
    strongerMove: `A stronger move was ${body.bestSan}.`,
    whyBetter: `Playing ${body.bestSan} improves piece activity and avoids avoidable tactical and positional concessions.`,
    category: 'Position',
    principle: 'Sound Piece Coordination',
    consequenceSummary: `Following ${continuationLine.join(' ')} gives a stable continuation with practical chances.`,
    hint: 'Look for a move that improves coordination and increases pressure on key central squares.',
  };
}

function heuristicGameSummaryResponse(body: GameCoachSummaryRequestBody): Record<string, unknown> {
  const playerColor = body.playerColor || 'w';
  const accuracy = playerColor === 'w' ? body.whiteAccuracy : body.blackAccuracy;
  return {
    headline: `Good effort — you finished with ${accuracy}% accuracy over ${body.movesCount} moves.`,
    strengths: [
      `You found ${body.bestMoveCount} best moves and kept active piece play for long stretches.`,
      `You maintained practical fighting chances despite ${body.mistakeCount + body.blunderCount} major slips.`,
    ],
    keyTakeaway: 'Before every move, quickly compare your candidate with the safest active alternative to reduce large evaluation swings.',
    nextDrill: 'Tactical blunder-check routine (checks, captures, threats) before committing each move.',
  };
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasNvidiaKey: !!process.env.NVIDIA_NIM_API_KEY,
  });
});

app.post('/api/ai/test-nim', async (req: Request, res: Response) => {
  try {
    const { model = DEFAULT_NIM_MODEL } = req.body as { model?: string };
    const keyToUse = process.env.NVIDIA_NIM_API_KEY;

    if (!keyToUse) {
      return sendValidationError(res, 'MISSING_NIM_KEY', 'NVIDIA NIM API key is required', [
        { field: 'NVIDIA_NIM_API_KEY', issue: 'set NVIDIA_NIM_API_KEY in environment' },
      ]);
    }

    const nimResult = await callNvidiaJson<{ reply: string }>({
      apiKey: keyToUse,
      model,
      systemInstruction: 'Return strict JSON only: {"reply":"..."}',
      prompt: 'Reply with JSON containing a short connectivity confirmation message.',
      maxTokens: 80,
      validate: (value: unknown): value is { reply: string } => {
        return typeof value === 'object' && value !== null && typeof (value as { reply?: unknown }).reply === 'string';
      },
    });

    if (nimResult.ok === false) {
      return res.status(nimResult.error.status ?? 502).json({
        error: nimResult.error.message,
        code: nimResult.error.code,
        details: [
          {
            field: 'nvidia',
            issue: nimResult.error.diagnostic || 'NVIDIA NIM request failed',
          },
        ],
      });
    }

    return res.json({ success: true, model, reply: nimResult.data.reply, warnings: nimResult.warnings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message, code: 'NIM_TEST_FAILED', details: [] });
  }
});

app.post('/api/ai/analyze-move', async (req: Request, res: Response) => {
  try {
    const validated = validateAnalyzeMoveRequest(req.body);
    if (validated.ok === false) {
      return res.status(400).json(validated.error);
    }

    const body = validated.value;
    const chess = createChessFromFen(body.fenBefore);
    if (!chess) {
      return sendValidationError(res, 'INVALID_FEN', 'Invalid chess position', [
        { field: 'fenBefore', issue: 'must be a valid FEN position' },
      ]);
    }

    const playedLegality = ensureLegalMove(body.fenBefore, body.sanPlayed, 'sanPlayed');
    if (playedLegality.ok === false) {
      return sendValidationError(res, 'ILLEGAL_MOVE', 'Invalid chess move for provided position', [playedLegality.detail]);
    }

    const bestLegality = ensureLegalMove(body.fenBefore, body.bestSan, 'bestSan');
    if (bestLegality.ok === false) {
      return sendValidationError(res, 'ILLEGAL_MOVE', 'Invalid chess move for provided position', [bestLegality.detail]);
    }

    const sanitizedLineResult = sanitizeConsequenceLine(body.fenBefore, body.consequenceLine);
    const continuationLine = sanitizedLineResult.line.length > 0 ? sanitizedLineResult.line : [body.bestSan];

    const deterministic = buildDeterministicMoveContext({
      color: body.color,
      sanPlayed: body.sanPlayed,
      bestSan: body.bestSan,
      evalBefore: body.evalBefore,
      evalAfter: body.evalAfter,
      evalLossCp: body.evalLossCp,
    });

    const personaInstructions: Record<string, string> = {
      encouraging:
        'You are a warm and supportive master chess coach who encourages improvement while staying concrete and accurate.',
      strict: 'You are a disciplined grandmaster coach who is direct and uncompromising about tactical truth.',
      tactical:
        'You are an energetic tactical trainer focusing on checks, captures, threats, and tactical motifs like forks, pins, and discovered attacks.',
      friendly: 'You are a friendly club coach who explains ideas in simple, memorable language.',
    };

    const promptText = `
You are an expert AI Chess Coach reviewing a student's move.

Context:
- Position FEN: ${body.fenBefore}
- Player color: ${body.color === 'w' ? 'White' : 'Black'}
- Move played: ${body.sanPlayed}
- Engine best move: ${body.bestSan}
- Existing classification label: ${body.classification || 'N/A'}
- Evaluation swing from move loss: ${formatEvalPawns(body.evalLossCp)} pawns
- Eval before: ${formatEvalPawns(body.evalBefore)}, Eval after: ${formatEvalPawns(body.evalAfter)}
- Engine continuation: ${continuationLine.join(' ')}
- ${deterministic.preSummary}

Coach style: ${personaInstructions[body.coachPersona || 'encouraging']}

Return strict JSON only with these keys:
1) whatPlayed: Explain what the played move did and which risk or flaw it introduced (1-2 sentences).
2) strongerMove: Explain why ${body.bestSan} is stronger (1-2 sentences).
3) whyBetter: Deep tactical/positional reason the best move works better (2-3 sentences).
4) category: One of ["Tactical", "Material", "King Safety", "Development", "Position", "Tempo", "Opportunity", "Endgame"].
5) principle: A concise named chess principle.
6) consequenceSummary: Practical consequence of the continuation line (1-2 sentences).
7) hint: Subtle board-based hint that does not reveal exact SAN notation directly.
`;

    const warnings = [...sanitizedLineResult.warnings];
    const requestedProvider = body.provider || 'nvidia';
    let fallbackUsed = false;
    let fallbackReason: string | null = null;

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    const nimModel = body.nvidiaModel || DEFAULT_NIM_MODEL;

    if (requestedProvider === 'nvidia') {
      if (!nimKey) {
        fallbackUsed = true;
        fallbackReason = 'NVIDIA NIM requested but no API key was configured.';
        warnings.push(fallbackReason);
      } else {
        const nimResult = await callNvidiaJson({
          apiKey: nimKey,
          model: nimModel,
          prompt: promptText,
          systemInstruction:
            'You are a grandmaster chess coach. Return strict JSON only with exactly these fields: whatPlayed, strongerMove, whyBetter, category, principle, consequenceSummary, hint. Ensure category uses the allowed enum.',
          validate: isValidMoveCoachResponse,
          topP: 0.95,
          reasoningBudget: 16384,
          maxTokens: 700,
        });

        warnings.push(...nimResult.warnings);

        if (nimResult.ok === true) {
          return res.json(
            withProvenance(
              {
                ...nimResult.data,
                deterministicSummary: deterministic.preSummary,
              },
              {
                source: 'nvidia-nim',
                model: nimModel,
                fallbackUsed,
                fallbackReason,
                warnings,
              }
            )
          );
        } else {
          fallbackUsed = true;
          const nimError = (nimResult as { ok: false; error: { code: string; message: string } }).error;
          fallbackReason = `${nimError.code}: ${nimError.message}`;
          warnings.push(`NVIDIA NIM failed: ${nimError.code}`);
        }
      }
    }

    return res.status(200).json(
      withProvenance(
        {
          ...heuristicMoveResponse(body, continuationLine),
          deterministicSummary: deterministic.preSummary,
        },
        {
          source: 'heuristic',
          model: 'deterministic-heuristic-v1',
          fallbackUsed,
          fallbackReason,
          warnings,
        }
      )
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error analyzing move with AI:', message);
    return res.status(500).json({ error: message, code: 'ANALYZE_MOVE_FAILED', details: [] });
  }
});

app.post('/api/ai/game-coach-summary', async (req: Request, res: Response) => {
  try {
    const validated = validateGameCoachSummaryRequest(req.body);
    if (validated.ok === false) {
      return res.status(400).json(validated.error);
    }

    const body = validated.value;
    const playerColor = body.playerColor || 'w';

    const promptText = `
You are a master chess coach providing a final comprehensive debrief after a completed chess game.

Student stats:
- Color: ${playerColor === 'w' ? 'White' : 'Black'}
- Accuracy: ${playerColor === 'w' ? body.whiteAccuracy : body.blackAccuracy}% (Opponent: ${
      playerColor === 'w' ? body.blackAccuracy : body.whiteAccuracy
    }%)
- Total Moves: ${body.movesCount}
- Blunders: ${body.blunderCount}, Mistakes: ${body.mistakeCount}, Best Moves: ${body.bestMoveCount}
- Game PGN: ${body.pgn || 'N/A'}

Return strict JSON only with these keys:
1) headline: One encouraging sentence summarizing performance.
2) strengths: Exactly 2 concise bullet-friendly strings describing what went well.
3) keyTakeaway: The single biggest tactical or strategic lesson.
4) nextDrill: A specific training focus for the next practice block.
`;

    const warnings: string[] = [];
    const requestedProvider = body.provider || 'nvidia';
    let fallbackUsed = false;
    let fallbackReason: string | null = null;

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    const nimModel = body.nvidiaModel || DEFAULT_NIM_MODEL;

    if (requestedProvider === 'nvidia') {
      if (!nimKey) {
        fallbackUsed = true;
        fallbackReason = 'NVIDIA NIM requested but no API key was configured.';
        warnings.push(fallbackReason);
      } else {
        const nimResult = await callNvidiaJson({
          apiKey: nimKey,
          model: nimModel,
          prompt: promptText,
          systemInstruction:
            'You are a grandmaster chess coach. Return strict JSON only with keys: headline, strengths, keyTakeaway, nextDrill. strengths must be an array of strings.',
          validate: isValidGameCoachSummaryResponse,
          topP: 0.95,
          reasoningBudget: 16384,
          maxTokens: 550,
        });

        warnings.push(...nimResult.warnings);

        if (nimResult.ok === true) {
          return res.json(
            withProvenance(nimResult.data, {
              source: 'nvidia-nim',
              model: nimModel,
              fallbackUsed,
              fallbackReason,
              warnings,
            })
          );
        } else {
          fallbackUsed = true;
          const nimError = (nimResult as { ok: false; error: { code: string; message: string } }).error;
          fallbackReason = `${nimError.code}: ${nimError.message}`;
          warnings.push(`NVIDIA NIM failed: ${nimError.code}`);
        }
      }
    }

    return res.json(
      withProvenance(heuristicGameSummaryResponse(body), {
        source: 'heuristic',
        model: 'deterministic-heuristic-v1',
        fallbackUsed,
        fallbackReason,
        warnings,
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message, code: 'GAME_SUMMARY_FAILED', details: [] });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Chess Coach server running on port ${PORT}`);
  });
}

startServer();
