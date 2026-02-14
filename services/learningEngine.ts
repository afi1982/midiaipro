
import { FeedbackTag, UserFeedbackMetrics, StyleDNA } from '../types';
import { learningBrainService } from './learningBrainService';

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export class LearningEngine {
    public applyLearningFromFeedback(genre: string, metrics: UserFeedbackMetrics, tags: FeedbackTag[]) {
        const deltas: any = { rating: metrics.rating };
        const reasons: string[] = [];

        if (tags.includes('BORING')) {
            deltas.density = 0.3;
            reasons.push("Increasing density to fix boredom");
        }
        if (tags.includes('TOO_REPETITIVE')) {
            deltas.variation = 0.4;
            reasons.push("Expanding variation range");
        }
        if (tags.includes('WEAK_DROP')) {
            deltas.syncopation = 0.25;
            reasons.push("Adding syncopation for energy");
        }
        if (tags.includes('PERFECT_ENERGY')) {
            deltas.rating = 5.0;
            reasons.push("Reinforcing current DNA profile");
        }

        if (reasons.length > 0) {
            learningBrainService.optimizeGenreDNA(genre, deltas, reasons.join(", "));
        }
    }

    public updateStyleWeights(dna: StyleDNA, feedback: UserFeedbackMetrics): StyleDNA {
        const updated = { ...dna };
        let delta = 0;
        if (feedback.rating >= 4) delta += 0.1;
        if (feedback.manualEdits > 3) delta -= 0.05;

        updated.density = clamp(updated.density + (delta * 0.1), 0.1, 1.0);
        updated.movement = clamp(updated.movement + (delta * 0.05), 0.1, 1.0);
        return updated;
    }
}

export default new LearningEngine();
