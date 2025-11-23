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
      .single();

    if (roleError || !roleData) {
      console.error("Role check error:", roleError);
      throw new Error("Only admins can import questions");
    }

    console.log("User role verified:", roleData.role);

    const { questions } = await req.json();

    console.log(`Importing ${questions.length} questions...`);

    // Get subject and chapter to ensure they exist
    const subjectId = questions[0]?.subject_id;
    const chapterSlug = questions[0]?.chapter_id;

    if (!subjectId || !chapterSlug) {
      throw new Error("Subject and chapter are required");
    }

    // Find or create subject
    let { data: subject } = await supabase
      .from("subjects")
      .select("id")
      .eq("slug", subjectId)
      .single();

    if (!subject) {
      const { data: newSubject, error: subjectError } = await supabase
        .from("subjects")
        .insert({
          name: subjectId.charAt(0).toUpperCase() + subjectId.slice(1),
          slug: subjectId,
        })
        .select("id")
        .single();

      if (subjectError) throw subjectError;
      subject = newSubject;
    }

    // Find or create chapter
    let { data: chapter } = await supabase
      .from("chapters")
      .select("id")
      .eq("slug", chapterSlug)
      .eq("subject_id", subject.id)
      .single();

    if (!chapter) {
      const chapterName = chapterSlug
        .split("-")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      const { data: newChapter, error: chapterError } = await supabase
        .from("chapters")
        .insert({
          name: chapterName,
          slug: chapterSlug,
          subject_id: subject.id,
        })
        .select("id")
        .single();

      if (chapterError) throw chapterError;
      chapter = newChapter;
    }

    // Insert questions
    const questionsToInsert = questions.map((q: any) => ({
      question_text: q.question_text,
      options: q.options,
      correct_option_index: q.correct_option_index,
      explanation: q.explanation,
      images: q.images || [],
      difficulty: q.difficulty || "auto_medium",
      subject_id: subject.id,
      chapter_id: chapter.id,
      source_file: q.source_file,
    }));

    const { data: insertedQuestions, error: insertError } = await supabase
      .from("questions")
      .insert(questionsToInsert)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    console.log(`Successfully imported ${insertedQuestions.length} questions`);

    return new Response(
      JSON.stringify({
        success: true,
        count: insertedQuestions.length,
        questions: insertedQuestions,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in import-questions:", error);
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
