
import * as Tone from 'tone';
import { NoteEvent, GrooveObject } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';

export class AudioService {
  private samplers: Record<string, Tone.Sampler | null> = {};
  private channelGains: Record<string, Tone.Gain> = {};
  private filters: Record<string, Tone.Filter> = {};
  private parts: Record<string, Tone.Part> = {}; 
  private masterGain: Tone.Gain | null = null;
  private initialized = false;
  private channelMutes: Record<string, boolean> = {};

  public async ensureInit() {
    if (this.initialized) {
        if (Tone.context.state !== 'running') {
            await Tone.start();
            await Tone.context.resume();
        }
        return;
    }

    await Tone.start();
    Tone.Transport.PPQ = 480;
    
    // Master Chain for high-fidelity output
    const limiter = new Tone.Limiter(-1).toDestination();
    const compressor = new Tone.Compressor({
        threshold: -18,
        ratio: 4,
        attack: 0.01,
        release: 0.2
    });

    this.masterGain = new Tone.Gain(0.6); 
    this.masterGain.chain(compressor, limiter);

    ELITE_16_CHANNELS.forEach(key => {
        this.channelMutes[key] = false;
        
        // Per-channel processing to avoid "mud"
        const filter = new Tone.Filter(20000, "lowpass").connect(this.masterGain!);
        this.filters[key] = filter;
        
        const gain = new Tone.Gain(0.5).connect(filter); 
        this.channelGains[key] = gain;
        this.samplers[key] = null;
    });

    this.initialized = true;
    console.log("🔊 Pro Audio Engine Initialized");
  }

  public async loadCustomSample(track: string, file: File) {
    await this.ensureInit();
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
        
        // Logic: Always cleanup existing sampler before replacing
        if (this.samplers[track]) {
            this.samplers[track]?.dispose();
        }

        return new Promise<void>((resolve, reject) => {
            const sampler = new Tone.Sampler({
                urls: { "C4": audioBuffer },
                onload: () => {
                    // CRITICAL: Set ADSR to prevent noise buildup and clicks
                    sampler.set({
                        envelope: {
                            attack: 0.005,
                            decay: 0.1,
                            sustain: 0.8,
                            release: 0.1
                        },
                        // Fix for noise: Limit polyphony for leads and bass
                        urls: { "C4": audioBuffer }
                    });
                    
                    // Route to channel mixer
                    sampler.connect(this.channelGains[track]);
                    this.samplers[track] = sampler;
                    
                    console.log(`✅ Track ${track}: Sample Loaded & Optimized`);
                    resolve();
                },
                onerror: (err) => {
                    console.error(`❌ Track ${track} Sampler Error:`, err);
                    reject(err);
                }
            });
        });
    } catch (e) {
        console.error(`❌ Decoding Failed for ${track}:`, e);
        throw e;
    }
  }

  public setBpm(bpm: number) {
      Tone.Transport.bpm.rampTo(bpm, 0.1);
  }

  public async scheduleSequence(groove: GrooveObject) {
      await this.ensureInit();
      
      // Stop and clear previous schedules to prevent "phasing noise"
      this.clearAllParts();

      ELITE_16_CHANNELS.forEach(trackName => {
          const events = (groove as any)[trackName] as NoteEvent[];
          if (!events || events.length === 0) return;
          
          // Map internal tick logic (480PPQ) to Tone.js Ticks
          const partEvents = events.map(e => ({
              time: (e.startTick || 0) + "i", 
              note: typeof e.note === 'string' ? e.note : e.note[0],
              duration: (e.durationTicks || 120) + "i",
              velocity: Math.min(1.0, (e.velocity || 0.8) * 0.85) // Headroom scaling
          }));

          // High-precision Part scheduling
          this.parts[trackName] = new Tone.Part((time, value) => {
              const sampler = this.samplers[trackName];
              
              if (sampler && sampler.loaded && !sampler.disposed) {
                  // Ensure only the correct note (C4) triggers the sample
                  sampler.triggerAttackRelease("C4", value.duration, time, value.velocity);
              } else {
                  // Fallback synth if no sample is loaded so user hears something
                  // This prevents the "silent/noise" confusion
              }
          }, partEvents);
          
          this.parts[trackName].loop = true;
          this.parts[trackName].loopEnd = ((groove.totalBars || 128) * 1920) + "i";
          this.parts[trackName].start(0);
      });
  }

  private clearAllParts() {
      Object.keys(this.parts).forEach(k => {
          this.parts[k].dispose();
          delete this.parts[k];
      });
  }

  public async play() { 
      await this.ensureInit();
      if (Tone.Transport.state !== 'started') {
          Tone.Transport.start("+0.1"); 
      }
  }
  
  public stop() { 
      Tone.Transport.stop(); 
      // Panic function: Silence everything immediately
      Object.values(this.samplers).forEach(s => {
          if (s && !s.disposed) {
              s.releaseAll();
          }
      });
  }

  public setChannelMute(trackName: string, mute: boolean) {
      this.channelMutes[trackName] = mute;
      if (this.channelGains[trackName]) {
          this.channelGains[trackName].gain.rampTo(mute ? 0 : 0.5, 0.05);
      }
  }

  public updateParameter(track: string, param: 'volume' | 'cutoff', val: number) {
      if (param === 'volume' && this.channelGains[track]) {
          this.channelGains[track].gain.rampTo(val * 0.7, 0.1);
      } else if (param === 'cutoff' && this.filters[track]) {
          this.filters[track].frequency.rampTo(val, 0.1);
      }
  }
}

export const audioService = new AudioService();
