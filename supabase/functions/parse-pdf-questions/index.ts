import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth + admin check ---
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["superadmin", "content_admin"])
      .maybeSingle();
    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      throw new Error("Text content is required");
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("AI API key not configured");
    }

    console.log(`Parsing text with ${text.length} characters...`);

    // Split text into chunks if too large
    const MAX_CHUNK = 15000;
    const chunks: string[] = [];

    if (text.length <= MAX_CHUNK) {
      chunks.push(text);
    } else {
      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= MAX_CHUNK) {
          chunks.push(remaining);
          break;
        }
        // Try to split at a question boundary
        let splitPoint = remaining.lastIndexOf("\n", MAX_CHUNK);
        if (splitPoint <= 0) splitPoint = MAX_CHUNK;
        chunks.push(remaining.substring(0, splitPoint));
        remaining = remaining.substring(splitPoint);
      }
    }

    const allQuestions: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)...`);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a NEET exam question parser. You will receive extracted text from HTML files that were converted from PDFs. The text may have spacing issues (characters separated by spaces) or formatting artifacts.

Your job is to extract ALL questions accurately. For EACH question extract:
1. question_number: The question number as it appears
2. question_text: The full cleaned question text with proper formatting. Fix spacing issues, merge separated characters.
3. options: Array of exactly 4 option texts (clean, without A/B/C/D or (1)/(2)/(3)/(4) prefixes)
4. correct_option_index: 0-based index (0,1,2,3) of the correct answer if identifiable from the content. Use null if not determinable.
5. explanation: Solution/explanation if provided, otherwise null
6. has_diagram: true if the question references a figure/diagram/graph/image

CRITICAL RULES:
- Extract EVERY question, don't skip any
- Fix character spacing (e.g. "C h e m i s t r y" → "Chemistry")
- Clean mathematical notation properly (use readable text like "x²", "H₃PO₄" etc.)
- Options should be clean without letter/number prefixes
- If answer section exists, match answers to questions
- Return ONLY valid JSON, no markdown code blocks`,
            },
            {
              role: "user",
              content: `Extract all questions from this text:\n\n${chunk}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_questions",
                description: "Extract structured questions from exam text",
                parameters: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          question_number: { type: "number" },
                          question_text: { type: "string" },
                          options: {
                            type: "array",
                            items: { type: "string" },
                            minItems: 4,
                            maxItems: 4,
                          },
                          correct_option_index: {
                            type: ["number", "null"],
                          },
                          explanation: { type: ["string", "null"] },
                          has_diagram: { type: "boolean" },
                        },
                        required: [
                          "question_number",
                          "question_text",
                          "options",
                          "correct_option_index",
                          "explanation",
                          "has_diagram",
                        ],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["questions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_questions" },
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI API error:", response.status, errText);
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ success: false, error: "Rate limited. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ success: false, error: "AI credits exhausted. Please add funds." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`AI API error: ${response.status}`);
      }

      const aiResult = await response.json();

      // Extract from tool call response
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          if (parsed.questions && Array.isArray(parsed.questions)) {
            allQuestions.push(...parsed.questions);
          }
        } catch (parseErr) {
          console.error("Failed to parse tool call arguments:", parseErr);
        }
      } else {
        // Fallback: try parsing content directly
        const content = aiResult.choices?.[0]?.message?.content || "";
        try {
          let jsonStr = content;
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1];
          const parsed = JSON.parse(jsonStr.trim());
          if (parsed.questions && Array.isArray(parsed.questions)) {
            allQuestions.push(...parsed.questions);
          }
        } catch (parseErr) {
          console.error("Failed to parse AI response:", parseErr);
        }
      }
    }

    console.log(`Total questions extracted: ${allQuestions.length}`);

    return new Response(
      JSON.stringify({ success: true, questions: allQuestions, totalChunks: chunks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
