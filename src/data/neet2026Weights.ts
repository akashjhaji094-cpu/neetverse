// NEET 2026 chapterwise weightage (from official analysis)
// Used to distribute mock test questions proportionally across selected chapters.

export type SubjectKey = "physics" | "chemistry" | "biology";

export interface ChapterWeight {
  name: string; // Canonical name (used for fuzzy match against DB chapter names)
  weight: number; // Questions asked in NEET 2026 paper
  aliases?: string[]; // Alternative names for matching
}

export const NEET_2026_WEIGHTS: Record<SubjectKey, ChapterWeight[]> = {
  physics: [
    { name: "Current Electricity", weight: 4 },
    { name: "Electrostatics", weight: 3, aliases: ["Electric Charges and Fields", "Electrostatic Potential and Capacitance"] },
    { name: "Moving Charges and Magnetism", weight: 3 },
    { name: "Oscillations", weight: 3, aliases: ["SHM", "Simple Harmonic Motion"] },
    { name: "Units and Measurements", weight: 3, aliases: ["Physics and Measurements"] },
    { name: "Semiconductor Devices", weight: 3, aliases: ["Electronic Devices", "Semiconductor"] },
    { name: "Rotational Motion", weight: 2 },
    { name: "Kinematics", weight: 2, aliases: ["Motion in a Straight Line", "Motion in a Plane"] },
    { name: "Laws of Motion", weight: 2 },
    { name: "Alternating Current", weight: 2 },
    { name: "Ray Optics", weight: 2, aliases: ["Ray Optics and Optical Instruments", "Optics"] },
    { name: "Wave Optics", weight: 2 },
    { name: "Dual Nature of Radiation and Matter", weight: 2, aliases: ["Dual Nature of Matter and Radiation"] },
    { name: "Nuclei", weight: 2, aliases: ["Atoms and Nuclei"] },
    { name: "Gravitation", weight: 1 },
    { name: "Work Energy and Power", weight: 1, aliases: ["Work, Energy and Power"] },
    { name: "Mechanical Properties of Solids", weight: 1, aliases: ["Properties of Solids and Liquids"] },
    { name: "Mechanical Properties of Fluids", weight: 1 },
    { name: "Thermodynamics", weight: 1 },
    { name: "Kinetic Theory", weight: 1, aliases: ["Kinetic Theory of Gases"] },
    { name: "Waves", weight: 1, aliases: ["Oscillations and Waves"] },
    { name: "Electromagnetic Induction", weight: 1, aliases: ["Electromagnetic Induction and Alternating Currents"] },
    { name: "Electromagnetic Waves", weight: 1 },
    { name: "Atoms", weight: 1 },
    { name: "Centre of Mass and System of Particles", weight: 1 },
    { name: "Circular Motion", weight: 1 },
    { name: "Thermal Properties of Matter", weight: 1 },
    { name: "Magnetism and Matter", weight: 1, aliases: ["Magnetic Effects of Current and Magnetism"] },
  ],
  chemistry: [
    { name: "Coordination Compounds", weight: 4 },
    { name: "Salt Analysis", weight: 4, aliases: ["Purification Qualitative Quantitative Analysis", "Practical Chemistry", "Principles Related to Practical Chemistry"] },
    { name: "Chemical Bonding and Molecular Structure", weight: 3 },
    { name: "Ionic Equilibrium", weight: 3 },
    { name: "Chemical Kinetics", weight: 3 },
    { name: "Amines", weight: 3, aliases: ["Organic Compounds Containing Nitrogen"] },
    { name: "Organic Chemistry Some Basic Principles Techniques GOC", weight: 3, aliases: ["Some Basic Principles of Organic Chemistry", "Organic Chemistry Some Basic Principles Techniques IUPAC", "Organic Chemistry Some Basic Principles Techniques Isomerism"] },
    { name: "Classification of Elements and Periodicity in Properties", weight: 2, aliases: ["Periodic Table"] },
    { name: "Solutions", weight: 2 },
    { name: "Electrochemistry", weight: 2, aliases: ["Redox Reactions and Electrochemistry"] },
    { name: "Chemical Thermodynamics", weight: 2, aliases: ["Thermodynamics Thermochemistry"] },
    { name: "D and F Block Elements", weight: 2, aliases: ["The D and F Block Elements"] },
    { name: "Haloalkanes and Haloarenes", weight: 2, aliases: ["Organic Compounds Containing Halogens"] },
    { name: "P Block Elements", weight: 2, aliases: ["The P Block Elements"] },
    { name: "Chemical Equilibrium", weight: 1, aliases: ["Equilibrium"] },
    { name: "Some Basic Concepts of Chemistry", weight: 1, aliases: ["Mole Concept", "Some Basic Concepts in Chemistry"] },
    { name: "Structure of Atom", weight: 1, aliases: ["Atomic Structure"] },
    { name: "Hydrocarbons", weight: 1, aliases: ["Hydrocarbon"] },
    { name: "Alcohols Ethers and Phenols", weight: 1, aliases: ["Alcohols Phenols and Ethers", "Organic Compounds Containing Oxygen"] },
    { name: "Aldehydes Ketones and Carboxylic Acids", weight: 1 },
    { name: "Biomolecules", weight: 1 },
    { name: "Redox Reaction", weight: 1 },
  ],
  biology: [
    { name: "Biotechnology and its Applications", weight: 10, aliases: ["Biotechnology Principles and Processes", "Biotechnology Principles Processes"] },
    { name: "Animal Kingdom", weight: 7 },
    { name: "Biodiversity and Conservation", weight: 5 },
    { name: "Molecular Basis of Inheritance", weight: 5 },
    { name: "Principles of Inheritance and Variation", weight: 5 },
    { name: "Biomolecules Biology", weight: 5, aliases: ["Biomolecules"] },
    { name: "Human Reproduction", weight: 4 },
    { name: "Cell the Unit of Life", weight: 4, aliases: ["Cell Structure and Function"] },
    { name: "Locomotion and Movement", weight: 3, aliases: ["Locomotion Movement"] },
    { name: "Morphology of Flowering Plants", weight: 3 },
    { name: "Anatomy of Flowering Plants", weight: 3 },
    { name: "Photosynthesis in Higher Plants", weight: 3 },
    { name: "Sexual Reproduction in Flowering Plants", weight: 3 },
    { name: "Evolution", weight: 3 },
    { name: "Ecosystem", weight: 3 },
    { name: "Organisms and Populations", weight: 3, aliases: ["Ecology Population"] },
    { name: "Cell Cycle and Cell Division", weight: 2 },
    { name: "Respiration in Plants", weight: 2 },
    { name: "Breathing and Exchange of Gases", weight: 2 },
    { name: "Excretory Products and their Elimination", weight: 2, aliases: ["Excretory Products Their Elimination"] },
    { name: "Body Fluids and Circulation", weight: 2 },
    { name: "Plant Growth and Development", weight: 2 },
    { name: "Human Health and Disease", weight: 2, aliases: ["Human Health and Diseases"] },
    { name: "Biological Classification", weight: 2 },
    { name: "Neural Control and Coordination", weight: 1, aliases: ["Neural Control Coordination"] },
    { name: "Chemical Coordination and Integration", weight: 1, aliases: ["Chemical Coordination Integration"] },
    { name: "Reproductive Health", weight: 1 },
    { name: "Plant Kingdom", weight: 1 },
    { name: "Microbes in Human Welfare", weight: 1 },
    { name: "The Living World", weight: 1 },
    { name: "Structural Organisation in Animals", weight: 1, aliases: ["Structural Organization in Animals"] },
  ],
};

// Normalize: lowercase + remove all non-alphanumerics
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Find NEET 2026 weight for a chapter by name (fuzzy match).
 * Returns 1 (default low weight) if no match found, so unknown chapters still get a chance.
 */
export function getChapterWeight(subject: SubjectKey, chapterName: string): number {
  const target = norm(chapterName);
  const list = NEET_2026_WEIGHTS[subject] || [];
  for (const cw of list) {
    if (norm(cw.name) === target) return cw.weight;
    if (cw.aliases?.some(a => norm(a) === target)) return cw.weight;
    // substring match (e.g. "Electric Charges and Fields" ⊂ "Electrostatics")
    if (norm(cw.name).includes(target) || target.includes(norm(cw.name))) return cw.weight;
  }
  return 1;
}

/**
 * Largest Remainder Method — distribute N questions across chapters proportional to weights.
 * Returns { chapterId: questionCount }, summing exactly to N.
 */
export function largestRemainder<T extends { id: string; weight: number }>(
  chapters: T[],
  totalN: number
): Record<string, number> {
  if (!chapters.length || totalN <= 0) return {};
  const W = chapters.reduce((s, c) => s + c.weight, 0);
  if (W === 0) return {};

  const items = chapters.map(c => {
    const raw = (c.weight / W) * totalN;
    const floor = Math.floor(raw);
    return { id: c.id, weight: c.weight, floor, frac: raw - floor, final: 0 };
  });

  const distributed = items.reduce((s, i) => s + i.floor, 0);
  let R = totalN - distributed;

  items.sort((a, b) => b.frac - a.frac || b.weight - a.weight);
  items.forEach((item, idx) => {
    item.final = item.floor + (idx < R ? 1 : 0);
  });

  const out: Record<string, number> = {};
  items.forEach(i => { out[i.id] = i.final; });
  return out;
}

/**
 * Weighted allocation that guarantees `minPerChapter` (default 1) for every chapter
 * that has available questions, then distributes the remainder by weight (largest remainder).
 *
 * - If totalN < eligible.length: top-(totalN) chapters by weight get 1, rest get 0.
 * - Otherwise: every eligible chapter gets `minPerChapter`, then remainder is weighted.
 *
 * `available` (optional) caps allocation per chapter; uncapped if omitted.
 */
export function allocateWeighted<T extends { id: string; weight: number; available?: number }>(
  chapters: T[],
  totalN: number,
  opts: { minPerChapter?: number } = {}
): Record<string, number> {
  const min = opts.minPerChapter ?? 1;
  const out: Record<string, number> = {};
  if (!chapters.length || totalN <= 0) return out;

  const eligible = chapters.filter(c => (c.available ?? Infinity) > 0);
  if (!eligible.length) return out;

  // Case A: not enough room for min-per-chapter — pick top-N by weight.
  if (totalN < eligible.length * min) {
    const sorted = [...eligible].sort((a, b) => b.weight - a.weight);
    let left = totalN;
    for (const c of sorted) {
      if (left <= 0) break;
      const give = Math.min(min, left, c.available ?? Infinity);
      out[c.id] = give;
      left -= give;
    }
    return out;
  }

  // Case B: seed min for each, then weighted distribute the rest.
  eligible.forEach(c => { out[c.id] = Math.min(min, c.available ?? Infinity); });
  let remaining = totalN - eligible.reduce((s, c) => s + out[c.id], 0);

  // Iteratively distribute by weight, respecting capacity.
  while (remaining > 0) {
    const candidates = eligible.filter(c => (out[c.id] || 0) < (c.available ?? Infinity));
    if (!candidates.length) break;
    const extra = largestRemainder(candidates.map(c => ({ id: c.id, weight: c.weight })), remaining);
    let progressed = false;
    for (const c of candidates) {
      const give = Math.min(extra[c.id] || 0, (c.available ?? Infinity) - (out[c.id] || 0));
      if (give > 0) {
        out[c.id] = (out[c.id] || 0) + give;
        remaining -= give;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return out;
}
