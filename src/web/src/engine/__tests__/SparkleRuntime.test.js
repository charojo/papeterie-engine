
import { SparkleRuntime } from '../Layer.js';

describe('SparkleRuntime', () => {
    let config;
    let context;
    let transform;

    beforeEach(() => {
        config = {
            type: 'sparkle',
            min_interval: 1.0,
            max_interval: 2.0,
            duration: 0.5,
            max_brightness: 2.0
        };
        context = {
            elapsedTime: 0
        };
        transform = {
            brightness: 1.0
        };
    });

    it('should initialize with default values', () => {
        const runtime = new SparkleRuntime({});
        expect(runtime.minInterval).toBe(0.5);
        expect(runtime.maxInterval).toBe(2.0);
        expect(runtime.duration).toBe(0.2);
        expect(runtime.maxBrightness).toBe(2.0);
    });

    it('should schedule next sparkle on first apply', () => {
        const runtime = new SparkleRuntime(config);

        // Mock random to return 0.5 (middle of interval range)
        const mockMath = Object.create(global.Math);
        mockMath.random = () => 0.5;
        global.Math = mockMath;

        runtime.apply(transform, context);

        // Interval = 1.0 + 0.5 * (2.0 - 1.0) = 1.5
        // nextSparkleTime = 0 + 1.5 = 1.5
        expect(runtime.nextSparkleTime).toBe(1.5);
        expect(runtime.isSparkling).toBe(false);

        // transform should be unchanged (brightness 1.0)
        expect(transform.brightness).toBe(1.0);
    });

    it('should start sparkling when time is reached', () => {
        const runtime = new SparkleRuntime(config);

        // Force next sparkle time
        runtime.nextSparkleTime = 1.5;
        runtime.isSparkling = false;

        context.elapsedTime = 1.5;
        runtime.apply(transform, context);

        expect(runtime.isSparkling).toBe(true);
        expect(runtime.sparkleStartTime).toBe(1.5);
        expect(transform.brightness).toBe(1.0); // Start of sparkle
    });

    it('should modulate brightness during sparkle', () => {
        const runtime = new SparkleRuntime(config);
        runtime.nextSparkleTime = 1.0;

        // Start sparkle
        context.elapsedTime = 1.0;
        runtime.apply(transform, context);

        // 50% into sparkle (Peak)
        // Duration is 0.5. Start is 1.0. Peak is at 1.0 + 0.25 = 1.25.
        context.elapsedTime = 1.25;
        runtime.apply(transform, context);

        expect(transform.brightness).toBeCloseTo(2.0); // Max brightness

        // 25% into sparkle (Ramping up)
        // Time = 1.0 + 0.125 = 1.125
        context.elapsedTime = 1.125;
        runtime.apply(transform, context);
        // Progress = 0.25. Val = 0.5. Brightness = 1.0 + 0.5 * (2.0 - 1.0) = 1.5
        expect(transform.brightness).toBeCloseTo(1.5);
    });

    it('should finish sparkle and schedule next', () => {
        const runtime = new SparkleRuntime(config);
        runtime.nextSparkleTime = 1.0;

        // Start sparkle
        context.elapsedTime = 1.0;
        runtime.apply(transform, context);

        // Mock random for next schedule
        const mockMath = Object.create(global.Math);
        mockMath.random = () => 0.0; // Min interval
        global.Math = mockMath;

        // Finish sparkle
        // Time = 1.0 + 0.5 (duration) = 1.5
        context.elapsedTime = 1.5;
        runtime.apply(transform, context);

        expect(transform.brightness).toBe(1.0);
        // Should have scheduled next. Min interval is 1.0.
        // nextSparkleTime = 1.5 + 1.0 = 2.5
        expect(runtime.nextSparkleTime).toBe(2.5);
    });
});
