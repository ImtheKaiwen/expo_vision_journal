const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;

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
               Ex: [{"text": "Breakfast", "time": "09:00", "isTimeAmbiguous": false}]
            4. If time is ambiguous (e.g. "at 7" but AM/PM unknown), set "isTimeAmbiguous": true and assign a default "time" (e.g. "07:00").
            5. "time" field MUST be in HH:mm format. Calculate relative expressions like "in 20 mins" based on ${currentTime}.
            6. Respond in ${lang === 'en' ? 'English' : 'Turkish'}.`
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
  console.log('--- CLAUDE GENEL ANALİZ ---');
  if (!CLAUDE_API_KEY) throw new Error('Claude API Key missing in .env');

  const systemPrompt = `You are a world-class forensic nutrition expert with elite visual recognition skills for global cuisines, specializing in Turkish, Middle Eastern, and Mediterranean dishes.
  
  IDENTIFICATION GUIDE:
  - İskender Kebap: Thinly sliced doner meat (meat slices, not minced) served over pide bread pieces, topped with hot tomato sauce and melted butter, with yogurt on the side and roasted peppers/tomatoes.
  - Adana/Urfa Kebap: Minced meat molded onto a skewer, grilled, and served with lavaş, onion salad, and roasted vegetables (No yogurt or tomato sauce on top).
  
  CORE CALCULATION LOGIC:
  1. ACCURATE IDENTIFICATION: Analyze the texture of the meat. If it's sliced döner meat with sauce and yogurt, it is "İskender Kebap".
  2. SCALE ANALYSIS: Compare food to utensils/table to estimate grams.
  3. QUANTITY: Use User Note "${userNote}" for multipliers.
  
  STRICT RULES:
  - If it's İskender, account for the butter and pide bread (high calorie density).
  - CULTURAL ACCURACY: Use precise names.
  - TEXT-ONLY MODE: If no image is provided, analyze based ONLY on the user note. Single meal names (e.g. "İskender", "Adana Kebap") are VALID inputs.
  - Gibberish Note (e.g. "asdf", "qwerty") -> isFood: false.
  - Respond ONLY with valid JSON.
  
  JSON Structure:
  {
    "isFood": true,
    "name": "Food Name (Amount/Portion) - in ${lang === 'en' ? 'English' : 'Turkish'}",
    "calories": 0,
    "protein": 0,
    "fat": 0,
    "carbs": 0,
    "estimatedWeightGrams": 0,
    "reasoning": "Explanation of calculation - in ${lang === 'en' ? 'English' : 'Turkish'}.",
    "errorMessage": "Error message - in ${lang === 'en' ? 'English' : 'Turkish'}"
  }`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              ...(base64Image ? [{
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: base64Image }
              }] : []),
              { type: 'text', text: userNote?.trim() ? `Analyze this meal based on the note: "${userNote}".` : `Analyze this meal based on the image provided.` }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    let text = data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed Yanıt:', parsed);
      return { ...parsed, success: parsed.isFood };
    }
    throw new Error('Geçerli JSON bulunamadı');
  } catch (error) {
    console.error('Meal Claude Analysis Error:', error);
    throw error;
  }
};
