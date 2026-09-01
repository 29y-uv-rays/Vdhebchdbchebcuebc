export interface ApiErrorPayload {
  error: string;
  code: string;
  details: Array<{ field: string; issue: string }>;
}

interface ValidationSuccess<T> {
  ok: true;
  value: T;
}

interface ValidationFailure {
  ok: false;
  error: ApiErrorPayload;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const MOVE_CATEGORIES = [
  'Tactical',
  'Material',
  'King Safety',
  'Development',
  'Position',
  'Tempo',
  'Opportunity',
  'Endgame',
] as const;

type MoveCategory = typeof MOVE_CATEGORIES[number];

export interface AnalyzeMoveRequestBody {
  provider?: 'nvidia' | 'heuristic';
  nvidiaModel?: string;
  fenBefore: string;
  color: 'w' | 'b';
  sanPlayed: string;
  bestSan: string;
  classification?: string;
  evalLossCp: number;
  evalBefore: number;
  evalAfter: number;
  consequenceLine?: string[];
  coachPersona?: 'encouraging' | 'strict' | 'tactical' | 'friendly';
}

export interface GameCoachSummaryRequestBody {
  whiteAccuracy: number;
  blackAccuracy: number;
  playerColor?: 'w' | 'b';
  movesCount: number;
  blunderCount: number;
  mistakeCount: number;
  bestMoveCount: number;
  pgn?: string;
  provider?: 'nvidia' | 'heuristic';
  nvidiaModel?: string;
}

export interface MoveCoachResponse {
  whatPlayed: string;
  strongerMove: string;
  whyBetter: string;
  category: MoveCategory;
  principle: string;
  consequenceSummary: string;
  hint: string;
}

export interface GameCoachSummaryResponse {
  headline: string;
  strengths: string[];
  keyTakeaway: string;
  nextDrill: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asError(details: Array<{ field: string; issue: string }>): ValidationFailure {
  return {
    ok: false,
    error: {
      error: 'Invalid request body',
      code: 'INVALID_REQUEST',
      details,
    },
  };
}

function requireString(
  obj: Record<string, unknown>,
  field: string,
  details: Array<{ field: string; issue: string }>
): string {
  const value = obj[field];
  if (typeof value !== 'string' || value.trim() === '') {
    details.push({ field, issue: 'must be a non-empty string' });
    return '';
  }
  return value.trim();
}

function requireFiniteNumber(
  obj: Record<string, unknown>,
  field: string,
  details: Array<{ field: string; issue: string }>
): number {
  const value = obj[field];
  if (!isFiniteNumber(value)) {
    details.push({ field, issue: 'must be a finite number' });
    return 0;
  }
  return value;
}

function requireNonNegativeInteger(
  obj: Record<string, unknown>,
  field: string,
  details: Array<{ field: string; issue: string }>
): number {
  const value = obj[field];
  if (!Number.isInteger(value) || (value as number) < 0) {
    details.push({ field, issue: 'must be a non-negative integer' });
    return 0;
  }
  return value as number;
}

export function validateAnalyzeMoveRequest(body: unknown): ValidationResult<AnalyzeMoveRequestBody> {
  if (!isRecord(body)) {
    return asError([{ field: 'body', issue: 'must be a JSON object' }]);
  }

  const details: Array<{ field: string; issue: string }> = [];
  const fenBefore = requireString(body, 'fenBefore', details);
  const sanPlayed = requireString(body, 'sanPlayed', details);
  const bestSan = requireString(body, 'bestSan', details);
  const evalLossCp = requireFiniteNumber(body, 'evalLossCp', details);
  const evalBefore = requireFiniteNumber(body, 'evalBefore', details);
  const evalAfter = requireFiniteNumber(body, 'evalAfter', details);

  const color = body.color;
  if (color !== 'w' && color !== 'b') {
    details.push({ field: 'color', issue: 'must be either "w" or "b"' });
  }

  const provider = body.provider;
  if (provider !== undefined && provider !== 'nvidia' && provider !== 'heuristic') {
    details.push({ field: 'provider', issue: 'must be one of "nvidia", "heuristic"' });
  }

  const coachPersona = body.coachPersona;
  if (
    coachPersona !== undefined &&
    coachPersona !== 'encouraging' &&
    coachPersona !== 'strict' &&
    coachPersona !== 'tactical' &&
    coachPersona !== 'friendly'
  ) {
    details.push({ field: 'coachPersona', issue: 'must be one of "encouraging", "strict", "tactical", "friendly"' });
  }

  const consequenceLineRaw = body.consequenceLine;
  if (consequenceLineRaw !== undefined) {
    if (!Array.isArray(consequenceLineRaw) || consequenceLineRaw.some((value) => typeof value !== 'string')) {
      details.push({ field: 'consequenceLine', issue: 'must be an array of SAN move strings' });
    }
  }

  if (details.length > 0) {
    return asError(details);
  }

  return {
    ok: true,
    value: {
      provider: provider as AnalyzeMoveRequestBody['provider'],
      nvidiaModel: typeof body.nvidiaModel === 'string' && body.nvidiaModel.trim() ? body.nvidiaModel.trim() : undefined,
      fenBefore,
      color: color as 'w' | 'b',
      sanPlayed,
      bestSan,
      classification: typeof body.classification === 'string' ? body.classification : undefined,
      evalLossCp,
      evalBefore,
      evalAfter,
      consequenceLine: Array.isArray(consequenceLineRaw) ? consequenceLineRaw : undefined,
      coachPersona: coachPersona as AnalyzeMoveRequestBody['coachPersona'],
    },
  };
}

export function validateGameCoachSummaryRequest(body: unknown): ValidationResult<GameCoachSummaryRequestBody> {
  if (!isRecord(body)) {
    return asError([{ field: 'body', issue: 'must be a JSON object' }]);
  }

  const details: Array<{ field: string; issue: string }> = [];
  const whiteAccuracy = requireFiniteNumber(body, 'whiteAccuracy', details);
  const blackAccuracy = requireFiniteNumber(body, 'blackAccuracy', details);
  const movesCount = requireNonNegativeInteger(body, 'movesCount', details);
  const blunderCount = requireNonNegativeInteger(body, 'blunderCount', details);
  const mistakeCount = requireNonNegativeInteger(body, 'mistakeCount', details);
  const bestMoveCount = requireNonNegativeInteger(body, 'bestMoveCount', details);

  const playerColor = body.playerColor;
  if (playerColor !== undefined && playerColor !== 'w' && playerColor !== 'b') {
    details.push({ field: 'playerColor', issue: 'must be either "w" or "b"' });
  }

  if (typeof body.pgn !== 'undefined' && typeof body.pgn !== 'string') {
    details.push({ field: 'pgn', issue: 'must be a string when provided' });
  }

  const provider = body.provider;
  if (provider !== undefined && provider !== 'nvidia' && provider !== 'heuristic') {
    details.push({ field: 'provider', issue: 'must be one of "nvidia", "heuristic"' });
  }

  if (details.length > 0) {
    return asError(details);
  }

  return {
    ok: true,
    value: {
      whiteAccuracy,
      blackAccuracy,
      playerColor: playerColor as 'w' | 'b' | undefined,
      movesCount,
      blunderCount,
      mistakeCount,
      bestMoveCount,
      pgn: typeof body.pgn === 'string' ? body.pgn : undefined,
      provider: provider as GameCoachSummaryRequestBody['provider'],
      nvidiaModel: typeof body.nvidiaModel === 'string' && body.nvidiaModel.trim() ? body.nvidiaModel.trim() : undefined,
    },
  };
}

function hasStringField(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'string' && (value[key] as string).trim().length > 0;
}

export function isValidMoveCoachResponse(value: unknown): value is MoveCoachResponse {
  if (!isRecord(value)) {
    return false;
  }
  return (
    hasStringField(value, 'whatPlayed') &&
    hasStringField(value, 'strongerMove') &&
    hasStringField(value, 'whyBetter') &&
    hasStringField(value, 'principle') &&
    hasStringField(value, 'consequenceSummary') &&
    hasStringField(value, 'hint') &&
    typeof value.category === 'string' &&
    MOVE_CATEGORIES.includes(value.category as MoveCategory)
  );
}

export function isValidGameCoachSummaryResponse(value: unknown): value is GameCoachSummaryResponse {
  if (!isRecord(value)) {
    return false;
  }
  return (
    hasStringField(value, 'headline') &&
    Array.isArray(value.strengths) &&
    value.strengths.length > 0 &&
    value.strengths.every((item) => typeof item === 'string' && item.trim().length > 0) &&
    hasStringField(value, 'keyTakeaway') &&
    hasStringField(value, 'nextDrill')
  );
}

export function getMoveCategories(): readonly MoveCategory[] {
  return MOVE_CATEGORIES;
}
