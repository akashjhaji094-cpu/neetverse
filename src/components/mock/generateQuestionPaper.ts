import { Question } from "@/lib/supabase";

interface PaperConfig {
  title: string;
  totalQuestions: number;
  totalMarks: number;
  duration: string;
  subjectGroups: { name: string; startIdx: number; endIdx: number }[];
}

function escapeHtml(text: string): string {
  return text;
}

function renderOption(opt: string, idx: number): string {
  const labels = ['A', 'B', 'C', 'D'];
  return `<div class="option"><span class="opt-label">(${labels[idx]})</span> <span class="opt-text">${escapeHtml(opt)}</span></div>`;
}

export function generateQuestionPaper(
  questions: Question[],
  subjectMap: Record<string, string>,
  config: PaperConfig
) {
  const subjectSections = config.subjectGroups.map(group => {
    const sectionQuestions = questions.slice(group.startIdx, group.endIdx);
    const questionsHtml = sectionQuestions.map((q, i) => {
      const qNum = group.startIdx + i + 1;
      const options = (q.options as string[]) || [];
      return `
        <div class="question">
          <div class="q-header">
            <span class="q-num">Q.${qNum}</span>
            <span class="q-text">${escapeHtml(q.question_text)}</span>
          </div>
          <div class="options-grid">
            ${options.map((opt, oi) => renderOption(opt, oi)).join('')}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="subject-section">
        <div class="subject-header">${group.name} (Q.${group.startIdx + 1} – Q.${group.endIdx})</div>
        ${questionsHtml}
      </div>
    `;
  }).join('');

  // OMR sheet
  const omrRows = questions.map((_, i) => {
    const qNum = i + 1;
    return `
      <tr>
        <td class="omr-qnum">${qNum}</td>
        <td class="omr-bubble">○</td>
        <td class="omr-bubble">○</td>
        <td class="omr-bubble">○</td>
        <td class="omr-bubble">○</td>
      </tr>
    `;
  }).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${config.title} — NEETVerse</title>
  <script>
    window.MathJax = {
      tex: { inlineMath: [['$','$'], ['\\\\(','\\\\)']], displayMath: [['$$','$$'], ['\\\\[','\\\\]']] },
      startup: {
        ready: function() {
          MathJax.startup.defaultReady();
          MathJax.startup.promise.then(function() {
            setTimeout(function() { window.print(); }, 500);
          });
        }
      }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async></script>
  <style>
    @page {
      size: A4;
      margin: 15mm 12mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', 'Georgia', serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #000;
      background: #fff;
    }

    /* Header */
    .paper-header {
      text-align: center;
      border-bottom: 3px double #000;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-name {
      font-size: 28pt;
      font-weight: bold;
      letter-spacing: 3px;
      color: #1a1a6e;
    }
    .brand-tagline {
      font-size: 9pt;
      color: #555;
      margin-top: 2px;
    }
    .paper-title {
      font-size: 16pt;
      font-weight: bold;
      margin-top: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .paper-meta {
      display: flex;
      justify-content: space-between;
      font-size: 10pt;
      margin-top: 8px;
      padding: 6px 0;
      border-top: 1px solid #ccc;
    }
    .paper-meta span { font-weight: 600; }

    /* Instructions */
    .instructions {
      border: 1px solid #000;
      padding: 10px 14px;
      margin-bottom: 16px;
      background: #f9f9f9;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    .instructions h4 {
      font-size: 10pt;
      margin-bottom: 6px;
      text-decoration: underline;
    }
    .instructions ul { padding-left: 18px; }
    .instructions li { margin-bottom: 3px; }

    /* Student info */
    .student-info {
      display: flex;
      gap: 20px;
      margin-bottom: 14px;
      font-size: 10pt;
    }
    .student-info .field {
      flex: 1;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
    }
    .student-info .field-label { font-weight: bold; }

    /* Subject sections */
    .subject-section { margin-bottom: 8px; }
    .subject-header {
      font-size: 13pt;
      font-weight: bold;
      text-align: center;
      padding: 8px 0;
      margin: 12px 0 8px;
      border-top: 2px solid #000;
      border-bottom: 1px solid #000;
      background: #f0f0f0;
      text-transform: uppercase;
      letter-spacing: 1px;
      page-break-after: avoid;
    }

    /* Questions */
    .question {
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .q-header {
      margin-bottom: 5px;
    }
    .q-num {
      font-weight: bold;
      margin-right: 6px;
    }
    .q-text {
      /* Allow inline HTML/LaTeX */
    }
    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 24px;
      margin-left: 28px;
      margin-top: 4px;
    }
    .option {
      display: flex;
      gap: 4px;
      align-items: baseline;
    }
    .opt-label {
      font-weight: bold;
      min-width: 24px;
    }

    /* OMR Sheet */
    .omr-page {
      page-break-before: always;
    }
    .omr-title {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .omr-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    .omr-table th, .omr-table td {
      border: 1px solid #000;
      padding: 4px 8px;
      text-align: center;
    }
    .omr-table th { background: #f0f0f0; font-weight: bold; }
    .omr-qnum { font-weight: bold; width: 50px; }
    .omr-bubble { font-size: 14pt; width: 50px; }

    /* Footer */
    .paper-footer {
      text-align: center;
      font-size: 8pt;
      color: #888;
      margin-top: 20px;
      border-top: 1px solid #ccc;
      padding-top: 6px;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="paper-header">
    <div class="brand-name">NEETVerse</div>
    <div class="brand-tagline">Your Universe of NEET Preparation</div>
    <div class="paper-title">${config.title}</div>
    <div class="paper-meta">
      <span>Total Questions: ${config.totalQuestions}</span>
      <span>Maximum Marks: ${config.totalMarks}</span>
      <span>Duration: ${config.duration}</span>
    </div>
  </div>

  <!-- Student Info -->
  <div class="student-info">
    <div class="field"><span class="field-label">Name:</span> ___________________________</div>
    <div class="field"><span class="field-label">Date:</span> _______________</div>
    <div class="field"><span class="field-label">Roll No:</span> ___________</div>
  </div>

  <!-- Instructions -->
  <div class="instructions">
    <h4>General Instructions</h4>
    <ul>
      <li>This question paper contains ${config.totalQuestions} questions.</li>
      <li>Each question carries <strong>4 marks</strong>. For each wrong answer, <strong>1 mark</strong> will be deducted.</li>
      <li>No marks will be deducted for unattempted questions.</li>
      <li>Use the OMR sheet at the end to mark your answers.</li>
      <li>Use of calculator is <strong>NOT</strong> permitted.</li>
      <li>Duration of the test is <strong>${config.duration}</strong>.</li>
    </ul>
  </div>

  <!-- Questions -->
  ${subjectSections}

  <!-- OMR Sheet -->
  <div class="omr-page">
    <div class="paper-header">
      <div class="brand-name">NEETVerse</div>
      <div class="omr-title">OMR Answer Sheet</div>
      <div class="student-info" style="margin-top:8px;">
        <div class="field"><span class="field-label">Name:</span> ___________________________</div>
        <div class="field"><span class="field-label">Date:</span> _______________</div>
      </div>
    </div>
    <table class="omr-table">
      <thead>
        <tr><th>Q.No</th><th>A</th><th>B</th><th>C</th><th>D</th></tr>
      </thead>
      <tbody>
        ${omrRows}
      </tbody>
    </table>
  </div>

  <div class="paper-footer">
    Generated by NEETVerse — neetverse.lovable.app — All the best! 🎯
  </div>
</body>
</html>
  `;

  return html;
}

export function printQuestionPaper(
  questions: Question[],
  subjectMap: Record<string, string>,
  config: PaperConfig
) {
  const html = generateQuestionPaper(questions, subjectMap, config);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
