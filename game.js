const CONFIG = {
    pvLabels: ['هـ', 'ص', 'د', 'ی'], 
    pvClasses: ['color-h', 'color-s', 'color-d', 'color-y'],
    school: '---'
};

let STORAGE = 'studentProfile_TaqsimTwoDigit_Default';
let GAME_STATE_STORAGE = 'gameState_TaqsimTwoDigit_Default';

const toPersian = num => String(num).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const toEnglish = str => String(str).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d]/g, '');
const getEl = id => document.getElementById(id);

function toggleAppSound() {
    const isMuted = GameAudio.toggleMute();
    const btn = getEl('btn-sound-toggle');
    if (btn) btn.innerText = isMuted ? '🔇 صدا: خاموش' : '🔊 صدا: روشن';
}

let tutBtnSafetyTimer = null;
function setTutorialBtnState(disabled) {
    const btn = getEl('btn-next-tutorial');
    if (btn) btn.disabled = disabled;
    clearTimeout(tutBtnSafetyTimer);
    if (disabled) {
        tutBtnSafetyTimer = setTimeout(() => {
            if (btn) btn.disabled = false;
        }, 8000);
    }
}

const TutorialVisuals = {
    clear() {
        document.querySelectorAll('.tut-multiply-glow').forEach(el => {
            el.classList.remove('tut-multiply-glow');
        });
    },
    showMultiplyDigit(stg, digitType) {
        this.clear();
        const qBox = getEl(`q-${stg}`);
        if (qBox) qBox.classList.add('tut-multiply-glow');

        const targetEl = getEl(digitType === 'units' ? 'dvr-units' : 'dvr-tens');
        if (targetEl) {
            targetEl.classList.add('tut-multiply-glow');
        } else {
            const dvrBox = getEl('divisor-display');
            if (dvrBox) dvrBox.classList.add('tut-multiply-glow');
        }
    }
};

const app = {
    state: { user: null, school: '', stats: { games: 0, stars: 0 }, lastHelpUsed: false, isTutorialMode: false, reportShown: false },
    init() {
        authenticatePortalStudent();
    },
    save() { 
        localStorage.setItem(STORAGE, JSON.stringify(this.state)); 
    },
    showScreen(id) {
        const screens = ['screen-register', 'screen-game', 'screen-report', 'screen-assistant', 'portal-submitting-screen'];
        screens.forEach(s => {
            const el = document.getElementById(s);
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('active');
                el.style.display = '';
            }
        });
        const tutBar = getEl('tutorial-bar');
        if (tutBar) {
            tutBar.classList.add('hidden');
        }
        const target = document.getElementById(id);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('active');
            target.style.display = '';
        }
        const statsEl = document.getElementById('stats-bar');
        if (statsEl) {
            statsEl.classList.toggle('hidden', id === 'screen-register' || id === 'screen-assistant' || id === 'portal-submitting-screen');
        }
        if (id === 'screen-report') {
            app.renderReport(app.state.stats.stars >= Portal.requiredStars, app.state.stats.stars);
        }
        if (id !== 'screen-game') {
            game.hideNumberPad();
            GameAudio.stop();
            TutorialVisuals.clear();
            setTutorialBtnState(false);
        }
    },
    updateStats() {
        if (this.state.user) {
            getEl('disp-name').innerText = this.state.user;
            getEl('disp-games').innerText = toPersian(this.state.stats.games);
            getEl('disp-stars').innerText = toPersian(this.state.stats.stars);
        }
    },
    async finishGame(success) {
        GameAudio.stop();
        TutorialVisuals.clear();
        setTutorialBtnState(false);
        const earnedThisGame = (success && !game.helpUsed && !app.state.isTutorialMode) ? 1 : 0;
        app.state.stats.games = app.state.stats.games + 1;
        if (earnedThisGame === 1) {
            app.state.stats.stars = app.state.stats.stars + 1;
            GameAudio.playSFX('win');
        }
        app.state.lastHelpUsed = (game.helpUsed || app.state.isTutorialMode);
        app.state.reportShown = true;
        game.clearState();
        app.save();
        app.updateStats();

        app.showScreen('portal-submitting-screen');
        await Portal.submitProgress(earnedThisGame, {
            onSuccess: (data) => {
                app.state.stats.games = data.plays;
                app.state.stats.stars = data.stars;
                app.save();
                app.updateStats();
                app.showScreen('screen-report');
            },
            onFailure: (err) => {}
        });
    },
    renderReport(goalReached, currentStars) {
        const stars = currentStars !== undefined ? currentStars : app.state.stats.stars;
        const games = app.state.stats.games;
        const now = new Date();
        const dateStr = now.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeStr = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateTimeStr = toPersian(dateStr) + ' ' + toPersian(timeStr);

        getEl('rep-name').innerText = app.state.user;
        getEl('rep-time').innerText = dateTimeStr;
        getEl('rep-games').innerText = toPersian(games);
        getEl('rep-stars').innerText = toPersian(stars);

        const schoolEl = getEl('portal-school-title');
        const finalSchool = app.state.school || (schoolEl && schoolEl.textContent.trim() !== '---' ? schoolEl.textContent.trim() : '---');
        if (getEl('rep-school')) getEl('rep-school').innerText = finalSchool;

        const repReqStarsRow = getEl('portal-req-stars-row');
        const repReqStars = getEl('rep-req-stars');
        if (repReqStarsRow && repReqStars) {
            repReqStarsRow.style.display = 'block';
            repReqStars.innerText = toPersian(Portal.requiredStars) + ' ⭐';
        }

        const goalBadge = getEl('portal-goal-reached-badge');
        const submitBadge = getEl('portal-submit-badge');
        const backInstruction = getEl('portal-back-instruction');
        const playAgainBtn = getEl('playAgainBtn');

        goalBadge.style.display = 'none';
        submitBadge.style.display = 'none';
        backInstruction.style.display = 'none';
        playAgainBtn.style.display = 'block';

        if (app.state.lastHelpUsed) {
            playAgainBtn.innerText = "بازیِ دوباره بدون کمک 💡";
            backInstruction.innerHTML = `
                <div style="background:#fff3e0; border:1px solid #ffe082; color:#e65100; padding:12px; border-radius:12px; margin-top:10px; font-size:11.5pt; line-height:1.6; text-align:center; width: 100%;">
                    💡 این دور بازی‌ات آموزشی بود و برای گرفتن ستاره باید بدون کمک حلش کنی. دکمه‌ی پایین رو بزن تا بدون کمک تلاش کنی!
                </div>
            `;
            backInstruction.style.display = 'block';
        } else if (goalReached) {
            goalBadge.style.display = 'block';
            playAgainBtn.style.display = 'none';
            backInstruction.innerHTML = `
                <div style="background:#e8f5e9; border:1px solid #2e7d32; color:#1b5e20; padding:15px; border-radius:12px; margin-top:10px; font-weight:bold; font-size:12pt; line-height:1.6; text-align:center; width: 100%;">
                    📱 آفرین! تکلیفت با موفقیت تموم شد.<br>
                    حالا با زدن <b>دکمه‌ی بازگشت (Back) گوشی</b> به پرتال کلاس برگرد.
                </div>
            `;
            backInstruction.style.display = 'block';
        } else {
            const remaining = Portal.requiredStars - stars;
            submitBadge.innerHTML = `✨ آفرین دانش‌آموز زرنگم! تو <b>${toPersian(stars)}</b> ستاره از <b>${toPersian(Portal.requiredStars)}</b> ستاره‌ی این تکلیف رو گرفتی! ⭐ فقط به <b>${toPersian(remaining)}</b> ستاره‌ی دیگه نیاز داری تا تکلیفت کامل بشه. بدو برو بعدی رو هم حل کن! 🏆`;
            submitBadge.style.display = 'block';
            playAgainBtn.innerText = "گرفتن ستاره‌ی بیشتر 🎮";
            backInstruction.innerHTML = `
                <div style="background:#fff3e0; border:1px solid #ffe082; color:#e65100; padding:12px; border-radius:12px; margin-top:10px; font-size:11.5pt; line-height:1.6; text-align:center; width: 100%;">
                    💡 اگه می‌خوای ادامه‌ی بازی رو بعداً انجام بدی، با زدن <b>دکمه‌ی بازگشت (Back) گوشی</b> به پرتال برگرد.
                </div>
            `;
            backInstruction.style.display = 'block';
        }
    },
    restartGame() { 
        GameAudio.stop();
        TutorialVisuals.clear();
        setTutorialBtnState(false);
        app.state.reportShown = false;
        app.state.isTutorialMode = false;
        game.helpUsed = false;
        app.save();
        app.showScreen('screen-game');
        game.start(); 
    }
};

const game = {
    dividend: 0, divisor: 0, digits: [], stage: 0, subStep: 'SELECT', activeBox: null, helpUsed: false, mathSteps: [], currentRem: 0,
    lastRemRowIndex: -1, estStep: 0, estActiveBox: null, inputQueue: [], usedEstimation: false,
    isTutorialMode: false, tutorialIdx: -1, isResetState: false, multStep: 0, multCarry: 0,
    
    start() {
        this.divisor = Math.floor(Math.random() * 89) + 11;
        this.dividend = Math.floor(Math.random() * 8000) + 1000;
        this.digits = String(this.dividend).split('').map(Number);
        this.startRoundLogic();
    },
    
    startRoundLogic() {
        GameAudio.stop();
        TutorialVisuals.clear();
        setTutorialBtnState(false);
        this.stage = 0; this.subStep = 'SELECT'; this.currentRem = 0; this.helpUsed = false;
        this.mathSteps = Array(4).fill(null).map(() => ({ q: null, p: Array(4).fill(''), r: Array(4).fill('') }));
        this.lastRemRowIndex = -1;
        this.inputQueue = []; this.usedEstimation = false;
        this.isTutorialMode = false; this.tutorialIdx = -1; this.isResetState = false;
        this.multStep = 0; this.multCarry = 0;
        
        const btn = getEl('btn-check'); btn.disabled = true; btn.classList.remove('btn-finish'); 
        btn.classList.remove('hidden'); 
        btn.className = 'btn btn-success';
        btn.innerText = '✅ بررسی';
        getEl('est-button').classList.add('hidden');
        getEl('tutorial-bar').classList.add('hidden');
        getEl('help-button').classList.remove('hidden');
        
        this.renderUI(); this.clearState(); this.saveProgress();
        this.msg('روی اولین رقم سمت چپ (هزارتایی) کلیک کن.');
    },
    
    saveProgress() {
        const inputs = {}; document.querySelectorAll('.box.has-val').forEach(el => { inputs[el.id] = el.innerText; });
        const borrows = {}; document.querySelectorAll('.box.borrow-src, .box.borrow-dest').forEach(el => {
            borrows[el.id] = {
                type: el.classList.contains('borrow-src') ? 'src' : 'dest',
                sub: el.getAttribute('data-val-sub'), dest: el.getAttribute('data-val-dest'),
                mode: el.classList.contains('display-mode-dest') ? 'dest' : (el.classList.contains('display-mode-src') ? 'src' : 'auto')
            };
        });
        const data = {
            d: this.dividend, vr: this.divisor, digits: this.digits, st: this.stage, ss: this.subStep, rem: this.currentRem,
            ms: this.mathSteps, lastR: this.lastRemRowIndex, help: this.helpUsed, ue: this.usedEstimation, inps: inputs, brws: borrows,
            isTut: (this.isTutorialMode || app.state.isTutorialMode), tutIdx: this.tutorialIdx, rst: this.isResetState,
            mStp: this.multStep, mCry: this.multCarry
        };
        localStorage.setItem(GAME_STATE_STORAGE, JSON.stringify(data));
    },

    restore() {
        const saved = localStorage.getItem(GAME_STATE_STORAGE);
        if (!saved) return this.start();
        try {
            const data = JSON.parse(saved);
            this.dividend = data.d; this.divisor = data.vr; this.digits = data.digits;
            this.stage = data.st; this.subStep = data.ss; this.currentRem = data.rem;
            this.mathSteps = data.ms; this.lastRemRowIndex = data.lastR;
            this.helpUsed = data.help; this.usedEstimation = data.ue;
            this.isResetState = !!data.rst;
            this.multStep = data.mStp !== undefined ? data.mStp : 0;
            this.multCarry = data.mCry !== undefined ? data.mCry : 0;
            
            this.isTutorialMode = !!data.isTut;
            app.state.isTutorialMode = this.isTutorialMode;
            this.tutorialIdx = data.tutIdx !== undefined ? data.tutIdx : -1;

            this.renderUI();
            
            if (this.isTutorialMode) {
                getEl('help-button').classList.add('hidden');
                getEl('est-button').classList.add('hidden');
                getEl('btn-check').classList.add('hidden');
                getEl('tutorial-bar').classList.remove('hidden');
                this.updateTutorialBtn();

                if (this.subStep === 'SELECT') {
                    if (this.stage === 0) this.msg('حالت آموزشی: اولین رقم از چپ رو انتخاب می‌کنیم.');
                    else this.msg(`رقم بعدی (${CONFIG.pvLabels[this.stage]}) رو هم انتخاب می‌کنیم.`);
                } else if (this.subStep === 'BRING_DOWN') {
                    this.msg(`حالا رقم بعدی (${CONFIG.pvLabels[this.stage]}) رو می‌آوریم پایین.`);
                } else if (this.subStep === 'QUOTIENT') {
                    const total = this.getCurrentTotal();
                    const correctQ = Math.floor(total / this.divisor);
                    const maxQ = correctQ > 9 ? 9 : correctQ;
                    if (maxQ === 0) this.msg('چون تقسیم نمی‌شه، در خارج‌قسمت یک ۰ می‌ذاریم.');
                    else this.msg(`${toPersian(total)} تقسیم بر ${toPersian(this.divisor)} حدوداً می‌شه ${toPersian(maxQ)}`);
                } else if (this.subStep === 'MULTIPLY_P') {
                    this.msg('حالا ضرب خارج‌قسمت در مقسوم‌علیه رو انجام می‌دیم.');
                } else if (this.subStep === 'SUBTRACT') {
                    this.msg('حالا تفریق رو انجام می‌دیم.');
                } else if (this.subStep === 'FINISH') {
                    this.msg('تموم شد! دکمه‌ی پایان رو بزن.');
                }
            }

            for (let i = 0; i <= this.stage; i++) {
                const qVal = this.mathSteps[i].q;
                const hasStarted = i < this.stage || (i === this.stage && this.subStep !== 'SELECT');
                if (hasStarted && qVal !== null && qVal !== 0) {
                     this.createProductRow(i);
                     if (i < this.stage || (i === this.stage && this.subStep !== 'MULTIPLY_P')) {
                         this.createRemainderRow(i);
                     }
                }
            }
            
            if (data.inps) {
                for (const [id, val] of Object.entries(data.inps)) {
                    const el = getEl(id);
                    if (el) {
                        el.innerText = val; el.classList.add('has-val');
                        el.classList.remove('invisible-box');
                        
                        const parts = id.split('-');
                        if (parts[0] === 'q' && parseInt(parts[1]) < this.stage) el.classList.add('readonly');
                        if (parts[0] !== 'div' && parts[0] !== 'q' && parseInt(parts[1]) < this.stage) {
                            el.classList.add('readonly');
                        }
                    }
                }
            }

            if ((this.subStep === 'QUOTIENT' || this.subStep === 'MULTIPLY_P' || this.subStep === 'SUBTRACT') && this.stage > 0) {
                let bdBox;
                if(this.lastRemRowIndex !== -1 && this.mathSteps[this.stage].q === null) {
                    bdBox = getEl(`r-${this.lastRemRowIndex}-${this.stage}`);
                } else {
                    bdBox = getEl(`r-${this.stage-1}-${this.stage}`);
                }

                if (bdBox && !bdBox.classList.contains('has-val') && !bdBox.classList.contains('invisible-box')) {
                    bdBox.innerText = toPersian(this.digits[this.stage]);
                    bdBox.classList.remove('invisible-box');
                    bdBox.classList.add('has-val');
                }
            }

            for (let i = 0; i < 4; i++) {
                const qBox = getEl(`q-${i}`);
                if (qBox && qBox.classList.contains('has-val')) {
                    if (i < this.stage) {
                        qBox.classList.add('correct', 'readonly');
                    } else if (i === this.stage) {
                        if (this.subStep === 'SUBTRACT' || this.subStep === 'BRING_DOWN' || this.subStep === 'FINISH') {
                            qBox.classList.add('correct', 'readonly');
                        } else if (this.subStep === 'MULTIPLY_P' && this.isResetState) {
                            const val = parseInt(toEnglish(qBox.innerText));
                            const total = this.getCurrentTotal();
                            const correctQ = Math.floor(total / this.divisor);
                            const maxQ = correctQ > 9 ? 9 : correctQ;
                            if (val === maxQ) qBox.classList.add('correct'); else qBox.classList.add('wrong');
                            
                            const expectedProdStr = String(val * this.divisor);
                            const endCol = this.stage;
                            const startCol = endCol - expectedProdStr.length + 1;
                            for (let j = 0; j < 4; j++) {
                                const box = getEl(`p-${this.stage}-${j}`);
                                if (box && !box.classList.contains('invisible-box') && box.classList.contains('has-val')) {
                                    const bVal = toEnglish(box.innerText);
                                    const charIdx = j - startCol;
                                    if (charIdx >= 0 && bVal === expectedProdStr[charIdx]) box.classList.add('correct');
                                    else box.classList.add('wrong');
                                }
                            }
                        }
                    }
                }
            }

            if (this.subStep === 'SUBTRACT' && this.isResetState) {
                 const q = this.mathSteps[this.stage].q;
                 const total = this.getCurrentTotal();
                 const prod = q * this.divisor;
                 const rem = total - prod;
                 const sRem = String(rem);
                 const endCol = this.stage;
                 const startCol = endCol - sRem.length + 1;

                 for (let i = 0; i <= this.stage; i++) {
                     const box = getEl(`r-${this.stage}-${i}`);
                     if (!box || box.classList.contains('invisible-box') || !box.classList.contains('has-val')) continue;
                     const valStr = toEnglish(box.innerText).trim();
                     const charIdx = i - startCol;
                     const expectedDigit = (charIdx >= 0 && charIdx < sRem.length) ? sRem[charIdx] : '0';

                     if (valStr === expectedDigit) {
                         box.classList.add('correct'); 
                         box.classList.remove('wrong');
                     } else {
                         box.classList.add('wrong');
                     }
                 }
            }

            if (this.subStep === 'MULTIPLY_P' && !this.isResetState) {
                this.inputQueue = [];
                for (let j = this.stage; j >= 0; j--) {
                    const b = getEl(`p-${this.stage}-${j}`);
                    if (b && !b.classList.contains('invisible-box') && !b.classList.contains('has-val')) {
                        this.inputQueue.push(b.id);
                    }
                }
            }

            if (data.brws) {
                for (const [id, info] of Object.entries(data.brws)) {
                    const el = getEl(id);
                    if (el) {
                        if (info.sub) { el.classList.add('borrow-src'); el.setAttribute('data-val-sub', info.sub); }
                        if (info.dest) { el.classList.add('borrow-dest'); el.setAttribute('data-val-dest', info.dest); }
                        if (info.mode === 'dest') el.classList.add('display-mode-dest');
                        else if (info.mode === 'src') el.classList.add('display-mode-src');
                    }
                }
            }
            
            for(let i=0; i<this.stage; i++) { if(getEl(`row-p-${i}`)) getEl(`row-p-${i}`).classList.add('dimmed'); }

            this.updateCheckBtn();
            if (!this.isTutorialMode) {
                if (this.subStep === 'SELECT') {
                     this.msg(`بازیابی شد. نوبت رقم ${CONFIG.pvLabels[this.stage]} هست.`);
                     this.updateSelectHighlight();
                     getEl('est-button').classList.add('hidden');
                } else if (this.subStep === 'BRING_DOWN') {
                     this.msg('بازیابی شد. رقم بعدی رو پایین بیار.');
                     this.updateSelectHighlight();
                     getEl('est-button').classList.remove('hidden');
                } else if (this.subStep === 'QUOTIENT') {
                    this.msg('بازیابی شد. تقسیم کن.');
                    const qBox = getEl(`q-${this.stage}`);
                    if (!qBox.classList.contains('correct')) getEl('est-button').classList.remove('hidden');
                    this.showBracket(this.stage);
                } else if (this.subStep === 'MULTIPLY_P') {
                    if (this.isResetState) {
                        this.msg('خطا وجود دارد. دکمه‌ی قرمز رو برای شروع دوباره بزن.', true);
                    } else {
                        if (this.inputQueue && this.inputQueue.length > 0) {
                            this.msg('بازیابی شد. حالا ضرب کن.');
                            this.processNextInput();
                        } else {
                            this.msg('حالا دکمه‌ی بررسی رو بزن تا حاصل‌ضرب تأیید بشه.');
                        }
                    }
                    getEl('est-button').classList.remove('hidden');
                    this.showBracket(this.stage);
                } else if (this.subStep === 'SUBTRACT') {
                    if (this.isResetState) {
                        this.msg('بعضی از رقم‌های تفریق اشتباهه. دکمه‌ی قرمز رو برای شروع دوباره‌ی تفریق بزن.', true);
                    } else {
                        this.msg('بازیابی شد. حالا تفریق کن.');
                        for (let j = this.stage; j >= 0; j--) {
                            const b = getEl(`r-${this.stage}-${j}`);
                            if (b && !b.classList.contains('invisible-box') && !b.classList.contains('has-val')) {
                                this.activate(b.id);
                                break;
                            }
                        }
                    }
                    getEl('est-button').classList.remove('hidden');
                    this.showBracket(this.stage);
                } else if (this.subStep === 'FINISH') {
                    this.msg('تموم شد! دکمه‌ی پایان رو بزن.');
                    getEl('est-button').classList.add('hidden');
                }
            } else {
                if(this.subStep === 'SELECT' || this.subStep === 'BRING_DOWN') this.updateSelectHighlight();
                if(this.subStep === 'QUOTIENT' || this.subStep === 'MULTIPLY_P' || this.subStep === 'SUBTRACT') this.showBracket(this.stage);
            }
            
        } catch (e) { console.error(e); this.start(); }
    },

    clearState() { localStorage.removeItem(GAME_STATE_STORAGE); },

    renderUI() {
        getEl('math-area').innerHTML = ''; getEl('dividend-row').innerHTML = ''; getEl('quotient-row').innerHTML = '';
        
        const dStr = String(this.divisor);
        getEl('divisor-display').innerHTML = `
            <span id="dvr-tens" class="dvr-digit">${toPersian(dStr[0])}</span>
            <span id="dvr-units" class="dvr-digit">${toPersian(dStr[1])}</span>
        `;

        for(let i=0; i<4; i++) {
            const b = document.createElement('div'); b.className = 'box readonly';
            b.innerText = toPersian(this.digits[i]); b.id = `div-${i}`; b.onclick = () => this.clkDividend(i);
            getEl('dividend-row').appendChild(b);
        }
        for (let i = 0; i < 4; i++) {
            const b = document.createElement('div'); b.className = `box ${CONFIG.pvClasses[i]}`; b.id = `q-${i}`;
            b.innerHTML = `<span class="pv-label">${CONFIG.pvLabels[i]}</span><span class="val"></span>`; 
            b.onclick = () => { if(i === this.stage) this.activate(b.id); };
            getEl('quotient-row').appendChild(b);
        }
        this.updateSelectHighlight();
    },

    createProductRow(idx) {
        if (getEl(`row-p-${idx}`)) return;
        const container = getEl('math-area');
        
        const rowP = document.createElement('div'); rowP.className = 'row-container'; rowP.id = `row-p-${idx}`;
        const op = document.createElement('div'); op.className = 'operator'; op.innerText = '-'; rowP.appendChild(op);
        
        const q = this.mathSteps[idx].q;
        const prod = (q !== null) ? q * this.divisor : 0;
        const sProd = String(prod);
        const prodLen = sProd.length;
        const startIdx = idx - prodLen + 1;
        
        for(let i=0; i<4; i++) {
            const b = document.createElement('div'); b.className = 'box'; b.id = `p-${idx}-${i}`;
            if (i > idx || i < startIdx) b.classList.add('invisible-box');
            b.onclick = () => this.activate(b.id);
            rowP.appendChild(b);
        }
        container.appendChild(rowP);
        const line = document.createElement('div');
        line.className = 'subtraction-line';
        line.id = `line-p-${idx}`;
        container.appendChild(line);
    },

    createRemainderRow(idx) {
        if (getEl(`row-r-${idx}`)) return;
        this.lastRemRowIndex = idx;
        const container = getEl('math-area');
        
        const rowR = document.createElement('div'); rowR.className = 'row-container'; rowR.id = `row-r-${idx}`;
        
        let remUntilNow = this.dividend;
        for(let k=0; k<=idx; k++) {
            const stepQ = this.mathSteps[k].q;
            if (stepQ !== null) {
                remUntilNow -= (stepQ * this.divisor * Math.pow(10, 3-k));
            }
        }
        
        const currentPlaceVal = Math.pow(10, 3 - idx);
        const partialRem = Math.floor(remUntilNow / currentPlaceVal);
        const sRem = String(partialRem);
        
        const startVisible = idx - sRem.length + 1;
        
        for(let i=0; i<4; i++) {
            const b = document.createElement('div'); b.className = 'box'; b.id = `r-${idx}-${i}`; 
            
            let isVisible = true;
            if (i > idx) isVisible = false;
            else if (partialRem === 0) {
                if (i !== idx) isVisible = false; 
            }
            else if (i < startVisible) isVisible = false;
            
            if (!isVisible) b.classList.add('invisible-box');
            b.onclick = () => this.handleRemainderClick(idx, i);
            
            rowR.appendChild(b);
        }
        container.appendChild(rowR);
    },

    handleRemainderClick(rIdx, cIdx) {
        if (this.subStep === 'SELECT') {
            if (rIdx === this.lastRemRowIndex) this.clkDividend(this.stage);
        } else if (this.subStep === 'SUBTRACT') {
            if (rIdx !== this.stage) {
                this.handleBorrowClick(`r-${rIdx}-${cIdx}`);
            }
            if (rIdx === this.stage && !getEl(`r-${rIdx}-${cIdx}`).classList.contains('invisible-box')) {
                this.activate(`r-${rIdx}-${cIdx}`);
            }
        }
        else if (this.subStep === 'BRING_DOWN') {
             if (!getEl(`r-${rIdx}-${cIdx}`).classList.contains('invisible-box'))
                this.activate(`r-${rIdx}-${cIdx}`);
        }
    },

    getCurrentTotal() { 
        if (this.lastRemRowIndex === -1) {
            let val = 0;
            for (let i = 0; i <= this.stage; i++) {
                val = val * 10 + this.digits[i];
            }
            return val;
        } else {
            if (this.subStep === 'BRING_DOWN') {
                return this.currentRem;
            }
            return (this.currentRem * 10) + this.digits[this.stage];
        }
    },

    clkDividend(idx) {
        if (this.isTutorialMode && this.subStep !== 'SELECT' && this.subStep !== 'BRING_DOWN') return;

        if (this.subStep === 'BRING_DOWN') {
            if (idx !== this.stage) return this.msg(`باید رقم ${CONFIG.pvLabels[this.stage]} رو پایین بیاری.`, true);
            
            let targetBox = null;
            if (getEl(`r-${this.stage-1}-${this.stage}`)) {
                targetBox = getEl(`r-${this.stage-1}-${this.stage}`);
            } else if (this.lastRemRowIndex !== -1) {
                 targetBox = getEl(`r-${this.lastRemRowIndex}-${this.stage}`);
            }

            if (targetBox) {
                targetBox.innerText = toPersian(this.digits[this.stage]);
                targetBox.classList.remove('invisible-box');
                targetBox.classList.add('has-val');
                targetBox.style.transform = 'scale(1.2)';
                setTimeout(()=>targetBox.style.transform = 'scale(1)', 200);
                this.subStep = 'QUOTIENT';
                this.showBracket(this.stage);
                this.updateSelectHighlight();
                if(!this.isTutorialMode) {
                    this.msg('حالا تقسیم کن.');
                    this.activate(`q-${this.stage}`);
                    getEl('est-button').classList.remove('hidden');
                }
                this.saveProgress();
            }
            return;
        }

        if (this.subStep === 'SUBTRACT') return this.handleBorrowClick(`div-${idx}`);
        if (this.subStep !== 'SELECT') return this.msg('مرحله‌ی جاری رو کامل کن.', true);
        if (idx !== this.stage) return this.msg(`نوبت رقم ${CONFIG.pvLabels[this.stage]} هست.`, true);
        
        GameAudio.playSFX('click');
        this.subStep = 'QUOTIENT'; 
        this.usedEstimation = false;
        this.saveProgress();
        this.updateSelectHighlight(); 
        this.showBracket(idx); 
        if(!this.isTutorialMode) {
            this.activate(`q-${idx}`); 
            getEl('est-button').classList.remove('hidden');
            this.msg('تقسیم کن و جواب رو بنویس.');
        }
    },

    handleQuotientInput(n) {
        const total = this.getCurrentTotal();
        const correctQ = Math.floor(total / this.divisor);
        const maxQ = correctQ > 9 ? 9 : correctQ;

        if (n === 0 && maxQ === 0) {
            const qBox = getEl(`q-${this.stage}`);
            qBox.innerText = toPersian(0);
            qBox.classList.add('correct', 'readonly');
            this.hideNumberPad();
            getEl('est-button').classList.add('hidden');
            
            this.currentRem = total; 
            if(this.stage === 3) { 
                this.subStep = 'FINISH'; 
                this.msg('تموم شد! دکمه‌ی پایان رو بزن.'); 
                this.updateCheckBtn(); 
            } else { 
                this.stage++; 
                if (this.lastRemRowIndex !== -1) {
                    this.subStep = 'BRING_DOWN'; 
                    this.msg(`۰ گذاشتی. حالا رقم بعدی (${CONFIG.pvLabels[this.stage]}) رو پایین بیار.`);
                    const slot = getEl(`r-${this.lastRemRowIndex}-${this.stage}`);
                    if(slot) slot.classList.remove('invisible-box');
                } else {
                    this.subStep = 'SELECT'; 
                    this.msg(`۰ گذاشتی. حالا رقم بعدی (${CONFIG.pvLabels[this.stage]}) رو انتخاب کن.`); 
                }
                this.updateSelectHighlight(); 
            }
            this.saveProgress();
            return;
        }

        this.createProductRow(this.stage);
        const prodBase = n * this.divisor; 
        const sProd = String(prodBase);
        
        this.inputQueue = [];
        const endCol = this.stage;
        const startCol = endCol - sProd.length + 1;
        
        for (let i = endCol; i >= startCol; i--) {
            if (i >= 0) this.inputQueue.push(`p-${this.stage}-${i}`);
        }

        this.subStep = 'MULTIPLY_P';
        this.tutorialIdx = endCol;
        this.msg(`حالا جواب ${toPersian(n)} ضربدر ${toPersian(this.divisor)} رو بنویس.`);
        if(!this.isTutorialMode) this.processNextInput();
        this.saveProgress();
    },

    processNextInput() {
        if (this.inputQueue.length > 0) {
            const nextId = this.inputQueue.shift();
            this.activate(nextId);
        } else {
            this.hideNumberPad();
            this.msg('حالا دکمه‌ی بررسی رو بزن تا حاصل‌ضرب تأیید بشه.');
            this.updateCheckBtn();
        }
    },

    checkEstimation() {
        const divBox = getEl('est-inp-div'); const dvrBox = getEl('est-inp-dvr'); const qBox = getEl('est-inp-q');
        const valDiv = parseInt(toEnglish(divBox.innerText)); const valDvr = parseInt(toEnglish(dvrBox.innerText));
        const realDiv = parseInt(toEnglish(getEl('est-real-div').innerText)); const realDvr = this.divisor;
        
        if (this.estStep === 1) {
            const expectedDiv = Math.floor(realDiv / 10) * 10; const expectedDvr = Math.floor(realDvr / 10) * 10;
            if (valDiv === expectedDiv && valDvr === expectedDvr) {
                divBox.classList.add('correct'); dvrBox.classList.add('correct');
                if (toPersian(valDiv).slice(-1) === '۰') divBox.innerHTML = toPersian(valDiv).slice(0, -1) + '<span class="crossed-zero">۰</span>';
                if (toPersian(valDvr).slice(-1) === '۰') dvrBox.innerHTML = toPersian(valDvr).slice(0, -1) + '<span class="crossed-zero">۰</span>';
                this.estStep = 2;
                qBox.style.opacity = '1'; qBox.style.pointerEvents = 'auto'; qBox.style.border = '2px solid #e67e22';
                getEl('est-msg').innerText = 'حالا صفرها رو نادیده بگیر و تقسیم کن'; this.activateEst('est-inp-q');
            } else {
                getEl('est-msg').innerText = 'اشتباهه! یکان باید صفر بشه (قطع‌کردن)';
                if(valDiv!==expectedDiv) divBox.classList.add('wrong'); if(valDvr!==expectedDvr) dvrBox.classList.add('wrong');
            }
        } else {
            const valQ = parseInt(toEnglish(qBox.innerText));
            const estDiv = Math.floor(realDiv / 10); const estDvr = Math.floor(realDvr / 10);
            let expectedQ = (estDvr === 0) ? 0 : Math.floor(estDiv / estDvr);
            if (valQ === expectedQ) {
                this.closeEstimation(); this.msg('جواب تخمین درسته. حالا بنویسش!'); this.usedEstimation = true; 
            } else {
                qBox.classList.add('wrong'); getEl('est-msg').innerText = 'تقسیم اشتباهه!';
            }
        }
    },

    inputDigit(n) {
        GameAudio.playSFX('click');
        if (!this.activeBox && !this.isTutorialMode) return;
        let targetId = this.activeBox;
        if (this.isTutorialMode && typeof n === 'object') targetId = n.targetId;
        const el = getEl(targetId);
        const val = (this.isTutorialMode && typeof n === 'object') ? n.val : n;

        if (this.activeBox && this.activeBox.startsWith('est-inp-') && !this.activeBox.endsWith('-q')) {
            let currentVal = toEnglish(el.innerText); if (currentVal.length < 3) el.innerText = toPersian(currentVal + val);
            el.classList.add('has-val'); el.classList.remove('wrong'); return;
        }
        el.innerText = toPersian(val); el.classList.add('has-val'); el.classList.remove('wrong');
        
        if (!this.activeBox || !this.activeBox.startsWith('est-')) {
            const [type, stg, idx] = targetId.split('-'); 
            const s = parseInt(stg); const i = parseInt(idx);

            if (type === 'q') { 
                this.mathSteps[s].q = val; 
                if(!this.isTutorialMode) this.handleQuotientInput(val); 
            }
            else if (type === 'p') { 
                this.mathSteps[s].p[i] = String(val); 
                if(!this.isTutorialMode) this.processNextInput(); 
            }
            else if (type === 'r') { 
                this.mathSteps[s].r[i] = String(val); 
                if (!this.isTutorialMode) {
                    if (i > 0 && !getEl(`r-${s}-${i-1}`).classList.contains('invisible-box')) {
                         this.activate(`r-${s}-${i - 1}`); 
                    } else {
                         this.hideNumberPad();
                    }
                }
            }
            this.updateCheckBtn(); this.saveProgress();
        }
    },

    activate(id) {
        if (this.isTutorialMode) return;
        if (getEl(id).classList.contains('readonly') || getEl(id).classList.contains('invisible-box')) return;
        if (this.activeBox) getEl(this.activeBox).classList.remove('active-input');
        this.activeBox = id; getEl(id).classList.add('active-input'); getEl('number-pad').classList.remove('hidden');
    },
    hideNumberPad() {
        getEl('number-pad').classList.add('hidden');
        if (this.activeBox) { getEl(this.activeBox).classList.remove('active-input'); this.activeBox = null; }
    },
    openEstimation() {
        this.hideNumberPad();
        const total = this.getCurrentTotal();
        getEl('est-real-div').innerText = toPersian(total); getEl('est-real-dvr').innerText = toPersian(this.divisor);
        getEl('est-inp-div').innerText = ''; getEl('est-inp-dvr').innerText = ''; getEl('est-inp-q').innerText = '';
        getEl('est-inp-div').className = 'est-box'; getEl('est-inp-dvr').className = 'est-box';
        getEl('est-inp-q').style.opacity = '0.5'; getEl('est-inp-q').style.pointerEvents = 'none';
        getEl('est-msg').innerText = ''; getEl('est-modal').classList.remove('hidden');
        this.estStep = 1; this.activateEst('est-inp-div');
    },
    activateEst(id) { document.querySelectorAll('.est-box').forEach(e => e.classList.remove('active')); getEl(id).classList.add('active'); this.estActiveBox = id; },
    inputEstDigit(n) { if (!this.estActiveBox) return; const el = getEl(this.estActiveBox); let currentVal = toEnglish(el.innerText); if (currentVal.length < 3) el.innerText = toPersian(currentVal + n); el.classList.add('has-val'); el.classList.remove('wrong'); },
    clearEstActiveBox() { if(this.estActiveBox) getEl(this.estActiveBox).innerText = ''; },
    closeEstimation() { getEl('est-modal').classList.add('hidden'); this.estActiveBox = null; if(this.subStep === 'QUOTIENT' && !this.isTutorialMode) this.activate(`q-${this.stage}`); },
    clearActiveBox() { 
        if(this.activeBox) { 
            const el = getEl(this.activeBox);
            el.classList.remove('has-val');
            
            const parts = this.activeBox.split('-');
            if (parts.length === 3) {
                el.innerText = ''; 
                const type = parts[0];
                const s = parseInt(parts[1]);
                const i = parseInt(parts[2]);
                if (type === 'p') this.mathSteps[s].p[i] = '';
                else if (type === 'r') this.mathSteps[s].r[i] = '';
            } else if (parts.length === 2 && parts[0] === 'q') {
                const s = parseInt(parts[1]);
                this.mathSteps[s].q = null;
                el.className = `box ${CONFIG.pvClasses[s]}`;
                el.innerHTML = `<span class="pv-label">${CONFIG.pvLabels[s]}</span><span class="val"></span>`;
            } else {
                el.innerText = '';
            }
            this.updateCheckBtn();
            this.saveProgress();
        } 
    },

    showBracket(idx) {
        const b = getEl('bracket'); const panel = getEl('left-panel');
        let startEl, endEl;
        if (this.lastRemRowIndex === -1) {
            startEl = getEl('div-0'); endEl = getEl(`div-${idx}`);
        } else {
            const rRow = getEl(`row-r-${this.lastRemRowIndex}`);
            if (rRow) {
                const visibleBoxes = Array.from(rRow.querySelectorAll('.box:not(.invisible-box)'));
                if (visibleBoxes.length > 0) {
                    startEl = visibleBoxes[0];
                    if (visibleBoxes.length > 1 && visibleBoxes[0].innerText.trim() === '۰') {
                        startEl = visibleBoxes[1];
                    }
                    endEl = visibleBoxes[visibleBoxes.length - 1];
                }
            }
        }
        if (startEl && endEl) {
            const pRect = panel.getBoundingClientRect(); const sRect = startEl.getBoundingClientRect(); const eRect = endEl.getBoundingClientRect();
            b.style.display = 'block'; 
            b.style.width = ((eRect.left - sRect.left) + eRect.width) + 'px';
            b.style.left = (sRect.left - pRect.left + panel.scrollLeft) + 'px';
            const topOffset = sRect.top - pRect.top + panel.scrollTop;
            b.style.top = `${topOffset - 12}px`;
            b.style.borderColor = `var(--${CONFIG.pvClasses[idx].split('-')[1]})`;
            let lbl = b.querySelector('.bracket-label'); if(!lbl) { lbl = document.createElement('span'); lbl.className = 'bracket-label'; b.appendChild(lbl); }
            lbl.innerText = CONFIG.pvLabels[idx];
        } else { b.style.display = 'none'; }
    },
    
    updateSelectHighlight() {
        document.querySelectorAll('.action-target').forEach(el => el.classList.remove('action-target'));
        if (this.subStep === 'SELECT') {
            getEl(`div-${this.stage}`).classList.add('action-target');
        } else if (this.subStep === 'BRING_DOWN') {
            const t = getEl(`div-${this.stage}`);
            if(t) t.classList.add('action-target');
        }
    },
    
    updateCheckBtn() {
        const btn = getEl('btn-check');
        if (this.isResetState) {
            if (this.subStep === 'SUBTRACT') {
                btn.innerText = '❌ پاک‌کردن تفریق';
            } else {
                btn.innerText = '❌ پاک‌کردن خطاها';
            }
            btn.className = 'btn btn-danger';
            btn.disabled = false;
            return;
        }
        
        if (this.subStep === 'FINISH') { 
            btn.innerText = '🏁 پایان'; 
            btn.className = 'btn btn-finish'; 
            btn.disabled = false; 
            return; 
        }

        btn.className = 'btn btn-success';
        btn.innerText = '✅ بررسی';
        
        if (this.subStep === 'MULTIPLY_P') {
            const qBox = getEl(`q-${this.stage}`);
            const qFilled = qBox && qBox.classList.contains('has-val');
            const pRow = getEl(`row-p-${this.stage}`);
            const pFilled = pRow ? Array.from(pRow.querySelectorAll('.box:not(.invisible-box)')).every(b => b.classList.contains('has-val')) : false;
            btn.disabled = !(qFilled && pFilled);
        } else if (this.subStep === 'SUBTRACT') {
            const rRow = getEl(`row-r-${this.stage}`);
            const rFilled = rRow ? Array.from(rRow.querySelectorAll('.box:not(.invisible-box)')).every(b => b.classList.contains('has-val')) : false;
            btn.disabled = !rFilled;
        } else {
            btn.disabled = true;
        }
    },

    updateTutorialBtn() {
        const tutBtn = getEl('btn-next-tutorial');
        if (!tutBtn) return;
        if (this.subStep === 'FINISH') {
            tutBtn.innerText = '🏁 پایان';
            tutBtn.className = 'btn btn-tut-next btn-finish';
        } else {
            tutBtn.innerText = '👇 مرحله‌ی بعد (همراه با صدا 🔊)';
            tutBtn.className = 'btn btn-tut-next';
        }
    },

    checkCurrentStep() {
        if (this.isResetState) {
            this.resetCurrentStep();
            return;
        }
        if (this.subStep === 'FINISH') return app.finishGame(true);
        
        const total = this.getCurrentTotal();
        
        if (this.subStep === 'MULTIPLY_P') {
            const correctQ = Math.floor(total / this.divisor);
            const maxQ = correctQ > 9 ? 9 : correctQ;
            
            const qBox = getEl(`q-${this.stage}`);
            const enteredQ = parseInt(toEnglish(qBox.innerText));
            const isQCorrect = (enteredQ === maxQ);
            
            const expectedProd = enteredQ * this.divisor;
            const expectedProdStr = String(expectedProd);
            
            const endCol = this.stage;
            const startCol = endCol - expectedProdStr.length + 1;
            
            let hasError = false;
            
            if (isQCorrect) {
                qBox.classList.add('correct');
                qBox.classList.remove('wrong');
            } else {
                qBox.classList.add('wrong');
                qBox.classList.remove('correct');
                hasError = true;
            }
            
            for (let i = 0; i < 4; i++) {
                const box = getEl(`p-${this.stage}-${i}`);
                if (box && !box.classList.contains('invisible-box')) {
                    const val = toEnglish(box.innerText);
                    const charIdx = i - startCol;
                    if (charIdx >= 0 && val === expectedProdStr[charIdx]) {
                        box.classList.add('correct');
                        box.classList.remove('wrong');
                    } else {
                        box.classList.add('wrong');
                        box.classList.remove('correct');
                        hasError = true;
                    }
                }
            }
            
            if (!hasError) {
                GameAudio.playSFX('correct');
                qBox.classList.add('readonly');
                for (let i = 0; i < 4; i++) {
                    const box = getEl(`p-${this.stage}-${i}`);
                    if (box) box.classList.add('readonly');
                }
                
                this.subStep = 'SUBTRACT';
                this.tutorialIdx = this.stage;
                this.createRemainderRow(this.stage);
                
                if (!this.isTutorialMode) {
                    this.msg('آفرین. حالا تفریق کن.');
                    this.activate(`r-${this.stage}-${this.stage}`); 
                }
                this.updateCheckBtn();
                this.saveProgress();
            } else {
                GameAudio.playSFX('wrong');
                this.isResetState = true;
                this.updateCheckBtn();
                this.msg('خطا وجود دارد. دکمه‌ی قرمز رو برای شروع دوباره بزن.', true);
            }
        }
        else if (this.subStep === 'SUBTRACT') {
            const q = this.mathSteps[this.stage].q;
            const prod = q * this.divisor; 
            const rem = total - prod;
            const sRem = String(rem);
            const endCol = this.stage;
            const startCol = endCol - sRem.length + 1;

            let hasError = false;
            let phantomBorrowError = false;
            
            for (let i = 0; i <= this.stage; i++) {
                const box = getEl(`r-${this.stage}-${i}`);
                if (!box || box.classList.contains('invisible-box') || !box.classList.contains('has-val')) continue;
                
                const valStr = toEnglish(box.innerText).trim();
                const charIdx = i - startCol;
                const expectedDigit = (charIdx >= 0 && charIdx < sRem.length) ? sRem[charIdx] : '0';
                
                if (valStr === expectedDigit) {
                     box.classList.add('correct', 'readonly'); 
                     box.classList.remove('wrong');
                } else {
                     box.classList.add('wrong'); 
                     hasError = true;
                     if (parseInt(valStr) === parseInt(expectedDigit) + 1) {
                         phantomBorrowError = true;
                     }
                }
            }

            if (rem === 0) {
                 const lastBox = getEl(`r-${this.stage}-${this.stage}`);
                 if (lastBox && lastBox.classList.contains('has-val')) {
                     const val = toEnglish(lastBox.innerText).trim();
                     if (val !== '0' && val !== '۰') {
                         lastBox.classList.add('wrong'); 
                         hasError = true;
                     }
                 }
            }

            if (!hasError) {
                GameAudio.playSFX('correct');
                this.currentRem = rem; 
                this.stage++; 
                getEl(`row-p-${this.stage-1}`)?.classList.add('dimmed');
                
                if (this.stage > 3) { 
                    this.subStep = 'FINISH'; 
                    this.msg('تموم شد! دکمه‌ی پایان رو بزن.');
                } else { 
                    this.subStep = 'BRING_DOWN'; 
                    getEl('bracket').style.display = 'none'; 
                    if (!this.isTutorialMode) {
                        this.msg(`حالا رقم بعدی (${CONFIG.pvLabels[this.stage]}) رو پایین بیار.`); 
                    }
                }
                this.updateCheckBtn();
                this.saveProgress();
            } else { 
                GameAudio.playSFX('wrong');
                this.isResetState = true;
                this.updateCheckBtn();
                if (phantomBorrowError) {
                    this.msg('یادت نره که از این عدد قرض گرفتی! (الان یکی کمتر شده). دکمه‌ی قرمز رو برای شروع دوباره‌ی تفریق بزن.', true);
                } else {
                    this.msg('بعضی از رقم‌های تفریق اشتباهه. دکمه‌ی قرمز رو برای شروع دوباره‌ی تفریق بزن.', true); 
                }
            }
        }
    },

    resetCurrentStep() {
        this.isResetState = false;

        if (this.subStep === 'SUBTRACT') {
            this.mathSteps[this.stage].r = Array(4).fill('');
            
            const rRow = getEl(`row-r-${this.stage}`);
            if (rRow) {
                const boxes = rRow.querySelectorAll('.box');
                boxes.forEach(box => {
                    box.innerText = '';
                    box.classList.remove('correct', 'wrong', 'readonly', 'has-val');
                });
            }

            document.querySelectorAll('.box').forEach(el => {
                el.classList.remove('borrow-src', 'borrow-dest', 'display-mode-src', 'display-mode-dest');
                el.removeAttribute('data-val-sub');
                el.removeAttribute('data-val-dest');
            });

            this.msg('خطاها پاک شدند. دوباره تفریق کن و جواب رو بنویس.');
            this.activate(`r-${this.stage}-${this.stage}`);
        } else {
            this.mathSteps[this.stage].q = null;
            this.mathSteps[this.stage].p = Array(4).fill('');
            this.mathSteps[this.stage].r = Array(4).fill('');

            const qBox = getEl(`q-${this.stage}`);
            if (qBox) {
                qBox.innerText = '';
                qBox.className = `box ${CONFIG.pvClasses[this.stage]}`;
                qBox.innerHTML = `<span class="pv-label">${CONFIG.pvLabels[this.stage]}</span><span class="val"></span>`;
            }

            const pRow = getEl(`row-p-${this.stage}`);
            if (pRow) pRow.remove();
            const pLine = getEl(`line-p-${this.stage}`);
            if (pLine) pLine.remove();

            const rRow = getEl(`row-r-${this.stage}`);
            if (rRow) rRow.remove();

            document.querySelectorAll('.box').forEach(el => {
                el.classList.remove('borrow-src', 'borrow-dest', 'display-mode-src', 'display-mode-dest');
                el.removeAttribute('data-val-sub');
                el.removeAttribute('data-val-dest');
            });

            if (this.stage === 0) {
                this.subStep = 'SELECT';
                this.msg('روی اولین رقم سمت چپ (هزارتایی) کلیک کن.');
            } else {
                this.subStep = 'QUOTIENT';
                this.msg('حالا تقسیم کن و خارج‌قسمت رو بنویس.');
                this.showBracket(this.stage);
                if (!this.isTutorialMode) this.activate(`q-${this.stage}`);
            }
        }

        const btn = getEl('btn-check');
        btn.innerText = '✅ بررسی';
        btn.className = 'btn btn-success';
        btn.disabled = true;

        this.updateSelectHighlight();
        this.saveProgress();
    },
    
    checkBorrowNecessity(targetId) {
        const parts = targetId.split('-');
        let colIdx = -1;
        if (parts[0] === 'div') colIdx = parseInt(parts[1]);
        else colIdx = parseInt(parts[2]); 

        const neighborCol = colIdx + 1;
        if (neighborCol > 3) return false; 

        const botEl = getEl(`p-${this.stage}-${neighborCol}`);
        let botVal = 0;
        if (botEl && !botEl.classList.contains('invisible-box')) {
            botVal = parseInt(toEnglish(botEl.innerText)) || 0;
        } else {
            return false; 
        }

        let neighborId;
        if (parts[0] === 'div') neighborId = `div-${neighborCol}`;
        else neighborId = `r-${parts[1]}-${neighborCol}`;
        
        const neighborEl = getEl(neighborId);
        if (!neighborEl) return false;

        let neighborVal = parseInt(toEnglish(neighborEl.innerText));
        if (neighborEl.classList.contains('display-mode-src')) neighborVal = parseInt(toEnglish(neighborEl.getAttribute('data-val-sub')));
        else if (neighborEl.classList.contains('display-mode-dest')) neighborVal = parseInt(toEnglish(neighborEl.getAttribute('data-val-dest')));
        else if (neighborEl.hasAttribute('data-val-dest')) neighborVal = parseInt(toEnglish(neighborEl.getAttribute('data-val-dest')));
        else if (neighborEl.hasAttribute('data-val-sub')) neighborVal = parseInt(toEnglish(neighborEl.getAttribute('data-val-sub')));

        if (neighborVal < botVal) return true;
        return false;
    },

    handleBorrowClick(id) {
        if (this.subStep !== 'SUBTRACT') return;
        const el = getEl(id);
        if(el.classList.contains('borrow-src')) return; 
        
        let currentVal = parseInt(toEnglish(el.innerText));
        if (el.classList.contains('display-mode-dest')) currentVal = parseInt(toEnglish(el.getAttribute('data-val-dest')));
        else if (el.hasAttribute('data-val-dest')) currentVal = parseInt(toEnglish(el.getAttribute('data-val-dest')));

        if (currentVal <= 0) {
             GameAudio.playSFX('wrong');
             el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500);
             this.msg('این عدد صفره و نمی‌تونه قرض بده.', true); return;
        }
        if (!this.checkBorrowNecessity(id)) {
            GameAudio.playSFX('wrong');
            el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500);
            this.msg('نیازی به قرض‌گرفتن نیست.', true); return;
        }

        GameAudio.playSFX('click');
        el.classList.add('borrow-src'); 
        el.setAttribute('data-val-sub', toPersian(currentVal - 1));
        el.classList.add('display-mode-src'); el.classList.remove('display-mode-dest');

        const parts = id.split('-');
        let neighborId;
        if(parts[0] === 'div') neighborId = `div-${parseInt(parts[1])+1}`;
        else neighborId = `${parts[0]}-${parts[1]}-${parseInt(parts[2])+1}`;
        
        const neighbor = getEl(neighborId);
        if(neighbor) {
            let nVal = parseInt(toEnglish(neighbor.innerText));
            if (neighbor.classList.contains('display-mode-src')) nVal = parseInt(toEnglish(neighbor.getAttribute('data-val-sub')));
            else if (neighbor.classList.contains('display-mode-dest')) nVal = parseInt(toEnglish(neighbor.getAttribute('data-val-dest')));
            else if (neighbor.hasAttribute('data-val-sub')) nVal = parseInt(toEnglish(neighbor.getAttribute('data-val-sub')));
            else if (neighbor.hasAttribute('data-val-dest')) nVal = parseInt(toEnglish(neighbor.getAttribute('data-val-dest')));

            const newVal = nVal + 10;
            neighbor.setAttribute('data-val-dest', toPersian(newVal));
            neighbor.classList.add('borrow-dest');
            neighbor.classList.add('display-mode-dest'); neighbor.classList.remove('display-mode-src');
        }
        this.saveProgress();
    },
    
    forceBorrowVisual(srcId, destId) {
        const srcEl = getEl(srcId); const destEl = getEl(destId);
        if(!srcEl || !destEl) return;
        let sVal = parseInt(toEnglish(srcEl.innerText));
        if (srcEl.classList.contains('display-mode-dest')) sVal = parseInt(toEnglish(srcEl.getAttribute('data-val-dest')));
        else if (srcEl.hasAttribute('data-val-dest')) sVal = parseInt(toEnglish(srcEl.getAttribute('data-val-dest')));
        else if (srcEl.hasAttribute('data-val-sub')) sVal = parseInt(toEnglish(srcEl.getAttribute('data-val-sub')));
        
        srcEl.classList.add('borrow-src'); srcEl.classList.add('display-mode-src'); srcEl.classList.remove('display-mode-dest');
        srcEl.setAttribute('data-val-sub', toPersian(sVal - 1));
        
        let dVal = parseInt(toEnglish(destEl.innerText));
        if (destEl.classList.contains('display-mode-src')) dVal = parseInt(toEnglish(destEl.getAttribute('data-val-sub')));
        else if (destEl.hasAttribute('data-val-dest')) dVal = parseInt(toEnglish(destEl.getAttribute('data-val-dest')));
        else if (destEl.hasAttribute('data-val-sub')) dVal = parseInt(toEnglish(destEl.getAttribute('data-val-sub')));
        
        destEl.classList.add('borrow-dest'); destEl.classList.add('display-mode-dest'); destEl.classList.remove('display-mode-src');
        destEl.setAttribute('data-val-dest', toPersian(dVal + 10));
    },
    
    getMinuendId(s, c) {
        for (let k = s - 1; k >= 0; k--) { if (document.getElementById(`r-${k}-${c}`)) return `r-${k}-${c}`; }
        return `div-${c}`;
    },

    askHelp() { getEl('help-modal').classList.remove('hidden'); },
    cancelHelp() { getEl('help-modal').classList.add('hidden'); },
    confirmHelp() {
        getEl('help-modal').classList.add('hidden');
        const savedD = this.dividend; const savedV = this.divisor;
        this.startRoundLogic();
        this.dividend = savedD; this.divisor = savedV; this.digits = String(this.dividend).split('').map(Number);
        this.renderUI();
        
        this.helpUsed = true;
        this.isTutorialMode = true;
        app.state.isTutorialMode = true;
        
        getEl('help-button').classList.add('hidden');
        getEl('est-button').classList.add('hidden');
        getEl('btn-check').classList.add('hidden');
        getEl('tutorial-bar').classList.remove('hidden');
        this.updateTutorialBtn();
        
        this.msg('حالت آموزشی: اولین رقم از چپ رو انتخاب می‌کنیم.');
        setTutorialBtnState(true);
        GameAudio.speakSelectInitial(() => setTutorialBtnState(false));
        this.saveProgress();
    },

    tutorialNext() {
        getEl('number-pad').classList.add('hidden');

        if (this.subStep === 'SELECT') {
            if (this.stage === 0) {
                this.clkDividend(0);
                const total = this.getCurrentTotal();
                const correctQ = Math.floor(total / this.divisor);
                const maxQ = correctQ > 9 ? 9 : correctQ;

                if (maxQ === 0) {
                    const qBox = getEl(`q-${this.stage}`);
                    qBox.innerText = toPersian(0);
                    qBox.classList.add('correct', 'readonly');
                    this.mathSteps[this.stage].q = 0;
                    this.currentRem = total;
                    this.stage = 1;
                    this.subStep = 'SELECT';
                    this.updateSelectHighlight();

                    this.msg('چون تقسیم نمی‌شه، در خارج‌قسمت یک ۰ می‌ذاریم.');
                    setTutorialBtnState(true);
                    GameAudio.speakZeroQuotient(() => setTutorialBtnState(false));
                }
                this.updateTutorialBtn();
                this.saveProgress();
                return;
            } else {
                const isTopRowOnly = (this.lastRemRowIndex === -1);
                if (isTopRowOnly) {
                    this.msg(`رقم بعدی (${CONFIG.pvLabels[this.stage]}) رو هم انتخاب می‌کنیم.`);
                    this.clkDividend(this.stage);
                    setTutorialBtnState(true);
                    GameAudio.speakSelectNext(() => setTutorialBtnState(false));
                } else {
                    this.msg(`حالا رقم بعدی (${CONFIG.pvLabels[this.stage]}) رو می‌آوریم پایین.`);
                    this.clkDividend(this.stage);
                    setTutorialBtnState(true);
                    GameAudio.speakBringDown(() => setTutorialBtnState(false));
                }
            }
            this.updateTutorialBtn();
            return;
        }

        if (this.subStep === 'BRING_DOWN') {
            this.msg(`حالا رقم بعدی (${CONFIG.pvLabels[this.stage]}) رو می‌آوریم پایین.`);
            this.clkDividend(this.stage);
            setTutorialBtnState(true);
            GameAudio.speakBringDown(() => setTutorialBtnState(false));
            this.updateTutorialBtn();
            return;
        }

        if (this.subStep === 'QUOTIENT') {
            const total = this.getCurrentTotal();
            const correctQ = Math.floor(total / this.divisor);
            const maxQ = correctQ > 9 ? 9 : correctQ;
            
            if (maxQ === 0) {
                const qBox = getEl(`q-${this.stage}`);
                qBox.innerText = toPersian(0);
                qBox.classList.add('correct', 'readonly', 'has-val');
                this.mathSteps[this.stage].q = 0;
                this.currentRem = total;

                if (this.stage === 3) {
                    this.subStep = 'FINISH';
                    this.msg('تموم شد! دکمه‌ی پایان رو بزن.');
                } else {
                    this.stage++;
                    if (this.lastRemRowIndex !== -1) {
                        this.subStep = 'BRING_DOWN';
                        const slot = getEl(`r-${this.lastRemRowIndex}-${this.stage}`);
                        if (slot) slot.classList.remove('invisible-box');
                    } else {
                        this.subStep = 'SELECT';
                    }
                    this.updateSelectHighlight();
                }

                this.msg('چون تقسیم نمی‌شه، در خارج‌قسمت یک ۰ می‌ذاریم.');
                setTutorialBtnState(true);
                GameAudio.speakZeroQuotient(() => setTutorialBtnState(false));
            } else {
                const qBox = getEl(`q-${this.stage}`);
                qBox.innerText = toPersian(maxQ);
                qBox.classList.add('correct', 'readonly', 'has-val');
                this.mathSteps[this.stage].q = maxQ;

                this.createProductRow(this.stage);
                this.subStep = 'MULTIPLY_P';
                this.multStep = 0;
                this.multCarry = 0;

                this.msg(`${toPersian(total)} تقسیم بر ${toPersian(this.divisor)} حدوداً می‌شه ${toPersian(maxQ)}`);
                setTutorialBtnState(true);
                GameAudio.speakQuotient(total, this.divisor, maxQ, () => setTutorialBtnState(false));
            }
            this.updateTutorialBtn();
            this.saveProgress();
            return;
        }

        if (this.subStep === 'MULTIPLY_P') {
            const q = this.mathSteps[this.stage].q;
            const dUnits = this.divisor % 10;
            const dTens = Math.floor(this.divisor / 10);
            const rawProdTotal = q * this.divisor;
            const sProdTotal = String(rawProdTotal);
            const endCol = this.stage;
            const startCol = endCol - sProdTotal.length + 1;

            if (this.multStep === 0) {
                const prodUnits = q * dUnits;
                const writeUnits = prodUnits % 10;
                const newCarry = Math.floor(prodUnits / 10);
                this.multCarry = newCarry;

                const box = getEl(`p-${this.stage}-${this.stage}`);
                if (box) {
                    box.innerText = toPersian(writeUnits);
                    box.classList.add('has-val', 'correct', 'readonly');
                }

                let msg = `<b>${toPersian(q)}</b> ضربدر <b>${toPersian(dUnits)}</b> می‌شه <b>${toPersian(prodUnits)}</b>؛ <b>${toPersian(writeUnits)}</b> رو می‌نویسیم`;
                if (newCarry > 0) {
                    msg += `، <b>${toPersian(newCarry)}</b> رو می‌بریم بالا.`;
                } else {
                    msg += `.`;
                }
                this.msg(msg);
                
                TutorialVisuals.showMultiplyDigit(this.stage, 'units');
                setTutorialBtnState(true);
                GameAudio.speakMultiplicationStep(q, dUnits, prodUnits, 0, prodUnits, writeUnits, newCarry, () => {
                    TutorialVisuals.clear();
                    setTutorialBtnState(false);
                });

                this.multStep = 1;
                this.saveProgress();
                return;
            } else {
                const carryIn = this.multCarry || 0;
                const rawProdTens = q * dTens;
                const totalValTens = rawProdTens + carryIn;

                for (let c = startCol; c <= endCol; c++) {
                    const charIdx = c - startCol;
                    const box = getEl(`p-${this.stage}-${c}`);
                    if (box) {
                        box.innerText = toPersian(sProdTotal[charIdx]);
                        box.classList.add('has-val', 'correct', 'readonly');
                    }
                    this.mathSteps[this.stage].p[c] = sProdTotal[charIdx];
                }

                let msg = `<b>${toPersian(q)}</b> ضربدر <b>${toPersian(dTens)}</b> می‌شه <b>${toPersian(rawProdTens)}</b>`;
                if (carryIn > 0) {
                    msg += `، با <b>${toPersian(carryIn)}</b> انتقال می‌شه <b>${toPersian(totalValTens)}</b>؛ <b>${toPersian(totalValTens)}</b> رو می‌نویسیم.`;
                } else {
                    msg += `؛ <b>${toPersian(totalValTens)}</b> رو می‌نویسیم.`;
                }
                this.msg(msg);
                
                TutorialVisuals.showMultiplyDigit(this.stage, 'tens');
                setTutorialBtnState(true);
                GameAudio.speakMultiplicationStep(q, dTens, rawProdTens, carryIn, totalValTens, totalValTens, 0, () => {
                    TutorialVisuals.clear();
                    setTutorialBtnState(false);
                    this.createRemainderRow(this.stage);
                    this.subStep = 'SUBTRACT';
                    this.updateTutorialBtn();
                    this.saveProgress();
                });
                return;
            }
        }

        if (this.subStep === 'SUBTRACT') {
            const rRow = getEl(`row-r-${this.stage}`);
            const boxes = Array.from(rRow.querySelectorAll('.box:not(.invisible-box)'));
            let emptyBoxes = boxes.filter(b => !b.classList.contains('has-val'));

            if (emptyBoxes.length === 0) {
                return;
            }

            let currentBox = emptyBoxes[emptyBoxes.length - 1];
            const parts = currentBox.id.split('-');
            const colIdx = parseInt(parts[2]);

            const topId = this.getMinuendId(this.stage, colIdx);
            const botId = `p-${this.stage}-${colIdx}`;
            const topEl = getEl(topId);
            const botEl = getEl(botId);

            let topVal = parseInt(toEnglish(topEl.innerText)) || 0;
            if (topEl.classList.contains('display-mode-src')) topVal = parseInt(toEnglish(topEl.getAttribute('data-val-sub')));
            else if (topEl.classList.contains('display-mode-dest')) topVal = parseInt(toEnglish(topEl.getAttribute('data-val-dest')));
            else if (topEl.hasAttribute('data-val-sub')) topVal = parseInt(toEnglish(topEl.getAttribute('data-val-sub')));
            else if (topEl.hasAttribute('data-val-dest')) topVal = parseInt(toEnglish(topEl.getAttribute('data-val-dest')));

            let botVal = botEl && !botEl.classList.contains('invisible-box') ? (parseInt(toEnglish(botEl.innerText)) || 0) : 0;

            if (topVal < botVal) {
                const leftCol = colIdx - 1;
                const neighborId = this.getMinuendId(this.stage, leftCol);
                const neighborEl = getEl(neighborId);

                if (neighborEl) {
                    let neighborVal = parseInt(toEnglish(neighborEl.innerText)) || 0;
                    if (neighborEl.classList.contains('display-mode-src')) neighborVal = parseInt(toEnglish(neighborEl.getAttribute('data-val-sub')));
                    else if (neighborEl.classList.contains('display-mode-dest')) neighborVal = parseInt(toEnglish(neighborEl.getAttribute('data-val-dest')));
                    else if (neighborEl.hasAttribute('data-val-sub')) neighborVal = parseInt(toEnglish(neighborEl.getAttribute('data-val-sub')));
                    else if (neighborEl.hasAttribute('data-val-dest')) neighborVal = parseInt(toEnglish(neighborEl.getAttribute('data-val-dest')));

                    if (neighborVal === 0) {
                        const grandId = this.getMinuendId(this.stage, leftCol - 1);
                        this.forceBorrowVisual(grandId, neighborId);
                        this.msg('چون این رقم ۰ هست، از رقم کناری‌اش قرض می‌گیریم.');
                        setTutorialBtnState(true);
                        GameAudio.speakBorrowZero(() => setTutorialBtnState(false));
                    } else {
                        this.forceBorrowVisual(neighborId, topId);
                        this.msg('چون نمی‌شه کم کرد، از رقم کناری قرض می‌گیریم.');
                        setTutorialBtnState(true);
                        GameAudio.speakBorrow(() => setTutorialBtnState(false));
                    }
                    this.saveProgress();
                    return;
                }
            }

            if (topEl.classList.contains('display-mode-src')) topVal = parseInt(toEnglish(topEl.getAttribute('data-val-sub')));
            else if (topEl.classList.contains('display-mode-dest')) topVal = parseInt(toEnglish(topEl.getAttribute('data-val-dest')));
            else if (topEl.hasAttribute('data-val-sub')) topVal = parseInt(toEnglish(topEl.getAttribute('data-val-sub')));
            else if (topEl.hasAttribute('data-val-dest')) topVal = parseInt(toEnglish(topEl.getAttribute('data-val-dest')));

            let diff = topVal - botVal;
            currentBox.innerText = toPersian(diff);
            currentBox.classList.add('has-val', 'correct', 'readonly');
            this.mathSteps[this.stage].r[colIdx] = String(diff);

            this.msg('حالا تفریق رو انجام می‌دیم.');
            setTutorialBtnState(true);
            GameAudio.speakSubtract(() => {
                setTutorialBtnState(false);
                let remainingEmpty = boxes.filter(b => !b.classList.contains('has-val'));
                if (remainingEmpty.length === 0) {
                    const q = this.mathSteps[this.stage].q;
                    const total = this.getCurrentTotal();
                    const prod = q * this.divisor;
                    const rem = total - prod;
                    this.currentRem = rem;

                    const pRow = getEl(`row-p-${this.stage}`);
                    if (pRow) pRow.classList.add('dimmed');

                    getEl('bracket').style.display = 'none';

                    if (this.stage === 3) {
                        this.subStep = 'FINISH';
                        this.msg('تموم شد! دکمه‌ی پایان رو بزن.');
                    } else {
                        this.stage++;
                        this.subStep = 'BRING_DOWN';
                        this.updateSelectHighlight();
                    }
                    this.updateTutorialBtn();
                    this.saveProgress();
                }
            });
            this.saveProgress();
            return;
        }

        if (this.subStep === 'FINISH') {
            GameAudio.stop();
            TutorialVisuals.clear();
            setTutorialBtnState(false);
            app.finishGame(true);
        }
    },
    
    msg(txt, err=false) { 
        const el = getEl('game-message'); 
        el.innerHTML = txt; 
        el.style.background = err ? '#f8d7da' : '#fdf6e3'; 
        el.style.color = err ? '#721c24' : '#8a6d3b'; 
    }
};

function checkSavedUnfinishedState() {
    try {
        const saved = localStorage.getItem(GAME_STATE_STORAGE);
        if (saved) {
            const d = JSON.parse(saved);
            if (d && d.d) return d;
        }
    } catch (e) {}
    return null;
}

window.submitAssistantStar = async function() {
    app.showScreen('portal-submitting-screen');
    await Portal.submitProgress(null, {
        onSuccess: (data) => { authenticatePortalStudent(); },
        onFailure: (err) => {}
    });
};

window.retryAuthentication = function() {
    const errSec = document.getElementById('portal-error-section');
    const regSec = document.getElementById('register-container');
    if (errSec) errSec.style.display = 'none';
    if (regSec) regSec.style.display = 'block';
    authenticatePortalStudent();
};

async function authenticatePortalStudent() {
    await Portal.authenticate({
        onSuccess: (data) => {
            try {
                const regSec = document.getElementById('register-container');
                if (regSec) regSec.style.display = '';
                document.getElementById('portal-welcome-section').style.display = '';
                document.getElementById('startGame').style.display = '';
                document.getElementById('portal-error-section').style.display = 'none';

                STORAGE = `studentProfile_TaqsimTwoDigit_${Portal.studentId}_${Portal.homeworkId}`;
                GAME_STATE_STORAGE = `gameState_TaqsimTwoDigit_${Portal.studentId}_${Portal.homeworkId}`;
                
                const saved = localStorage.getItem(STORAGE);
                let parsedState = null;
                if (saved) {
                    try {
                        parsedState = JSON.parse(saved);
                    } catch (e) {}
                }

                if (parsedState && typeof parsedState === 'object') {
                    app.state = parsedState;
                } else {
                    app.state = {
                        user: data.name,
                        school: '',
                        stats: { games: data.plays, stars: data.stars },
                        lastHelpUsed: false,
                        isTutorialMode: false,
                        reportShown: false
                    };
                }

                const schoolElCandidate = getEl('portal-school-title');
                if (schoolElCandidate && schoolElCandidate.textContent && schoolElCandidate.textContent.trim() !== '---' && schoolElCandidate.textContent.trim() !== '') {
                    app.state.school = schoolElCandidate.textContent.trim();
                }
                
                app.state.user = data.name || Portal.studentName || app.state.user || "دانش‌آموز";
                if (!app.state.stats) {
                    app.state.stats = { games: 0, stars: 0 };
                }
                app.state.stats.games = data.plays !== undefined ? data.plays : app.state.stats.games;
                app.state.stats.stars = data.stars !== undefined ? data.stars : app.state.stats.stars;
                
                app.save();
                app.updateStats();

                document.getElementById('portal-student-name').textContent = app.state.user;
                document.getElementById('portal-prev-plays').textContent = toPersian(app.state.stats.games);
                document.getElementById('portal-prev-stars').textContent = toPersian(app.state.stats.stars) + ' ⭐';
                document.getElementById('portal-req-stars').textContent = toPersian(Portal.requiredStars) + ' ⭐';

                const activeState = checkSavedUnfinishedState();
                const startBtn = document.getElementById('startGame');
                if (activeState) {
                    if (activeState.isTut || app.state.isTutorialMode) {
                        startBtn.textContent = 'ادامه‌ی آموزش (باقی‌مونده) 🔄';
                        startBtn.style.backgroundColor = '#e67e22';
                    } else {
                        startBtn.textContent = 'ادامه‌ی بازی (باقی‌مونده) 🔄';
                        startBtn.style.backgroundColor = '#ff9800';
                    }
                } else {
                    startBtn.textContent = 'شروع بازیِ تکلیف 🎮';
                    startBtn.style.backgroundColor = '#2ecc71';
                }

                const needsSubmitKey = `portal_needs_submit_${Portal.gameId}_${Portal.studentId}_${Portal.homeworkId}`;
                const hasUnsentStar = localStorage.getItem(needsSubmitKey) === 'true';

                if (hasUnsentStar) {
                    document.getElementById('ast-welcome').textContent = `سلام ${app.state.user} عزیز! 🌟`;
                    document.getElementById('ast-name').textContent = app.state.user;
                    document.getElementById('ast-stars').textContent = toPersian(app.state.stats.stars) + ' ⭐';
                    document.getElementById('ast-req-stars').textContent = toPersian(Portal.requiredStars) + ' ⭐';
                    app.showScreen('screen-assistant');
                } else if (app.state.reportShown) {
                    app.showScreen('screen-report');
                } else if (activeState) {
                    try {
                        app.showScreen('screen-game');
                        game.restore();
                    } catch (ex) {
                        game.clearState();
                        app.state.reportShown = false;
                        app.save();
                        app.showScreen('screen-register');
                    }
                } else {
                    app.showScreen('screen-register');
                }
            } catch (errGlobal) {
                app.showScreen('screen-register');
                document.getElementById('portal-welcome-section').style.display = 'none';
                document.getElementById('startGame').style.display = 'none';
                document.getElementById('portal-error-section').style.display = 'block';
            }
        },
        onFailure: (err) => {
            app.showScreen('screen-register');
            document.getElementById('portal-welcome-section').style.display = 'none';
            document.getElementById('startGame').style.display = 'none';
            document.getElementById('portal-error-section').style.display = 'block';
            const regScreen = document.getElementById('screen-register');
            if (regScreen) regScreen.classList.remove('hidden');
        },
        onGuestMode: () => {
            app.showScreen('screen-register');
            document.getElementById('portal-welcome-section').style.display = 'none';
            document.getElementById('startGame').style.display = 'none';
            document.getElementById('portal-error-title').textContent = 'لینک ورود درست نیست!';
            document.getElementById('portal-error-desc').textContent = 'برای انجام این تکلیف، باید حتماً از داخل پرتال مدرسه‌ی خودت و با لینک اختصاصی‌ات وارد بشی.';
            document.getElementById('portal-retry-auth-btn').style.display = 'none';
            document.getElementById('portal-error-section').style.display = 'block';
            const regScreen = document.getElementById('screen-register');
            if (regScreen) regScreen.classList.remove('hidden');
        }
    });
}

function initApp() {
    app.init();
    window.addEventListener('beforeunload', () => {
        if (app.state && app.state.user) app.save();
    });
    const startBtn = document.getElementById('startGame');
    if (startBtn) {
        startBtn.onclick = () => {
            try {
                GameAudio.stop();
                TutorialVisuals.clear();
                setTutorialBtnState(false);
                app.state.reportShown = false;
                const activeState = checkSavedUnfinishedState();
                if (activeState) {
                    game.restore();
                } else {
                    app.state.isTutorialMode = false;
                    game.helpUsed = false;
                    game.start();
                }
                app.showScreen('screen-game');
                app.updateStats();
                app.save();
            } catch (e) {
                game.clearState();
                game.dividend = 0;
                app.state.isTutorialMode = false;
                game.helpUsed = false;
                app.state.reportShown = false;
                app.save();
                game.start();
                app.showScreen('screen-game');
                app.updateStats();
                app.save();
            }
        };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}