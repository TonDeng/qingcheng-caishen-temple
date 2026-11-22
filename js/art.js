/* 财神庙互动场景：全部矢量绘制函数。
   本文件不依赖任何图片、字体文件或第三方库。 */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var C = CS.Config;
  var Art = {};
  var FONT = '"STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif';

  /* ---------- 基础工具 ---------- */

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function oval(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function linear(ctx, x0, y0, x1, y1, stops) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i++) { g.addColorStop(stops[i][0], stops[i][1]); }
    return g;
  }

  function cloud(ctx, x, y, s, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffd98a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-46, 8);
    ctx.bezierCurveTo(-52, -8, -30, -16, -22, -6);
    ctx.bezierCurveTo(-16, -24, 12, -24, 16, -8);
    ctx.bezierCurveTo(30, -18, 50, -6, 42, 8);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-30, 14);
    ctx.bezierCurveTo(-14, 6, 14, 6, 30, 14);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- 静态层：天空、地面、庙宇建筑 ---------- */

  Art.drawStatic = function (ctx) {
    var W = C.W, H = C.H;

    /* 夜空与霞光。 */
    ctx.fillStyle = linear(ctx, 0, 0, 0, 350, [
      [0, '#6d101c'], [0.42, '#a91f26'], [0.78, '#d94a2b'], [1, '#f4aa45']
    ]);
    ctx.fillRect(0, 0, W, 350);

    var glow = ctx.createRadialGradient(500, 130, 10, 500, 130, 430);
    glow.addColorStop(0, 'rgba(255,226,150,0.55)');
    glow.addColorStop(0.55, 'rgba(255,170,80,0.16)');
    glow.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 360);

    cloud(ctx, 105, 92, 1.15, 0.42);
    cloud(ctx, 880, 72, 1.0, 0.36);
    cloud(ctx, 790, 210, 0.8, 0.24);
    cloud(ctx, 170, 235, 0.72, 0.2);

    /* 远山剪影。 */
    ctx.fillStyle = 'rgba(92,18,26,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, 330);
    ctx.lineTo(0, 268); ctx.lineTo(90, 210); ctx.lineTo(160, 262);
    ctx.lineTo(250, 196); ctx.lineTo(340, 272); ctx.lineTo(430, 240);
    ctx.lineTo(560, 286); ctx.lineTo(680, 208); ctx.lineTo(780, 264);
    ctx.lineTo(900, 216); ctx.lineTo(1000, 272); ctx.lineTo(1000, 330);
    ctx.closePath();
    ctx.fill();

    /* 广场石板地面。 */
    ctx.fillStyle = linear(ctx, 0, 330, 0, H, [
      [0, '#efd6a4'], [0.5, '#e8c88e'], [1, '#d8ab6d']
    ]);
    ctx.fillRect(0, 330, W, H - 330);

    ctx.strokeStyle = 'rgba(150,96,48,0.22)';
    ctx.lineWidth = 1.5;
    for (var gy = 356; gy < H; gy += 46) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      var offset = ((gy / 46) | 0) % 2 ? 0 : 68;
      for (var gx = offset; gx < W; gx += 136) {
        ctx.beginPath(); ctx.moveTo(gx, gy - 46); ctx.lineTo(gx, gy); ctx.stroke();
      }
    }

    /* 中轴金砖引导线。 */
    ctx.fillStyle = 'rgba(255,214,120,0.20)';
    ctx.fillRect(468, 340, 64, 315);
    ctx.strokeStyle = 'rgba(190,120,40,0.30)';
    ctx.strokeRect(468, 340, 64, 315);

    /* 庙宇台基与三级台阶。 */
    for (var s = 0; s < 3; s++) {
      var sy = 300 + s * 14;
      var inset = s * 14;
      ctx.fillStyle = linear(ctx, 0, sy, 0, sy + 15, [
        [0, '#f0dfbb'], [1, '#c9ae83']
      ]);
      ctx.fillRect(178 + inset, sy, 644 - inset * 2, 15);
      ctx.strokeStyle = 'rgba(140,92,42,0.55)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(178 + inset, sy, 644 - inset * 2, 15);
    }

    /* 庙墙。 */
    ctx.fillStyle = linear(ctx, 170, 150, 830, 300, [
      [0, '#a92228'], [0.5, '#c8362f'], [1, '#9d1e25']
    ]);
    ctx.fillRect(170, 150, 660, 152);
    ctx.fillStyle = '#e8b64c';
    ctx.fillRect(170, 150, 660, 9);
    ctx.fillRect(170, 292, 660, 8);

    /* 三个门洞。 */
    var doors = [[255, 130], [435, 130], [615, 130]];
    for (var d = 0; d < doors.length; d++) {
      var dx = doors[d][0], dw = doors[d][1];
      ctx.fillStyle = linear(ctx, dx, 190, dx, 300, [
        [0, '#4a1018'], [0.55, '#6d1a1c'], [1, '#8b2a22']
      ]);
      ctx.fillRect(dx, 190, dw, 110);
      var dg = ctx.createRadialGradient(dx + dw / 2, 235, 4, dx + dw / 2, 235, 74);
      dg.addColorStop(0, 'rgba(255,214,120,0.42)');
      dg.addColorStop(1, 'rgba(255,180,70,0)');
      ctx.fillStyle = dg;
      ctx.fillRect(dx, 190, dw, 110);
      ctx.strokeStyle = '#e5b352';
      ctx.lineWidth = 4;
      ctx.strokeRect(dx, 190, dw, 110);
      ctx.strokeStyle = 'rgba(255,226,150,0.5)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(dx + 6, 196, dw - 12, 104);
    }

    /* 三座财神雕像。 */
    for (var i = 0; i < C.STATUES.length; i++) {
      Art.drawStatue(ctx, C.STATUES[i]);
    }

    /* 红柱与柱头。 */
    var pillars = [230, 410, 590, 770];
    for (var p = 0; p < pillars.length; p++) {
      var px = pillars[p];
      ctx.fillStyle = linear(ctx, px - 11, 0, px + 11, 0, [
        [0, '#8e1a20'], [0.45, '#d34135'], [1, '#8e1a20']
      ]);
      ctx.fillRect(px - 11, 155, 22, 148);
      ctx.fillStyle = '#e9bb56';
      ctx.fillRect(px - 15, 152, 30, 8);
      ctx.fillRect(px - 15, 296, 30, 8);
      ctx.fillStyle = 'rgba(255,226,150,0.35)';
      ctx.fillRect(px - 5, 160, 3, 136);
    }

    /* 重檐屋顶。 */
    function roof(yTop, halfW, ridgeY, colorA, colorB) {
      ctx.beginPath();
      ctx.moveTo(500 - halfW, yTop);
      ctx.quadraticCurveTo(500, ridgeY - 26, 500, ridgeY);
      ctx.quadraticCurveTo(500, ridgeY - 26, 500 + halfW, yTop);
      ctx.lineTo(500 + halfW - 18, yTop + 12);
      ctx.quadraticCurveTo(500, ridgeY + 6, 500 - halfW + 18, yTop + 12);
      ctx.closePath();
      ctx.fillStyle = linear(ctx, 0, ridgeY, 0, yTop + 12, [
        [0, colorA], [1, colorB]
      ]);
      ctx.fill();
      ctx.strokeStyle = '#8c3a18';
      ctx.lineWidth = 3;
      ctx.stroke();
      /* 瓦垄。 */
      ctx.strokeStyle = 'rgba(140,66,20,0.42)';
      ctx.lineWidth = 1.6;
      for (var k = -8; k <= 8; k++) {
        var fx = 500 + k * (halfW / 9);
        ctx.beginPath();
        ctx.moveTo(500 + k * 5, ridgeY + 2);
        ctx.quadraticCurveTo(fx, ridgeY + (yTop - ridgeY) * 0.55, fx, yTop + 4);
        ctx.stroke();
      }
      /* 檐口金边。 */
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(500 - halfW + 18, yTop + 12);
      ctx.quadraticCurveTo(500, ridgeY + 6, 500 + halfW - 18, yTop + 12);
      ctx.stroke();
    }

    /* 檐下椽子。 */
    ctx.fillStyle = '#8d3320';
    ctx.fillRect(168, 138, 664, 14);
    ctx.fillStyle = 'rgba(255,210,120,0.7)';
    for (var e = 172; e < 830; e += 16) { ctx.fillRect(e, 138, 6, 14); }

    roof(150, 360, 96, '#ffd977', '#c8862c');
    roof(126, 250, 76, '#ffe39a', '#d59a36');

    /* 屋脊宝珠。 */
    var orb = ctx.createRadialGradient(500, 68, 2, 500, 68, 26);
    orb.addColorStop(0, 'rgba(255,240,180,0.9)');
    orb.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = orb;
    ctx.fillRect(470, 40, 60, 58);
    oval(ctx, 500, 68, 9, 9, '#ffe9a8', '#b87520', 2);
    ctx.fillStyle = '#c8862c';
    ctx.fillRect(496, 76, 8, 18);

    /* 匾额。 */
    roundRect(ctx, 414, 104, 172, 42, 6);
    ctx.fillStyle = '#8c1c20'; ctx.fill();
    ctx.strokeStyle = '#ffd977'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffe6a0';
    ctx.font = 'bold 28px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('财 神 庙', 500, 126);

    /* 对联。 */
    function couplet(x, text) {
      ctx.fillStyle = '#9c2024';
      roundRect(ctx, x - 15, 168, 30, 128, 4);
      ctx.fill();
      ctx.strokeStyle = '#e6b655'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffe2a0';
      ctx.font = '17px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var ci = 0; ci < text.length; ci++) {
        ctx.fillText(text.charAt(ci), x, 184 + ci * 20);
      }
    }
    couplet(196, '财源广进达三江');
    couplet(804, '福泽绵长润四海');

    /* 石狮。 */
    Art.drawLion(ctx, 155, 358, 1);
    Art.drawLion(ctx, 845, 358, -1);

    /* 元宝堆。 */
    Art.drawIngotPile(ctx, 250, 400);
    Art.drawIngotPile(ctx, 750, 400);

    /* 地面边角装饰。 */
    ctx.strokeStyle = 'rgba(180,110,40,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 344, W - 28, H - 358);
  };

  /* ---------- 建筑细件 ---------- */

  Art.drawStatue = function (ctx, s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(s.scale, s.scale);

    /* 佛光。 */
    var halo = ctx.createRadialGradient(0, -8, 6, 0, -8, 60);
    halo.addColorStop(0, 'rgba(255,232,150,0.85)');
    halo.addColorStop(0.6, 'rgba(255,196,80,0.30)');
    halo.addColorStop(1, 'rgba(255,180,60,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-62, -70, 124, 124);
    oval(ctx, 0, -8, 42, 42, null, 'rgba(255,220,130,0.55)', 2);

    /* 莲花座。 */
    oval(ctx, 0, 46, 40, 10, '#b8741d', '#ffe09a', 2);
    for (var pl = -3; pl <= 3; pl++) {
      oval(ctx, pl * 11, 40, 8, 6, '#e6b23f', '#8a5114', 1);
    }

    /* 袍身。 */
    ctx.beginPath();
    ctx.moveTo(-22, 38);
    ctx.quadraticCurveTo(-30, -2, -16, -12);
    ctx.lineTo(16, -12);
    ctx.quadraticCurveTo(30, -2, 22, 38);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, -24, 0, 24, 0, [
      [0, '#c9881f'], [0.5, '#ffe08a'], [1, '#c9881f']
    ]);
    ctx.fill();
    ctx.strokeStyle = '#8a5612'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(140,80,10,0.55)';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 36); ctx.stroke();
    ctx.fillStyle = '#8a1d22';
    roundRect(ctx, -12, 22, 24, 8, 3); ctx.fill();

    /* 头与官帽。 */
    oval(ctx, 0, -28, 15, 16, '#ffd98a', '#8a5612', 1.5);
    ctx.fillStyle = '#2b2a28';
    ctx.fillRect(-15, -43, 30, 6);
    oval(ctx, 0, -46, 13, 5, '#3a332b', '#a8791f', 1);
    ctx.fillStyle = '#d9a636';
    ctx.fillRect(-20, -42, 8, 4);
    ctx.fillRect(12, -42, 8, 4);
    /* 眉眼与长须。 */
    ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-8, -30); ctx.lineTo(-3, -29); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, -29); ctx.lineTo(8, -30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, -20); ctx.quadraticCurveTo(0, -16, 4, -20); ctx.stroke();
    ctx.strokeStyle = '#f2e2bd'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-5, -17); ctx.quadraticCurveTo(-8, -2, -3, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -17); ctx.quadraticCurveTo(8, -2, 3, 8); ctx.stroke();

    /* 手持法器。 */
    if (s.prop === 'ingot') {
      Art.drawIngot(ctx, 22, 14, 0.75);
    } else if (s.prop === 'coin') {
      oval(ctx, 22, 12, 10, 10, '#ffd05a', '#a26a12', 2);
      ctx.fillStyle = '#a26a12'; ctx.fillRect(19, 9, 6, 6);
    } else {
      ctx.strokeStyle = '#fff0bc'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(16, 20); ctx.quadraticCurveTo(30, 6, 24, -2); ctx.stroke();
      oval(ctx, 24, -4, 7, 5, '#fff0bc', '#c78a20', 1.5);
      ctx.lineCap = 'butt';
    }
    /* 双手。 */
    oval(ctx, -16, 14, 5, 5, '#f6cf84');
    oval(ctx, 16, 14, 5, 5, '#f6cf84');

    ctx.fillStyle = 'rgba(255,236,170,0.9)';
    ctx.font = '11px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(s.title, 0, 62);
    ctx.restore();
  };

  Art.drawIngot = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(-18, 6);
    ctx.quadraticCurveTo(-12, -8, 0, -8);
    ctx.quadraticCurveTo(12, -8, 18, 6);
    ctx.quadraticCurveTo(0, 14, -18, 6);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, -8, 0, 12, [[0, '#fff0b0'], [1, '#d79722']]);
    ctx.fill();
    ctx.strokeStyle = '#a66a12'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, -7); ctx.quadraticCurveTo(0, -16, 9, -7);
    ctx.strokeStyle = '#b8781a'; ctx.stroke();
    ctx.restore();
  };

  Art.drawIngotPile = function (ctx, x, y) {
    ctx.save();
    oval(ctx, x, y + 16, 38, 9, 'rgba(90,50,20,0.25)');
    oval(ctx, x, y + 10, 34, 9, '#c9a567', '#8a6a34', 2);
    Art.drawIngot(ctx, x - 13, y + 2, 0.72);
    Art.drawIngot(ctx, x + 13, y + 2, 0.72);
    Art.drawIngot(ctx, x, y - 9, 0.85);
    ctx.restore();
  };

  Art.drawLion = function (ctx, x, y, flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);
    oval(ctx, 0, 18, 26, 7, 'rgba(80,50,20,0.22)');
    ctx.fillStyle = '#c8b28a';
    roundRect(ctx, -20, 8, 40, 10, 3); ctx.fill();
    ctx.strokeStyle = '#8f7b58'; ctx.lineWidth = 1.5; ctx.stroke();
    oval(ctx, -4, -2, 15, 14, '#ded0ae', '#a89a78', 1.5);
    oval(ctx, 8, -12, 11, 11, '#e6d8b8', '#a89a78', 1.5);
    for (var k = 0; k < 5; k++) {
      oval(ctx, 2 + k * 3.5, -20 + (k % 2) * 2, 4, 4, '#d3c19c', '#9e8c68', 1);
    }
    oval(ctx, 12, -12, 2, 1.6, '#4a3a28');
    oval(ctx, 15, -7, 3, 2, '#8a6a48');
    ctx.fillStyle = '#c8323c';
    roundRect(ctx, -2, -4, 12, 5, 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- 动态层 ---------- */

  Art.drawLantern = function (ctx, l, t) {
    var swing = Math.sin(t * 1.25 + l.phase) * 0.13;
    ctx.save();
    ctx.translate(l.x, l.y - 8);
    ctx.rotate(swing);
    var halo = ctx.createRadialGradient(0, 24, 2, 0, 24, 48);
    halo.addColorStop(0, 'rgba(255,190,90,0.42)');
    halo.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-48, -24, 96, 96);
    ctx.strokeStyle = '#ffd77a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 4); ctx.stroke();
    ctx.fillStyle = '#e8b74e';
    roundRect(ctx, -11, 2, 22, 5, 2); ctx.fill();
    oval(ctx, 0, 24, 17, 22, linear(ctx, -17, 0, 17, 0, [
      [0, '#9d1b22'], [0.45, '#e84038'], [1, '#9d1b22']
    ]), '#ffd77a', 1.6);
    ctx.strokeStyle = 'rgba(255,215,130,0.55)'; ctx.lineWidth = 1;
    for (var q = -1; q <= 1; q++) {
      ctx.beginPath();
      ctx.ellipse(0, 24, 17 - Math.abs(q) * 5.5, 22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('福', 0, 24);
    ctx.fillStyle = '#e8b74e';
    roundRect(ctx, -10, 44, 20, 5, 2); ctx.fill();
    ctx.strokeStyle = '#f3c65a'; ctx.lineWidth = 2;
    for (var f = -1; f <= 1; f++) {
      ctx.beginPath(); ctx.moveTo(f * 5, 49); ctx.lineTo(f * 5 + swing * 10, 62); ctx.stroke();
    }
    ctx.restore();
  };

  Art.drawCushion = function (ctx, c, opts) {
    opts = opts || {};
    ctx.save();
    /* 2D 回退与 3D 共用同一套半径：蒲团放大一倍时，
       矢量绘制按半径比例整体缩放，而不是只放大命中框。 */
    var k = (C.CUSHION_RADIUS || 26) / 26;
    ctx.translate(c.x, c.y);
    ctx.scale(k, k);
    ctx.translate(-c.x, -c.y);
    var pulse = opts.highlight ? 0.5 + 0.5 * Math.sin(opts.time * 3.4) : 0;

    if (opts.highlight) {
      var g = ctx.createRadialGradient(c.x, c.y, 6, c.x, c.y, 54);
      g.addColorStop(0, 'rgba(255,225,130,' + (0.30 + pulse * 0.25) + ')');
      g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c.x - 54, c.y - 54, 108, 108);
    }

    oval(ctx, c.x, c.y + 9, 36, 13, 'rgba(90,45,20,0.28)');
    oval(ctx, c.x, c.y + 4, 35, 15,
      linear(ctx, 0, c.y - 12, 0, c.y + 18, [[0, '#b8202a'], [1, '#7d141c']]),
      '#e9b84f', 2);
    oval(ctx, c.x, c.y - 1, 35, 14,
      linear(ctx, c.x - 35, 0, c.x + 35, 0, [[0, '#a81f27'], [0.5, '#e04438'], [1, '#a81f27']]),
      '#ffd977', opts.highlight ? 3 : 2);
    oval(ctx, c.x, c.y - 1, 24, 9, null, 'rgba(255,222,140,0.75)', 1.4);

    /* 团花。 */
    ctx.save();
    ctx.translate(c.x, c.y - 1);
    for (var k = 0; k < 6; k++) {
      ctx.rotate(Math.PI / 3);
      oval(ctx, 0, -5, 3.2, 6, 'rgba(255,214,110,0.85)');
    }
    oval(ctx, 0, 0, 4, 3, '#ffe9a8');
    ctx.restore();

    /* 流苏。 */
    ctx.strokeStyle = '#f0c35c'; ctx.lineWidth = 2;
    var tassels = [[-30, 8], [-12, 14], [12, 14], [30, 8]];
    for (var i = 0; i < tassels.length; i++) {
      ctx.beginPath();
      ctx.moveTo(c.x + tassels[i][0], c.y + tassels[i][1]);
      ctx.lineTo(c.x + tassels[i][0] + (opts.time ? Math.sin(opts.time * 2 + i) * 1.5 : 0), c.y + tassels[i][1] + 7);
      ctx.stroke();
    }

    if (opts.occupied) {
      oval(ctx, c.x, c.y, 36, 16, 'rgba(70,20,20,0.18)');
    }
    if (opts.highlight) {
      ctx.fillStyle = 'rgba(255,240,190,' + (0.75 + pulse * 0.25) + ')';
      ctx.font = '13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('蒲团·可落座', c.x, c.y - 28);
    }
    ctx.restore();
  };

  Art.drawCenser = function (ctx, censer, incenseCount, t, highlight) {
    ctx.save();
    var x = censer.x, y = censer.y;

    if (highlight) {
      var g = ctx.createRadialGradient(x, y, 8, x, y, 76);
      g.addColorStop(0, 'rgba(255,220,130,0.34)');
      g.addColorStop(1, 'rgba(255,190,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 76, y - 76, 152, 152);
    }

    oval(ctx, x, y + 40, 54, 12, 'rgba(80,45,20,0.28)');
    ctx.fillStyle = linear(ctx, 0, y + 24, 0, y + 40, [[0, '#e0cba0'], [1, '#b89a6c']]);
    roundRect(ctx, x - 50, y + 24, 100, 14, 4); ctx.fill();
    ctx.strokeStyle = '#8a7148'; ctx.lineWidth = 1.5; ctx.stroke();

    /* 三足。 */
    ctx.fillStyle = '#8c6a32';
    roundRect(ctx, x - 30, y + 14, 9, 16, 2); ctx.fill();
    roundRect(ctx, x + 21, y + 14, 9, 16, 2); ctx.fill();
    roundRect(ctx, x - 5, y + 16, 10, 14, 2); ctx.fill();

    /* 炉身。 */
    ctx.beginPath();
    ctx.moveTo(x - 42, y - 8);
    ctx.quadraticCurveTo(x - 46, y + 20, x - 26, y + 25);
    ctx.lineTo(x + 26, y + 25);
    ctx.quadraticCurveTo(x + 46, y + 20, x + 42, y - 8);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, x - 44, 0, x + 44, 0, [
      [0, '#7d5a28'], [0.35, '#d8ad58'], [0.6, '#f0cd7c'], [1, '#795526']
    ]);
    ctx.fill();
    ctx.strokeStyle = '#5e421c'; ctx.lineWidth = 2; ctx.stroke();

    /* 双耳。 */
    ctx.strokeStyle = '#c99a44'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(x - 44, y - 8, 11, Math.PI * 0.55, Math.PI * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 44, y - 8, 11, Math.PI * 1.5, Math.PI * 0.45); ctx.stroke();

    /* 云纹与铭文。 */
    ctx.strokeStyle = 'rgba(92,62,22,0.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 24, y + 8);
    ctx.quadraticCurveTo(x - 10, y + 2, x, y + 9);
    ctx.quadraticCurveTo(x + 12, y + 16, x + 24, y + 8);
    ctx.stroke();
    ctx.fillStyle = '#6b4a1c';
    ctx.font = '12px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('招 财', x, y + 19);

    /* 炉口。 */
    oval(ctx, x, y - 8, 43, 11, '#4c3a20', '#e6c272', 3);
    oval(ctx, x, y - 8, 36, 7, '#6c5228');

    /* 已插的香枝。 */
    var count = Math.min(9, incenseCount);
    for (var i = 0; i < count; i++) {
      var sx = x - 24 + (i % 5) * 12 + (i % 2) * 2;
      var sy = y - 9 + Math.floor(i / 5) * 2;
      var lean = (i - 2.5) * 0.035;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(lean);
      ctx.strokeStyle = '#a8412a'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -34); ctx.stroke();
      oval(ctx, 0, -34, 2.4, 2.4, '#ff7a3c');
      var ember = ctx.createRadialGradient(0, -34, 0, 0, -34, 8);
      ember.addColorStop(0, 'rgba(255,150,60,0.7)');
      ember.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = ember;
      ctx.fillRect(-8, -42, 16, 16);
      ctx.restore();
    }

    if (highlight) {
      ctx.fillStyle = 'rgba(255,240,190,0.92)';
      ctx.font = '13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('香炉·可上香', x, y - 72);
    }
    ctx.restore();
  };

  /* 膜拜金色光环。 */
  Art.drawWorshipAura = function (ctx, x, y, t, strength) {
    ctx.save();
    for (var i = 0; i < 3; i++) {
      var r = 20 + ((t * 46 + i * 22) % 66);
      var a = (1 - (r - 20) / 66) * 0.55 * strength;
      ctx.strokeStyle = 'rgba(255,222,120,' + a.toFixed(3) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(x, y - 26, r, r * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    var g = ctx.createRadialGradient(x, y - 28, 2, x, y - 28, 48 * strength);
    g.addColorStop(0, 'rgba(255,240,180,0.42)');
    g.addColorStop(1, 'rgba(255,210,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 60, y - 88, 120, 120);
    ctx.restore();
  };

  /* ---------- 卡通小人 ---------- */

  /* ch: { x, y, pose, dir, outfit, name, scale, phase, showName } */
  Art.drawCharacter = function (ctx, ch, t) {
    var s = ch.scale || 1;
    var pose = ch.pose || 'idle';
    var seated = (pose === 'sit' || pose === 'worship');
    var walk = (pose === 'walk');
    var o = ch.outfit || C.OUTFITS[0];
    var ph = ch.phase || 0;

    ctx.save();
    ctx.translate(ch.x, ch.y);
    ctx.scale(s, s);

    /* 影子。 */
    oval(ctx, 0, 2, seated ? 28 : 20, seated ? 8 : 6, 'rgba(80,45,20,0.28)');

    var bob = walk ? Math.sin(t * 11 + ph) * 2.5 : Math.sin(t * 2.2 + ph) * 1.1;
    var bodyY = seated ? -18 : -34 + bob;
    var facingBack = ch.dir === 'up';

    /* 腿。 */
    if (seated) {
      oval(ctx, 0, -6, 25, 10, o.robeDark, '#7d1a20', 1.5);
      oval(ctx, -9, -8, 9, 6, o.robe);
      oval(ctx, 9, -8, 9, 6, o.robe);
    } else {
      var swing = walk ? Math.sin(t * 11 + ph) * 7 : 0;
      ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-7, -16); ctx.lineTo(-7 + swing, -1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(7, -16); ctx.lineTo(7 - swing, -1); ctx.stroke();
      ctx.fillStyle = '#4a3428';
      oval(ctx, -7 + swing, -1, 6, 3.5, '#4a3428');
      oval(ctx, 7 - swing, -1, 6, 3.5, '#4a3428');
      ctx.lineCap = 'butt';
    }

    /* 袍身。 */
    ctx.beginPath();
    if (seated) {
      ctx.moveTo(-21, -6);
      ctx.quadraticCurveTo(-24, bodyY - 4, -12, bodyY);
      ctx.lineTo(12, bodyY);
      ctx.quadraticCurveTo(24, bodyY - 4, 21, -6);
    } else {
      ctx.moveTo(-16, -12);
      ctx.quadraticCurveTo(-19, bodyY + 2, -11, bodyY);
      ctx.lineTo(11, bodyY);
      ctx.quadraticCurveTo(19, bodyY + 2, 16, -12);
    }
    ctx.closePath();
    ctx.fillStyle = linear(ctx, -20, 0, 20, 0, [
      [0, o.robeDark], [0.45, o.robe], [1, o.robeDark]
    ]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,20,20,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();

    /* 腰带与金色滚边。 */
    ctx.fillStyle = o.trim;
    roundRect(ctx, seated ? -20 : -16, seated ? -14 : -21, seated ? 40 : 32, 5, 2); ctx.fill();
    ctx.strokeStyle = o.trim; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, bodyY + 2); ctx.lineTo(0, seated ? -12 : -18); ctx.stroke();

    /* 手臂与动作。 */
    var worshipLift = pose === 'worship' ? Math.sin(t * 7 + ph) * 5 : 0;
    if (pose === 'worship') {
      /* 双手合十，置于胸前并上下起伏。 */
      ctx.save();
      ctx.translate(0, -30 + worshipLift);
      ctx.strokeStyle = o.robe; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(-3, -4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, 4); ctx.lineTo(3, -4); ctx.stroke();
      oval(ctx, -2, -5, 4.5, 6, '#ffdcb8', '#e8b98e', 1);
      oval(ctx, 3, -5, 4.5, 6, '#ffdcb8', '#e8b98e', 1);
      ctx.lineCap = 'butt';
      ctx.restore();
    } else if (pose === 'incense') {
      /* 一手举香，一手护香。 */
      ctx.strokeStyle = o.robe; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-13, -28); ctx.lineTo(-9, -44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(13, -28); ctx.lineTo(8, -40); ctx.stroke();
      ctx.lineCap = 'butt';
      oval(ctx, -9, -45, 4, 4, '#ffdcb8');
      oval(ctx, 8, -40, 4, 4, '#ffdcb8');
      ctx.strokeStyle = '#a8412a'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(-9, -46); ctx.lineTo(-9, -74); ctx.stroke();
      oval(ctx, -9, -74, 2.4, 2.4, '#ff8a3c');
      var eg = ctx.createRadialGradient(-9, -74, 0, -9, -74, 12);
      eg.addColorStop(0, 'rgba(255,160,70,0.75)');
      eg.addColorStop(1, 'rgba(255,140,50,0)');
      ctx.fillStyle = eg; ctx.fillRect(-21, -86, 24, 24);
    } else {
      var armSwing = walk ? Math.sin(t * 11 + ph + Math.PI) * 5 : 0;
      ctx.strokeStyle = o.robe; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-13, bodyY + 6); ctx.lineTo(-17 + armSwing, -12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(13, bodyY + 6); ctx.lineTo(17 - armSwing, -12); ctx.stroke();
      ctx.lineCap = 'butt';
      oval(ctx, -17 + armSwing, -11, 4, 4.5, '#ffdcb8');
      oval(ctx, 17 - armSwing, -11, 4, 4.5, '#ffdcb8');
    }

    /* 头。 */
    var headY = seated ? -44 : -56 + bob;
    oval(ctx, 0, headY, 15, 15, '#ffdcb8', '#e3ae80', 1.3);
    /* 头发与发髻。 */
    ctx.fillStyle = '#2c2521';
    ctx.beginPath();
    ctx.arc(0, headY, 15, Math.PI * 1.02, Math.PI * 1.98);
    ctx.closePath(); ctx.fill();
    oval(ctx, 0, headY - 15, 6, 5, '#2c2521');
    /* 红色头绳。 */
    ctx.strokeStyle = '#d8323c'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-7, headY - 11); ctx.lineTo(7, headY - 11); ctx.stroke();

    if (!facingBack) {
      oval(ctx, -5.5, headY + 1, 1.8, 2.2, '#3a2a20');
      oval(ctx, 5.5, headY + 1, 1.8, 2.2, '#3a2a20');
      oval(ctx, -10, headY + 5, 3, 2, 'rgba(232,110,90,0.5)');
      oval(ctx, 10, headY + 5, 3, 2, 'rgba(232,110,90,0.5)');
      ctx.strokeStyle = '#b4654a'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, headY + 4, 4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      /* 背对镜头时只画出上半部黑发与发髻，保留耳廓和颈部的肤色。 */
      ctx.fillStyle = '#2c2521';
      ctx.beginPath();
      ctx.arc(0, headY, 15, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      oval(ctx, -14, headY + 3, 3, 4, '#f4cba2');
      oval(ctx, 14, headY + 3, 3, 4, '#f4cba2');
      oval(ctx, 0, headY - 15, 6, 5, '#2c2521');
      ctx.strokeStyle = '#d8323c'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-8, headY - 10); ctx.lineTo(8, headY - 10);
      ctx.stroke();
    }

    /* 昵称标签。 */
    if (ch.showName && ch.name) {
      ctx.font = '12px ' + FONT;
      var tw = ctx.measureText(ch.name).width + 16;
      ctx.fillStyle = 'rgba(92,22,24,0.82)';
      roundRect(ctx, -tw / 2, headY - 39, tw, 19, 9); ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,120,0.7)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#ffe6a8';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch.name, 0, headY - 29);
    }

    ctx.restore();
  };

  CS.Art = Art;
})(window.CS);
