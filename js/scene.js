/* 财神庙互动场景：静态背景缓存、交互热点、粒子与香客。 */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var C = CS.Config;
  var Art = CS.Art;

  function Scene(game) {
    this.game = game;
    this.particles = [];
    this.npcs = [];
    /* 云端同殿真人香客（由 multiplayer.js 填充），2D 回退也照常绘制。 */
    this.remotes = [];
    this.selfGreetUntil = 0;
    this.incenseCount = 3;
    this.petalClock = 0;
    this.smokeClock = 0;
    this.fireworkClock = 3.2;
    this.occupied = {};
    this.highlightId = null;
    this.staticCache = null;
    this.time = 0;
    this.buildStatic();
    this.buildNpcs();
  }

  Scene.prototype.buildStatic = function () {
    /* 缓存以 2 倍分辨率绘制，缩放时仍保持清晰。 */
    var cache = document.createElement('canvas');
    cache.width = C.W * 2;
    cache.height = C.H * 2;
    var cctx = cache.getContext('2d');
    cctx.scale(2, 2);
    Art.drawStatic(cctx);
    this.staticCache = cache;
  };

  Scene.prototype.buildNpcs = function () {
    var palettes = [C.OUTFITS[1], C.OUTFITS[2], C.OUTFITS[0]];
    /* 香客沿 15 排蒲团之间的通道巡礼，终点停在某个蒲团上叩拜。
       三条路线分别落在法堂前、中、后段，段落长度仍保持在 150~220，
       免得殿宇拉深后香客走一整段要十几秒。终点对齐新的蒲团中心
       （西列 100/248/396/544/692、东列 908/1056/1204/1352/1500，
       排距 152）。 */
    var routes = [
      [{ x: 180, y: 1550 }, { x: 320, y: 1400 }, { x: 248, y: 1327 }, { x: 248, y: 1175 }],
      [{ x: 1420, y: 2500 }, { x: 1280, y: 2350 }, { x: 1352, y: 2239 }, { x: 1352, y: 2087 }],
      [{ x: 220, y: 640 }, { x: 396, y: 567 }, { x: 544, y: 567 }, { x: 544, y: 415 }]
    ];
    for (var i = 0; i < routes.length; i++) {
      this.npcs.push({
        route: routes[i],
        leg: 0,
        t: 0,
        x: routes[i][0].x,
        y: routes[i][0].y,
        outfit: palettes[i],
        pose: 'walk',
        dir: 'down',
        phase: i * 1.7,
        pause: 0,
        name: ['小满', '阿福', '招弟'][i],
        scale: 0.82
      });
    }
  };

  /* ---------- 粒子 ---------- */

  Scene.prototype.spawn = function (p) {
    if (this.particles.length >= C.MAX_PARTICLES) { return; }
    p.age = 0;
    this.particles.push(p);
  };

  Scene.prototype.floatText = function (x, y, text, color) {
    this.spawn({ kind: 'float', x: x, y: y, text: text, color: color || '#ffe9a8', life: 1.5 });
  };

  Scene.prototype.sparkBurst = function (x, y, n, color) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 130;
      this.spawn({
        kind: 'spark', x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.7 + Math.random() * 0.7,
        color: color || (Math.random() > 0.5 ? '#ffd968' : '#ff8a4a'),
        size: 1.6 + Math.random() * 2.6
      });
    }
  };

  Scene.prototype.celebrate = function (x, y) {
    this.sparkBurst(x, y - 40, 26);
    if (this.game.audio) { this.game.audio.play('firecracker'); }
  };

  Scene.prototype.update = function (dt) {
    this.time += dt;
    var t = this.time;

    /* 金箔与花瓣。 */
    this.petalClock += dt;
    if (this.petalClock > 0.28) {
      this.petalClock = 0;
      this.spawn({
        kind: 'petal',
        x: Math.random() * C.W,
        y: -12,
        vx: -12 + Math.random() * 24,
        vy: 26 + Math.random() * 30,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 3,
        life: 22,
        size: 4 + Math.random() * 4,
        color: Math.random() > 0.45 ? '#ffd97a' : '#f2705a'
      });
    }

    /* 香炉青烟。 */
    this.smokeClock += dt;
    if (this.smokeClock > 0.16 && this.incenseCount > 0) {
      this.smokeClock = 0;
      this.spawn({
        kind: 'smoke',
        x: C.CENSER.x + (Math.random() - 0.5) * 34,
        y: C.CENSER.y - 42,
        vx: (Math.random() - 0.5) * 14,
        vy: -20 - Math.random() * 16,
        life: 1.9 + Math.random(),
        size: 5 + Math.random() * 6
      });
    }

    /* 远处烟花。 */
    this.fireworkClock -= dt;
    if (this.fireworkClock <= 0) {
      this.fireworkClock = 4 + Math.random() * 4;
      var fx = 120 + Math.random() * (C.W - 240);
      var fy = 70 + Math.random() * 130;
      this.sparkBurst(fx, fy, 20);
    }

    /* 粒子积分。 */
    var alive = [];
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) { continue; }
      if (p.kind === 'spark') {
        p.vy += 95 * dt;
        p.vx *= (1 - 0.9 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.kind === 'petal') {
        p.x += (p.vx + Math.sin(t * 1.6 + p.spin) * 16) * dt;
        p.y += p.vy * dt;
        p.spin += p.spinSpeed * dt;
      } else if (p.kind === 'smoke') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx += Math.sin(t * 2 + p.age * 3) * 8 * dt;
        p.size += 6 * dt;
      } else if (p.kind === 'float') {
        p.y -= 34 * dt;
      }
      alive.push(p);
    }
    this.particles = alive;

    /* 香客巡逻。 */
    for (var n = 0; n < this.npcs.length; n++) {
      var npc = this.npcs[n];
      npc.t += dt;
      if (npc.pause > 0) {
        npc.pause -= dt;
        npc.pose = 'worship';
        if (npc.pause <= 0) { npc.pose = 'walk'; }
        continue;
      }
      var to = npc.route[(npc.leg + 1) % npc.route.length];
      var dx = to.x - npc.x, dy = to.y - npc.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 4) {
        npc.leg = (npc.leg + 1) % npc.route.length;
        if (npc.leg === npc.route.length - 1) { npc.pause = 1.6 + Math.random() * 1.6; }
        continue;
      }
      var step = Math.min(dist, 48 * dt);
      npc.x += dx / dist * step;
      npc.y += dy / dist * step;
      npc.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      npc.pose = 'walk';
    }
  };

  /* ---------- 命中检测 ---------- */

  Scene.prototype.hitTest = function (x, y) {
    var best = null, bestD = Infinity;
    var r = C.CUSHION_HIT || 30;
    /* 150 个蒲团用平方距离比较，避免每帧做 150 次开方。 */
    for (var i = 0; i < C.CUSHIONS.length; i++) {
      var c = C.CUSHIONS[i];
      var dx = x - c.x, dy = y - c.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 < bestD) {
        best = { type: 'cushion', data: c };
        bestD = d2;
      }
    }
    var cdx = x - C.CENSER.x, cdy = y - C.CENSER.y;
    var cd2 = cdx * cdx + cdy * cdy;
    if (cd2 < 62 * 62 && cd2 < bestD) { best = { type: 'censer', data: C.CENSER }; }
    return best;
  };

  Scene.prototype.nearestFreeCushion = function (x, y) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < C.CUSHIONS.length; i++) {
      var c = C.CUSHIONS[i];
      if (this.occupied[c.id]) { continue; }
      var d = Math.sqrt((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y));
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  };

  /* ---------- 绘制 ---------- */

  Scene.prototype.drawBack = function (ctx) {
    /* 3D 模式下静态背景由 WebGL 场景接管。 */
    if (this.game.world) { return; }
    ctx.drawImage(this.staticCache, 0, 0, C.W, C.H);
  };

  Scene.prototype.drawDynamic = function (ctx) {
    /* 3D 模式下蒲团、香炉与香客由 world3d.sync 每帧同步。 */
    if (this.game.world) { return; }
    var t = this.time;

    /* 灯笼。 */
    for (var i = 0; i < C.LANTERNS.length; i++) {
      Art.drawLantern(ctx, C.LANTERNS[i], t);
    }

    /* 蒲团。 */
    for (var j = 0; j < C.CUSHIONS.length; j++) {
      var c = C.CUSHIONS[j];
      Art.drawCushion(ctx, c, {
        time: t,
        highlight: this.highlightId === c.id,
        occupied: !!this.occupied[c.id]
      });
    }

    /* 香炉。 */
    Art.drawCenser(ctx, C.CENSER, this.incenseCount, t, this.highlightId === 'censer');

    /* 香客：本地巡礼的三位，加上云端同殿的真人香客。 */
    for (var n = 0; n < this.npcs.length; n++) {
      Art.drawCharacter(ctx, this.npcs[n], t);
    }
    for (var r = 0; r < this.remotes.length; r++) {
      var remote = this.remotes[r];
      Art.drawCharacter(ctx, {
        x: remote.x, y: remote.y,
        pose: remote.pose === 'greet' ? 'idle' : remote.pose,
        dir: remote.dir,
        outfit: remote.outfit, name: remote.name,
        scale: remote.scale || 0.84, phase: r * 1.3,
        showName: true
      }, t);
    }
  };

  Scene.prototype.drawParticles = function (ctx) {
    var is3d = !!this.game.world;
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      var k = p.age / p.life;
      var alpha = k < 0.15 ? k / 0.15 : (1 - k);
      if (alpha < 0) { alpha = 0; }
      /* 3D 叠层：把逻辑坐标投影到屏幕，并按离地高度抬升特效。 */
      var h = 0;
      if (is3d) {
        h = p.kind === 'float' ? 96 : (p.kind === 'spark' ? 34 :
          (p.kind === 'smoke' ? 76 : (p.kind === 'petal' ? 26 : 10)));
      }
      var pr = this.game.project(p.x, p.y, h);
      if (pr.behind) { continue; }
      var px = pr.x, py = pr.y, ps = pr.s;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.kind === 'petal') {
        ctx.translate(px, py);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * ps, p.size * 0.5 * ps, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = alpha * 0.42;
        ctx.fillStyle = '#e8dcc0';
        ctx.beginPath();
        ctx.arc(px, py, p.size * ps, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size * (1 - k * 0.5) * ps, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'float') {
        ctx.font = 'bold ' + Math.round(20 * ps) + 'px "STKaiti", "KaiTi", serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(110,30,20,0.65)';
        ctx.strokeText(p.text, px, py);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, px, py);
      }
      ctx.restore();
    }
  };

  CS.Scene = Scene;
})(window.CS);
