const GameAudio = {
    audioCtx: null,
    masterGain: null,
    compressor: null,
    isMuted: localStorage.getItem('game_sound_muted') === 'true',
    volumeBoost: 1.7,
    audioBufferCache: {},
    activeSourceNodes: [],
    playSequenceId: 0,

    getAudioContext() {
        if (!this.audioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.audioCtx = new AudioCtx();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        this.setupMasterOutput();
        return this.audioCtx;
    },

    setupMasterOutput() {
        if (!this.audioCtx || this.masterGain) return;

        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = this.volumeBoost;

        this.compressor = this.audioCtx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-14, this.audioCtx.currentTime);
        this.compressor.knee.setValueAtTime(30, this.audioCtx.currentTime);
        this.compressor.ratio.setValueAtTime(10, this.audioCtx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.audioCtx.currentTime);

        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.audioCtx.destination);
    },

    trimSilence(buffer) {
        const ctx = this.getAudioContext();
        if (!ctx || !buffer) return buffer;

        const channelData = buffer.getChannelData(0);
        let start = 0;
        let end = channelData.length - 1;
        const threshold = 0.008;

        while (start < end && Math.abs(channelData[start]) < threshold) {
            start++;
        }
        while (end > start && Math.abs(channelData[end]) < threshold) {
            end--;
        }

        const safePadding = Math.floor(buffer.sampleRate * 0.02);
        start = Math.max(0, start - safePadding);
        end = Math.min(channelData.length - 1, end + safePadding);

        const length = Math.max(1, end - start + 1);
        const trimmed = ctx.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
        for (let c = 0; c < buffer.numberOfChannels; c++) {
            trimmed.copyToChannel(buffer.getChannelData(c).subarray(start, end + 1), c);
        }
        return trimmed;
    },

    async getSoundBuffer(fileName) {
        if (this.audioBufferCache[fileName]) {
            return this.audioBufferCache[fileName];
        }

        const ctx = this.getAudioContext();
        if (!ctx) return null;

        try {
            const response = await fetch(`sounds/${fileName}.mp3`);
            const arrayBuffer = await response.arrayBuffer();
            const decoded = await ctx.decodeAudioData(arrayBuffer);
            const trimmed = this.trimSilence(decoded);
            this.audioBufferCache[fileName] = trimmed;
            return trimmed;
        } catch (e) {
            return null;
        }
    },

    chunkToFiles(n) {
        n = parseInt(n);
        if (isNaN(n) || n === 0) return [];
        const files = [];
        const h = Math.floor(n / 100);
        const rem = n % 100;

        if (h > 0) {
            files.push(String(h * 100));
        }

        if (rem > 0) {
            if (files.length > 0) files.push('va');
            if (rem <= 19) {
                files.push(String(rem));
            } else {
                const t = Math.floor(rem / 10) * 10;
                const o = rem % 10;
                files.push(String(t));
                if (o > 0) {
                    files.push('va');
                    files.push(String(o));
                }
            }
        }
        return files;
    },

    numToFiles(n) {
        n = parseInt(n);
        if (isNaN(n) || n === 0) return ['0'];
        return this.chunkToFiles(n);
    },

    getNaturalGap(fileName) {
        if (['va', 'dar', 'ba', 'taqsim_bar', 'zarb_dar', 'mishe', 'hodoodan_mishe'].includes(fileName)) {
            return 0.06;
        }
        if (!isNaN(parseInt(fileName))) {
            return 0.06;
        }
        return 0.18;
    },

    async playList(files, onComplete) {
        if (this.isMuted || !files || files.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        this.stop();
        const seqId = ++this.playSequenceId;
        const ctx = this.getAudioContext();
        if (!ctx) {
            if (onComplete) onComplete();
            return;
        }

        let startTime = ctx.currentTime + 0.03;

        for (let i = 0; i < files.length; i++) {
            if (this.playSequenceId !== seqId || this.isMuted) return;

            const fName = files[i];
            const buffer = await this.getSoundBuffer(fName);

            if (this.playSequenceId !== seqId || this.isMuted) return;
            if (!buffer) continue;

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.masterGain || ctx.destination);

            const playAt = Math.max(ctx.currentTime, startTime);
            source.start(playAt);
            this.activeSourceNodes.push(source);

            const gap = this.getNaturalGap(fName);
            startTime = playAt + buffer.duration + gap;
        }

        const totalDuration = Math.max(0, startTime - ctx.currentTime);
        setTimeout(() => {
            if (this.playSequenceId === seqId && onComplete) {
                onComplete();
            }
        }, totalDuration * 1000);
    },

    stop() {
        this.playSequenceId++;
        this.activeSourceNodes.forEach(node => {
            try { node.stop(); } catch (e) {}
        });
        this.activeSourceNodes = [];
    },

    speakSelectInitial(onComplete) {
        this.playList(['entekhab_aval'], onComplete);
    },

    speakSelectNext(onComplete) {
        this.playList(['entekhab_baadi'], onComplete);
    },

    speakBringDown(onComplete) {
        this.playList(['paeen_avordan'], onComplete);
    },

    speakZeroQuotient(onComplete) {
        this.playList(['sefr_kharej_qesmat'], onComplete);
    },

    speakQuotient(partialDiv, divisor, quotient, onComplete) {
        const list = [
            ...this.numToFiles(partialDiv),
            'taqsim_bar',
            ...this.numToFiles(divisor),
            'hodoodan_mishe',
            ...this.numToFiles(quotient)
        ];
        this.playList(list, onComplete);
    },

    speakMultiplicationStep(q, dDigit, rawProd, carryIn, totalVal, writeDigit, newCarry, onComplete) {
        const list = [
            String(q),
            'dar',
            String(dDigit),
            'mishe',
            ...this.numToFiles(rawProd)
        ];

        if (carryIn > 0) {
            list.push('ba', String(carryIn), 'enteqal_mishe', ...this.numToFiles(totalVal));
        }

        if (newCarry > 0) {
            list.push(String(writeDigit), 'ro_minevisim', String(newCarry), 'ro_mibarim_bala');
        } else {
            list.push(...this.numToFiles(writeDigit), 'ro_minevisim');
        }

        this.playList(list, onComplete);
    },

    speakBorrow(onComplete) {
        this.playList(['qarz_kenari'], onComplete);
    },

    speakBorrowZero(onComplete) {
        this.playList(['qarz_sefr'], onComplete);
    },

    speakSubtract(onComplete) {
        this.playList(['tafriq_kon'], onComplete);
    },

    speakFinished(onComplete) {
        this.playList(['payan_taqsim'], onComplete);
    },

    playSFX(type) {
        if (this.isMuted) return;
        try {
            const ctx = this.getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            if (type === 'correct') {
                this.playTone(523.25, 'triangle', now, 0.12, 0.25);
                this.playTone(659.25, 'triangle', now + 0.1, 0.25, 0.25);
            } else if (type === 'wrong') {
                this.playTone(392.00, 'sine', now, 0.12, 0.2);
                this.playTone(311.13, 'sine', now + 0.1, 0.25, 0.2);
            } else if (type === 'win') {
                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, i) => this.playTone(freq, 'triangle', now + (i * 0.12), 0.25, 0.25));
            } else if (type === 'click') {
                this.playTone(400, 'sine', now, 0.03, 0.1);
            }
        } catch (e) {}
    },

    playTone(freq, type, startTime, duration, maxGain = 0.25, rampToFreq = null) {
        const ctx = this.audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        if (rampToFreq) {
            osc.frequency.exponentialRampToValueAtTime(rampToFreq, startTime + duration);
        }

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain || ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('game_sound_muted', this.isMuted);
        if (this.isMuted) this.stop();
        return this.isMuted;
    }
};