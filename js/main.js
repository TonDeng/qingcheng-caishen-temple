/* 财神庙互动场景：状态机、主循环、坐标换算与动作分发。
   入口状态为 Login，交互后进入 Scene，二者共用同一个渲染循环。 */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var C = CS.Config;

  function Game() {
    this.canvas = document.getElementById('gameCanvas');
    var fx = document.getElementById('fxCanvas');
    /* 无 2D 叠层时（如无头逻辑测试桩件）退回主画布。 */
    this.fxCanvas = (fx && fx.getContext) ? fx : this.canvas;
    this.ctx = this.fxCanvas.getContext ? this.fxCanvas.getContext('2d') : null;
    this.world = null;
    this.audio = CS.Audio;
    this.scene = null;
    this.player = null;
    this.ui = null;
    this.input = null;
    this.running = false;
    this.time = 0;
    this.lastTs = 0;
    this.lastDt = 0;
    this.selectedOutfit = 0;
    this.merit = 0;
    this.incenseCount = 3;
    this.bows = 0;
    /* Sansa 式功课与多人：百八拜 / 念珠各以 108 为一轮，放空不算离线。 */
    this.bows108 = 0;
    this.beads = 0;
    this.zen = false;
    this.multi = null;
    this.dpr = 1;
    this.cssW = 0;
    this.cssH = 0;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.portraitMode = false;
    /* 2D 回退的跟随镜头焦点（逻辑坐标），3D 机位由 world3d 自己维护。 */
    this.camFocusX = C.W / 2;
    this.camFocusY = C.SPAWN.y;
  }

  Game.prototype.init = function () {
    var self = this;
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add('touch');
    }
    this.ui = new CS.UI(this);
    this.scene = new CS.Scene(this);
    this.input = new CS.Input(this);
    /* 多人模块只在此处创建；进庙（startFromLogin）后才真正连云端。 */
    if (CS.Multiplayer) { this.multi = new CS.Multiplayer(this); }
    this.ui.setMusic(this.audio.isEnabled());
    this.initWorld();
    this.resize();
    window.addEventListener('resize', function () { self.resize(); });
    window.addEventListener('orientationchange', function () {
      window.setTimeout(function () { self.resize(); }, 180);
    });
    this.lastTs = window.performance.now();
    window.requestAnimationFrame(function (ts) { self.loop(ts); });
  };

  /* 优先启用 WebGL 3D；WebGL 不可用或库缺失时静默回退到原 2D 绘制。 */
  Game.prototype.initWorld = function () {
    if (!CS.World3D || !window.WebGLRenderingContext || !this.canvas) { return; }
    try {
      var w = new CS.World3D(this.canvas);
      if (w && w.renderer && !w.failed) {
        this.world = w;
        document.body.classList.add('is3d');
        return;
      }
    } catch (e) {
      this.world = null;
    }
    if (this.fxCanvas !== this.canvas && this.canvas.style) {
      this.canvas.style.display = 'none';
    }
  };

  Game.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var cssW = Math.max(1, rect.width);
    var cssH = Math.max(1, rect.height);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    /* WebGL 画布尺寸由渲染器管理；2D 画布才在这里手动设定。 */
    if (!this.world) {
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
    }
    if (this.fxCanvas !== this.canvas) {
      this.fxCanvas.width = Math.round(cssW * dpr);
      this.fxCanvas.height = Math.round(cssH * dpr);
    }

    /* 进庙后镜头跟着角色走，画面必须放大到大于视口才有可平移的空间；
       登录页仍用原来的全景构图。3D 机位由 world3d 单独管理。 */
    this.portraitMode = (cssH / cssW) > 1.15;
    var base = Math.min(cssW / C.W, cssH / C.H);
    this.scale = base * (this.portraitMode ? 2.0 : 1.6);
    if (this.world) { this.world.resize(cssW, cssH, this.portraitMode); }
    this.updateCamera(1);
  };

  Game.prototype.updateCamera = function (dt) {
    var drawW = C.W * this.scale;
    var drawH = C.H * this.scale;
    var following = !!(this.running && this.player);
    var targetX = following ? this.player.x : C.W / 2;
    var targetY = following ? this.player.y : C.SPAWN.y;

    if (following) {
      /* 同样严格对齐，保证 2D 回退下人物也始终在正中。 */
      this.camFocusX = targetX;
      this.camFocusY = targetY;
    } else {
      this.camFocusX = targetX;
      this.camFocusY = targetY;
    }

    if (following) {
      /* 严格居中：不做边界钳制，角色走到外庭边界也仍在画面正中。 */
      this.offsetX = this.cssW / 2 - this.camFocusX * this.scale;
      this.offsetY = this.cssH / 2 - this.camFocusY * this.scale;
    } else {
      this.offsetX = (this.cssW - drawW) / 2;
      this.offsetY = (this.cssH - drawH) / 2;
    }
  };

  Game.prototype.toLogical = function (clientX, clientY) {
    if (this.world) {
      /* 3D：射线与地面平面求交，透视投影下点击依然精确。 */
      var p = this.world.screenToLogical(clientX, clientY);
      if (p) { return p; }
      /* 点到天空时视为无效，不让角色跑向无穷远。 */
      return this.player
        ? { x: this.player.x, y: this.player.y }
        : { x: C.W / 2, y: C.H / 2 };
    }
    var rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale
    };
  };

  /* 逻辑坐标 -> 屏幕 CSS 像素，供 2D 粒子与浮字叠加到 3D 画面上。 */
  Game.prototype.project = function (lx, ly, height) {
    if (this.world) { return this.world.project(lx, ly, height || 0); }
    return {
      x: this.offsetX + lx * this.scale,
      y: this.offsetY + (ly - (height || 0)) * this.scale,
      s: this.scale,
      behind: false
    };
  };

  /* ---------- 登录与状态切换 ---------- */

  Game.prototype.startFromLogin = function () {
    var input = document.getElementById('playerName');
    var raw = input ? input.value.trim() : '';
    /* 留空即赐随机道号：免注册、不捏脸，打开就能入殿。 */
    var name = raw ? raw.slice(0, 12) : (this.ui.randomName ? this.ui.randomName() : '善信');
    var outfit = C.OUTFITS[this.selectedOutfit] || C.OUTFITS[0];

    this.audio.unlock();
    this.audio.play('chime');
    this.ui.setIdentity(name);
    this.ui.hideLogin();
    this.ui.toggleHelp(false);
    this.player = new CS.Player(this, name, outfit);
    this.running = true;
    /* 入殿这一刻才加入同殿；登录页不产生任何云端写入。 */
    if (this.multi) { this.multi.start({ name: name, outfit: outfit }); }
    this.setHint('同殿静候 · 点击蒲团落座膜拜，点其他香客可合掌致意；什么都不做，放空一会儿也好。');
    this.ui.toast('入庙大吉 · 功德 +1，班味 −1');
  };

  /* ---------- 动作分发 ---------- */

  Game.prototype.doWorship = function () {
    if (!this.running) { return; }
    this.audio.play('click');
    this.player.startWorship();
  };

  Game.prototype.doIncense = function () {
    if (!this.running) { return; }
    this.audio.play('click');
    this.player.startIncense();
  };

  Game.prototype.doStand = function () {
    if (!this.running) { return; }
    if (this.player.action === 'sitting' || this.player.action === 'worship') {
      this.audio.play('click');
      this.player.standUp(true);
    } else if (this.player.action === 'moving') {
      this.player.dest = null;
      this.player.pending = null;
      this.player.action = 'none';
      this.player.pose = 'idle';
      this.setHint('已停下脚步。');
    }
  };

  /* ---------- 同殿静默共处与功课 ---------- */

  /* 合掌是全殿唯一的社交动作：没有聊天、好友、排行榜。 */
  Game.prototype.greetPeer = function (peerId) {
    if (!this.running || !this.multi) { return; }
    var ok = this.multi.greet(peerId || null);
    if (!ok && !this.multi.peers.length) {
      this.setHint('殿里暂时只有你，先拜一会儿，其他香客会陆续进来。');
    }
  };

  /* 每叩拜一次累积「百八拜」，满 108 为一轮。 */
  Game.prototype.addBow = function () {
    this.bows108 += 1;
    if (this.bows108 >= 108) {
      this.bows108 = 0;
      this.ui.toast('百八拜圆满 · 班味 −108');
      this.audio.play('chime');
    }
  };

  Game.prototype.bead = function () {
    if (!this.running) { return; }
    this.beads += 1;
    this.audio.play('bead');
    if (this.beads >= 108) {
      this.beads = 0;
      this.ui.toast('念珠一百零八 · 心静下来了');
      this.audio.play('chime');
    } else if (this.beads % 27 === 0) {
      this.ui.toast('已拨 ' + this.beads + ' 颗念珠');
    }
  };

  /* 放空也算玩：数字与提示淡出，控件仍可用，随时可以「回来」。 */
  Game.prototype.toggleZen = function (force) {
    if (!this.running) { return; }
    var on = (typeof force === 'boolean') ? force : !this.zen;
    this.zen = on;
    this.ui.setZen(on);
    this.setHint(on ? '放空中 · 什么都不做也可以'
      : '回来了 · 点击蒲团落座膜拜，点其他香客可合掌致意。');
  };

  Game.prototype.toggleMusic = function () {
    var on = this.audio.setEnabled(!this.audio.isEnabled());
    this.ui.setMusic(on);
    if (on) { this.audio.play('click'); }
  };

  Game.prototype.toggleHelp = function (force) {
    this.ui.toggleHelp(force);
  };

  Game.prototype.setHint = function (text) {
    this.ui.setHint(text);
  };

  /* ---------- 数值 ---------- */

  Game.prototype.addMerit = function (n, x, y, text) {
    this.merit += n;
    this.scene.floatText(x, y, text || ('+' + n + ' 功德'), '#ffe9a8');
    var milestones = [100, 300, 600, 1000];
    for (var i = 0; i < milestones.length; i++) {
      if (this.merit >= milestones[i] && this.merit - n < milestones[i]) {
        this.ui.toast('功德满 ' + milestones[i] + ' · 福运临门！');
        this.scene.sparkBurst(this.player.x, this.player.y - 60, 34);
        this.audio.play('coin');
        this.audio.play('firecracker');
      }
    }
  };

  Game.prototype.addIncense = function () {
    this.incenseCount += 1;
  };

  /* ---------- 主循环 ---------- */

  Game.prototype.loop = function (ts) {
    var self = this;
    var dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (dt > 0.05) { dt = 0.05; }
    if (dt < 0) { dt = 0; }
    this.lastDt = dt;
    this.time += dt;

    if (this.running) {
      this.player.update(dt, this.input.getIntent());
      this.audio.update(dt);
      this.ui.update();
    }
    this.scene.update(dt);
    if (this.world) {
      this.world.setFocus(
        this.player ? this.player.x : C.W / 2,
        this.player ? this.player.y : C.SPAWN.y,
        this.running
      );
      this.world.sync(this.scene, this.player, dt, this.time);
    } else {
      this.updateCamera(dt);
    }
    this.render();
    window.requestAnimationFrame(function (next) { self.loop(next); });
  };

  Game.prototype.render = function () {
    var ctx = this.ctx;
    if (!ctx) { return; }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);

    if (this.world) {
      /* WebGL 画 3D 世界，2D 叠层只负责粒子与功德浮字。 */
      this.world.render();
      this.scene.drawParticles(ctx);
      return;
    }

    /* 2D 回退路径：整幅场景仍由原矢量绘制函数完成。 */
    var outer = ctx.createLinearGradient(0, 0, 0, this.cssH);
    outer.addColorStop(0, '#6d101c');
    outer.addColorStop(0.55, '#8c1c20');
    outer.addColorStop(1, '#520c14');
    ctx.fillStyle = outer;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    /* 可行走区域已超出静态底图的 1600x900：先在底图之下铺满外院青石地，
       再画几道石缝，跟随镜头走到殿外时不会露出空白版面。 */
    var world = C.WORLD;
    ctx.fillStyle = '#a9a894';
    ctx.fillRect(world.minX, world.minY, world.maxX - world.minX, world.maxY - world.minY);
    ctx.strokeStyle = 'rgba(84,82,66,0.20)';
    ctx.lineWidth = 1;
    for (var gx = world.minX; gx <= world.maxX; gx += 120) {
      ctx.beginPath(); ctx.moveTo(gx, world.minY); ctx.lineTo(gx, world.maxY); ctx.stroke();
    }
    for (var gy2 = world.minY; gy2 <= world.maxY; gy2 += 120) {
      ctx.beginPath(); ctx.moveTo(world.minX, gy2); ctx.lineTo(world.maxX, gy2); ctx.stroke();
    }

    /* 2D 回退里也把拉深后的法堂铺成暖木地板、按 15 排压金线，
       否则 y>900 的蒲团会孤零零落在青石外院上。 */
    ctx.fillStyle = '#6b432c';
    ctx.fillRect(40, 900, 1520, C.HALL_FRONT - 900);
    ctx.strokeStyle = 'rgba(232,196,104,0.26)';
    ctx.lineWidth = 2;
    for (var rl = 0; rl < C.CUSHION_ROWS; rl++) {
      var rowY = C.CUSHION_ROW_START + rl * C.CUSHION_ROW_GAP;
      if (rowY <= 900) { continue; }
      ctx.beginPath(); ctx.moveTo(40, rowY); ctx.lineTo(1560, rowY); ctx.stroke();
    }

    this.scene.drawBack(ctx);
    this.scene.drawDynamic(ctx);
    if (this.player) { this.player.draw(ctx, this.time); }
    ctx.restore();

    /* 暗角与外院边框改用屏幕空间，镜头平移后仍贴合视口。 */
    var vignette = ctx.createRadialGradient(
      this.cssW / 2, this.cssH / 2, Math.min(this.cssW, this.cssH) * 0.28,
      this.cssW / 2, this.cssH / 2, Math.max(this.cssW, this.cssH) * 0.75);
    vignette.addColorStop(0, 'rgba(80,10,10,0)');
    vignette.addColorStop(1, 'rgba(70,8,14,0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    this.scene.drawParticles(ctx);
    ctx.strokeStyle = 'rgba(255,214,120,0.32)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.offsetX + world.minX * this.scale + 1,
      this.offsetY + world.minY * this.scale + 1,
      (world.maxX - world.minX) * this.scale - 2,
      (world.maxY - world.minY) * this.scale - 2);
  };

  CS.Game = Game;

  function boot() {
    var game = new CS.Game();
    CS.game = game;
    game.init();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.CS);
