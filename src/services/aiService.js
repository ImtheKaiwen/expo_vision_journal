const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
import { getAIUsage, incrementAIUsage } from '../storage';

export const generateAIPlan = async (userInput, existingTodos = [], currentDate = '', lang = 'tr') => {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API Key missing');

  const now = new Date();
  const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
  const existingTasksStr = existingTodos.map(t => `- ${t.text}${t.time ? ' (' + t.time + ')' : ''}`).join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional personal assistant and task planner. 
            Today's Date: ${currentDate || now.toDateString()}. Local Time: ${currentTime}.
            
            User's Current Active (Incomplete) Tasks:
            ${existingTasksStr || 'No active tasks in the list.'}
            
            Instructions:
            1. Analyze user input and create NEW tasks.
            2. NEVER duplicate existing active tasks.
            3. Return ONLY a JSON array of objects. 
               Ex: [{"text": "Breakfast", "time": "09:00", "isTimeAmbiguous": false, "category": "morning"}]
            4. Assign a "category" to each task: "morning" (05:00-12:00), "afternoon" (12:00-17:00), "evening" (17:00-04:59), or "general" (no time/specific time of day).
            5. Even if no time is specified, use context (e.g., "Breakfast" is "morning").
            6. ONLY include "time" if specified (e.g. "at 7", "afternoon", "9 pm") or relative ("in 1 hour"). Otherwise, set "time": null.
            7. If time is ambiguous (e.g. "at 7" without AM/PM or "morning/evening" context), set "isTimeAmbiguous": true.
            8. If user explicitly says "at 7 pm" or "evening 7", set "time": "19:00" and "isTimeAmbiguous": false.
            9. "time" field MUST be in HH:mm format. Calculate relative expressions like "in 20 mins" based on ${currentTime}.
            10. Respond in ${lang === 'en' ? 'English' : 'Turkish'}.`
          },
          { role: 'user', content: userInput }
        ],
        temperature: 0.7
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Markdown ve temizlik
    const jsonStr = content.match(/\[[\s\S]*\]/)?.[0] || content;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('AI Plan Error:', error);
    throw error;
  }
};

export const transcribeAudio = async (uri) => {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API Key missing');

  const formData = new FormData();
  formData.append('file', {
    uri,
    name: 'audio.m4a',
    type: 'audio/m4a',
  });
  formData.append('model', 'whisper-1');

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.text;
  } catch (error) {
    console.error('Transcription Error:', error);
    throw error;
  }
};

export const analyzeMealImage = async (base64Image, userNote, lang = 'tr') => {
  console.log('--- GEMINI 2.5 FLASH ANALİZİ ---');
  const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('Gemini API Key missing');

  // Limit kontrolü
  const usage = await getAIUsage();
  if (usage >= 50) {
    const error = new Error('DAILY_LIMIT_REACHED');
    throw error;
  }

  const promptText = `Analyze this meal image. First, identify the food items. 
  Then, use your extensive knowledge base to estimate the most accurate calories and macros for these specific items, taking into account any portions or brand names mentioned in this note: "${userNote}".
  
  You must provide a realistic scientific breakdown based on standard nutritional databases.
  
  Respond ONLY with valid JSON:
  {
    "isFood": true,
    "name": "Food Name (Portion) - in ${lang === 'en' ? 'English' : 'Turkish'}",
    "calories": 0,
    "protein": 0,
    "fat": 0,
    "carbs": 0,
    "estimatedWeightGrams": 0,
    "reasoning": "Breakdown using estimated nutritional data - in ${lang === 'en' ? 'English' : 'Turkish'}.",
    "errorMessage": "Error message - in ${lang === 'en' ? 'English' : 'Turkish'}"
  }`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            ...(base64Image ? [{
              inline_data: { mime_type: "image/jpeg", data: base64Image }
            }] : [])
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const rawText = data.candidates[0].content.parts[0].text;
    console.log('Gemini Ham Yanıt:', rawText);
    
    // JSON'u metin içinden ayıkla
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Geçerli JSON bulunamadı');
    
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.isFood) {
      await incrementAIUsage();
    }
    return { ...parsed, success: parsed.isFood };
  } catch (error) {
    console.error('Meal Gemini Analysis Error:', error);
    throw error;
  }
};
