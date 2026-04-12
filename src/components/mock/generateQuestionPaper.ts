import { Question } from "@/lib/supabase";

interface PaperConfig {
  title: string;
  totalQuestions: number;
  totalMarks: number;
  duration: string;
  subjectGroups: { name: string; startIdx: number; endIdx: number }[];
}

function renderQuestionImages(images: string[] | null | undefined): string {
  if (!images || images.length === 0) return '';
  return images.map(src => 
    `<div class="q-image"><img src="${src}" crossorigin="anonymous" style="max-width:100%;max-height:200px;margin:6px 0;" /></div>`
  ).join('');
}

function renderOption(opt: string, idx: number): string {
  const labels = ['A', 'B', 'C', 'D'];
  return `<div class="option"><span class="opt-label">(${labels[idx]})</span> <span class="opt-text">${opt}</span></div>`;
}

function generateCompactOMR(totalQuestions: number): string {
  // Fit all questions in a single page using multi-column grid layout
  const cols = totalQuestions <= 90 ? 6 : 9;
  const perCol = Math.ceil(totalQuestions / cols);
  
  let columnsHtml = '';
  for (let c = 0; c < cols; c++) {
    const start = c * perCol;
    const end = Math.min(start + perCol, totalQuestions);
    let rows = '';
    for (let i = start; i < end; i++) {
      const qNum = i + 1;
      rows += `<tr>
        <td class="omr-q">${qNum}</td>
        <td class="omr-b">◯</td>
        <td class="omr-b">◯</td>
        <td class="omr-b">◯</td>
        <td class="omr-b">◯</td>
      </tr>`;
    }
    columnsHtml += `<div class="omr-col">
      <table class="omr-grid">
        <thead><tr><th>Q</th><th>A</th><th>B</th><th>C</th><th>D</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  return `
    <div class="omr-page">
      <div class="omr-header">
        <div class="omr-brand">NEETVerse</div>
        <div class="omr-brand-tag">OMR Answer Sheet</div>
        <div class="omr-student-row">
          <span>Name: _______________________________</span>
          <span>Date: _______________</span>
          <span>Roll No: ___________</span>
        </div>
      </div>
      <div class="omr-columns">${columnsHtml}</div>
      <div class="omr-footer">
        <span>Total Questions: ${totalQuestions}</span>
        <span>Fill the correct bubble completely ●</span>
        <span>NEETVerse — neetverse.lovable.app</span>
      </div>
    </div>
  `;
}

function generateAnswerKey(questions: Question[], config: PaperConfig): string {
  const labels = ['A', 'B', 'C', 'D'];
  const cols = config.totalQuestions <= 90 ? 6 : 9;
  const perCol = Math.ceil(config.totalQuestions / cols);

  let columnsHtml = '';
  for (let c = 0; c < cols; c++) {
    const start = c * perCol;
    const end = Math.min(start + perCol, config.totalQuestions);
    let rows = '';
    for (let i = start; i < end; i++) {
      const q = questions[i];
      const ans = q?.correct_option_index != null ? labels[q.correct_option_index] : '—';
      rows += `<tr><td class="ak-q">${i + 1}</td><td class="ak-a">${ans}</td></tr>`;
    }
    columnsHtml += `<div class="ak-col">
      <table class="ak-table">
        <thead><tr><th>Q</th><th>Ans</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  return `
    <div class="answer-key-page">
      <div class="omr-header">
        <div class="omr-brand">NEETVerse</div>
        <div class="omr-brand-tag">Answer Key — ${config.title}</div>
      </div>
      <div class="ak-columns">${columnsHtml}</div>
      <div class="omr-footer">
        <span>+4 for correct, −1 for incorrect</span>
        <span>NEETVerse — neetverse.lovable.app</span>
      </div>
    </div>
  `;
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
      const images = (q.images as string[]) || [];
      const rawHtml = q.raw_html || '';
      // Use raw_html if available (preserves LaTeX + images), else fallback to question_text
      const questionContent = rawHtml || q.question_text;
      return `
        <div class="question">
          <div class="q-header">
            <span class="q-num">Q.${qNum}</span>
            <span class="q-text">${questionContent}</span>
          </div>
          ${renderQuestionImages(images)}
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

  const omrHtml = generateCompactOMR(config.totalQuestions);
  const answerKeyHtml = generateAnswerKey(questions, config);

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
            // Wait for images to load too
            var imgs = document.querySelectorAll('img');
            var promises = [];
            imgs.forEach(function(img) {
              if (!img.complete) {
                promises.push(new Promise(function(resolve) {
                  img.onload = resolve;
                  img.onerror = resolve;
                }));
              }
            });
            Promise.all(promises).then(function() {
              setTimeout(function() { window.print(); }, 800);
            });
          });
        }
      }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async></script>
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', 'Georgia', serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }

    /* Header */
    .paper-header {
      text-align: center;
      border-bottom: 3px double #000;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .brand-name { font-size: 26pt; font-weight: bold; letter-spacing: 3px; color: #1a1a6e; }
    .brand-tagline { font-size: 9pt; color: #555; margin-top: 2px; }
    .paper-title { font-size: 15pt; font-weight: bold; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
    .paper-meta { display: flex; justify-content: space-between; font-size: 10pt; margin-top: 6px; padding: 5px 0; border-top: 1px solid #ccc; }
    .paper-meta span { font-weight: 600; }

    .student-info { display: flex; gap: 16px; margin-bottom: 12px; font-size: 10pt; }
    .student-info .field { flex: 1; border-bottom: 1px solid #000; padding-bottom: 3px; }
    .student-info .field-label { font-weight: bold; }

    .instructions { border: 1px solid #000; padding: 8px 12px; margin-bottom: 14px; background: #f9f9f9; font-size: 9.5pt; page-break-inside: avoid; }
    .instructions h4 { font-size: 10pt; margin-bottom: 5px; text-decoration: underline; }
    .instructions ul { padding-left: 18px; }
    .instructions li { margin-bottom: 2px; }

    .subject-section { margin-bottom: 6px; }
    .subject-header {
      font-size: 12pt; font-weight: bold; text-align: center; padding: 6px 0; margin: 10px 0 6px;
      border-top: 2px solid #000; border-bottom: 1px solid #000; background: #f0f0f0;
      text-transform: uppercase; letter-spacing: 1px; page-break-after: avoid;
    }

    .question { margin-bottom: 12px; page-break-inside: avoid; }
    .q-header { margin-bottom: 4px; }
    .q-num { font-weight: bold; margin-right: 5px; }
    .q-image { margin: 4px 0 4px 28px; }
    .q-image img { max-width: 90%; max-height: 180px; border: 1px solid #ddd; border-radius: 4px; }
    .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 20px; margin-left: 28px; margin-top: 3px; }
    .option { display: flex; gap: 4px; align-items: baseline; }
    .opt-label { font-weight: bold; min-width: 22px; }

    /* OMR - Compact single page */
    .omr-page { page-break-before: always; }
    .omr-header {
      text-align: center; padding: 8px 0; margin-bottom: 8px;
      border-bottom: 3px solid #cc0000;
    }
    .omr-brand { font-size: 28pt; font-weight: bold; color: #cc0000; letter-spacing: 4px; }
    .omr-brand-tag { font-size: 13pt; font-weight: bold; color: #cc0000; margin-top: 2px; }
    .omr-student-row { display: flex; justify-content: space-between; font-size: 9pt; margin-top: 6px; padding-top: 4px; border-top: 1px solid #cc0000; }
    .omr-columns { display: flex; gap: 3px; flex-wrap: nowrap; }
    .omr-col { flex: 1; min-width: 0; }
    .omr-grid { width: 100%; border-collapse: collapse; font-size: 7pt; }
    .omr-grid th { background: #cc0000; color: #fff; padding: 2px 1px; font-size: 6.5pt; border: 1px solid #cc0000; }
    .omr-grid td { border: 1px solid #ccc; padding: 1px 2px; text-align: center; }
    .omr-q { font-weight: bold; font-size: 7pt; width: 18px; }
    .omr-b { font-size: 8pt; width: 16px; color: #999; }
    .omr-footer { display: flex; justify-content: space-between; font-size: 7pt; color: #cc0000; margin-top: 6px; padding-top: 4px; border-top: 2px solid #cc0000; font-weight: bold; }

    /* Answer Key - Compact single page */
    .answer-key-page { page-break-before: always; }
    .ak-columns { display: flex; gap: 4px; flex-wrap: nowrap; }
    .ak-col { flex: 1; min-width: 0; }
    .ak-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
    .ak-table th { background: #1a1a6e; color: #fff; padding: 2px 4px; font-size: 7pt; border: 1px solid #1a1a6e; }
    .ak-table td { border: 1px solid #ccc; padding: 1px 4px; text-align: center; }
    .ak-q { font-weight: bold; font-size: 7.5pt; }
    .ak-a { font-weight: bold; color: #1a1a6e; font-size: 8pt; }

    .paper-footer { text-align: center; font-size: 8pt; color: #888; margin-top: 16px; border-top: 1px solid #ccc; padding-top: 5px; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
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

  <div class="student-info">
    <div class="field"><span class="field-label">Name:</span> ___________________________</div>
    <div class="field"><span class="field-label">Date:</span> _______________</div>
    <div class="field"><span class="field-label">Roll No:</span> ___________</div>
  </div>

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

  ${subjectSections}

  ${omrHtml}

  ${answerKeyHtml}

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
