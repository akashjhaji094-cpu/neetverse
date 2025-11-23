export interface NeetChapter {
  id: string;
  name: string;
}

export interface NeetSubjectConfig {
  id: string;
  name: string;
  tagline?: string;
  chapters: NeetChapter[];
}

export const neetSubjects: NeetSubjectConfig[] = [
  {
    id: "physics",
    name: "Physics",
    tagline: "Conceptual understanding and numerical practice",
    chapters: [
      { id: "physics-and-measurements", name: "Physics and Measurements" },
      { id: "kinematics", name: "Kinematics" },
      { id: "laws-of-motion", name: "Laws of Motion" },
      { id: "work-energy-power", name: "Work, Energy and Power" },
      { id: "rotational-motion", name: "Rotational Motion" },
      { id: "gravitation", name: "Gravitation" },
      { id: "properties-of-solids-and-liquids", name: "Properties of Solids and Liquids" },
      { id: "thermodynamics", name: "Thermodynamics" },
      { id: "kinetic-theory-of-gases", name: "Kinetic Theory of Gases" },
      { id: "oscillations-and-waves", name: "Oscillations and Waves" },
      { id: "electrostatics", name: "Electrostatics" },
      { id: "current-electricity", name: "Current Electricity" },
      {
        id: "magnetic-effects-of-current-and-magnetism",
        name: "Magnetic Effects of Current and Magnetism",
      },
      {
        id: "electromagnetic-induction-and-alternating-currents",
        name: "Electromagnetic Induction and Alternating Currents",
      },
      { id: "electromagnetic-waves", name: "Electromagnetic Waves" },
      { id: "optics", name: "Optics (Ray Optics and Wave Optics)" },
      { id: "dual-nature-of-matter-and-radiation", name: "Dual Nature of Matter and Radiation" },
      { id: "atoms-and-nuclei", name: "Atoms and Nuclei" },
      { id: "electronic-devices", name: "Electronic Devices" },
      { id: "experimental-skills", name: "Experimental Skills (Practicals)" },
    ],
  },
  {
    id: "chemistry",
    name: "Chemistry",
    tagline: "Physical, Inorganic and Organic chemistry for NEET",
    chapters: [
      // Physical Chemistry
      { id: "some-basic-concepts-in-chemistry", name: "Some Basic Concepts in Chemistry" },
      { id: "atomic-structure", name: "Atomic Structure" },
      {
        id: "chemical-bonding-and-molecular-structure",
        name: "Chemical Bonding and Molecular Structure",
      },
      { id: "chemical-thermodynamics", name: "Chemical Thermodynamics" },
      { id: "solutions", name: "Solutions" },
      { id: "equilibrium", name: "Equilibrium" },
      {
        id: "redox-reactions-and-electrochemistry",
        name: "Redox Reactions and Electrochemistry",
      },
      { id: "chemical-kinetics", name: "Chemical Kinetics" },
      // Inorganic Chemistry
      {
        id: "classification-of-elements-and-periodicity-in-properties",
        name: "Classification of Elements and Periodicity in Properties",
      },
      { id: "p-block-elements", name: "p-Block Elements (Groups 13 to 18)" },
      { id: "d-and-f-block-elements", name: "d- and f-Block Elements" },
      { id: "coordination-compounds", name: "Co-ordination Compounds" },
      // Organic Chemistry
      {
        id: "purification-and-characterisation-of-organic-compounds",
        name: "Purification and Characterisation of Organic Compounds",
      },
      {
        id: "some-basic-principles-of-organic-chemistry",
        name: "Some Basic Principles of Organic Chemistry (GOC)",
      },
      { id: "hydrocarbons", name: "Hydrocarbons" },
      {
        id: "organic-compounds-containing-halogens",
        name: "Organic Compounds Containing Halogens (Haloalkanes and Haloarenes)",
      },
      {
        id: "organic-compounds-containing-oxygen",
        name:
          "Organic Compounds Containing Oxygen (Alcohols, Phenols, Ethers, Aldehydes, Ketones, Carboxylic Acids)",
      },
      {
        id: "organic-compounds-containing-nitrogen",
        name: "Organic Compounds Containing Nitrogen (Amines, Cyanides, Isocyanides)",
      },
      { id: "biomolecules", name: "Biomolecules" },
      {
        id: "principles-related-to-practical-chemistry",
        name: "Principles Related to Practical Chemistry",
      },
    ],
  },
  {
    id: "biology",
    name: "Biology",
    tagline: "Botany and Zoology topics combined",
    chapters: [
      { id: "the-living-world", name: "The Living World" },
      { id: "biological-classification", name: "Biological Classification" },
      { id: "plant-kingdom", name: "Plant Kingdom" },
      { id: "animal-kingdom", name: "Animal Kingdom" },
      { id: "morphology-of-flowering-plants", name: "Morphology of Flowering Plants" },
      { id: "anatomy-of-flowering-plants", name: "Anatomy of Flowering Plants" },
      { id: "structural-organisation-in-animals", name: "Structural Organisation in Animals" },
      { id: "cell-the-unit-of-life", name: "Cell: The Unit of Life" },
      { id: "biomolecules-biology", name: "Biomolecules" },
      { id: "cell-cycle-and-cell-division", name: "Cell Cycle and Cell Division" },
      { id: "photosynthesis-in-higher-plants", name: "Photosynthesis in Higher Plants" },
      { id: "respiration-in-plants", name: "Respiration in Plants" },
      { id: "plant-growth-and-development", name: "Plant Growth and Development" },
      { id: "breathing-and-exchange-of-gases", name: "Breathing and Exchange of Gases" },
      { id: "body-fluids-and-circulation", name: "Body Fluids and Circulation" },
      {
        id: "excretory-products-and-their-elimination",
        name: "Excretory Products and their Elimination",
      },
      { id: "locomotion-and-movement", name: "Locomotion and Movement" },
      { id: "neural-control-and-coordination", name: "Neural Control and Coordination" },
      {
        id: "chemical-coordination-and-integration",
        name: "Chemical Coordination and Integration",
      },
      {
        id: "sexual-reproduction-in-flowering-plants",
        name: "Sexual Reproduction in Flowering Plants",
      },
      { id: "human-reproduction", name: "Human Reproduction" },
      { id: "reproductive-health", name: "Reproductive Health" },
      {
        id: "principles-of-inheritance-and-variation",
        name: "Principles of Inheritance and Variation",
      },
      {
        id: "molecular-basis-of-inheritance",
        name: "Molecular Basis of Inheritance",
      },
      { id: "evolution", name: "Evolution" },
      { id: "human-health-and-disease", name: "Human Health and Disease" },
      { id: "microbes-in-human-welfare", name: "Microbes in Human Welfare" },
      {
        id: "biotechnology-principles-and-processes",
        name: "Biotechnology: Principles and Processes",
      },
      {
        id: "biotechnology-and-its-applications",
        name: "Biotechnology and its Applications",
      },
      { id: "organisms-and-populations", name: "Organisms and Populations" },
      { id: "ecosystem", name: "Ecosystem" },
      { id: "biodiversity-and-conservation", name: "Biodiversity and Conservation" },
    ],
  },
];
