/**
 * Client-side HTML question parser - NO AI needed.
 * Parses structured HTML files from MentorBox/ExamBro format.
 * Extracts questions, options, images, and matches correct answers from answer key.
 */

export interface ParsedQuestion {
  question_number: number;
  question_text: string;
  question_html: string;
  options: string[];
  options_html: string[];
  correct_option_index: number | null;
  answer_value: string;
  images: string[];
  has_diagram: boolean;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  title: string;
  subject: string;
  totalInFile: number;
  matchedAnswers: number;
}

/** Normalize text for comparison: strip whitespace, lowercase, remove $ signs and latex wrappers */
function normalizeForMatch(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim()
    .toLowerCase();
}

/** Extract clean text from an HTML element, preserving meaningful content */
function getCleanText(el: Element): string {
  // Get innerHTML but strip nested divs/containers that are options, etc.
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

export function parseHtmlFile(htmlContent: string, fileName: string): ParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  // Extract metadata
  const titleEl = doc.querySelector('.test-title');
  const title = titleEl?.textContent?.trim() || 'Unknown';
  
  const subtitleEl = doc.querySelector('.test-subtitle');
  const subject = subtitleEl?.textContent?.replace('Subjects:', '').trim() || '';

  // Parse answer key first
  const answerMap = new Map<number, string>();
  const answerItems = doc.querySelectorAll('.answer-item');
  answerItems.forEach(item => {
    const numEl = item.querySelector('.answer-number');
    const valEl = item.querySelector('.answer-value');
    if (numEl && valEl) {
      const numText = numEl.textContent?.trim() || '';
      const match = numText.match(/Q?(\d+)/i);
      if (match) {
        const qNum = parseInt(match[1]);
        // Store the innerHTML to preserve math/formatting for matching
        const answerHtml = valEl.innerHTML.trim();
        const answerText = valEl.textContent?.trim() || '';
        answerMap.set(qNum, answerText);
      }
    }
  });

  // Parse questions
  const questionItems = doc.querySelectorAll('.question-item');
  const questions: ParsedQuestion[] = [];

  questionItems.forEach(qItem => {
    const numEl = qItem.querySelector('.question-number');
    const contentEl = qItem.querySelector('.question-content');
    if (!numEl || !contentEl) return;

    const numText = numEl.textContent?.trim() || '';
    const qNum = parseInt(numText.replace('.', ''));
    if (isNaN(qNum)) return;

    // Extract question text (everything before .options, excluding nested special divs)
    // Clone the content element to manipulate
    const contentClone = contentEl.cloneNode(true) as Element;
    // Remove options div from clone
    const optionsDiv = contentClone.querySelector('.options');
    if (optionsDiv) optionsDiv.remove();
    // Remove question-image divs for text extraction (but keep track of images)
    const imgDivs = contentClone.querySelectorAll('.question-image');
    imgDivs.forEach(d => d.remove());

    // Get the question HTML and text
    const questionHtml = contentClone.innerHTML
      .replace(/\s+/g, ' ')
      .trim();
    const questionText = contentClone.textContent?.replace(/\s+/g, ' ').trim() || '';

    // Extract images
    const images: string[] = [];
    const imgElements = contentEl.querySelectorAll('.question-image img');
    imgElements.forEach(img => {
      const src = img.getAttribute('src');
      if (src) images.push(src);
    });

    // Extract options
    const optionElements = contentEl.querySelectorAll('.option');
    const options: string[] = [];
    const optionsHtml: string[] = [];

    optionElements.forEach(opt => {
      const optTextEl = opt.querySelector('.option-text');
      if (optTextEl) {
        options.push(optTextEl.textContent?.replace(/\s+/g, ' ').trim() || '');
        optionsHtml.push(optTextEl.innerHTML.trim());
      }
    });

    // Match correct answer
    let correctIndex: number | null = null;
    const answerValue = answerMap.get(qNum) || '';

    if (answerValue && options.length > 0) {
      const normalizedAnswer = normalizeForMatch(answerValue);

      // Try exact match first
      for (let i = 0; i < options.length; i++) {
        const normalizedOption = normalizeForMatch(options[i]);
        if (normalizedOption === normalizedAnswer) {
          correctIndex = i;
          break;
        }
      }

      // Try contains match if no exact match
      if (correctIndex === null) {
        for (let i = 0; i < options.length; i++) {
          const normalizedOption = normalizeForMatch(options[i]);
          if (normalizedOption.includes(normalizedAnswer) || normalizedAnswer.includes(normalizedOption)) {
            correctIndex = i;
            break;
          }
        }
      }

      // Try numeric match (answer is just "4" meaning option 4)
      if (correctIndex === null) {
        const answerNum = parseInt(answerValue);
        if (!isNaN(answerNum) && answerNum >= 1 && answerNum <= options.length) {
          // Only use numeric match if answer is a plain number and doesn't look like an option value
          const isPlainNumber = /^\d+$/.test(answerValue.trim());
          // Check if any option is also just that number (then it's a value match not index)
          const optionIsNumber = options.some(o => normalizeForMatch(o) === answerValue.trim());
          if (isPlainNumber && !optionIsNumber) {
            correctIndex = answerNum - 1;
          }
        }
      }
    }

    questions.push({
      question_number: qNum,
      question_text: questionText,
      question_html: questionHtml,
      options,
      options_html: optionsHtml,
      correct_option_index: correctIndex,
      answer_value: answerValue,
      images,
      has_diagram: images.length > 0,
    });
  });

  return {
    questions,
    title,
    subject,
    totalInFile: questions.length,
    matchedAnswers: questions.filter(q => q.correct_option_index !== null).length,
  };
}
