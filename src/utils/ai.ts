// Gemini AI integration - calls the free Gemini API
// Note: In production, this should go through a backend (Cloudflare Worker)
// to protect API keys. For MVP, we use a client-side call with the user's key
// or a proxy endpoint.

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface AIResponse {
  text: string;
  error?: string;
}

export async function callGemini(prompt: string, apiKey: string): Promise<AIResponse> {
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { text: '', error: err?.error?.message || `API error: ${res.status}` };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return { text: '', error: 'No response from AI' };
    return { text };
  } catch (e: any) {
    return { text: '', error: e.message || 'Network error' };
  }
}

// ===== PROMPT BUILDERS =====

export function summarizePrompt(text: string): string {
  return `You are a study assistant. Summarize the following text clearly and concisely for a student.

Provide your response in this EXACT JSON format:
{
  "summary": "A clear 3-5 sentence summary",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "importantTerms": [{"term": "word", "definition": "meaning"}],
  "difficulty": "easy|medium|hard"
}

TEXT TO SUMMARIZE:
${text.slice(0, 8000)}`;
}

export function flashcardsPrompt(text: string, count: number = 8): string {
  return `You are a study assistant. Create exactly ${count} flashcards from the following text for effective studying.

Provide your response in this EXACT JSON format:
{
  "flashcards": [
    {"front": "Question or concept", "back": "Answer or explanation"},
    {"front": "Question or concept", "back": "Answer or explanation"}
  ]
}

Make the questions test understanding, not just recall. Cover the most important concepts.

TEXT:
${text.slice(0, 8000)}`;
}

export function quizPrompt(text: string, count: number = 5): string {
  return `You are a study assistant. Create exactly ${count} multiple-choice quiz questions from the following text.

Provide your response in this EXACT JSON format:
{
  "questions": [
    {
      "question": "The question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}

Make questions that test real understanding. Include plausible wrong answers. correctIndex is 0-3.

TEXT:
${text.slice(0, 8000)}`;
}

export function explainPrompt(topic: string): string {
  return `You are a friendly teacher. Explain the following topic in simple language that a 10-year-old could understand.

Provide your response in this EXACT JSON format:
{
  "simpleExplanation": "Easy explanation in 3-4 sentences",
  "analogy": "A real-world analogy to help understand",
  "example": "A concrete example",
  "funFact": "An interesting related fact",
  "steps": ["step 1 of understanding", "step 2", "step 3"]
}

TOPIC TO EXPLAIN:
${topic}`;
}

export function youtubePrompt(transcript: string): string {
  return `You are a study assistant. Summarize this YouTube video transcript for a student.

Provide your response in this EXACT JSON format:
{
  "title": "Brief title of the video content",
  "summary": "A clear 3-5 sentence summary of the video",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "timestamps": [{"time": "0:00", "topic": "Introduction"}, {"time": "2:30", "topic": "Main concept"}],
  "actionItems": ["What to study next", "What to practice"]
}

TRANSCRIPT:
${transcript.slice(0, 10000)}`;
}

// ===== USAGE TRACKING =====

const USAGE_KEY = 'sg_daily_usage';
const MAX_FREE_USES = 5;

export function getUsageToday(): number {
  try {
    const data = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
    const today = new Date().toISOString().split('T')[0];
    return data[today] || 0;
  } catch {
    return 0;
  }
}

export function incrementUsage(): void {
  try {
    const data = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
    const today = new Date().toISOString().split('T')[0];
    // Clean old dates
    const cleaned: Record<string, number> = {};
    cleaned[today] = (data[today] || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(cleaned));
  } catch {}
}

export function canUseFreeTier(): boolean {
  return getUsageToday() < MAX_FREE_USES;
}

export function getRemainingUses(): number {
  return Math.max(0, MAX_FREE_USES - getUsageToday());
}

// ===== API KEY MANAGEMENT =====

const API_KEY_STORAGE = 'sg_gemini_key';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

// ===== PARSE AI RESPONSE =====

export function parseJSON(text: string): any {
  // Try to extract JSON from markdown code blocks or raw text
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {}
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
