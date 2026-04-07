const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, pageCount } = await req.json();

    if (!text || typeof text !== "string") {
      throw new Error("PDF text content is required");
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("AI API key not configured");
    }

    console.log(`Parsing PDF with ${text.length} characters from ${pageCount} pages...`);

    // Split text into chunks if too large (process in batches)
    const MAX_CHUNK = 12000;
    const chunks: string[] = [];
    
    if (text.length <= MAX_CHUNK) {
      chunks.push(text);
    } else {
      // Split by page markers or by size
      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= MAX_CHUNK) {
          chunks.push(remaining);
          break;
        }
        // Try to split at a question boundary
        let splitPoint = remaining.lastIndexOf("\n#", MAX_CHUNK);
        if (splitPoint <= 0) splitPoint = remaining.lastIndexOf("\n", MAX_CHUNK);
        if (splitPoint <= 0) splitPoint = MAX_CHUNK;
        chunks.push(remaining.substring(0, splitPoint));
        remaining = remaining.substring(splitPoint);
      }
    }

    const allQuestions: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)...`);

      const prompt = `You are a NEET exam question parser. Extract ALL questions from this text content of a PDF.

For EACH question, extract:
1. question_number: The question number
2. question_text: The full question text (clean it up, fix encoding issues)
3. options: Array of exactly 4 option texts (without option labels like (1), (2) etc.)
4. correct_option_index: 0-based index (0,1,2,3) of the correct answer. If the answer/solution section mentions the correct option, use that. If not determinable, use null.
5. explanation: If there's a solution/explanation provided for this question, include it. Otherwise null.
6. has_diagram: true if the question references a figure/diagram/graph

IMPORTANT RULES:
- Extract EVERY question, don't skip any
- Clean up mathematical notation (use readable text like "x²" not LaTeX)
- Options should be clean text without "(1)", "(2)" prefixes
- If answer key or solutions section exists, match answers to questions
- Return valid JSON only, no markdown

Return format:
{"questions": [{"question_number": 1, "question_text": "...", "options": ["...", "...", "...", "..."], "correct_option_index": 3, "explanation": "...", "has_diagram": false}, ...]}

PDF CONTENT:
${chunk}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 8000,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI API error:", errText);
        throw new Error(`AI API error: ${response.status}`);
      }

      const aiResult = await response.json();
      const content = aiResult.choices?.[0]?.message?.content || "";
      
      console.log("AI response length:", content.length);

      // Parse JSON from AI response
      try {
        // Remove markdown code blocks if present
        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
        
        const parsed = JSON.parse(jsonStr.trim());
        if (parsed.questions && Array.isArray(parsed.questions)) {
          allQuestions.push(...parsed.questions);
        }
      } catch (parseErr) {
        console.error("Failed to parse AI response:", parseErr);
        console.error("Response content:", content.substring(0, 500));
      }
    }

    console.log(`Total questions extracted: ${allQuestions.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        questions: allQuestions,
        totalChunks: chunks.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in parse-pdf-questions:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
