export async function onRequestPost(context) {
  try {
    const request = context.request;
    const body = await request.json();
    const prompt = body.prompt;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[API] GEMINI_API_KEY is not configured in Cloudflare settings');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      console.error('[API] Gemini API Error:', errorData);
      
      let errorMessage = 'Failed to fetch insights from AI provider';
      if (errorData.error && errorData.error.message) {
        errorMessage = `Gemini Error: ${errorData.error.message}`;
      }
      
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await geminiResponse.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return new Response(JSON.stringify({
        text: data.candidates[0].content.parts[0].text
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid response format from AI provider' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[API] Internal Server Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
