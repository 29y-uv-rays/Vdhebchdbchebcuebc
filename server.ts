import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client (server-side only)
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasNvidiaKey: !!process.env.NVIDIA_NIM_API_KEY,
  });
});

// Test NVIDIA NIM API Key
app.post('/api/ai/test-nim', async (req: Request, res: Response) => {
  try {
    const { apiKey, model = 'meta/llama-3.1-70b-instruct' } = req.body;
    const keyToUse = apiKey || process.env.NVIDIA_NIM_API_KEY;

    if (!keyToUse) {
      return res.status(400).json({ error: 'No NVIDIA NIM API key provided' });
    }

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToUse}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Say "NVIDIA NIM Connected!" in 3 words.' }],
        max_tokens: 30,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `NVIDIA API error: ${errText}` });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Connected successfully!';
    return res.json({ success: true, model, reply });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

// AI Move Deep Analysis Coach endpoint (Supports Gemini and NVIDIA NIM)
app.post('/api/ai/analyze-move', async (req: Request, res: Response) => {
  try {
    const {
      provider = 'gemini',
      nvidiaApiKey,
      nvidiaModel = 'meta/llama-3.1-70b-instruct',
      fenBefore,
      color,
      sanPlayed,
      bestSan,
      classification,
      evalLossCp,
      evalBefore,
      evalAfter,
      consequenceLine,
      coachPersona = 'encouraging',
    } = req.body;

    const personaInstructions: Record<string, string> = {
      encouraging: 'You are a warm, supportive, master chess coach who encourages the student while giving crystal-clear tactical and positional insights.',
      strict: 'You are a disciplined Grandmaster coach who cuts straight to the tactical truth and expects disciplined play.',
      tactical: 'You are an energetic tactical trainer focusing heavily on spotting pins, forks, discovered attacks, and piece vulnerabilities.',
      friendly: 'You are a friendly club coach explaining chess in simple, memorable, intuitive concepts.',
    };

    const promptText = `
You are an expert AI Chess Coach reviewing a student's move.
Context:
- Position FEN: ${fenBefore}
- Player color: ${color === 'w' ? 'White' : 'Black'}
- Move Played: ${sanPlayed}
- Engine Best Move: ${bestSan}
- Classification: ${classification}
- Evaluation swing: ${(evalLossCp / 100).toFixed(2)} pawns
- Eval before: ${(evalBefore / 100).toFixed(2)}, Eval after: ${(evalAfter / 100).toFixed(2)}
- Engine Continuation: ${consequenceLine ? consequenceLine.join(' ') : bestSan}

Coach Style: ${personaInstructions[coachPersona] || personaInstructions.encouraging}

Please provide a structured coaching response answering these 3 questions clearly for the player:
1. "whatPlayed": Explain what the player's move did and what flaw/risk it created (1-2 sentences).
2. "strongerMove": State why the recommended move ${bestSan} is stronger (1-2 sentences).
3. "whyBetter": The deep tactical or positional reasoning behind why ${bestSan} works and what principle applies (2-3 sentences).
4. "category": Choose one of ["Tactical", "Material", "King Safety", "Development", "Position", "Tempo", "Opportunity", "Endgame"].
5. "principle": A concise named chess principle (e.g. "Overloaded Defender", "Pawn Structure Vulnerability", "King Exposure").
6. "consequenceSummary": What could or did happen following the continuation line (1-2 sentences).
7. "hint": A subtle interactive puzzle hint for the player trying to find the best move on the board WITHOUT giving away the exact move notation directly (e.g. "Look for a way your bishop can exploit the weakened f7 square").
`;

    // 1. Try NVIDIA NIM if selected or key provided
    const nimKey = nvidiaApiKey || process.env.NVIDIA_NIM_API_KEY;
    if (provider === 'nvidia' && nimKey) {
      const nimResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${nimKey}`,
        },
        body: JSON.stringify({
          model: nvidiaModel,
          messages: [
            {
              role: 'system',
              content: 'You are a grandmaster chess coach. Always respond in valid strict JSON matching the requested fields: whatPlayed, strongerMove, whyBetter, category, principle, consequenceSummary, hint.',
            },
            { role: 'user', content: promptText },
          ],
          temperature: 0.4,
          max_tokens: 600,
        }),
      });

      if (nimResponse.ok) {
        const nimData = await nimResponse.json();
        const content = nimData.choices?.[0]?.message?.content || '';
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return res.json({
              ...parsed,
              source: 'nvidia-nim',
              model: nvidiaModel,
            });
          }
        } catch {
          // fallback to text extraction
        }
      }
    }

    // 2. Try Gemini API
    const ai = getGeminiClient();
    if (ai) {
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: promptText,
        config: {
          systemInstruction: 'You are a world-class chess coach. You explain moves with clarity, coaching warmth, and deep tactical understanding.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              whatPlayed: { type: Type.STRING },
              strongerMove: { type: Type.STRING },
              whyBetter: { type: Type.STRING },
              category: { 
                type: Type.STRING, 
                enum: ['Tactical', 'Material', 'King Safety', 'Development', 'Position', 'Tempo', 'Opportunity', 'Endgame'] 
              },
              principle: { type: Type.STRING },
              consequenceSummary: { type: Type.STRING },
              hint: { type: Type.STRING },
            },
            required: ['whatPlayed', 'strongerMove', 'whyBetter', 'category', 'principle', 'consequenceSummary', 'hint'],
          },
        },
      });

      if (geminiResponse.text) {
        const parsed = JSON.parse(geminiResponse.text);
        return res.json({
          ...parsed,
          source: 'gemini',
          model: 'gemini-3.7-flash',
        });
      }
    }

    // 3. Fallback response
    return res.status(200).json({
      whatPlayed: `You played ${sanPlayed}.`,
      strongerMove: `A stronger move was ${bestSan}.`,
      whyBetter: `Playing ${bestSan} coordinates your pieces more effectively and maintains central presence without incurring unnecessary weaknesses.`,
      category: 'Position',
      principle: 'Sound Piece Coordination',
      consequenceSummary: `Following ${consequenceLine ? consequenceLine.join(' ') : bestSan} gives a balanced, active continuation.`,
      hint: `Look for a move that controls key central squares or removes opponent tension.`,
      source: 'heuristic',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error analyzing move with AI:', message);
    return res.status(500).json({ error: message });
  }
});

// Full Game AI Coach Summary
app.post('/api/ai/game-coach-summary', async (req: Request, res: Response) => {
  try {
    const {
      whiteAccuracy,
      blackAccuracy,
      playerColor = 'w',
      movesCount,
      blunderCount,
      mistakeCount,
      bestMoveCount,
      pgn,
      provider = 'gemini',
      nvidiaApiKey,
      nvidiaModel = 'meta/llama-3.1-70b-instruct',
    } = req.body;

    const promptText = `
You are a master chess coach providing a final comprehensive debrief after a completed chess game.
Student stats:
- Color: ${playerColor === 'w' ? 'White' : 'Black'}
- Accuracy: ${playerColor === 'w' ? whiteAccuracy : blackAccuracy}% (Opponent: ${playerColor === 'w' ? blackAccuracy : whiteAccuracy}%)
- Total Moves: ${movesCount}
- Blunders: ${blunderCount}, Mistakes: ${mistakeCount}, Best Moves: ${bestMoveCount}
- Game PGN: ${pgn || 'N/A'}

Provide:
1. "headline": An encouraging 1-sentence headline summarizing the performance.
2. "strengths": 2 bullet points on what the student did well.
3. "keyTakeaway": The #1 tactical or strategic lesson from this game to remember for future matches.
4. "nextDrill": A recommended training focus (e.g. "Defending against pins", "King safety in open files", "Knight outposts").
`;

    const nimKey = nvidiaApiKey || process.env.NVIDIA_NIM_API_KEY;
    if (provider === 'nvidia' && nimKey) {
      const nimResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${nimKey}`,
        },
        body: JSON.stringify({
          model: nvidiaModel,
          messages: [
            { role: 'system', content: 'You are a grandmaster chess coach. Return valid JSON.' },
            { role: 'user', content: promptText },
          ],
          temperature: 0.4,
          max_tokens: 500,
        }),
      });

      if (nimResponse.ok) {
        const nimData = await nimResponse.json();
        const content = nimData.choices?.[0]?.message?.content || '';
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return res.json(JSON.parse(jsonMatch[0]));
          }
        } catch {
          // ignore
        }
      }
    }

    const ai = getGeminiClient();
    if (ai) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              keyTakeaway: { type: Type.STRING },
              nextDrill: { type: Type.STRING },
            },
            required: ['headline', 'strengths', 'keyTakeaway', 'nextDrill'],
          },
        },
      });

      if (response.text) {
        return res.json(JSON.parse(response.text));
      }
    }

    return res.json({
      headline: `Great game! You achieved ${playerColor === 'w' ? whiteAccuracy : blackAccuracy}% accuracy across ${movesCount} moves.`,
      strengths: [
        `Executed ${bestMoveCount} engine-approved best moves with strong opening play.`,
        'Demonstrated active piece mobilization throughout the middlegame.',
      ],
      keyTakeaway: 'Always pause before pawn moves to check which defensive squares and pieces they leave behind.',
      nextDrill: 'Middlegame piece coordination & tactical defense',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

// Vite middleware for development & static serving for production
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
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Chess Coach server running on port ${PORT}`);
  });
}

startServer();
