
import { describe, it, expect } from 'vitest';
import {
    BehaviorType,
    CoordinateType,
    OscillateBehaviorSchema,
    DriftBehaviorSchema,
    PulseBehaviorSchema,
    LayerConfigSchema,
    SceneConfigSchema,
    SpriteMetadataSchema
} from '../index';

describe('Zod Schemas', () => {

    describe('Enums', () => {
        it('validates BehaviorType', () => {
            expect(BehaviorType.parse('oscillate')).toBe('oscillate');
            expect(() => BehaviorType.parse('invalid')).toThrow();
        });

        it('validates CoordinateType', () => {
            expect(CoordinateType.parse('x')).toBe('x');
            expect(() => CoordinateType.parse('invalid')).toThrow();
        });
    });

    describe('Behaviors', () => {
        it('validates OscillateBehavior', () => {
            const valid = {
                type: 'oscillate',
                coordinate: 'y',
                frequency: 2.0,
                amplitude: 5.0
            };
            const result = OscillateBehaviorSchema.parse(valid);
            expect(result).toMatchObject(valid);
            // defaults
            const minimal = { type: 'oscillate' };
            const minResult = OscillateBehaviorSchema.parse(minimal);
            expect(minResult.enabled).toBe(true);
            expect(minResult.frequency).toBe(1.0);
        });

        it('validates DriftBehavior', () => {
            const valid = {
                type: 'drift',
                velocity: 20
            };
            expect(DriftBehaviorSchema.parse(valid).velocity).toBe(20);
        });

        it('validates PulseBehavior', () => {
            const valid = { type: 'pulse', min_value: 0.2 };
            expect(PulseBehaviorSchema.parse(valid).min_value).toBe(0.2);
            expect(PulseBehaviorSchema.parse(valid).coordinate).toBe('opacity');
        });
    });

    describe('LayerConfigSchema', () => {
        it('validates basic layer', () => {
            const valid = {
                sprite_name: 'test.png',
                z_depth: 10,
                behaviors: []
            };
            const result = LayerConfigSchema.parse(valid);
            expect(result.sprite_name).toBe('test.png');
            expect(result.visible).toBe(true); // default
        });

        it('validates layer with environmental reaction', () => {
            const valid = {
                sprite_name: 'ship',
                environmental_reaction: {
                    reaction_type: 'pivot_on_crest',
                    target_sprite_name: 'waves',
                    max_tilt_angle: 45
                }
            };
            const result = LayerConfigSchema.parse(valid);
            expect(result.environmental_reaction.max_tilt_angle).toBe(45);
        });
    });

    describe('SceneConfigSchema', () => {
        it('validates complete scene', () => {
            const valid = {
                name: 'scene1',
                layers: [
                    { sprite_name: 'sky', z_depth: 0 },
                    { sprite_name: 'bird', z_depth: 2 }
                ],
                duration_sec: 60
            };
            const result = SceneConfigSchema.parse(valid);
            expect(result.layers).toHaveLength(2);
            expect(result.duration_sec).toBe(60);
        });
    });

    describe('SpriteMetadataSchema', () => {
        it('validates metadata', () => {
            const valid = {
                vertical_percent: 0.8,
                vertical_anchor: 'bottom'
            };
            const result = SpriteMetadataSchema.parse(valid);
            expect(result.vertical_percent).toBe(0.8);
            expect(result.vertical_anchor).toBe('bottom');
            expect(result.tile_horizontal).toBe(false); // default
        });
    });

});
