/**
 * Seed topics — 2 per seeded subject.
 * Topics are subject-scoped. Since the same subject name (e.g. "Mathematics")
 * may exist across multiple exam types as separate Subject entities, we include
 * examTypeName to disambiguate during seeding.
 *
 * content: Markdown + LaTeX — shown on /student/topics/:id detail page.
 */

export interface TopicSeed {
  subjectName: string;
  examTypeName: string; // used to find the right Subject entity
  name: string;
  content: string;
}

export const topicsSeedData: TopicSeed[] = [
  // ── JAMB Mathematics ───────────────────────────────────────────────────────
  {
    subjectName: 'Mathematics',
    examTypeName: 'JAMB',
    name: 'Differentiation',
    content: `## Differentiation

Differentiation is the process of finding the **derivative** of a function — the rate at which one quantity changes with respect to another.

### The Power Rule
For $f(x) = x^n$, the derivative is:
$$f'(x) = nx^{n-1}$$

**Example:** $f(x) = x^3 - 4x^2 + 7x - 2$

Differentiate term by term:
$$f'(x) = 3x^2 - 8x + 7$$

### The Chain Rule
For a composite function $f(g(x))$:
$$\\frac{d}{dx}[f(g(x))] = f'(g(x)) \\cdot g'(x)$$

### Product Rule
For $y = u \\cdot v$:
$$\\frac{dy}{dx} = u\\frac{dv}{dx} + v\\frac{du}{dx}$$

### Quotient Rule
For $y = \\frac{u}{v}$:
$$\\frac{dy}{dx} = \\frac{v\\frac{du}{dx} - u\\frac{dv}{dx}}{v^2}$$

### Applications
- **Finding turning points:** Set $f'(x) = 0$ and solve
- **Determining nature:** Use $f''(x)$ — positive means minimum, negative means maximum
- **Rates of change:** $\\frac{ds}{dt}$ gives velocity; $\\frac{dv}{dt}$ gives acceleration`,
  },
  {
    subjectName: 'Mathematics',
    examTypeName: 'JAMB',
    name: 'Integration',
    content: `## Integration

Integration is the reverse of differentiation. It computes the **area under a curve** or reconstructs a function from its derivative.

### The Power Rule (Integration)
$$\\int x^n \\, dx = \\frac{x^{n+1}}{n+1} + C \\quad (n \\neq -1)$$

### Definite Integrals
$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$
where $F$ is any antiderivative of $f$.

**Example:** $\\int_0^1 (3x^2 + 2x)\\,dx$

$$= \\Big[x^3 + x^2\\Big]_0^1 = (1 + 1) - (0 + 0) = 2$$

### Standard Integrals

| Function | Integral |
|----------|----------|
| $e^x$ | $e^x + C$ |
| $\\frac{1}{x}$ | $\\ln|x| + C$ |
| $\\sin x$ | $-\\cos x + C$ |
| $\\cos x$ | $\\sin x + C$ |

### Integration by Substitution
Let $u = g(x)$, then $du = g'(x)\\,dx$:
$$\\int f(g(x))g'(x)\\,dx = \\int f(u)\\,du$$`,
  },

  // ── JAMB English Language ──────────────────────────────────────────────────
  {
    subjectName: 'English Language',
    examTypeName: 'JAMB',
    name: 'Comprehension and Summary',
    content: `## Comprehension and Summary

Reading comprehension tests your ability to understand and extract meaning from a passage.

### Approach to Comprehension Questions

1. **Read the passage actively** — underline key ideas as you read
2. **Identify the main idea** — what is the passage primarily about?
3. **Look for supporting details** — how does the author support the main point?
4. **Infer meaning** — use context to understand unfamiliar words

### Types of Questions

- **Literal:** The answer is stated directly in the passage
- **Inferential:** You must draw conclusions from what is implied
- **Vocabulary in context:** Choose the meaning that fits the passage, not just the general definition
- **Tone/attitude:** What is the writer's attitude toward the subject?

### Summary Writing Tips

- Identify the **main points** only — avoid examples and illustrations
- Use **your own words** where possible
- Keep to the **word limit** strictly
- Write in **continuous prose** (not bullet points unless asked)
- Begin with a **topic sentence** that captures the theme

### Common Pitfalls
- Lifting sentences verbatim from the passage (paraphrase instead)
- Including irrelevant details
- Losing the logical flow between sentences`,
  },
  {
    subjectName: 'English Language',
    examTypeName: 'JAMB',
    name: 'Grammar and Usage',
    content: `## Grammar and Usage

A solid grasp of English grammar is essential for JAMB success.

### Parts of Speech

| Part of Speech | Function | Example |
|----------------|----------|---------|
| Noun | Names a person, place, thing, idea | *teacher, Lagos, honesty* |
| Pronoun | Replaces a noun | *he, she, it, they* |
| Verb | Shows action or state | *run, is, seems* |
| Adjective | Modifies a noun | *tall, beautiful* |
| Adverb | Modifies a verb/adjective/adverb | *quickly, very* |
| Preposition | Shows relationship | *in, on, under, between* |
| Conjunction | Joins words/clauses | *and, but, because, although* |

### Tense Consistency
Always maintain the same tense within a sentence unless a time shift is intended.

❌ *She **was** singing when he **enters** the room.*
✅ *She **was** singing when he **entered** the room.*

### Subject-Verb Agreement
The verb must agree with the **subject**, not the object.

❌ *The quality of the results **are** poor.*
✅ *The quality of the results **is** poor.*

### Concord Rules
- Collective nouns (team, committee, government) take **singular** verbs in most contexts
- **Neither…nor / Either…or:** the verb agrees with the **closer** subject
  - *Neither the teacher nor the students **were** present.*

### Figures of Speech
- **Simile:** A direct comparison using *like* or *as* — *brave as a lion*
- **Metaphor:** An implied comparison — *He is a lion in battle*
- **Personification:** Giving human qualities to non-human things — *The wind whispered*
- **Irony:** Saying one thing but meaning another`,
  },

  // ── JAMB Physics ──────────────────────────────────────────────────────────
  {
    subjectName: 'Physics',
    examTypeName: 'JAMB',
    name: "Newton's Laws of Motion",
    content: `## Newton's Laws of Motion

Newton's three laws describe the relationship between forces and motion.

### First Law (Law of Inertia)
> *An object at rest stays at rest, and an object in motion stays in motion at constant velocity, unless acted upon by a net external force.*

- **Inertia** is the tendency of an object to resist changes to its motion
- Mass is the measure of inertia

### Second Law
> *The net force on an object equals the product of its mass and acceleration.*

$$F_{net} = ma$$

**Units:** Force in Newtons (N), mass in kg, acceleration in m/s²

**Example:** A 10 kg box accelerates at 3 m/s². Net force = 10 × 3 = **30 N**

### Third Law (Action-Reaction)
> *For every action there is an equal and opposite reaction.*

The two forces act on **different** objects — they never cancel each other.

### Momentum and Impulse
- **Momentum:** $p = mv$ (kg·m/s)
- **Impulse:** $J = F\\Delta t = \\Delta p$
- **Conservation of Momentum:** In a closed system, total momentum is constant

$$m_1u_1 + m_2u_2 = m_1v_1 + m_2v_2$$

### Friction
- **Static friction** ($f_s = \\mu_s N$): acts before motion begins
- **Kinetic friction** ($f_k = \\mu_k N$): acts during motion; always $\\mu_k < \\mu_s$`,
  },
  {
    subjectName: 'Physics',
    examTypeName: 'JAMB',
    name: 'Electricity and Circuits',
    content: `## Electricity and Circuits

### Ohm's Law
$$V = IR$$

where $V$ = voltage (V), $I$ = current (A), $R$ = resistance (Ω).

### Series Circuits
- Same current flows through all components
- Total resistance: $R_T = R_1 + R_2 + R_3 + \\ldots$
- Voltages add up: $V_T = V_1 + V_2 + V_3$

### Parallel Circuits
- Same voltage across all branches
- Total resistance: $\\frac{1}{R_T} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3}$
- Currents add up: $I_T = I_1 + I_2 + I_3$

### Electric Power
$$P = IV = I^2R = \\frac{V^2}{R}$$

**Units:** Watts (W); 1 kWh = 3.6 × 10⁶ J

### Electromotive Force (EMF)
For a battery with internal resistance $r$:
$$V_{terminal} = \\varepsilon - Ir$$

### Kirchhoff's Laws
1. **Current Law (KCL):** Sum of currents into a node = sum out
2. **Voltage Law (KVL):** Sum of voltage drops around any loop = 0

### Capacitors
- **Capacitance:** $C = \\frac{Q}{V}$ (Farads)
- Series: $\\frac{1}{C_T} = \\frac{1}{C_1} + \\frac{1}{C_2}$
- Parallel: $C_T = C_1 + C_2$`,
  },

  // ── JAMB Chemistry ────────────────────────────────────────────────────────
  {
    subjectName: 'Chemistry',
    examTypeName: 'JAMB',
    name: 'Atomic Structure',
    content: `## Atomic Structure

### Subatomic Particles

| Particle | Symbol | Charge | Mass (amu) | Location |
|----------|--------|--------|------------|----------|
| Proton | p⁺ | +1 | 1 | Nucleus |
| Neutron | n⁰ | 0 | 1 | Nucleus |
| Electron | e⁻ | -1 | ~0 | Orbitals |

### Key Definitions
- **Atomic number (Z):** number of protons (= electrons in neutral atom)
- **Mass number (A):** protons + neutrons
- **Isotopes:** same Z, different mass number (e.g., $^{12}C$ and $^{14}C$)

### Electron Configuration
Electrons fill orbitals in order of increasing energy:

$$1s^2 \\; 2s^2 \\; 2p^6 \\; 3s^2 \\; 3p^6 \\; 4s^2 \\; 3d^{10} \\; \\ldots$$

**Aufbau Principle:** Fill lowest-energy orbitals first.
**Hund's Rule:** In degenerate orbitals, one electron enters each before pairing.
**Pauli Exclusion:** No two electrons can have the same four quantum numbers.

### Periodic Trends (left → right across a period)
- Atomic radius **decreases**
- Ionisation energy **increases**
- Electronegativity **increases**
- Metallic character **decreases**

### Valence Electrons and Bonding
- Valence electrons are in the outermost shell
- Atoms bond to achieve a **full outer shell** (octet rule)
- **Ionic bonding:** electron transfer (e.g., NaCl)
- **Covalent bonding:** electron sharing (e.g., H₂O)`,
  },
  {
    subjectName: 'Chemistry',
    examTypeName: 'JAMB',
    name: 'Chemical Equilibrium',
    content: `## Chemical Equilibrium

### Dynamic Equilibrium
A reversible reaction reaches equilibrium when the **forward and reverse rates are equal** — concentrations remain constant but both reactions continue.

$$aA + bB \\rightleftharpoons cC + dD$$

### Equilibrium Constant $K_c$
$$K_c = \\frac{[C]^c[D]^d}{[A]^a[B]^b}$$

- $K_c > 1$: products favoured
- $K_c < 1$: reactants favoured
- Pure solids and liquids are **excluded**

### Le Chatelier's Principle
*If a system at equilibrium is disturbed, it shifts to counteract the disturbance.*

| Disturbance | System Response |
|-------------|-----------------|
| Increase concentration of reactant | Shift **forward** |
| Decrease concentration of product | Shift **forward** |
| Increase temperature (exothermic rxn) | Shift **backward** |
| Increase pressure (gas reaction) | Shift toward **fewer moles** |
| Add catalyst | **No shift** — reaches equilibrium faster |

### Haber Process (Ammonia Synthesis)
$$N_2(g) + 3H_2(g) \\rightleftharpoons 2NH_3(g) \\quad \\Delta H = -92 \\; \\text{kJ/mol}$$

- **High pressure** (200 atm): favours products (fewer moles)
- **Low temperature** (450°C): favours products but too slow; compromise used
- **Iron catalyst**: increases rate without affecting $K$

### Acid-Base Equilibria
$$K_a = \\frac{[H^+][A^-]}{[HA]}, \\quad \\text{pH} = -\\log[H^+]$$`,
  },

  // ── JAMB Biology ──────────────────────────────────────────────────────────
  {
    subjectName: 'Biology',
    examTypeName: 'JAMB',
    name: 'Cell Biology',
    content: `## Cell Biology

The cell is the basic structural and functional unit of all living organisms.

### Prokaryotic vs Eukaryotic Cells

| Feature | Prokaryotic | Eukaryotic |
|---------|-------------|------------|
| Nucleus | Absent (nucleoid) | Present (membrane-bound) |
| Size | 1–10 μm | 10–100 μm |
| Organelles | None (except ribosomes) | Many |
| Examples | Bacteria, Archaea | Animals, Plants, Fungi |

### Key Organelles

- **Nucleus:** controls cell activities; contains DNA
- **Mitochondria:** site of aerobic respiration; "powerhouse of the cell"
- **Chloroplast:** (plants) site of photosynthesis; contains chlorophyll
- **Ribosome:** site of protein synthesis
- **Endoplasmic Reticulum:** transport network; rough ER has ribosomes
- **Golgi Apparatus:** packages and secretes proteins
- **Lysosome:** contains digestive enzymes; breaks down waste
- **Cell Wall:** (plants/bacteria) provides rigidity and support
- **Vacuole:** (plants) stores water and maintains turgor pressure

### Cell Division

**Mitosis** — produces 2 genetically identical daughter cells for growth and repair:
PMAT: Prophase → Metaphase → Anaphase → Telophase

**Meiosis** — produces 4 genetically unique gametes (half the chromosome number):
Involves two rounds of division; crossing-over during Prophase I increases variation

### Diffusion and Osmosis
- **Diffusion:** movement of molecules from high to low concentration
- **Osmosis:** diffusion of water through a selectively permeable membrane
- **Active transport:** movement against the concentration gradient; requires ATP`,
  },
  {
    subjectName: 'Biology',
    examTypeName: 'JAMB',
    name: 'Genetics and Heredity',
    content: `## Genetics and Heredity

Genetics studies how traits are passed from parents to offspring.

### Key Terms
- **Gene:** a segment of DNA that codes for a trait
- **Allele:** alternative forms of a gene (e.g., T for tall, t for short)
- **Homozygous:** two identical alleles (TT or tt)
- **Heterozygous:** two different alleles (Tt)
- **Dominant:** allele expressed even in one copy (T)
- **Recessive:** allele expressed only when homozygous (tt)
- **Genotype:** genetic makeup (e.g., Tt)
- **Phenotype:** observable trait (e.g., tall)

### Mendel's Laws
1. **Law of Segregation:** allele pairs separate during gamete formation; each gamete gets one allele
2. **Law of Independent Assortment:** genes on different chromosomes segregate independently

### Monohybrid Cross
Cross Tt × Tt:

|   | T | t |
|---|---|---|
| **T** | TT | Tt |
| **t** | Tt | tt |

Genotype ratio: 1TT : 2Tt : 1tt
Phenotype ratio: **3 tall : 1 short**

### Sex-Linked Traits
- Carried on the X chromosome (e.g., colour blindness, haemophilia)
- Females (XX) can be carriers; males (XY) either have it or not
- Affected female: $X^hX^h$; Carrier female: $X^HX^h$; Affected male: $X^hY$

### Blood Groups (ABO System)
- Alleles: $I^A$, $I^B$ (codominant), $i$ (recessive)
- Blood group O: $ii$; A: $I^AI^A$ or $I^Ai$; B: $I^BI^B$ or $I^Bi$; AB: $I^AI^B$`,
  },
];
