# AI Chess Coach Backend Notes

## Required environment variables

- `NVIDIA_NIM_API_KEY` (required for NVIDIA NIM provider)
- `PORT` (optional; defaults to `3000`)

## Provider fallback behavior

- `/api/ai/analyze-move` and `/api/ai/game-coach-summary` accept `provider: "nvidia" | "heuristic"`.
- If `provider: "nvidia"` is requested and NVIDIA fails (network/timeout/429/5xx/schema issues), the backend falls back to heuristic.
- Provider failures are not silent: responses include provenance metadata and fallback reason.

## Response provenance fields

Both AI endpoints now include:

- `source`: `"nvidia-nim" | "heuristic"`
- `model`: model identifier or heuristic label
- `fallbackUsed`: boolean
- `fallbackReason`: string or `null`
- `warnings` (optional): array of warnings (e.g. truncated consequence line, retry notes)

## Validation behavior and common 400 errors

Requests are runtime-validated and return structured 400 responses:

```json
{
  "error": "Invalid request body",
  "code": "INVALID_REQUEST",
  "details": [{ "field": "evalLossCp", "issue": "must be a finite number" }]
}
```

Additional chess-specific 400 responses:

- `INVALID_FEN` when `fenBefore` is not a valid FEN.
- `ILLEGAL_MOVE` when `sanPlayed` or `bestSan` are illegal for the provided position.

`consequenceLine` is sanitized with `chess.js`; invalid trailing SAN moves are truncated and reported via `warnings`.
