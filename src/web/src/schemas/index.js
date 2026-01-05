/**
 * Zod schemas for frontend validation.
 * 
 * These schemas mirror the Pydantic models in src/compiler/models.py
 * to ensure data consistency between frontend and backend.
 * 
 * Created as part of Phase 6: Schema Validation refactoring.
 */
import { z } from 'zod';

// --- Enums ---

export const BehaviorType = z.enum([
    'oscillate',
    'drift',
    'pulse',
    'background',
    'location',
    'sound'
]);

export const CoordinateType = z.enum(['x', 'y', 'scale', 'rotation', 'opacity']);

// --- Base Behavior Schema ---

const BaseBehaviorSchema = z.object({
    type: BehaviorType,
    enabled: z.boolean().default(true),
    coordinate: CoordinateType.default('y'),
    llm_guidance: z.string().nullable().optional()
});

// --- Specific Behavior Schemas ---

export const OscillateBehaviorSchema = BaseBehaviorSchema.extend({
    type: z.literal('oscillate'),
    frequency: z.number().default(1.0),
    amplitude: z.number().default(10.0),
    phase_offset: z.number().default(0.0)
});

export const DriftBehaviorSchema = BaseBehaviorSchema.extend({
    type: z.literal('drift'),
    velocity: z.number().default(10.0),
    acceleration: z.number().default(0.0),
    drift_cap: z.number().nullable().optional(),
    cap_behavior: z.enum(['stop', 'bounce', 'loop']).default('stop')
});

export const PulseBehaviorSchema = BaseBehaviorSchema.extend({
    type: z.literal('pulse'),
    coordinate: CoordinateType.default('opacity'),
    frequency: z.number().default(1.0),
    min_value: z.number().default(0.5),
    max_value: z.number().default(1.0),
    waveform: z.enum(['sine', 'spike']).default('sine'),
    activation_threshold_scale: z.number().nullable().optional()
});

export const BackgroundBehaviorSchema = BaseBehaviorSchema.extend({
    type: z.literal('background'),
    scroll_speed: z.number().default(0.0)
});

export const LocationBehaviorSchema = BaseBehaviorSchema.extend({
    type: z.literal('location'),
    x: z.number().default(0.0),
    y: z.number().default(0.0),
    vertical_percent: z.number().min(0).max(1).nullable().optional(),
    horizontal_percent: z.number().min(0).max(1).nullable().optional(),
    z_depth: z.number().int().min(1).max(100).nullable().optional(),
    scale: z.number().min(0).nullable().optional(),
    time_offset: z.number().min(0).default(0.0),
    interpolate: z.boolean().default(true)
});

export const SoundBehaviorSchema = BaseBehaviorSchema.extend({
    type: z.literal('sound'),
    sound_file: z.string(),
    volume: z.number().min(0).max(1).default(1.0),
    time_offset: z.number().nullable().optional(),
    trigger_event: z.string().nullable().optional(),
    loop: z.boolean().default(false),
    fade_in: z.number().default(0.0),
    fade_out: z.number().default(0.0)
});

// --- Union Behavior Schema ---

export const BehaviorSchema = z.discriminatedUnion('type', [
    OscillateBehaviorSchema,
    DriftBehaviorSchema,
    PulseBehaviorSchema,
    BackgroundBehaviorSchema,
    LocationBehaviorSchema,
    SoundBehaviorSchema
]);

// --- Environmental Reaction Schema ---

export const EnvironmentalReactionSchema = z.object({
    reaction_type: z.enum(['pivot_on_crest']),
    target_sprite_name: z.string(),
    max_tilt_angle: z.number().min(0).max(90),
    vertical_follow_factor: z.number().min(0).max(1).default(1.0),
    tilt_lift_factor: z.number().default(0.0),
    hull_length_factor: z.number().min(0).max(1).default(0.5)
});

// --- Layer Config Schema ---

export const LayerConfigSchema = z.object({
    sprite_name: z.string(),
    z_depth: z.number().int().nullable().optional(),
    x_offset: z.number().nullable().optional(),
    y_offset: z.number().nullable().optional(),
    scale: z.number().nullable().optional(),
    rotation: z.number().nullable().optional(),
    behaviors: z.array(BehaviorSchema).default([]),
    behavior_guidance: z.string().nullable().optional(),
    vertical_percent: z.number().min(0).max(1).nullable().optional(),
    visible: z.boolean().default(true)
});

// --- Scene Config Schema ---

export const SceneConfigSchema = z.object({
    name: z.string(),
    layers: z.array(LayerConfigSchema),
    duration_sec: z.number().default(30.0),
    sounds: z.array(SoundBehaviorSchema).default([])
});

// --- Sprite Metadata Schema ---

export const SpriteMetadataSchema = z.object({
    name: z.string().nullable().optional(),
    z_depth: z.number().int().min(1).max(100).nullable().optional(),
    behaviors: z.array(BehaviorSchema).default([]),
    vertical_percent: z.number().min(0).max(1).default(0.5),
    target_height: z.number().int().nullable().optional(),
    tile_horizontal: z.boolean().default(false),
    tile_border: z.number().int().default(0),
    height_scale: z.number().nullable().optional(),
    fill_down: z.boolean().default(false),
    vertical_anchor: z.enum(['center', 'bottom', 'top']).default('center'),
    x_offset: z.number().int().default(0),
    y_offset: z.number().int().default(0),
    environmental_reaction: EnvironmentalReactionSchema.nullable().optional()
});

/**
 * Type inference can be done in TypeScript projects:
 * type Behavior = z.infer<typeof BehaviorSchema>;
 * type LayerConfig = z.infer<typeof LayerConfigSchema>;
 * type SceneConfig = z.infer<typeof SceneConfigSchema>;
 * type SpriteMetadata = z.infer<typeof SpriteMetadataSchema>;
 */
