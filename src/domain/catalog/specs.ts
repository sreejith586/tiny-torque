// Real-car performance specs on a catalogue model (F-25 racing input, MV-W08-prep, D-075).
// zod at the boundary (D-013); the DB backstop is `catalog_specs_valid()` + the CHECK constraint
// in 0022_catalog_specs — keep the two rule sets identical. All keys optional: `{}` means "no
// specs known", which is the normal state for fantasy castings (they race on an archetype).
//
// PURE and dependency-free apart from zod on purpose: `domain/races/stats.ts` imports the type
// from here, and the W08 Edge `run-race` function will import the same module.
import { z } from 'zod';

export const DRIVETRAINS = ['fwd', 'rwd', 'awd'] as const;
export type Drivetrain = (typeof DRIVETRAINS)[number];

/** Bounds mirror 0022_catalog_specs `catalog_specs_valid()` exactly. */
export const SPEC_BOUNDS = {
  power_kw: { min: 0, max: 2500, exclusiveMin: true },
  torque_nm: { min: 0, max: 5000, exclusiveMin: true },
  weight_kg: { min: 300, max: 10000, exclusiveMin: false },
  zero_to_100_s: { min: 1, max: 60, exclusiveMin: false },
  top_speed_kmh: { min: 30, max: 600, exclusiveMin: false },
  drag_cd: { min: 0.1, max: 1.5, exclusiveMin: false },
  model_year: { min: 1880, max: 2100, exclusiveMin: false },
} as const;

export const SPEC_KEYS = [
  'power_kw',
  'torque_nm',
  'weight_kg',
  'zero_to_100_s',
  'top_speed_kmh',
  'drivetrain',
  'drag_cd',
  'model_year',
] as const;
export type SpecKey = (typeof SPEC_KEYS)[number];

export const carSpecsSchema = z
  .object({
    /** Peak engine/motor power, kW. */
    power_kw: z.number().gt(0).max(2500).optional(),
    torque_nm: z.number().gt(0).max(5000).optional(),
    /** Kerb weight, kg. */
    weight_kg: z.number().min(300).max(10000).optional(),
    /** 0–100 km/h, seconds. */
    zero_to_100_s: z.number().min(1).max(60).optional(),
    top_speed_kmh: z.number().min(30).max(600).optional(),
    drivetrain: z.enum(DRIVETRAINS).optional(),
    /** Drag coefficient. */
    drag_cd: z.number().min(0.1).max(1.5).optional(),
    /** The real car's model year — not the casting's `year`. */
    model_year: z.number().int().min(1880).max(2100).optional(),
  })
  .strict();
export type CarSpecs = z.infer<typeof carSpecsSchema>;

export const EMPTY_SPECS: CarSpecs = {};

/** A proposal/verification must carry at least one value (the RPCs refuse `{}` too). */
export const carSpecsInputSchema = carSpecsSchema.refine(
  (s) => Object.values(s).some((v) => v !== undefined),
  { message: 'Enter at least one spec' }
);

export const specsSourceSchema = z.string().trim().min(1).max(80);

/** Lenient read of a stored `specs` jsonb: a malformed document (impossible after 0022's CHECK,
 *  but cheap to guard) reads as empty rather than taking a page down. Writes use the strict schema. */
export function parseStoredSpecs(json: unknown): CarSpecs {
  const parsed = carSpecsSchema.safeParse(json);
  return parsed.success ? parsed.data : EMPTY_SPECS;
}

export function hasAnySpec(specs: CarSpecs): boolean {
  return Object.values(specs).some((v) => v !== undefined);
}
