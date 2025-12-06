const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Clean and normalize question text
function cleanQuestionText(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  
  // Remove option numbers from question text (they're duplicated)
  cleaned = cleaned.replace(/\s*\(1\)[^(]*\(2\)[^(]*\(3\)[^(]*\(4\)[^)]*$/s, '');
  
  // Fix common LaTeX errors
  cleaned = cleaned.replace(/\\lamda/g, '\\lambda');
  cleaned = cleaned.replace(/\/lamda/g, '\\lambda');
  cleaned = cleaned.replace(/\\alfa/g, '\\alpha');
  cleaned = cleaned.replace(/\\bita/g, '\\beta');
  cleaned = cleaned.replace(/\\gama/g, '\\gamma');
  
  // Fix HTML entities
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/&ndash;/g, '–');
  cleaned = cleaned.replace(/&mdash;/g, '—');
  cleaned = cleaned.replace(/&rsquo;/g, "'");
  cleaned = cleaned.replace(/&lsquo;/g, "'");
  cleaned = cleaned.replace(/&rdquo;/g, '"');
  cleaned = cleaned.replace(/&ldquo;/g, '"');
  cleaned = cleaned.replace(/&times;/g, '×');
  cleaned = cleaned.replace(/&divide;/g, '÷');
  cleaned = cleaned.replace(/&plusmn;/g, '±');
  cleaned = cleaned.replace(/&deg;/g, '°');
  cleaned = cleaned.replace(/&micro;/g, 'µ');
  cleaned = cleaned.replace(/&Omega;/g, 'Ω');
  cleaned = cleaned.replace(/&alpha;/g, 'α');
  cleaned = cleaned.replace(/&beta;/g, 'β');
  cleaned = cleaned.replace(/&gamma;/g, 'γ');
  cleaned = cleaned.replace(/&delta;/g, 'δ');
  cleaned = cleaned.replace(/&lambda;/g, 'λ');
  cleaned = cleaned.replace(/&mu;/g, 'μ');
  cleaned = cleaned.replace(/&pi;/g, 'π');
  cleaned = cleaned.replace(/&theta;/g, 'θ');
  cleaned = cleaned.replace(/&phi;/g, 'φ');
  cleaned = cleaned.replace(/&psi;/g, 'ψ');
  cleaned = cleaned.replace(/&omega;/g, 'ω');
  cleaned = cleaned.replace(/&rho;/g, 'ρ');
  cleaned = cleaned.replace(/&sigma;/g, 'σ');
  cleaned = cleaned.replace(/&tau;/g, 'τ');
  cleaned = cleaned.replace(/&epsilon;/g, 'ε');
  cleaned = cleaned.replace(/&eta;/g, 'η');
  cleaned = cleaned.replace(/&nu;/g, 'ν');
  cleaned = cleaned.replace(/&xi;/g, 'ξ');
  
  // Remove escaped HTML tags
  cleaned = cleaned.replace(/<\/?em>/gi, '');
  cleaned = cleaned.replace(/<\/?strong>/gi, '');
  cleaned = cleaned.replace(/<\/?b>/gi, '');
  cleaned = cleaned.replace(/<\/?i>/gi, '');
  cleaned = cleaned.replace(/<\/?u>/gi, '');
  cleaned = cleaned.replace(/<\/?p>/gi, '');
  cleaned = cleaned.replace(/<\/?span[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/?div[^>]*>/gi, '');
  cleaned = cleaned.replace(/<br\s*\/?>/gi, ' ');
  
  // Fix double backslashes
  cleaned = cleaned.replace(/\\\\/g, '\\');
  
  // Fix spacing issues
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();
  
  // Remove trailing question marks if duplicated
  cleaned = cleaned.replace(/\?\s*\?+/g, '?');
  
  return cleaned;
}

// Parse options from string format to clean array
function parseOptions(options: any): string[] {
  if (!options) return [];
  
  // If already an array of clean strings
  if (Array.isArray(options)) {
    // Check if options are in "(1) text" format
    const cleaned = options.map((opt: string) => {
      if (typeof opt !== 'string') return String(opt);
      
      let cleanOpt = opt;
      
      // Remove leading option numbers like "(1)", "(2)", "(A)", "(B)", "1.", "2.", etc.
      cleanOpt = cleanOpt.replace(/^\s*\(?[1-4ABCD]\)?[\.\)]\s*/i, '');
      
      // Apply same cleaning as question text
      cleanOpt = cleanQuestionText(cleanOpt);
      
      return cleanOpt;
    });
    
    return cleaned;
  }
  
  // If it's a string, try to parse
  if (typeof options === 'string') {
    // Try to split by option markers
    const matches = options.match(/\(?\d\)?[.\)]\s*[^(]+/g);
    if (matches && matches.length >= 4) {
      return matches.slice(0, 4).map(opt => {
        let cleanOpt = opt.replace(/^\s*\(?[1-4]\)?[\.\)]\s*/i, '');
        return cleanQuestionText(cleanOpt);
      });
    }
  }
  
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create client with anon key to validate user JWT
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Unauthorized");
    }

    console.log("Authenticated user:", user.email);

    // Create service role client for admin operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["superadmin", "content_admin"])
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("Role check error:", roleError);
      throw new Error("Only admins can clean questions");
    }

    const { batchSize = 100, offset = 0 } = await req.json();

    console.log(`Cleaning questions: batch ${batchSize}, offset ${offset}`);

    // Fetch questions in batches
    const { data: questions, error: fetchError } = await supabase
      .from("questions")
      .select("id, question_text, options, explanation")
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      throw fetchError;
    }

    if (!questions || questions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No more questions to clean",
          processed: 0,
          offset,
          done: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${questions.length} questions...`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const question of questions) {
      try {
        const cleanedText = cleanQuestionText(question.question_text);
        const cleanedOptions = parseOptions(question.options);
        const cleanedExplanation = question.explanation ? cleanQuestionText(question.explanation) : null;

        // Only update if something changed
        const textChanged = cleanedText !== question.question_text;
        const optionsChanged = JSON.stringify(cleanedOptions) !== JSON.stringify(question.options);
        const explanationChanged = cleanedExplanation !== question.explanation;

        if (textChanged || optionsChanged || explanationChanged) {
          const { error: updateError } = await supabase
            .from("questions")
            .update({
              question_text: cleanedText,
              options: cleanedOptions,
              explanation: cleanedExplanation
            })
            .eq("id", question.id);

          if (updateError) {
            console.error(`Error updating question ${question.id}:`, updateError);
            errorCount++;
          } else {
            updatedCount++;
          }
        }
      } catch (err) {
        console.error(`Error processing question ${question.id}:`, err);
        errorCount++;
      }
    }

    console.log(`Batch complete: ${updatedCount} updated, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: questions.length,
        updated: updatedCount,
        errors: errorCount,
        offset,
        nextOffset: offset + batchSize,
        done: questions.length < batchSize
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in clean-questions:", error);
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
