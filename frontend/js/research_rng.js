export class SeededRNG {
    constructor(seed = 1) {
        this.initialSeed = seed >>> 0;
        this.state = this.initialSeed;
    }

    reset(seed = this.initialSeed) {
        this.initialSeed = seed >>> 0;
        this.state = this.initialSeed;
    }

    next() {
        this.state += 0x6D2B79F5;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min = 0, max = 1) {
        return min + (max - min) * this.next();
    }
}

export function createSeededRandom(seed) {
    const rng = new SeededRNG(seed);
    return () => rng.next();
}

export function createSeededRNG(seed) {
    return new SeededRNG(seed);
}
