/* 道家音乐（道乐）：WebAudio 实时合成的原创慢板器乐。
   法器层：引磬、木鱼、云锣、法鼓；旋律层：笙箫与古琴。
   取全真「步虚」一类韵腔的级进五声旋法与一板三眼的散淡节奏，
   叠加殿堂混响。全部为程序合成，不含任何录音采样与外部音频文件，
   因此没有第三方录音版权问题。 */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var ctx = null;
  var master = null;
  var busDry = null;
  var busWet = null;
  var convolver = null;
  var wetGain = null;
  var enabled = true;
  var melodyClock = 0;
  var melodyStep = 0;
  var noiseBuffer = null;

  /* 羽调式五声音阶：A3 C4 D4 E4 G4 A4 C5 D5。 */
  var PENTA = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];
  var BASS = [110.00, 130.81, 146.83, 164.81];
  /* 两句一段、四段一循环的级进旋律，每次取一个音跨两步。 */
  var MELODY = [
    5, 4, 3, 4, 5, 6, 5, 4, 3, 2, 3, 4, 3, 2, 1, 2,
    3, 4, 5, 4, 3, 2, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2
  ];
  var STEP = 0.62;   /* 每步 0.62 秒，约合慢板一板三眼。 */
  var LOOP_STEPS = 64;

  function ensure() {
    if (ctx) { return ctx; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return null; }
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);

    busDry = ctx.createGain();
    busDry.gain.value = 1;
    busDry.connect(master);

    /* 程序生成的殿堂脉冲响应：约 2.4 秒的指数衰减尾音。 */
    var seconds = 2.4;
    var len = Math.floor(ctx.sampleRate * seconds);
    var ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    convolver = ctx.createConvolver();
    convolver.buffer = ir;
    wetGain = ctx.createGain();
    wetGain.gain.value = 0.62;
    busWet = ctx.createGain();
    busWet.gain.value = 1;
    busWet.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(master);
    return ctx;
  }

  function noise() {
    if (noiseBuffer) { return noiseBuffer; }
    var len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) { data[i] = Math.random() * 2 - 1; }
    return noiseBuffer;
  }

  function env(t0, dur, vol, attack) {
    var g = ctx.createGain();
    var a = Math.max(0.003, attack || 0.008);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, a + 0.02));
    return g;
  }

  function route(node, send) {
    node.connect(busDry);
    if (send > 0) {
      var s = ctx.createGain();
      s.gain.value = send;
      node.connect(s);
      s.connect(busWet);
    }
  }

  function filteredNoise(t0, dur, vol, type, freq, q, send, loop) {
    var src = ctx.createBufferSource();
    src.buffer = noise();
    src.loop = !!loop;
    var f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (q) { f.Q.value = q; }
    var g = env(t0, dur, vol, Math.min(0.14, dur * 0.25));
    src.connect(f); f.connect(g); route(g, send);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  /* 引磬 / 铜磬：非谐泛音列 + 长尾，道乐里用于起腔与叩拜。 */
  function qing(freq, dur, vol) {
    if (!ctx) { return; }
    var t0 = ctx.currentTime;
    var partials = [1, 2.76, 5.40, 8.93];
    var amps = [1, 0.44, 0.20, 0.085];
    for (var i = 0; i < partials.length; i++) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * partials[i], t0);
      var g = env(t0, dur * (1 - i * 0.12), vol * amps[i], 0.005);
      o.connect(g); route(g, 0.85);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    filteredNoise(t0, 0.05, vol * 0.22, 'bandpass', freq * 4, 1.2, 0.4);
  }

  /* 云锣 / 铛子：比引磬短而亮。 */
  function yunluo(freq, dur, vol) {
    if (!ctx) { return; }
    var t0 = ctx.currentTime;
    var parts = [1, 3.02, 5.88];
    var amps = [1, 0.34, 0.15];
    for (var i = 0; i < parts.length; i++) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * parts[i], t0);
      var g = env(t0, dur * (1 - i * 0.16), vol * amps[i], 0.004);
      o.connect(g); route(g, 0.7);
      o.start(t0); o.stop(t0 + dur + 0.04);
    }
  }

  /* 木鱼：短促木质敲击，节拍骨架。 */
  function muyu(vol) {
    if (!ctx) { return; }
    var t0 = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(430, t0);
    o.frequency.exponentialRampToValueAtTime(176, t0 + 0.10);
    var g = env(t0, 0.15, vol, 0.003);
    o.connect(g); route(g, 0.14);
    o.start(t0); o.stop(t0 + 0.17);
    filteredNoise(t0, 0.065, vol * 0.8, 'bandpass', 980, 1.6, 0.12);
  }

  /* 法鼓：低沉一击，只在偶数句轻点。 */
  function drum(vol) {
    if (!ctx) { return; }
    var t0 = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(132, t0);
    o.frequency.exponentialRampToValueAtTime(58, t0 + 0.24);
    var g = env(t0, 0.34, vol, 0.005);
    o.connect(g); route(g, 0.35);
    o.start(t0); o.stop(t0 + 0.38);
    filteredNoise(t0, 0.10, vol * 0.5, 'lowpass', 420, 0, 0.22);
  }

  /* 笙箫：慢起音、轻微气声与颤音的长音。 */
  function xiao(freq, dur, vol) {
    if (!ctx) { return; }
    var t0 = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t0);
    var lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(4.7, t0);
    var lg = ctx.createGain();
    lg.gain.value = freq * 0.006;
    lfo.connect(lg); lg.connect(o.frequency);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.17);
    g.gain.setValueAtTime(Math.max(0.0002, vol), t0 + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); route(g, 0.62);
    o.start(t0); o.stop(t0 + dur + 0.04);
    lfo.start(t0); lfo.stop(t0 + dur + 0.04);
    filteredNoise(t0, dur, vol * 0.12, 'bandpass', freq * 2.1, 0.8, 0.35, true);
  }

  /* 古琴：拨弦起音 + 泛音，衰减较长。 */
  function guqin(freq, dur, vol) {
    if (!ctx) { return; }
    var t0 = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t0);
    var g = env(t0, dur, vol, 0.004);
    o.connect(g); route(g, 0.5);
    o.start(t0); o.stop(t0 + dur + 0.04);
    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(freq * 2.01, t0);
    var g2 = env(t0, dur * 0.55, vol * 0.34, 0.004);
    o2.connect(g2); route(g2, 0.4);
    o2.start(t0); o2.stop(t0 + dur * 0.6);
    filteredNoise(t0, 0.05, vol * 0.28, 'highpass', 1600, 0, 0.2);
  }

  function schedule(step) {
    var i = step % LOOP_STEPS;
    var phrase = Math.floor(i / 16);
    var beat = i % 16;

    if (beat === 0) {
      qing(phrase % 2 ? 587.33 : 523.25, 2.8, 0.135);
    }
    if (beat % 4 === 0) {
      muyu(beat === 0 ? 0.19 : 0.115);
    }
    if (beat === 8 && phrase % 2 === 1) { drum(0.085); }
    if (beat % 2 === 0) {
      var mi = Math.floor(i / 2) % MELODY.length;
      xiao(PENTA[MELODY[mi]], 1.18, 0.072);
    }
    if (beat % 4 === 2) {
      guqin(BASS[(phrase + Math.floor(beat / 4)) % BASS.length], 1.7, 0.055);
    }
    if (beat === 14 && phrase % 2 === 0) {
      guqin(PENTA[3] / 2, 1.2, 0.036);
    }
    if (beat === 15) {
      yunluo(783.99, 1.0, 0.062);
    }
  }

  var Audio = {
    /* 浏览器要求音频上下文由用户手势触发。 */
    unlock: function () {
      var c = ensure();
      if (!c) { return false; }
      if (c.state === 'suspended') { c.resume(); }
      return true;
    },

    isEnabled: function () { return enabled; },

    setEnabled: function (v) {
      enabled = !!v;
      if (master && ctx) {
        master.gain.setTargetAtTime(enabled ? 0.22 : 0, ctx.currentTime, 0.08);
      }
      return enabled;
    },

    play: function (name) {
      if (!ctx || !enabled) { return; }
      if (name === 'bell') {
        qing(659.25, 2.2, 0.20);
      } else if (name === 'coin') {
        yunluo(880.00, 0.85, 0.13);
        window.setTimeout(function () { if (ctx && enabled) { yunluo(1174.66, 0.7, 0.085); } }, 110);
      } else if (name === 'ignite') {
        filteredNoise(ctx.currentTime, 0.22, 0.075, 'bandpass', 2300, 0.8, 0.2);
        qing(1046.50, 0.9, 0.075);
      } else if (name === 'firecracker') {
        /* 庄严的法鼓 + 铙钹式庆祝，不再是鞭炮。 */
        drum(0.13);
        yunluo(659.25, 1.1, 0.10);
        window.setTimeout(function () { if (ctx && enabled) { qing(880.00, 1.6, 0.10); } }, 140);
      } else if (name === 'sit') {
        muyu(0.14);
      } else if (name === 'bead') {
        /* 拨念珠：一声轻木鱼，不叠加法器，长时间拨也不吵。 */
        muyu(0.10);
      } else if (name === 'greet') {
        qing(523.25, 1.4, 0.10);
      } else if (name === 'click') {
        yunluo(1046.50, 0.30, 0.055);
      } else if (name === 'chime') {
        qing(783.99, 2.4, 0.16);
        window.setTimeout(function () { if (ctx && enabled) { yunluo(1046.50, 1.0, 0.09); } }, 190);
      }
    },

    /* 可核验的运行状态：供验证脚本确认道乐调度器确实在推进。 */
    status: function () {
      return {
        enabled: enabled,
        context: ctx ? ctx.state : 'not-created',
        steps: melodyStep,
        reverb: !!convolver,
        loopSteps: LOOP_STEPS,
        stepSeconds: STEP,
        scale: 'pentatonic'
      };
    },

    /* 由主循环按 dt 调度，避免 setInterval 与动画不同步。 */
    update: function (dt) {
      if (!ctx || !enabled) { return; }
      melodyClock += dt;
      while (melodyClock >= STEP) {
        melodyClock -= STEP;
        schedule(melodyStep % LOOP_STEPS);
        melodyStep++;
      }
    }
  };

  CS.Audio = Audio;
})(window.CS);
