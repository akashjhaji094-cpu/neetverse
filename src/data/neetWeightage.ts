// NEET 2025 chapter-wise weightage analysis
// Based on previous year trends and NEET pattern

export interface ChapterWeightage {
  chapterId: string;
  weight: number; // Higher weight = more questions from this chapter
}

export const physicsWeightage: ChapterWeightage[] = [
  { chapterId: "current-electricity", weight: 3 },
  { chapterId: "electrostatics", weight: 3 },
  { chapterId: "magnetic-effects-of-current-and-magnetism", weight: 3 },
  { chapterId: "electromagnetic-induction-and-alternating-currents", weight: 2 },
  { chapterId: "optics", weight: 3 },
  { chapterId: "modern-physics", weight: 2 },
  { chapterId: "atoms-and-nuclei", weight: 2 },
  { chapterId: "electronic-devices", weight: 2 },
  { chapterId: "kinematics", weight: 2 },
  { chapterId: "laws-of-motion", weight: 2 },
  { chapterId: "work-energy-power", weight: 2 },
  { chapterId: "rotational-motion", weight: 2 },
  { chapterId: "gravitation", weight: 1 },
  { chapterId: "properties-of-solids-and-liquids", weight: 2 },
  { chapterId: "thermodynamics", weight: 2 },
  { chapterId: "kinetic-theory-of-gases", weight: 1 },
  { chapterId: "oscillations-and-waves", weight: 2 },
  { chapterId: "electromagnetic-waves", weight: 1 },
  { chapterId: "dual-nature-of-matter-and-radiation", weight: 1 },
  { chapterId: "experimental-skills", weight: 1 },
  { chapterId: "physics-and-measurements", weight: 1 },
];

export const chemistryWeightage: ChapterWeightage[] = [
  // Physical Chemistry (Higher weightage)
  { chapterId: "chemical-bonding-and-molecular-structure", weight: 3 },
  { chapterId: "chemical-thermodynamics", weight: 2 },
  { chapterId: "equilibrium", weight: 3 },
  { chapterId: "redox-reactions-and-electrochemistry", weight: 2 },
  { chapterId: "chemical-kinetics", weight: 2 },
  { chapterId: "solutions", weight: 2 },
  { chapterId: "atomic-structure", weight: 2 },
  { chapterId: "some-basic-concepts-in-chemistry", weight: 1 },
  
  // Inorganic Chemistry
  { chapterId: "classification-of-elements-and-periodicity-in-properties", weight: 2 },
  { chapterId: "p-block-elements", weight: 3 },
  { chapterId: "d-and-f-block-elements", weight: 2 },
  { chapterId: "coordination-compounds", weight: 2 },
  
  // Organic Chemistry (Higher weightage)
  { chapterId: "some-basic-principles-of-organic-chemistry", weight: 3 },
  { chapterId: "hydrocarbons", weight: 2 },
  { chapterId: "organic-compounds-containing-halogens", weight: 2 },
  { chapterId: "organic-compounds-containing-oxygen", weight: 3 },
  { chapterId: "organic-compounds-containing-nitrogen", weight: 2 },
  { chapterId: "biomolecules", weight: 2 },
  { chapterId: "purification-and-characterisation-of-organic-compounds", weight: 1 },
  { chapterId: "principles-related-to-practical-chemistry", weight: 1 },
];

export const biologyWeightage: ChapterWeightage[] = [
  // Botany (High importance chapters)
  { chapterId: "plant-physiology", weight: 3 },
  { chapterId: "photosynthesis-in-higher-plants", weight: 3 },
  { chapterId: "respiration-in-plants", weight: 2 },
  { chapterId: "plant-growth-and-development", weight: 2 },
  { chapterId: "sexual-reproduction-in-flowering-plants", weight: 3 },
  { chapterId: "morphology-of-flowering-plants", weight: 2 },
  { chapterId: "anatomy-of-flowering-plants", weight: 2 },
  { chapterId: "plant-kingdom", weight: 2 },
  { chapterId: "biological-classification", weight: 2 },
  { chapterId: "the-living-world", weight: 1 },
  
  // Zoology (High importance chapters)
  { chapterId: "human-health-and-disease", weight: 3 },
  { chapterId: "human-reproduction", weight: 3 },
  { chapterId: "reproductive-health", weight: 2 },
  { chapterId: "principles-of-inheritance-and-variation", weight: 3 },
  { chapterId: "molecular-basis-of-inheritance", weight: 3 },
  { chapterId: "evolution", weight: 2 },
  { chapterId: "biotechnology-principles-and-processes", weight: 3 },
  { chapterId: "biotechnology-and-its-applications", weight: 2 },
  { chapterId: "organisms-and-populations", weight: 2 },
  { chapterId: "ecosystem", weight: 2 },
  { chapterId: "biodiversity-and-conservation", weight: 2 },
  { chapterId: "animal-kingdom", weight: 2 },
  { chapterId: "structural-organisation-in-animals", weight: 1 },
  { chapterId: "cell-the-unit-of-life", weight: 3 },
  { chapterId: "biomolecules-biology", weight: 2 },
  { chapterId: "cell-cycle-and-cell-division", weight: 2 },
  { chapterId: "breathing-and-exchange-of-gases", weight: 2 },
  { chapterId: "body-fluids-and-circulation", weight: 2 },
  { chapterId: "excretory-products-and-their-elimination", weight: 2 },
  { chapterId: "locomotion-and-movement", weight: 2 },
  { chapterId: "neural-control-and-coordination", weight: 2 },
  { chapterId: "chemical-coordination-and-integration", weight: 2 },
  { chapterId: "microbes-in-human-welfare", weight: 2 },
];

export function getWeightageForSubject(subjectSlug: string): ChapterWeightage[] {
  switch (subjectSlug.toLowerCase()) {
    case 'physics':
      return physicsWeightage;
    case 'chemistry':
      return chemistryWeightage;
    case 'biology':
      return biologyWeightage;
    default:
      return [];
  }
}

// Add randomization factor to make each test unique
export function addRandomVariation(baseWeight: number): number {
  // Add ±20% random variation to the weight
  const variation = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
  return Math.max(1, Math.round(baseWeight * variation));
}
