/* 青城山道观 3D 场景。
   以青城山宫观为原型：依山层叠的青石台基、青灰瓦重檐、栗色木构、
   山岚远岫、松柏银杏；殿内三龛供奉用户提供的鎏金财神像。
   渲染用本地 vendor/three.min.js，逻辑坐标来自 config.js：
   横向 1600，纵向因 15 排蒲团拉长到 3480（殿内法堂 2650 / 山门 3420）。

   殿宇放大：整座建筑放在 hall 组里统一缩放 HALL_SCALE 倍，
   而蒲团、香炉、角色等「逻辑对象」仍用 wx()/wz() 以 1:1 落在世界里；
   建筑内部一律用 hz(逻辑 y) 反算局部 z，法堂拉深时铺地、柱列、廊庑、
   殿门、外庭石作与山门会一起跟着走，不会出现景深与可行走区脱节。 */
window.CS = window.CS || {};
(function (CS) {
  'use strict';
  var T = window.THREE;
  if (!T) { return; }

  var C = CS.Config;
  var PI = Math.PI;
  var HALL_SCALE = 1.5;

  function wx(x) { return x - C.W / 2; }
  function wz(y) { return y - C.H / 2; }
  /* 逻辑 y -> hall 组局部 z（整组放大 HALL_SCALE 倍）。
     殿宇、铺地、柱列、山门一律用 hz(逻辑坐标) 定位，
     法堂拉深时只改 config.js 的常量，3D 美术坐标自动跟着走。 */
  function hz(y) { return (y - C.H / 2) / HALL_SCALE; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- 程序化贴图 ---------- */

  function tex(w, h, draw, rx, ry) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var c = cv.getContext('2d');
    draw(c, w, h);
    var t = new T.CanvasTexture(cv);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    if (rx || ry) {
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(rx || 1, ry || 1);
    }
    return t;
  }

  function noise(c, w, h, count, colors, size) {
    for (var i = 0; i < count; i++) {
      c.fillStyle = colors[(Math.random() * colors.length) | 0];
      c.fillRect(Math.random() * w, Math.random() * h,
        Math.random() * size + 0.5, Math.random() * size + 0.5);
    }
  }

  var TEXTURES = {};
  function buildTextures() {
    TEXTURES.stone = tex(256, 256, function (c, w, h) {
      c.fillStyle = '#7c867c'; c.fillRect(0, 0, w, h);
      for (var y = 0; y < 4; y++) {
        for (var x = 0; x < 4; x++) {
          var ox = x * 64 + (y % 2 ? 12 : 0);
          c.fillStyle = (x + y) % 2 ? '#828c81' : '#737d73';
          c.fillRect(ox + 2, y * 64 + 2, 60, 60);
          c.strokeStyle = 'rgba(48,60,52,0.55)'; c.lineWidth = 2;
          c.strokeRect(ox + 2, y * 64 + 2, 60, 60);
        }
      }
      noise(c, w, h, 900, ['rgba(210,220,200,0.09)', 'rgba(40,60,45,0.12)', 'rgba(120,140,110,0.10)'], 3);
    }, 8, 6);

    TEXTURES.tile = tex(256, 128, function (c, w, h) {
      c.fillStyle = '#39484a'; c.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 16) {
        var g = c.createLinearGradient(x, 0, x + 16, 0);
        g.addColorStop(0, '#2c3a3c'); g.addColorStop(0.45, '#556768');
        g.addColorStop(1, '#2c3a3c');
        c.fillStyle = g; c.fillRect(x, 0, 15, h);
      }
      for (var y = 8; y < h; y += 22) {
        c.strokeStyle = 'rgba(22,32,34,0.7)'; c.lineWidth = 2;
        c.beginPath();
        for (var xx = 0; xx <= w; xx += 16) {
          c.moveTo(xx, y); c.quadraticCurveTo(xx + 8, y + 5, xx + 16, y);
        }
        c.stroke();
      }
      noise(c, w, h, 400, ['rgba(180,200,190,0.06)', 'rgba(10,20,20,0.10)'], 2);
    }, 6, 3);

    TEXTURES.wood = tex(128, 256, function (c, w, h) {
      var g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#4b2a20'); g.addColorStop(0.35, '#794332');
      g.addColorStop(0.7, '#643527'); g.addColorStop(1, '#40231b');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (var i = 0; i < 26; i++) {
        c.strokeStyle = 'rgba(30,14,10,' + (0.05 + Math.random() * 0.12) + ')';
        c.lineWidth = 1 + Math.random() * 2;
        c.beginPath();
        var x = Math.random() * w;
        c.moveTo(x, 0);
        c.bezierCurveTo(x + 8, h * 0.3, x - 8, h * 0.7, x + 3, h);
        c.stroke();
      }
    });

    TEXTURES.lattice = tex(128, 256, function (c, w, h) {
      c.fillStyle = '#3a231b'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#20201d'; c.fillRect(8, 10, w - 16, h - 20);
      c.strokeStyle = '#6a4a2c'; c.lineWidth = 4;
      for (var x = 16; x < w - 8; x += 22) {
        c.beginPath(); c.moveTo(x, 10); c.lineTo(x, h - 10); c.stroke();
      }
      for (var y = 16; y < h - 8; y += 26) {
        c.beginPath(); c.moveTo(8, y); c.lineTo(w - 8, y); c.stroke();
      }
      c.strokeStyle = '#6d4227'; c.lineWidth = 7;
      c.strokeRect(4, 6, w - 8, h - 12);
    });

    TEXTURES.cushion = tex(256, 256, function (c, w, h) {
      var g = c.createRadialGradient(128, 128, 12, 128, 128, 128);
      g.addColorStop(0, '#e8c065'); g.addColorStop(0.55, '#c99a3e');
      g.addColorStop(0.88, '#9c6d28'); g.addColorStop(1, '#70491c');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(90,58,20,0.35)'; c.lineWidth = 2;
      for (var r = 18; r < 128; r += 11) {
        c.beginPath(); c.arc(128, 128, r, 0, PI * 2); c.stroke();
      }
      for (var a = 0; a < 32; a++) {
        var ang = a * PI / 16;
        c.beginPath();
        c.moveTo(128 + Math.cos(ang) * 14, 128 + Math.sin(ang) * 14);
        c.lineTo(128 + Math.cos(ang) * 126, 128 + Math.sin(ang) * 126);
        c.stroke();
      }
      c.strokeStyle = '#f0cf7e'; c.lineWidth = 6;
      c.beginPath(); c.arc(128, 128, 120, 0, PI * 2); c.stroke();
    });

    TEXTURES.bagua = tex(256, 256, function (c) {
      c.clearRect(0, 0, 256, 256);
      c.strokeStyle = 'rgba(226,203,142,0.85)'; c.lineWidth = 3;
      c.beginPath(); c.arc(128, 128, 118, 0, PI * 2); c.stroke();
      c.beginPath(); c.arc(128, 128, 82, 0, PI * 2); c.stroke();
      /* 太极 */
      c.fillStyle = 'rgba(240,224,178,0.80)';
      c.beginPath(); c.arc(128, 128, 58, -PI / 2, PI / 2); c.fill();
      c.fillStyle = 'rgba(38,52,48,0.85)';
      c.beginPath(); c.arc(128, 128, 58, PI / 2, PI * 1.5); c.fill();
      c.beginPath(); c.arc(128, 99, 29, 0, PI * 2); c.fillStyle = 'rgba(240,224,178,0.8)'; c.fill();
      c.beginPath(); c.arc(128, 157, 29, 0, PI * 2); c.fillStyle = 'rgba(38,52,48,0.85)'; c.fill();
      c.beginPath(); c.arc(128, 99, 9, 0, PI * 2); c.fillStyle = 'rgba(38,52,48,0.85)'; c.fill();
      c.beginPath(); c.arc(128, 157, 9, 0, PI * 2); c.fillStyle = 'rgba(240,224,178,0.8)'; c.fill();
      /* 八卦爻线 */
      for (var i = 0; i < 8; i++) {
        c.save(); c.translate(128, 128); c.rotate(i * PI / 4);
        c.strokeStyle = 'rgba(232,210,150,0.9)'; c.lineWidth = 4;
        var trig = [1, 1, 1, 0, 1, 0, 0, 0];
        for (var k = 0; k < 3; k++) {
          var yy = -103 - k * 9;
          var solid = ((trig[(i + k) % 8]) === 1);
          if (solid) { c.beginPath(); c.moveTo(-20, yy); c.lineTo(20, yy); c.stroke(); }
          else {
            c.beginPath(); c.moveTo(-20, yy); c.lineTo(-6, yy); c.stroke();
            c.beginPath(); c.moveTo(6, yy); c.lineTo(20, yy); c.stroke();
          }
        }
        c.restore();
      }
    });

    TEXTURES.halo = tex(256, 256, function (c) {
      var g = c.createRadialGradient(128, 128, 20, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,236,166,0.95)');
      g.addColorStop(0.35, 'rgba(255,197,92,0.55)');
      g.addColorStop(0.72, 'rgba(224,145,44,0.20)');
      g.addColorStop(1, 'rgba(200,110,30,0)');
      c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = 'rgba(255,226,150,0.65)'; c.lineWidth = 3;
      for (var i = 0; i < 24; i++) {
        var a = i * PI / 12;
        c.beginPath();
        c.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
        c.lineTo(128 + Math.cos(a) * 120, 128 + Math.sin(a) * 120);
        c.stroke();
      }
    });

    TEXTURES.shadow = tex(128, 128, function (c) {
      var g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(12,20,16,0.55)');
      g.addColorStop(1, 'rgba(12,20,16,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    }, undefined, undefined);
    TEXTURES.shadow.colorSpace = T.SRGBColorSpace;

    TEXTURES.mist = tex(512, 256, function (c, w, h) {
      c.clearRect(0, 0, w, h);
      for (var i = 0; i < 26; i++) {
        var x = Math.random() * w, y = h * 0.25 + Math.random() * h * 0.55;
        var r = 45 + Math.random() * 95;
        var g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(210,224,214,0.16)');
        g.addColorStop(1, 'rgba(210,224,214,0)');
        c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });

    TEXTURES.mountains = tex(1600, 620, function (c, w, h) {
      c.clearRect(0, 0, w, h);
      var layers = [
        { base: 500, amp: 120, col: 'rgba(38,54,50,0.55)', step: 190 },
        { base: 430, amp: 165, col: 'rgba(46,66,59,0.62)', step: 145 },
        { base: 350, amp: 210, col: 'rgba(58,80,69,0.72)', step: 115 }
      ];
      for (var l = 0; l < layers.length; l++) {
        var L = layers[l];
        c.fillStyle = L.col;
        c.beginPath(); c.moveTo(0, h);
        for (var x = 0; x <= w; x += 10) {
          var y = L.base - Math.abs(Math.sin(x / L.step + l * 1.7)) * L.amp
            - Math.abs(Math.sin(x / (L.step * 0.41) + l)) * L.amp * 0.34;
          c.lineTo(x, y);
        }
        c.lineTo(w, h); c.closePath(); c.fill();
      }
    });

    TEXTURES.bronze = tex(256, 256, function (c, w, h) {
      var g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#4a4632'); g.addColorStop(0.3, '#8e7b45');
      g.addColorStop(0.55, '#b39a58'); g.addColorStop(0.8, '#6d6038');
      g.addColorStop(1, '#3e3b28');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(40,38,24,0.45)'; c.lineWidth = 3;
      for (var y = 20; y < h; y += 44) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      }
      c.strokeStyle = 'rgba(232,206,132,0.35)'; c.lineWidth = 2;
      for (var x = 12; x < w; x += 32) {
        c.beginPath(); c.arc(x, 100, 22, 0, PI * 2); c.stroke();
      }
      noise(c, w, h, 500, ['rgba(30,34,20,0.10)', 'rgba(220,200,140,0.08)'], 3);
    });

    TEXTURES.plaque = tex(512, 150, function (c, w, h) {
      c.fillStyle = '#241a13'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#c39a4c'; c.lineWidth = 8; c.strokeRect(9, 9, w - 18, h - 18);
      c.strokeStyle = 'rgba(226,190,110,0.6)'; c.lineWidth = 2; c.strokeRect(19, 19, w - 38, h - 38);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'bold 82px "STKaiti","KaiTi","Songti SC",serif';
      c.fillStyle = '#f0cf7a'; c.fillText('財 神 殿', w / 2, h / 2 + 4);
    });

    TEXTURES.hallPlaque = function (str) {
      return tex(512, 128, function (c, w, h) {
        c.fillStyle = '#241a13'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#c39a4c'; c.lineWidth = 7; c.strokeRect(8, 8, w - 16, h - 16);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = 'bold 62px "STKaiti","KaiTi","Songti SC",serif';
        c.fillStyle = '#f0cf7a'; c.fillText(str, w / 2, h / 2 + 3);
      });
    };

    TEXTURES.couplet = function (str) {
      return tex(96, 420, function (c, w, h) {
        c.fillStyle = '#3a2419'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#b98c46'; c.lineWidth = 4; c.strokeRect(5, 5, w - 10, h - 10);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = 'bold 44px "STKaiti","KaiTi","Songti SC",serif';
        c.fillStyle = '#e9ce8b';
        for (var i = 0; i < str.length; i++) {
          c.fillText(str.charAt(i), w / 2, 52 + i * 52);
        }
      });
    };

    TEXTURES.banner = tex(96, 360, function (c, w, h) {
      c.fillStyle = '#8e2226'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c9a24c'; c.fillRect(0, 0, w, 16); c.fillRect(0, h - 16, w, 16);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'bold 46px "STKaiti","KaiTi",serif'; c.fillStyle = '#f6dda0';
      var s = '祈福迎祥';
      for (var i = 0; i < s.length; i++) { c.fillText(s.charAt(i), w / 2, 62 + i * 76); }
    });

    TEXTURES.nameTag = function (name) {
      return tex(256, 72, function (c, w, h) {
        c.fillStyle = 'rgba(28,26,20,0.78)';
        c.beginPath();
        if (c.roundRect) { c.roundRect(6, 6, w - 12, h - 12, 16); c.fill(); }
        else { c.fillRect(6, 6, w - 12, h - 12); }
        c.strokeStyle = 'rgba(236,201,118,0.8)'; c.lineWidth = 3; c.stroke();
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = 'bold 40px "STKaiti","KaiTi",serif';
        c.fillStyle = '#ffe7ae'; c.fillText(name, w / 2, h / 2 + 2);
      });
    };

    /* ---------- 宏大殿内：新增程序化彩画贴图 ---------- */

    /* 井口天花：青绿支条 + 金线团花 + 岔角云，可平铺 */
    TEXTURES.caisson = tex(256, 256, function (c, w, h) {
      c.fillStyle = '#1f3b35'; c.fillRect(0, 0, w, h);
      var g = c.createRadialGradient(128, 128, 8, 128, 128, 126);
      g.addColorStop(0, '#41705c'); g.addColorStop(1, '#1b332e');
      c.fillStyle = g; c.fillRect(6, 6, 244, 244);
      c.strokeStyle = '#7d4f28'; c.lineWidth = 11;
      c.strokeRect(3, 3, 250, 250);
      c.strokeStyle = '#d8ad5c'; c.lineWidth = 2;
      c.strokeRect(11, 11, 234, 234);
      c.save(); c.translate(128, 128);
      for (var p = 0; p < 8; p++) {
        c.save(); c.rotate(p * PI / 4);
        c.fillStyle = 'rgba(226,186,102,0.80)';
        c.beginPath(); c.ellipse(0, -56, 19, 42, 0, 0, PI * 2); c.fill();
        c.strokeStyle = 'rgba(255,228,156,0.7)'; c.lineWidth = 2;
        c.beginPath(); c.ellipse(0, -56, 19, 42, 0, 0, PI * 2); c.stroke();
        c.restore();
      }
      c.fillStyle = '#f0d08a'; c.beginPath(); c.arc(0, 0, 29, 0, PI * 2); c.fill();
      c.fillStyle = '#b8863c'; c.beginPath(); c.arc(0, 0, 20, 0, PI * 2); c.fill();
      c.fillStyle = '#ffe9ad'; c.beginPath(); c.arc(0, 0, 10, 0, PI * 2); c.fill();
      c.strokeStyle = 'rgba(224,190,120,0.6)'; c.lineWidth = 3;
      for (var q = 0; q < 4; q++) {
        c.save(); c.rotate(q * PI / 2);
        c.beginPath(); c.moveTo(80, -108);
        c.bezierCurveTo(102, -96, 100, -68, 84, -60);
        c.bezierCurveTo(96, -70, 92, -88, 76, -86);
        c.stroke();
        c.restore();
      }
      c.restore();
      noise(c, w, h, 240, ['rgba(255,235,180,0.05)', 'rgba(8,24,20,0.10)'], 2);
    }, 6, 4);

    /* 藻井井心：八角攒尖 + 莲瓣 + 太极八卦 */
    TEXTURES.caissonCore = tex(512, 512, function (c) {
      c.clearRect(0, 0, 512, 512);
      var g = c.createRadialGradient(256, 256, 18, 256, 256, 250);
      g.addColorStop(0, '#f5d88f'); g.addColorStop(0.34, '#b9843c');
      g.addColorStop(0.68, '#2c5348'); g.addColorStop(1, '#142b27');
      c.fillStyle = g; c.beginPath(); c.arc(256, 256, 248, 0, PI * 2); c.fill();
      c.strokeStyle = '#e8c274'; c.lineWidth = 6;
      for (var r = 232; r > 96; r -= 34) {
        c.beginPath();
        for (var k = 0; k < 8; k++) {
          var a = k * PI / 4 + PI / 8;
          var px = 256 + Math.cos(a) * r, py = 256 + Math.sin(a) * r;
          if (k) { c.lineTo(px, py); } else { c.moveTo(px, py); }
        }
        c.closePath(); c.stroke();
      }
      c.fillStyle = 'rgba(240,206,132,0.92)';
      for (var l = 0; l < 16; l++) {
        c.save(); c.translate(256, 256); c.rotate(l * PI / 8);
        c.beginPath(); c.ellipse(0, -118, 11, 28, 0, 0, PI * 2); c.fill();
        c.restore();
      }
      /* 八卦爻线 */
      for (var i = 0; i < 8; i++) {
        c.save(); c.translate(256, 256); c.rotate(i * PI / 4);
        c.strokeStyle = 'rgba(244,214,140,0.9)'; c.lineWidth = 5;
        var trig = [1, 1, 1, 0, 1, 0, 0, 0];
        for (var k2 = 0; k2 < 3; k2++) {
          var yy = -218 - k2 * 9;
          if (trig[(i + k2) % 8] === 1) {
            c.beginPath(); c.moveTo(-17, yy); c.lineTo(17, yy); c.stroke();
          } else {
            c.beginPath(); c.moveTo(-17, yy); c.lineTo(-5, yy); c.stroke();
            c.beginPath(); c.moveTo(5, yy); c.lineTo(17, yy); c.stroke();
          }
        }
        c.restore();
      }
      /* 太极 */
      c.fillStyle = '#f6e2ae'; c.beginPath(); c.arc(256, 256, 84, -PI / 2, PI / 2); c.fill();
      c.fillStyle = '#1d3a33'; c.beginPath(); c.arc(256, 256, 84, PI / 2, PI * 1.5); c.fill();
      c.fillStyle = '#f6e2ae'; c.beginPath(); c.arc(256, 298, 42, 0, PI * 2); c.fill();
      c.fillStyle = '#1d3a33'; c.beginPath(); c.arc(256, 214, 42, 0, PI * 2); c.fill();
      c.fillStyle = '#1d3a33'; c.beginPath(); c.arc(256, 214, 13, 0, PI * 2); c.fill();
      c.fillStyle = '#f6e2ae'; c.beginPath(); c.arc(256, 298, 13, 0, PI * 2); c.fill();
    });

    /* 神帐：朱红褶裥帷幔 + 金云纹 + 海水江崖 + 垂穗 */
    TEXTURES.drapery = tex(512, 512, function (c, w, h) {
      var g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#5a1419'); g.addColorStop(0.45, '#912328');
      g.addColorStop(1, '#481116');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 32) {
        var pg = c.createLinearGradient(x, 0, x + 32, 0);
        pg.addColorStop(0, 'rgba(0,0,0,0.24)');
        pg.addColorStop(0.5, 'rgba(255,190,120,0.12)');
        pg.addColorStop(1, 'rgba(0,0,0,0.24)');
        c.fillStyle = pg; c.fillRect(x, 0, 32, h);
      }
      c.strokeStyle = 'rgba(236,196,110,0.5)'; c.lineWidth = 4;
      for (var i = 0; i < 7; i++) {
        for (var j = 0; j < 4; j++) {
          var cx = 40 + j * 140 + (i % 2 ? 60 : 0), cy = 48 + i * 60;
          c.beginPath(); c.moveTo(cx - 26, cy + 12);
          c.bezierCurveTo(cx - 10, cy - 14, cx + 16, cy - 14, cx + 22, cy + 4);
          c.bezierCurveTo(cx + 30, cy + 18, cx + 8, cy + 24, cx + 2, cy + 12);
          c.stroke();
        }
      }
      c.fillStyle = '#24494a'; c.fillRect(0, h - 72, w, 72);
      c.strokeStyle = 'rgba(224,196,128,0.7)'; c.lineWidth = 3;
      for (var s2 = 0; s2 < 5; s2++) {
        c.beginPath();
        for (var xx = 0; xx <= w; xx += 8) {
          var yy = h - 62 + Math.sin(xx / 26 + s2) * (5 + s2 * 2) + s2 * 11;
          if (xx) { c.lineTo(xx, yy); } else { c.moveTo(xx, yy); }
        }
        c.stroke();
      }
      c.fillStyle = '#e8bf68'; c.fillRect(0, 0, w, 12);
      for (var t = 0; t < 16; t++) {
        c.beginPath(); c.moveTo(t * 32 + 8, 12); c.lineTo(t * 32 + 16, 34);
        c.lineTo(t * 32 + 24, 12); c.closePath(); c.fill();
      }
    });

    /* 宝盖：伞盖俯视，朱绸金环 + 莲瓣 + 垂穗 */
    TEXTURES.canopy = tex(256, 256, function (c) {
      c.clearRect(0, 0, 256, 256);
      var g = c.createRadialGradient(128, 128, 10, 128, 128, 126);
      g.addColorStop(0, '#f4d68e'); g.addColorStop(0.25, '#c8933f');
      g.addColorStop(0.56, '#9b2b26'); g.addColorStop(1, '#5d191c');
      c.fillStyle = g; c.beginPath(); c.arc(128, 128, 126, 0, PI * 2); c.fill();
      for (var p = 0; p < 16; p++) {
        c.save(); c.translate(128, 128); c.rotate(p * PI / 8);
        c.strokeStyle = 'rgba(240,206,132,0.75)'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(0, -20); c.lineTo(0, -124); c.stroke();
        c.fillStyle = 'rgba(240,206,132,0.5)';
        c.beginPath(); c.ellipse(0, -104, 12, 27, 0, 0, PI * 2); c.fill();
        c.restore();
      }
      c.strokeStyle = '#f3d18a'; c.lineWidth = 6;
      var rings = [26, 58, 92, 122];
      for (var ri = 0; ri < rings.length; ri++) {
        c.beginPath(); c.arc(128, 128, rings[ri], 0, PI * 2); c.stroke();
      }
      c.fillStyle = '#ffe6a6'; c.beginPath(); c.arc(128, 128, 20, 0, PI * 2); c.fill();
      c.fillStyle = '#a32c28'; c.beginPath(); c.arc(128, 128, 11, 0, PI * 2); c.fill();
      /* 外圈流苏 */
      c.fillStyle = '#e9bd66';
      for (var f = 0; f < 24; f++) {
        var a = f * PI / 12;
        c.beginPath();
        c.arc(128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124, 5, 0, PI * 2);
        c.fill();
      }
    });

    /* 廊庑壁画：青绿山水 + 云气 + 松鹤剪影 */
    TEXTURES.mural = tex(256, 512, function (c, w, h) {
      var g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#395b52'); g.addColorStop(0.5, '#527267');
      g.addColorStop(1, '#243f39');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (var m = 0; m < 3; m++) {
        c.fillStyle = 'rgba(28,56,50,' + (0.5 + m * 0.12) + ')';
        c.beginPath(); c.moveTo(0, 190 + m * 70);
        for (var x = 0; x <= w; x += 8) {
          c.lineTo(x, 190 + m * 70 - Math.abs(Math.sin(x / 34 + m)) * (38 - m * 8));
        }
        c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
      }
      c.strokeStyle = 'rgba(230,214,164,0.45)'; c.lineWidth = 3;
      for (var i = 0; i < 9; i++) {
        var cy = 60 + i * 48;
        c.beginPath(); c.moveTo(0, cy);
        c.bezierCurveTo(60, cy - 18, 90, cy + 18, 150, cy);
        c.bezierCurveTo(200, cy - 16, 224, cy + 12, 256, cy - 4);
        c.stroke();
      }
      c.strokeStyle = 'rgba(22,46,40,0.85)'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(10, h); c.lineTo(40, 300); c.lineTo(18, 220); c.stroke();
      c.beginPath(); c.moveTo(234, h); c.lineTo(212, 320); c.stroke();
      c.fillStyle = 'rgba(26,60,48,0.9)';
      for (var b = 0; b < 10; b++) {
        c.beginPath();
        c.ellipse(20 + (b % 3) * 14, 210 + b * 9, 22, 7, b * 0.3, 0, PI * 2);
        c.fill();
      }
    });

    /* 旋子彩画：梁枋青绿叠晕 + 金团花，横向平铺 */
    TEXTURES.beamPaint = tex(256, 64, function (c, w, h) {
      c.fillStyle = '#22443c'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3b6a5b'; c.fillRect(0, 10, w, h - 20);
      c.strokeStyle = '#d7ad5e'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 10); c.lineTo(w, 10);
      c.moveTo(0, h - 10); c.lineTo(w, h - 10); c.stroke();
      for (var x = 32; x < w; x += 64) {
        c.save(); c.translate(x, h / 2);
        c.strokeStyle = 'rgba(238,204,124,0.85)'; c.lineWidth = 3;
        for (var k = 0; k < 4; k++) {
          c.save(); c.rotate(k * PI / 2);
          c.beginPath(); c.ellipse(0, -12, 7, 14, 0, 0, PI * 2); c.stroke();
          c.restore();
        }
        c.fillStyle = '#e9c477'; c.beginPath(); c.arc(0, 0, 6, 0, PI * 2); c.fill();
        c.restore();
      }
    }, 8, 1);

    /* 丹陛石雕：中轴御路云纹 */
    TEXTURES.danbi = tex(256, 512, function (c, w, h) {
      c.fillStyle = '#9aa497'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(60,74,62,0.55)'; c.lineWidth = 3;
      c.strokeRect(8, 8, w - 16, h - 16);
      c.strokeStyle = 'rgba(226,214,168,0.8)'; c.lineWidth = 5;
      for (var i = 0; i < 9; i++) {
        var y = 34 + i * 54;
        c.beginPath(); c.moveTo(20, y);
        c.bezierCurveTo(70, y - 30, 100, y + 30, 150, y);
        c.bezierCurveTo(190, y - 24, 220, y + 16, 240, y - 6);
        c.stroke();
      }
      c.fillStyle = 'rgba(206,186,126,0.55)';
      c.beginPath(); c.arc(128, 256, 62, 0, PI * 2); c.fill();
      c.strokeStyle = '#6f7a68'; c.lineWidth = 5;
      c.beginPath(); c.arc(128, 256, 62, 0, PI * 2); c.stroke();
      c.beginPath(); c.arc(128, 256, 42, 0, PI * 2); c.stroke();
      noise(c, w, h, 400, ['rgba(255,255,240,0.08)', 'rgba(40,56,44,0.10)'], 3);
    });
  }

  /* ---------- 几何工具 ---------- */

  function addMesh(parent, geo, material, x, y, z) {
    var m = new T.Mesh(geo, material);
    m.position.set(x || 0, y || 0, z || 0);
    parent.add(m);
    return m;
  }
  function box(parent, w, h, d, material, x, y, z, shadow) {
    var m = addMesh(parent, new T.BoxGeometry(w, h, d), material, x, y, z);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  }
  function cyl(parent, rt, rb, h, seg, material, x, y, z, shadow) {
    var m = addMesh(parent, new T.CylinderGeometry(rt, rb, h, seg), material, x, y, z);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  }
  function plane(parent, w, h, material, x, y, z) {
    return addMesh(parent, new T.PlaneGeometry(w, h), material, x, y, z);
  }

  function lampMaterial(color, intensity) {
    return new T.MeshStandardMaterial({
      color: color, emissive: color, emissiveIntensity: intensity || 0.8,
      roughness: 0.55, metalness: 0.05
    });
  }

  /* ---------- 主体 ---------- */

  function World3D(canvas) {
    if (!T.WebGLRenderer) { return; }
    this.canvas = canvas;
    this.w = 1000; this.h = 680;
    this.focusLx = C.W / 2;
    this.focusLy = C.SPAWN.y;
    this.followX = C.W / 2;
    this.followY = C.SPAWN.y;
    this.followOn = false;
    this.parX = 0; this.parY = 0;
    this.targetParX = 0; this.targetParY = 0;
    this.time = 0;
    this.ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
    this.raycaster = new T.Raycaster();
    this.tmpVec = new T.Vector3();
    this.tmpVec2 = new T.Vector3();

    try {
      this.renderer = new T.WebGLRenderer({
        canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance'
      });
    } catch (e) {
      this.failed = true;
      return;
    }
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.58;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;

    this.scene = new T.Scene();
    this.scene.background = new T.Color('#3b554b');
    /* 法堂拉深到 15 排后，从山门望到三龛的距离接近 2700 单位，
       雾稍微放淡一点，远处金身与重檐仍能看清。 */
    this.scene.fog = new T.FogExp2('#5b7161', 0.00022);
    this.camera = new T.PerspectiveCamera(42, 1.47, 1, 9000);

    /* 建筑整体放大；逻辑对象（蒲团、香炉、角色、灯笼）不进这个组。 */
    this.hall = new T.Group();
    this.hall.scale.setScalar(HALL_SCALE);
    this.scene.add(this.hall);

    buildTextures();
    this.buildMaterials();
    this.buildLights();
    this.buildEnvironment();
    this.buildGrandHall();
    this.buildTemple();
    this.buildShrines();
    this.buildCushions();
    this.buildCenser();
    this.buildLanterns();
    this.buildCharacters();

    var self = this;
    canvas.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') { return; }
      var r = canvas.getBoundingClientRect();
      self.targetParX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      self.targetParY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    canvas.addEventListener('pointerleave', function () {
      self.targetParX = 0; self.targetParY = 0;
    });
    this.resize(this.w, this.h, false);
  }

  World3D.prototype.buildMaterials = function () {
    var M = this.M = {};
    M.stone = new T.MeshLambertMaterial({ color: 0xd3d2c0, map: TEXTURES.stone });
    M.stoneDark = new T.MeshLambertMaterial({ color: 0x98a08f });
    M.step = new T.MeshLambertMaterial({ color: 0xb8b8a4, map: TEXTURES.stone });
    M.tile = new T.MeshLambertMaterial({ color: 0xc4d0cc, map: TEXTURES.tile, side: T.DoubleSide });
    M.tileDark = new T.MeshLambertMaterial({ color: 0x445654, side: T.DoubleSide });
    M.wood = new T.MeshLambertMaterial({ color: 0xf0cfae, map: TEXTURES.wood });
    M.pillar = new T.MeshLambertMaterial({ color: 0x9b5133 });
    M.woodDark = new T.MeshLambertMaterial({ color: 0x4a2c20 });
    M.lattice = new T.MeshLambertMaterial({ color: 0x8c7458, map: TEXTURES.lattice });
    M.gold = new T.MeshStandardMaterial({ color: 0xd8a63e, metalness: 0.78, roughness: 0.28, emissive: 0x3a2408, emissiveIntensity: 0.35 });
    M.goldSoft = new T.MeshStandardMaterial({ color: 0xe8c468, metalness: 0.6, roughness: 0.38, emissive: 0x4a2c08, emissiveIntensity: 0.4 });
    M.bronze = new T.MeshStandardMaterial({ color: 0xb7a26a, map: TEXTURES.bronze, metalness: 0.62, roughness: 0.44 });
    M.red = lampMaterial(0xb42c2c, 0.55);
    M.redBright = lampMaterial(0xff5536, 1.05);
    M.flame = lampMaterial(0xffb347, 1.7);
    M.cushion = new T.MeshLambertMaterial({ color: 0xffffff, map: TEXTURES.cushion });
    M.cushionSide = new T.MeshLambertMaterial({ color: 0x9c7029 });
    M.ring = new T.MeshBasicMaterial({ color: 0xffe09a, transparent: true, opacity: 0.0 });
    M.halo = new T.MeshBasicMaterial({ map: TEXTURES.halo, transparent: true, opacity: 0.46, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    M.mist = new T.MeshBasicMaterial({ map: TEXTURES.mist, transparent: true, opacity: 0.72, depthWrite: false, side: T.DoubleSide });
    M.mountains = new T.MeshBasicMaterial({ map: TEXTURES.mountains, transparent: true, depthWrite: false });
    M.bagua = new T.MeshBasicMaterial({ map: TEXTURES.bagua, transparent: true, opacity: 0.5, depthWrite: false });
    M.shadow = new T.MeshBasicMaterial({ map: TEXTURES.shadow, transparent: true, depthWrite: false });
    M.incenseStick = new T.MeshLambertMaterial({ color: 0x8d4a2a });
    M.incenseTip = lampMaterial(0xff6b3a, 1.2);
    /* 殿额关掉深度测试：竖屏俯角更陡时后坡屋檐会盖住它，
       强制绘制在上层才能让两种视口都读到殿名。它位于画面顶端，
       覆盖的只是屋檐与彩画带，不会侵入三龛头部的区域。 */
    M.plaque = new T.MeshBasicMaterial({
      map: TEXTURES.plaque, side: T.DoubleSide,
      depthTest: false, depthWrite: false
    });
    M.plaqueBack = new T.MeshBasicMaterial({
      color: 0x241a13, depthTest: false, depthWrite: false
    });
    M.banner = new T.MeshLambertMaterial({ map: TEXTURES.banner, side: T.DoubleSide, transparent: true });
    M.groundDark = new T.MeshLambertMaterial({ color: 0x4e5b50 });
    M.leaf = lampMaterial(0xc9a13f, 0.2);
    M.trunk = new T.MeshLambertMaterial({ color: 0x4a3a2a });
    M.pine = new T.MeshLambertMaterial({ color: 0x37564a });
    M.ginkgo = new T.MeshLambertMaterial({ color: 0xb8973c });
    /* 殿内宏大新增材质 */
    M.caisson = new T.MeshBasicMaterial({ map: TEXTURES.caisson, side: T.DoubleSide });
    M.caissonCore = new T.MeshBasicMaterial({ map: TEXTURES.caissonCore, transparent: true, side: T.DoubleSide, depthWrite: false });
    M.drapery = new T.MeshLambertMaterial({ map: TEXTURES.drapery, side: T.DoubleSide });
    M.canopy = new T.MeshLambertMaterial({ map: TEXTURES.canopy, transparent: true, opacity: 0.82, alphaTest: 0.02, depthWrite: false, side: T.DoubleSide });
    M.mural = new T.MeshLambertMaterial({ map: TEXTURES.mural, side: T.DoubleSide });
    M.beamPaint = new T.MeshLambertMaterial({ map: TEXTURES.beamPaint, side: T.DoubleSide });
    M.danbi = new T.MeshLambertMaterial({ map: TEXTURES.danbi, side: T.DoubleSide });
    M.hallDark = new T.MeshLambertMaterial({ color: 0x243832 });
    M.pillarDeep = new T.MeshLambertMaterial({ color: 0x8a3c28 });
    M.distantRoof = new T.MeshLambertMaterial({ color: 0x3b544c, side: T.DoubleSide });
    M.hallPlaque = [
      '三 清 殿', '文昌殿', '青 城 山'
    ].map(function (s) {
      return new T.MeshBasicMaterial({ map: TEXTURES.hallPlaque(s), side: T.DoubleSide });
    });
  };

  World3D.prototype.buildLights = function () {
    /* 光源留在世界坐标里（不随 hall 缩放），按放大后的殿宇重新铺开范围。 */
    var s = this.scene;
    var K = HALL_SCALE;
    s.add(new T.HemisphereLight(0xd4e6d6, 0x5a4130, 1.48));
    var sun = new T.DirectionalLight(0xffe8bd, 1.9);
    sun.position.set(-320 * K, 660 * K, 430 * K);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -720 * K; sun.shadow.camera.right = 720 * K;
    sun.shadow.camera.top = 620 * K; sun.shadow.camera.bottom = -520 * K;
    sun.shadow.camera.near = 100; sun.shadow.camera.far = 1800 * K;
    sun.shadow.bias = -0.0009;
    s.add(sun);
    var fill = new T.DirectionalLight(0x8fb6c0, 0.42);
    fill.position.set(420 * K, 300 * K, -500 * K);
    s.add(fill);
    var censerLight = new T.PointLight(0xff9a4a, 1.5, 330 * K, 2);
    censerLight.position.set(wx(C.CENSER.x), 105 * K, wz(C.CENSER.y));
    s.add(censerLight);
    var shrineLight = new T.PointLight(0xffc978, 1.35, 460 * K, 2);
    shrineLight.position.set(0, 210 * K, -170 * K);
    s.add(shrineLight);
    var lanternLight = new T.PointLight(0xff6a3a, 0.85, 520 * K, 2);
    lanternLight.position.set(0, 250 * K, -60 * K);
    s.add(lanternLight);
    /* 殿内高处一盏暖光，把藻井与柱列从青绿雾气里托出来。 */
    var hallLight = new T.PointLight(0xffd394, 1.05, 1150 * K, 2);
    hallLight.position.set(0, 400 * K, -280 * K);
    s.add(hallLight);
    var aisleLight = new T.PointLight(0xffb877, 0.55, 900 * K, 2);
    aisleLight.position.set(0, 300 * K, 120 * K);
    s.add(aisleLight);
    this.censerLight = censerLight;
  };

  World3D.prototype.buildEnvironment = function () {
    var s = this.hall, M = this.M;

    /* 15 排蒲团把殿门推到逻辑 y=2650、山门推到 3420，
       所有铺地统一按 config 常量换算成 hall 局部 z，避免景深与可行走区脱节。 */
    var floorBack = hz(150), floorFront = hz(C.HALL_FRONT);
    var floorDepth = floorFront - floorBack;
    var floorCenter = (floorFront + floorBack) / 2;
    var aisleW = C.AISLE_WIDTH / HALL_SCALE;

    var ground = plane(s, 2600, 3400, M.stone, 0, -0.4, 550);
    ground.rotation.x = -PI / 2;
    ground.receiveShadow = true;

    /* 跟随镜头会一路退到山门，相机始终在玩家正后方，所以铺地必须一直
       延伸到相机脚下。青石格纹要比世界边界再向外多铺一段，
       否则会露出一块浅灰矩形，看起来像「地面到头了」。 */
    var outerStone = M.stone.clone();
    outerStone.color.set(0x9aa48f);
    var outerGround = plane(s, 4200, 4400, outerStone, 0, -1.2, 400);
    outerGround.rotation.x = -PI / 2;
    outerGround.receiveShadow = true;

    /* Sansa「清缘堂」式殿内：一整片暖木地板，殿外才是青石庭院。
       材质分界本身就是法堂的房间边界，不必砌实墙去挡财神与主角。
       地板按 15 排蒲团压细金线，形成「一排排参拜垫」的秩序感。 */
    var woodFloor = plane(s, 1040, floorDepth,
      new T.MeshLambertMaterial({ color: 0x6b432c, side: T.DoubleSide }),
      0, 0.15, floorCenter);
    woodFloor.rotation.x = -PI / 2;
    woodFloor.receiveShadow = true;
    this.woodFloor = woodFloor;
    for (var fr = 0; fr < C.CUSHION_ROWS; fr++) {
      var rowLz = hz(C.CUSHION_ROW_START + fr * C.CUSHION_ROW_GAP);
      box(s, 1030, 1.2, 2.4, M.goldSoft, 0, 0.55, rowLz, false);
    }
    /* 殿门门槛：法堂与月台的分界。两侧短柱收口，中轴完全留空，
       绝不横越视线通廊，三龛头部不会被门框压住。 */
    var doorLz = hz(C.HALL_FRONT);
    this.hallDoorZ = doorLz;
    box(s, 1040, 3, 7, M.goldSoft, 0, 0.7, doorLz, false);
    for (var ds = -1; ds <= 1; ds += 2) {
      box(s, 26, 150, 26, M.woodDark, ds * 510, 75, doorLz, false);
      box(s, 34, 8, 34, M.goldSoft, ds * 510, 154, doorLz, false);
    }

    /* 青石甬道：与放宽后的中轴御道同宽，一路铺到山门之后，
       不盖住两侧蒲团阵列。 */
    var pathBack = hz(0), pathFront = hz(C.WORLD.maxY + 200);
    var path = plane(s, aisleW, pathFront - pathBack,
      M.stoneDark, 0, 0.2, (pathFront + pathBack) / 2);
    path.rotation.x = -PI / 2;
    path.receiveShadow = true;

    /* 八卦石雕移到殿门外的庭院，避开整片蒲团与中轴香炉 */
    var bg = plane(s, 150, 150, M.bagua, 0, 0.9, hz(C.HALL_FRONT + 130));
    bg.rotation.x = -PI / 2;

    /* 天幕与远岫：拉得更宽更远，让三重后殿两侧仍透出青城山影。 */
    var sky = plane(s, 4200, 2100, new T.MeshBasicMaterial({ color: 0x3d5a50, fog: false }), 0, 340, -1580);
    void sky;
    var mt = plane(s, 3600, 1180, M.mountains, 0, 250, -960);
    mt.renderOrder = -2;
    var mt2 = plane(s, 3000, 860, M.mountains.clone(), 0, 150, -1320);
    mt2.material.opacity = 0.55;
    mt2.renderOrder = -3;

    /* 山岚：从殿前一直铺到山门之后，层层漂移，拉出空间纵深。 */
    this.mists = [];
    for (var i = 0; i < 7; i++) {
      var mp = plane(s, 2100, 460, M.mist.clone(), 0, 130 + i * 46, -300 - i * 165);
      mp.material.opacity = 0.30 + i * 0.055;
      mp.rotation.x = -PI / 2.35;
      mp.renderOrder = 1 + i;
      this.mists.push({ mesh: mp, speed: 5 + i * 3, base: mp.position.x });
    }

    /* 松柏与银杏：殿侧与后方，用圆锥层叠 */
    var trees = [
      { x: -640, z: -330, s: 1.25, kind: 'pine' },
      { x: 640, z: -330, s: 1.25, kind: 'pine' },
      { x: -760, z: 120, s: 1.0, kind: 'ginkgo' },
      { x: 760, z: 120, s: 1.0, kind: 'ginkgo' },
      { x: -560, z: -700, s: 1.5, kind: 'pine' },
      { x: 560, z: -700, s: 1.5, kind: 'pine' },
      { x: -880, z: -430, s: 1.1, kind: 'ginkgo' },
      { x: 880, z: -430, s: 1.1, kind: 'ginkgo' }
    ];
    for (var k = 0; k < trees.length; k++) {
      var tr = trees[k];
      var g = new T.Group();
      g.position.set(tr.x, 0, tr.z);
      g.scale.setScalar(tr.s);
      var trunk = cyl(g, 12, 18, 150, 8, M.trunk, 0, 75, 0, true);
      void trunk;
      var leafMat = tr.kind === 'pine' ? M.pine : M.ginkgo;
      for (var j = 0; j < 3; j++) {
        var cone = cyl(g, 0, 78 - j * 16, 115, 9, leafMat, 0, 145 + j * 62, 0, true);
        void cone;
      }
      s.add(g);
    }

    /* 石灯与经幢 */
    for (var q = 0; q < 2; q++) {
      var sx = q ? 470 : -470;
      var lg = new T.Group();
      /* 殿侧石灯移到殿门外的庭院：法堂拉深后原位置会压在第 3 排蒲团上。 */
      lg.position.set(sx, 0, hz(C.HALL_FRONT + 150));
      box(lg, 46, 14, 46, M.stoneDark, 0, 7, 0, true);
      cyl(lg, 16, 20, 76, 8, M.stoneDark, 0, 52, 0, true);
      box(lg, 54, 12, 54, M.stoneDark, 0, 96, 0, true);
      box(lg, 40, 34, 40, M.red, 0, 118, 0, true);
      box(lg, 58, 10, 58, M.tileDark, 0, 140, 0, true);
      s.add(lg);
    }

    /* 十、殿前外庭：镜头跟随玩家后，从山门方向一路走到拜台都要有景。
       这里只放低矮的石作（最高约 210 世界单位），刻意不放高墙与高树——
       相机始终位于玩家正后方，高物体会横在视线里挡住主角。 */

    /* 月台三级石阶与两侧石栏：全部以殿门为锚点，随法堂一起后移。 */
    var courtZ = hz(C.HALL_FRONT);
    for (var stp = 0; stp < 3; stp++) {
      box(s, 1520, 5, 24, M.stone, 0, 0.3 + stp * 2.2,
        courtZ + 24 + stp * 24, false);
    }
    var railStart = courtZ + 40;
    var railCount = Math.max(5, Math.round((hz(C.GATE_Y) - railStart) / 70));
    for (var sd = -1; sd <= 1; sd += 2) {
      for (var bl = 0; bl < railCount; bl++) {
        box(s, 16, 30, 16, M.stoneDark, sd * 660, 15, railStart + bl * 70, true);
        cyl(s, 8, 8, 6, 6, M.stone, sd * 660, 33, railStart + bl * 70, false);
      }
      box(s, 10, 8, (railCount - 1) * 70 + 20, M.stone, sd * 660, 27,
        railStart + (railCount - 1) * 35, false);
    }

    /* 外庭八卦地雕与两列石灯、经幢 */
    var courtBaguas = [
      { x: -330, z: courtZ + 97 }, { x: 330, z: courtZ + 97 },
      { x: -330, z: courtZ + 317 }, { x: 330, z: courtZ + 317 }
    ];
    for (var cb = 0; cb < courtBaguas.length; cb++) {
      var cbp = plane(s, 116, 116, M.bagua, courtBaguas[cb].x, 0.7, courtBaguas[cb].z);
      cbp.rotation.x = -PI / 2;
    }
    for (var cl = 0; cl < 4; cl++) {
      var cx2 = (cl < 2 ? -1 : 1) * 470;
      var cz2 = courtZ + 107 + (cl % 2) * 230;
      var lamp = new T.Group();
      lamp.position.set(cx2, 0, cz2);
      box(lamp, 40, 12, 40, M.stoneDark, 0, 6, 0, true);
      cyl(lamp, 13, 17, 66, 8, M.stoneDark, 0, 45, 0, true);
      box(lamp, 46, 10, 46, M.stone, 0, 83, 0, true);
      box(lamp, 34, 28, 34, M.red, 0, 102, 0, true);
      box(lamp, 50, 8, 50, M.tileDark, 0, 120, 0, true);
      s.add(lamp);
    }

    /* 外院边界用矮照壁与松柏点景，位置退到可行走范围之外；
       照壁压得很低，不会在相机与玩家之间形成遮挡。 */
    var screenZ = hz(C.GATE_Y) - 47;
    for (var ws = -1; ws <= 1; ws += 2) {
      box(s, 420, 62, 22, M.red, ws * 880, 31, screenZ, true);
      box(s, 440, 10, 34, M.tileDark, ws * 880, 66, screenZ, false);
    }
    var outerTrees = [
      { x: -980, z: 120, s: 1.15, kind: 'pine' },
      { x: 980, z: 120, s: 1.15, kind: 'ginkgo' },
      { x: -980, z: -160, s: 1.0, kind: 'ginkgo' },
      { x: 980, z: -160, s: 1.0, kind: 'pine' }
    ];
    for (var ot = 0; ot < outerTrees.length; ot++) {
      var tr2 = outerTrees[ot];
      var tg = new T.Group();
      tg.position.set(tr2.x, 0, tr2.z);
      tg.scale.setScalar(tr2.s);
      cyl(tg, 12, 18, 140, 8, M.trunk, 0, 70, 0, true);
      var lm = tr2.kind === 'pine' ? M.pine : M.ginkgo;
      for (var lf = 0; lf < 3; lf++) {
        cyl(tg, 0, 72 - lf * 15, 108, 9, lm, 0, 138 + lf * 58, 0, true);
      }
      s.add(tg);
    }

    /* 十一、山门：Sansa 的庭院是有门的，不是一片走不到头的空地。
       相机始终在玩家正后上方，所以中轴绝不架横梁；只在两侧立门阙、
       向外延伸低院墙，中轴留门洞，用地面门槛石板提示「到此收口」。 */
    var gz = hz(C.GATE_Y);                      /* 逻辑 3420 → hall z≈1980 */
    var GG = new T.Group();
    s.add(GG);
    this.gateGroup = GG;
    this.gateZ = gz;
    var gatePath = plane(GG, 430, 280, M.stone, 0, 0.35, gz);
    gatePath.rotation.x = -PI / 2;
    box(GG, 440, 3, 9, M.goldSoft, 0, 0.75, gz, false);
    for (var gside = -1; gside <= 1; gside += 2) {
      box(GG, 54, 160, 54, M.red, gside * 210, 80, gz, true);
      box(GG, 66, 10, 66, M.tileDark, gside * 210, 168, gz, false);
      box(GG, 520, 44, 20, M.red, gside * 480, 22, gz, true);
      box(GG, 540, 8, 32, M.tileDark, gside * 480, 48, gz, false);
      var gp = plane(GG, 34, 74, M.hallPlaque[2], gside * 210, 112, gz + 28);
      gp.renderOrder = 2;
    }
  };

  World3D.prototype.buildTemple = function () {
    var s = this.hall, M = this.M;
    var g = new T.Group();
    s.add(g);

    /* 依山台基与石阶：台阶放在可行走区之后，不干扰角色平面移动。 */
    box(g, 1060, 26, 230, M.stone, 0, 13, -205, true);
    box(g, 1090, 10, 250, M.stoneDark, 0, 2, -205, true);
    for (var st = 0; st < 5; st++) {
      box(g, 1000 - st * 8, 5 + st * 4, 12, M.step,
        0, 3 + st * 2, -96 - st * 12, true);
    }
    /* 石栏望柱 */
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < 5; i++) {
        var px = side * 500;
        var pz = -110 - i * 52;
        box(g, 18, 44, 18, M.stoneDark, px, 48, pz, true);
        cyl(g, 11, 11, 8, 6, M.stoneDark, px, 74, pz, true);
      }
      box(g, 12, 9, 230, M.stoneDark, side * 500, 44, -215, true);
    }

    /* 后墙与格扇 */
    box(g, 940, 250, 16, M.woodDark, 0, 150, -318, true);
    for (var door = 0; door < 5; door++) {
      var dx = -360 + door * 180;
      var dm = plane(g, 150, 200, M.lattice, dx, 152, -308);
      void dm;
    }

    /* 前檐柱、后檐柱与柱础 */
    /* 撤掉紧贴中尊的 ±84 两根前檐柱：纵深柱列已足够撑起殿内气势，
       这两根反而会把正财神像劈成两半。 */
    /* 四根前檐柱全部退到三龛视线之外（放大后 |x| >= 510）。 */
    var colX = [-500, -340, 340, 500];
    for (var ci = 0; ci < colX.length; ci++) {
      var cx = colX[ci];
      cyl(g, 20, 23, 18, 12, M.stoneDark, cx, 34, -108, true);
      cyl(g, 12, 14, 236, 12, M.pillar, cx, 160, -108, true);
      cyl(g, 18, 15, 16, 12, M.goldSoft, cx, 276, -108, true);
      cyl(g, 16, 18, 16, 10, M.stoneDark, cx, 34, -302, true);
      cyl(g, 11, 13, 230, 10, M.pillar, cx, 157, -302, true);
    }
    /* 三龛正前的「视线通廊」必须干净：前檐额枋、斗拱与悬挂物一律
       退到通廊之外。原先横贯的两道细枋会横切三尊金身的头部与肩部，
       这里彻底移除，殿内层次改由纵深柱列与彩枋承担。 */

    /* 上下两重檐：手写四边形屋面，带收分与起翘 */
    this.roof(g, 1080, 330, 316, 392, M.tile, M.tileDark, 0);
    this.roof(g, 760, 230, 392, 462, M.tile, M.tileDark, 0);
    /* 正脊与脊饰 */
    box(g, 660, 12, 16, M.tileDark, 0, 468, -205, true);
    for (var fin = -2; fin <= 2; fin++) {
      cyl(g, 0, 9, 26, 6, M.goldSoft, fin * 130, 485, -205, true);
    }

    /* 殿额：落在三龛之后、像顶之上的窄带里。
       实测桌面投影中心约 y=41、像顶约 y=99；手机约 y=151、像顶约 y=212。
       竖屏俯角更陡，竖直平面会被压成一条线，所以整块匾向镜头微倾，
       两端都能读到「財神殿」，同时下沿仍不触到任何一顶官帽。 */
    var plaqueGroup = new T.Group();
    plaqueGroup.position.set(0, 333, -300);
    plaqueGroup.rotation.x = -0.55;
    g.add(plaqueGroup);
    var plaqueBack = box(plaqueGroup, 264, 70, 8, M.plaqueBack, 0, 0, -5, false);
    plaqueBack.renderOrder = 19;
    var plaque = plane(plaqueGroup, 250, 62, M.plaque, 0, 0, 0);
    plaque.renderOrder = 20;
    var leftC = new T.MeshBasicMaterial({ map: TEXTURES.couplet('青城幽境聚祥'), side: T.DoubleSide });
    var rightC = new T.MeshBasicMaterial({ map: TEXTURES.couplet('金殿慈光赐福'), side: T.DoubleSide });
    plane(g, 40, 176, leftC, -336, 190, -94);
    plane(g, 40, 176, rightC, 336, 190, -94);

    /* 幡幢 */
    for (var b = -1; b <= 1; b += 2) {
      var ban = plane(g, 62, 230, M.banner, b * 452, 168, -96);
      ban.rotation.y = b * 0.18;
      box(g, 70, 7, 7, M.goldSoft, b * 452, 286, -96, true);
      cyl(g, 3, 3, 40, 6, M.red, b * 452, 34, -96, true);
    }

    /* 殿前供案 */
    var table = new T.Group();
    table.position.set(0, 26, -150);
    g.add(table);
    box(table, 700, 14, 46, M.wood, 0, 32, 0, true);
    box(table, 716, 6, 52, M.goldSoft, 0, 40, 0, true);
    for (var leg = -3; leg <= 3; leg += 2) {
      box(table, 16, 32, 16, M.woodDark, leg * 110, 16, 0, true);
    }
    box(table, 700, 30, 6, M.red, 0, 17, 20, true);
    /* 烛台与供果 */
    for (var cd = -1; cd <= 1; cd += 2) {
      var cdx = cd * 250;
      cyl(table, 8, 14, 26, 10, M.bronze, cdx, 53, 0, true);
      cyl(table, 5, 5, 34, 8, M.redBright, cdx, 82, 0, true);
      var fl = cyl(table, 0, 8, 16, 8, M.flame, cdx, 106, 0, false);
      fl.userData.isFlame = true;
      this.flames = this.flames || [];
      this.flames.push(fl);
    }
    for (var fr = -2; fr <= 2; fr++) {
      var fruit = new T.Mesh(new T.SphereGeometry(13, 12, 10),
        new T.MeshLambertMaterial({ color: 0xd98b3c }));
      fruit.position.set(fr * 62, 52, 6);
      table.add(fruit);
    }
  };

  /* ---------- 宏大殿内：纵深柱列 / 廊庑 / 藻井 / 神帐 / 层叠殿宇 ----------
     这一层把原本偏「殿外立面」的构图包进一座有纵深的殿堂：
     两侧多进柱列向后收敛，廊庑格扇与壁画夹出甬道，三龛之后立神帐，
     更远处还有三重殿宇沿青城山势层层退去。 */
  World3D.prototype.buildGrandHall = function () {
    var H = new T.Group(), M = this.M;
    this.hall.add(H);

    /* 殿内一切纵深构件都以 HALL_FRONT 为终点、以神帐为起点自动铺开，
       蒲团从 7 排扩到 15 排时不需要逐个改美术坐标。 */
    var aisleW = C.AISLE_WIDTH / HALL_SCALE;
    var hallFrontZ = hz(C.HALL_FRONT);
    var rampBack = hz(200), rampFront = hallFrontZ;
    var rampLen = rampFront - rampBack, rampZ = (rampFront + rampBack) / 2;
    var bayBack = -835, bayFront = hallFrontZ + 20;
    var bayLen = bayFront - bayBack, bayZ = (bayFront + bayBack) / 2;

    /* 一、中轴御道：宽度等于两片蒲团阵列留出的 216 单位中缝，
       长度贯穿 15 排拜垫，把 150 个蒲团分成东西两班。 */
    var ramp = plane(H, aisleW - 12, rampLen, M.danbi, 0, 0.55, rampZ);
    ramp.rotation.x = -PI / 2;
    ramp.receiveShadow = true;
    for (var rb = -1; rb <= 1; rb += 2) {
      box(H, 6, 4, rampLen, M.goldSoft, rb * (aisleW / 2 - 6), 1.4, rampZ, false);
    }

    /* 二、殿内纵深柱列：两侧各两列，按 300 逻辑单位一进铺满整座法堂。
       柱距比蒲团行距大，既撑起纵深又不会把一排排拜垫切碎。 */
    var bays = [];
    for (var bayZ0 = hallFrontZ - 20; bayZ0 >= -505; bayZ0 -= 200) {
      bays.push(bayZ0);
    }
    var rows = [548, 708];
    for (var side = -1; side <= 1; side += 2) {
      for (var r = 0; r < rows.length; r++) {
        var rx = side * rows[r];
        for (var b = 0; b < bays.length; b++) {
          var bz = bays[b], hgt = 316;
          cyl(H, 21, 25, 15, 10, M.stoneDark, rx, 7.5, bz, false);
          cyl(H, 13, 15, hgt, 10, M.pillarDeep, rx, 15 + hgt / 2, bz, true);
          box(H, 40, 10, 40, M.woodDark, rx, 15 + hgt + 5, bz, false);
          box(H, 34, 7, 34, M.goldSoft, rx, 15 + hgt + 13, bz, false);
        }
        /* 纵向彩枋：旋子彩画 + 金线压边 */
        box(H, 20, 18, bayLen, M.beamPaint, rx, 344, bayZ, false);
        box(H, 26, 5, bayLen + 6, M.goldSoft, rx, 356, bayZ, false);
      }

      /* 三、廊庑：格扇长窗与青绿壁画交替，夹出殿内甬道 */
      box(H, 16, 288, bayLen, M.hallDark, side * 792, 150, bayZ, false);
      var panelCount = Math.ceil(bayLen / 200);
      for (var w = 0; w < panelCount; w++) {
        var wz0 = bayFront - 60 - w * 200;
        var pmat = (w % 2 === 0) ? M.lattice : M.mural;
        var pnl = plane(H, 142, 196, pmat, side * 782, 170, wz0);
        pnl.rotation.y = side * PI / 2;
        box(H, 8, 208, 8, M.goldSoft, side * 776, 170, wz0 - 74, false);
      }
      box(H, 22, 10, bayLen, M.beamPaint, side * 792, 300, bayZ, false);
      box(H, 26, 4, bayLen + 6, M.goldSoft, side * 792, 308, bayZ, false);

      /* 四、纵深宫灯：留在龛前一段，不往拜垫上方新增遮挡 */
      for (var la = 0; la < 4; la++) {
        var lz = -60 - la * 150;
        var lx = side * (430 - la * 12);
        var lg = new T.Group();
        lg.position.set(lx, 288, lz);
        H.add(lg);
        cyl(lg, 2, 2, 30, 6, M.goldSoft, 0, 0, 0, false);
        cyl(lg, 13, 13, 26, 12, M.red, 0, -30, 0, false);
        cyl(lg, 9, 9, 4, 10, M.goldSoft, 0, -16, 0, false);
        cyl(lg, 9, 9, 4, 10, M.goldSoft, 0, -44, 0, false);
        var gl = new T.Mesh(new T.SphereGeometry(17, 8, 6), M.redBright.clone());
        gl.material.transparent = true; gl.material.opacity = 0.14;
        gl.position.y = -30; lg.add(gl);
      }

      /* 五、月台石栏：一路伸到殿门，夹住整片 15 排拜垫 */
      var hallRailCount = Math.max(5, Math.floor((hallFrontZ - 20) / 60) + 1);
      for (var pi = 0; pi < hallRailCount; pi++) {
        var pz = 20 + pi * 60;
        box(H, 16, 40, 16, M.stoneDark, side * 508, 20, pz, true);
        cyl(H, 10, 10, 7, 6, M.stoneDark, side * 508, 44, pz, false);
      }
      box(H, 10, 8, (hallRailCount - 1) * 60 + 20, M.stoneDark, side * 508, 36,
        20 + (hallRailCount - 1) * 30, false);
    }

    /* 六、神帐：三龛之后的朱红帷幔，上方压一条井口天花彩画 */
    var drape = plane(H, 1240, 318, M.drapery, 0, 190, -306);
    drape.renderOrder = 0;
    /* 彩画带改用横向单排旋子纹，避免 6x4 平铺在竖屏下叠成密集扇形。 */
    var frieze = plane(H, 1240, 46, M.beamPaint, 0, 362, -303);
    frieze.renderOrder = 1;
    box(H, 1250, 6, 8, M.goldSoft, 0, 397, -300, false);
    /* 帐前一对太极圆光，填住龛与龛之间的空档；正中不再放圆光，
       免得俯视下叠在正财神官帽后面造成「被压住」的错觉。 */
    for (var md = -1; md <= 1; md += 2) {
      var med = plane(H, 116, 116, M.caissonCore, md * 392, 232, -300);
      med.renderOrder = 2;
    }

    /* 七、帐前垂穗：原先悬在每龛上方的三顶宝盖在竖屏下会与官帽叠成
       扇形，直接移除，改作神帐上沿一排细密金穗。它位于像顶之上、像身之后，
       只作华盖意象，绝不侵入三龛头部的视线通廊。 */
    for (var tk = 0; tk < 24; tk++) {
      var tx = -600 + tk * 52;
      cyl(H, 1.4, 1.4, 16, 5, M.goldSoft, tx, 386, -298, false);
      var bead = new T.Mesh(new T.SphereGeometry(3.2, 6, 5), M.goldSoft);
      bead.position.set(tx, 376, -298);
      H.add(bead);
    }

    /* 八、层叠殿宇：三重后殿沿中轴向山里退去，形成宏大远景 */
    var farHalls = [
      { z: -570, w: 1280, wall: 196, eave: 240, ridge: 306 },
      { z: -800, w: 1040, wall: 164, eave: 204, ridge: 258 },
      { z: -1020, w: 860, wall: 134, eave: 172, ridge: 216 }
    ];
    for (var fh = 0; fh < farHalls.length; fh++) {
      var F = farHalls[fh];
      box(H, F.w, F.wall, 46, M.hallDark, 0, F.wall / 2, F.z - 20, false);
      var panels = Math.max(3, Math.round(F.w / 200));
      for (var pp = 0; pp < panels; pp++) {
        var px = -F.w / 2 + (pp + 0.5) * (F.w / panels);
        plane(H, F.w / panels - 16, F.wall * 0.66, M.lattice,
          px, F.wall * 0.52, F.z + 5);
      }
      box(H, F.w + 76, 12, 156, M.tileDark, 0, F.eave, F.z, false);
      box(H, F.w + 44, 9, 124, M.tile, 0, F.eave + 15, F.z - 12, false);
      box(H, F.w * 0.52, 10, 82, M.tileDark, 0, F.ridge, F.z - 32, false);
      box(H, F.w + 84, 4, 164, M.goldSoft, 0, F.eave + 7, F.z + 2, false);
      /* 后殿匾额 */
      var fp = plane(H, 128, 34, M.hallPlaque[fh], 0, F.wall * 0.82, F.z + 8);
      fp.renderOrder = 2;
    }

    /* 九、山门牌坊：最远处的中轴收束点 */
    var gate = new T.Group();
    gate.position.set(0, 0, -1180);
    H.add(gate);
    for (var gs = -1; gs <= 1; gs += 2) {
      cyl(gate, 11, 14, 190, 10, M.pillarDeep, gs * 210, 95, 0, false);
      box(gate, 44, 14, 44, M.stoneDark, gs * 210, 7, 0, false);
    }
    box(gate, 560, 18, 30, M.woodDark, 0, 196, 0, false);
    box(gate, 600, 10, 96, M.tileDark, 0, 214, 0, false);
    box(gate, 620, 5, 104, M.goldSoft, 0, 222, 0, false);
    var gp = plane(gate, 150, 42, M.hallPlaque[2], 0, 166, 18);
    gp.renderOrder = 2;
  };

  /* 两坡屋面 + 檐口 + 四角起翘 */
  World3D.prototype.roof = function (parent, width, depth, eaveY, ridgeY, tileMat, darkMat, zOff) {
    var zc = -205 + zOff;
    var halfD = depth / 2;
    var topW = width * 0.42;
    function quad(a, b, c, d, mat) {
      var geo = new T.BufferGeometry();
      var v = new Float32Array([
        a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
        a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]
      ]);
      var uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
      geo.setAttribute('position', new T.BufferAttribute(v, 3));
      geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
      geo.computeVertexNormals();
      var m = new T.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    var eF = zc + halfD, eB = zc - halfD;
    /* 界画式剖顶：朝镜头的前坡完全打开，只保留后坡青瓦与正脊。
       前檐口若留在相机与金身之间，会横切像身造成「头身分离」。 */
    quad([width / 2, eaveY, eB], [-width / 2, eaveY, eB],
      [-topW, ridgeY, zc], [topW, ridgeY, zc], tileMat);
    /* 两侧山花用薄板收边，避免与后坡共面产生深度冲突。 */
    for (var sh = -1; sh <= 1; sh += 2) {
      var tri = new T.Mesh(new T.ConeGeometry(depth * 0.22, ridgeY - eaveY, 3), darkMat);
      tri.position.set(sh * (width * 0.44), (ridgeY + eaveY) / 2, zc - halfD * 0.5);
      tri.rotation.y = PI / 2;
      tri.castShadow = true;
      parent.add(tri);
    }
    /* 前檐只留左右两段短轮廓，中间整条让给三龛视线通廊；
       横贯的檐线在俯视下会像一条刀口切断财神头身。 */
    for (var lip = -1; lip <= 1; lip += 2) {
      box(parent, width * 0.18, 3, 6, darkMat,
        lip * width * 0.41, eaveY - 2, eF + 2, true);
    }
    box(parent, width + 16, 12, 14, darkMat, 0, eaveY - 6, eB - 2, true);
    box(parent, topW * 2 + 12, 10, 12, darkMat, 0, ridgeY + 2, zc, true);
    /* 四角起翘：用短圆锥沿斜上方挑出 */
    for (var sx = -1; sx <= 1; sx += 2) {
      for (var sz = -1; sz <= 1; sz += 2) {
        var horn = cyl(parent, 0, 11, 52, 6, tileMat,
          sx * width / 2, eaveY + 16, zc + sz * halfD, true);
        horn.rotation.z = -sx * 0.62;
        horn.rotation.x = sz * 0.3;
      }
    }
  };

  World3D.prototype.buildShrines = function () {
    var M = this.M;
    var self = this;
    this.halos = [];
    this.statuePlanes = [];

    var loader = new T.TextureLoader();
    var goldTex = null;
    if (CS.GOLD_IMAGE) {
      goldTex = loader.load(CS.GOLD_IMAGE, function () {
        /* data URI 解码完成后刷新材质，避免首帧空白。 */
        if (mirror) { mirror.needsUpdate = true; }
        goldTex.needsUpdate = true;
        for (var i = 0; i < self.statuePlanes.length; i++) {
          self.statuePlanes[i].material.needsUpdate = true;
        }
      });
      goldTex.colorSpace = T.SRGBColorSpace;
    }
    var mirror = goldTex ? goldTex.clone() : null;
    if (mirror) {
      mirror.wrapS = T.RepeatWrapping;
      mirror.repeat.x = -1; mirror.offset.x = 1;
      mirror.needsUpdate = true;
    }

    for (var i = 0; i < C.STATUES.length; i++) {
      var st = C.STATUES[i];
      /* 三龛用建筑局部坐标定位（放大后约为世界 x = -270 / 0 / 270），
         与新逻辑坐标系里的 520 / 800 / 1080 基本对齐。 */
      var cx = (i - 1) * 180;
      var sz = -212;
      var scale = st.scale;
      var g = new T.Group();
      g.position.set(cx, 26, sz);
      this.hall.add(g);

      /* 须弥座：青石束腰 + 莲瓣 */
      cyl(g, 74 * scale, 84 * scale, 22, 12, M.stoneDark, 0, 11, 0, true);
      cyl(g, 68 * scale, 74 * scale, 10, 12, M.goldSoft, 0, 27, 0, true);
      for (var p = 0; p < 14; p++) {
        var a = p * PI * 2 / 14;
        var petal = new T.Mesh(new T.SphereGeometry(11 * scale, 8, 6), M.goldSoft);
        petal.scale.set(1.5, 0.55, 0.9);
        petal.position.set(Math.cos(a) * 62 * scale, 33, Math.sin(a) * 62 * scale);
        petal.rotation.y = -a;
        g.add(petal);
      }

      /* 神龛背板与木框 */
      /* 神龛略向后仰 20°：既抵消俯视压缩，又让像身稳稳落在莲座上。 */
      var niche = new T.Group();
      niche.position.set(0, 140 * scale, -32);
      niche.rotation.x = -0.35;
      g.add(niche);
      var pw = 163 * scale, ph = 289 * scale;
      box(niche, pw + 34, ph + 34, 12, M.woodDark, 0, 0, -14, true);
      box(niche, pw + 18, ph + 18, 4, M.goldSoft, 0, 0, -6, true);
      box(niche, pw + 6, ph + 6, 3, new T.MeshLambertMaterial({ color: 0x1d1a17 }), 0, 0, -3, true);

      var haloMat = M.halo.clone();
      var halo = plane(niche, pw * 1.42, ph * 1.16, haloMat, 0, 8, -1);
      halo.renderOrder = 2;
      this.halos.push(halo);

      var imgMat;
      if (goldTex) {
        imgMat = new T.MeshBasicMaterial({
          map: (i === 0 ? mirror : goldTex), transparent: true,
          alphaTest: 0.02, depthWrite: false, side: T.DoubleSide,
          /* 关掉 ACES 色调映射，保留参考照片原本的鎏金浓淡。 */
          toneMapped: false,
          color: (i === 2 ? 0xffeed2 : 0xffffff)
        });
      } else {
        imgMat = new T.MeshBasicMaterial({ color: 0xd8a63e, transparent: true, opacity: 0.92 });
      }
      var img = plane(niche, pw, ph, imgMat, 0, 0, 2);
      img.renderOrder = 4;
      this.statuePlanes.push(img);

      /* 龛前一对烛台与香炉 */
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        cyl(g, 5, 9, 26, 8, M.bronze, s2 * 58 * scale, 52, 34, true);
        cyl(g, 4, 4, 22, 8, M.redBright, s2 * 58 * scale, 76, 34, true);
        var f = cyl(g, 0, 6, 12, 6, M.flame, s2 * 58 * scale, 93, 34, false);
        this.flames = this.flames || [];
        this.flames.push(f);
      }
    }
  };

  World3D.prototype.buildCushions = function () {
    var M = this.M;
    var n = C.CUSHIONS.length;
    var R = C.CUSHION_RADIUS || 26;
    /* 蒲团直径翻倍后厚度同步翻倍，才不会变成一张薄饼。 */
    var k = R / 26;
    var thick = 11 * k;

    /* 150 个蒲团若逐个建 Mesh 会产生约 450 个 draw call。
       侧面与顶面各用一个 InstancedMesh，高亮只保留一个跟随的环，
       合计 3 个 draw call，低端设备也能流畅铺满拜台。 */
    var sideGeo = new T.CylinderGeometry(R, R + 2 * k, thick, 24);
    var topGeo = new T.CircleGeometry(R, 24);
    topGeo.rotateX(-PI / 2);

    var sideInst = new T.InstancedMesh(sideGeo, M.cushionSide, n);
    var topInst = new T.InstancedMesh(topGeo, M.cushion, n);
    sideInst.castShadow = true; sideInst.receiveShadow = true;
    topInst.receiveShadow = true;
    sideInst.frustumCulled = false;
    topInst.frustumCulled = false;

    var mtx = new T.Matrix4();
    var white = new T.Color(1, 1, 1);
    this.cushionPos = [];
    this.cushionBusy = new Array(n);
    this.remoteBusy = {};   /* 同殿香客坐下时占用的蒲团，供满殿静坐观感着色 */
    for (var i = 0; i < n; i++) {
      var c = C.CUSHIONS[i];
      var x = wx(c.x), z = wz(c.y);
      mtx.makeTranslation(x, thick / 2, z);
      sideInst.setMatrixAt(i, mtx);
      mtx.makeTranslation(x, thick + 0.2, z);
      topInst.setMatrixAt(i, mtx);
      sideInst.setColorAt(i, white);
      topInst.setColorAt(i, white);
      this.cushionPos.push({ x: x, z: z, id: c.id });
      this.cushionBusy[i] = false;
    }
    sideInst.instanceMatrix.needsUpdate = true;
    topInst.instanceMatrix.needsUpdate = true;
    this.scene.add(sideInst);
    this.scene.add(topInst);
    this.cushionSideInst = sideInst;
    this.cushionTopInst = topInst;

    var ringGeo = new T.TorusGeometry(R + 5, 2.4 * k, 8, 36);
    ringGeo.rotateX(-PI / 2);
    var ring = new T.Mesh(ringGeo, M.ring.clone());
    ring.visible = false;
    ring.renderOrder = 3;
    this.scene.add(ring);
    this.cushionRing = ring;
  };

  World3D.prototype.buildCenser = function () {
    var M = this.M;
    var g = new T.Group();
    g.position.set(wx(C.CENSER.x), 0, wz(C.CENSER.y));
    /* 鼎炉留在世界坐标里，手动放大到与殿宇同一量级。 */
    g.scale.setScalar(HALL_SCALE * 0.95);
    this.scene.add(g);
    /* 鼎式三足 */
    for (var i = 0; i < 3; i++) {
      var a = i * PI * 2 / 3 + 0.4;
      cyl(g, 7, 10, 30, 8, M.bronze, Math.cos(a) * 26, 15, Math.sin(a) * 26, true);
    }
    /* 鼓腹鼎身：用车削轮廓做出收腰与外撇口沿，比直筒更有青铜鼎的体积感。 */
    var profile = [
      new T.Vector2(0, 28), new T.Vector2(24, 28), new T.Vector2(33, 36),
      new T.Vector2(41, 52), new T.Vector2(40, 68), new T.Vector2(35, 78),
      new T.Vector2(42, 83)
    ];
    var body = new T.Mesh(new T.LatheGeometry(profile, 28), M.bronze);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    var rim = new T.Mesh(new T.TorusGeometry(41, 4.5, 10, 28), M.goldSoft);
    rim.rotation.x = PI / 2; rim.position.y = 83;
    g.add(rim);
    /* 双耳 */
    for (var s = -1; s <= 1; s += 2) {
      var ear = new T.Mesh(new T.TorusGeometry(15, 4, 8, 16, PI), M.bronze);
      ear.position.set(s * 42, 76, 0);
      ear.rotation.z = s * PI / 2;
      g.add(ear);
    }
    cyl(g, 34, 34, 3, 24, new T.MeshLambertMaterial({ color: 0x615c4c }), 0, 80, 0, false);
    this.censerGroup = g;
    this.incenseSticks = [];
    for (var k = 0; k < 9; k++) {
      var ang = k * PI * 2 / 9;
      var rad = 10 + (k % 3) * 7;
      var stick = cyl(g, 1.6, 1.6, 62, 6, M.incenseStick,
        Math.cos(ang) * rad, 111, Math.sin(ang) * rad, false);
      var tip = new T.Mesh(new T.SphereGeometry(2.6, 8, 6), M.incenseTip);
      tip.position.set(Math.cos(ang) * rad, 142, Math.sin(ang) * rad);
      g.add(tip);
      this.incenseSticks.push({ stick: stick, tip: tip });
    }
  };

  World3D.prototype.buildLanterns = function () {
    var M = this.M;
    this.lanternObjs = [];
    for (var i = 0; i < C.LANTERNS.length; i++) {
      var L = C.LANTERNS[i];
      var g = new T.Group();
      /* 灯笼留在世界坐标里，用逻辑挂点直接定位：全部退到三龛外侧
         （|x| >= 440），任何一尊财神的官帽都不会被灯笼压住。 */
      g.position.set(wx(L.x), 420, -150);
      g.scale.setScalar(1.15);
      this.scene.add(g);
      cyl(g, 2, 2, 26, 6, M.goldSoft, 0, 0, 0, false);
      var body = cyl(g, 20, 20, 38, 14, M.red, 0, -32, 0, true);
      body.scale.set(1.15, 1, 1.15);
      cyl(g, 14, 14, 4, 12, M.goldSoft, 0, -12, 0, true);
      cyl(g, 14, 14, 4, 12, M.goldSoft, 0, -52, 0, true);
      for (var t = 0; t < 5; t++) {
        var a = t * PI * 2 / 5;
        cyl(g, 1.2, 1.2, 24, 5, M.goldSoft,
          Math.cos(a) * 8, -66, Math.sin(a) * 8, false);
      }
      var glow = new T.Mesh(new T.SphereGeometry(24, 10, 8), M.redBright.clone());
      glow.material.transparent = true;
      glow.material.opacity = 0.18;
      glow.position.y = -32;
      g.add(glow);
      this.lanternObjs.push({ group: g, phase: L.phase, glow: glow });
    }
  };

  /* ---------- 卡通小人 ---------- */

  World3D.prototype.makeCharacter = function (outfit, name, showName) {
    var M = this.M;
    var g = new T.Group();
    this.scene.add(g);

    var sh = plane(g, 76, 44, M.shadow, 0, 0.7, 0);
    sh.rotation.x = -PI / 2;
    sh.renderOrder = 1;

    var robe = new T.Color(outfit.robe);
    var robeDark = new T.Color(outfit.robeDark);
    var robeMat = new T.MeshLambertMaterial({ color: robe });
    var darkMat = new T.MeshLambertMaterial({ color: robeDark });
    var trimMat = new T.MeshStandardMaterial({ color: new T.Color(outfit.trim), metalness: 0.55, roughness: 0.4, emissive: 0x2a1c05, emissiveIntensity: 0.3 });
    var skin = new T.MeshLambertMaterial({ color: 0xf5cfa6 });
    var hair = new T.MeshLambertMaterial({ color: 0x2b2622 });

    var pivot = new T.Group();
    g.add(pivot);

    var shadowMesh = sh;
    var body = cyl(pivot, 15, 27, 46, 14, robeMat, 0, 32, 0, true);
    var hem = new T.Mesh(new T.TorusGeometry(26, 3.4, 8, 20), trimMat);
    hem.rotation.x = PI / 2; hem.position.y = 10; pivot.add(hem);
    var belt = new T.Mesh(new T.TorusGeometry(16, 3, 8, 18), trimMat);
    belt.rotation.x = PI / 2; belt.position.y = 50; pivot.add(belt);
    var collar = cyl(pivot, 15, 18, 8, 12, darkMat, 0, 56, 0, true);

    var head = new T.Mesh(new T.SphereGeometry(16, 18, 14), skin);
    head.position.y = 74; head.castShadow = true; pivot.add(head);
    var cap = new T.Mesh(new T.SphereGeometry(16.5, 18, 12, 0, PI * 2, 0, PI * 0.56), hair);
    cap.position.y = 75; pivot.add(cap);
    var bun = new T.Mesh(new T.SphereGeometry(7, 10, 8), hair);
    bun.position.set(0, 89, -3); pivot.add(bun);
    var bunRing = new T.Mesh(new T.TorusGeometry(6, 1.6, 6, 12), trimMat);
    bunRing.rotation.x = PI / 2; bunRing.position.set(0, 88, -3); pivot.add(bunRing);

    var eyeMat = new T.MeshLambertMaterial({ color: 0x332a24 });
    var blushMat = new T.MeshLambertMaterial({ color: 0xe08b7d });
    for (var e = -1; e <= 1; e += 2) {
      var eye = new T.Mesh(new T.SphereGeometry(2.1, 8, 6), eyeMat);
      eye.position.set(e * 6, 76, 14.2); pivot.add(eye);
      var blush = new T.Mesh(new T.SphereGeometry(3.4, 8, 6), blushMat);
      blush.scale.set(1, 0.55, 0.4);
      blush.position.set(e * 10.5, 70, 12.5); pivot.add(blush);
    }
    var smile = new T.Mesh(new T.TorusGeometry(3.4, 0.9, 6, 12, PI), eyeMat);
    smile.position.set(0, 69.5, 15.2); smile.rotation.z = PI; pivot.add(smile);

    var arms = [];
    for (var a = -1; a <= 1; a += 2) {
      var arm = new T.Group();
      arm.position.set(a * 17, 50, 0);
      pivot.add(arm);
      var sleeve = cyl(arm, 7, 9, 30, 10, robeMat, a * 4, -12, 0, true);
      sleeve.rotation.z = a * 0.28;
      var hand = new T.Mesh(new T.SphereGeometry(5.4, 10, 8), skin);
      hand.position.set(a * 8, -27, 2); arm.add(hand);
      arms.push(arm);
    }
    var legs = [];
    for (var l = -1; l <= 1; l += 2) {
      var leg = new T.Group();
      leg.position.set(l * 9, 12, 0);
      pivot.add(leg);
      cyl(leg, 5, 5, 16, 8, darkMat, 0, -8, 0, true);
      var shoe = new T.Mesh(new T.SphereGeometry(6, 8, 6), hair);
      shoe.scale.set(1, 0.6, 1.5); shoe.position.set(0, -16, 3);
      leg.add(shoe);
      legs.push(leg);
    }

    var tag = null;
    if (showName && name) {
      var tagMat = new T.SpriteMaterial({ map: TEXTURES.nameTag(name), transparent: true, depthTest: false });
      tag = new T.Sprite(tagMat);
      tag.scale.set(96, 27, 1);
      tag.position.y = 112;
      tag.renderOrder = 10;
      g.add(tag);
    }

    return {
      group: g, pivot: pivot, body: body, head: head, arms: arms, legs: legs,
      tag: tag, shadow: shadowMesh, phase: Math.random() * 6
    };
  };

  World3D.prototype.buildCharacters = function () {
    this.playerChar = null;
    this.npcChars = [];
    this.npcPalettes = [C.OUTFITS[1], C.OUTFITS[2], C.OUTFITS[0]];
    this.npcNames = ['小满', '阿福', '招弟'];
    /* 同殿真人香客：以 client_id 复用角色，离殿时移除。 */
    this.remoteChars = {};
  };

  /* 远端香客离殿：共享材质不能 dispose，只移除 group 并释放独有的名牌贴图。 */
  World3D.prototype.disposeRemote = function (ch) {
    this.scene.remove(ch.group);
    if (ch.tag && ch.tag.material) {
      if (ch.tag.material.map && ch.tag.material.map.dispose) {
        ch.tag.material.map.dispose();
      }
      ch.tag.material.dispose();
    }
  };

  /* Sansa 式静默共处：云端同步来的真人香客与本地 NPC 同屏，
     但不聊天、不排名，只显示道号名牌与膜拜/合掌姿态。 */
  World3D.prototype.syncRemotes = function (remotes, dt, t) {
    var list = remotes || [];
    var seen = {};
    var busyNow = {};
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var id = s.client_id;
      if (!id) { continue; }
      seen[id] = true;
      var ch = this.remoteChars[id];
      if (!ch) {
        ch = this.makeCharacter(s.outfit || C.OUTFITS[0], s.name || '同殿香客', true);
        ch.showTag = true;
        ch.renderX = s.x;
        ch.renderY = s.y;
        this.remoteChars[id] = ch;
      }
      /* Sansa 式「满殿静坐」：坐下、叩拜或上香的香客吸附到最近的蒲团，
         该蒲团随即标记为占用（变暗），一排排垫子上有人坐着才看得出来。
         心跳只有 3 秒一次，吸附目标也走同一套平滑插值，不会瞬移。 */
      var tx = s.x, ty = s.y;
      if (s.pose === 'sit' || s.pose === 'worship' || s.pose === 'incense') {
        var snapR = (C.CUSHION_RADIUS || 26) + 24;
        var best = null, bd = snapR * snapR;
        for (var ci = 0; ci < this.cushionPos.length; ci++) {
          var cp = this.cushionPos[ci];
          var ddx = (cp.x + C.W / 2) - s.x, ddy = (cp.z + C.H / 2) - s.y;
          var dd = ddx * ddx + ddy * ddy;
          if (dd < bd) { bd = dd; best = cp; }
        }
        if (best) {
          busyNow[best.id] = true;
          tx = best.x + C.W / 2;
          ty = best.z + C.H / 2 + 8;
        }
      }
      var k = Math.min(1, dt * 5);
      ch.renderX += (tx - ch.renderX) * k;
      ch.renderY += (ty - ch.renderY) * k;
      this.poseCharacter(ch, {
        x: ch.renderX, y: ch.renderY,
        pose: s.pose, dir: s.dir, facing: s.facing, scale: s.scale
      }, t, false);
    }
    this.remoteBusy = busyNow;
    for (var key in this.remoteChars) {
      if (Object.prototype.hasOwnProperty.call(this.remoteChars, key) && !seen[key]) {
        this.disposeRemote(this.remoteChars[key]);
        delete this.remoteChars[key];
      }
    }
  };

  World3D.prototype.ensureCharacters = function (player, npcs) {
    if (!this.playerChar && player) {
      this.playerChar = this.makeCharacter(player.outfit, player.name, true);
    }
    while (this.npcChars.length < npcs.length) {
      var i = this.npcChars.length;
      this.npcChars.push(this.makeCharacter(this.npcPalettes[i % 3], this.npcNames[i % 3], false));
    }
  };

  World3D.prototype.poseCharacter = function (ch, s, t, isPlayer) {
    var g = ch.group, p = ch.pivot;
    g.position.set(wx(s.x), 0, wz(s.y));
    var sc = (s.scale || 1) * 1.22 * HALL_SCALE;
    g.scale.setScalar(sc);
    ch.shadow.scale.setScalar(1);

    var pose = s.pose || 'idle';
    /* 坐下、叩拜、上香用 player.facing（指向最近神龛的弧度），
       走动时才退回四方向枚举。 */
    var want;
    if (typeof s.facing === 'number' && isFinite(s.facing)) {
      want = s.facing;
    } else {
      var dirs = { down: 0, up: PI, left: -PI / 2, right: PI / 2 };
      want = dirs[s.dir] !== undefined ? dirs[s.dir] : 0;
    }
    var cur = p.rotation.y;
    var diff = want - cur;
    while (diff > PI) { diff -= PI * 2; }
    while (diff < -PI) { diff += PI * 2; }
    /* 定姿动作立即转正，避免软件渲染低帧率下转身还没转完就开始叩拜。 */
    var fixed = pose === 'sit' || pose === 'worship' || pose === 'incense';
    p.rotation.y = fixed ? cur + diff : cur + diff * 0.22;

    var bob = Math.sin(t * 2.1 + ch.phase) * 1.3;
    var walk = Math.sin(t * 9 + ch.phase);
    p.position.y = bob;
    p.rotation.x = 0;
    ch.body.scale.y = 1;
    ch.head.position.y = 74;
    ch.head.position.z = 0;
    ch.arms[0].rotation.set(0, 0, 0);
    ch.arms[1].rotation.set(0, 0, 0);
    ch.arms[0].position.set(-17, 50, 0);
    ch.arms[1].position.set(17, 50, 0);
    ch.legs[0].visible = true; ch.legs[1].visible = true;
    ch.legs[0].rotation.x = 0; ch.legs[1].rotation.x = 0;

    if (pose === 'walk') {
      ch.legs[0].rotation.x = walk * 0.55;
      ch.legs[1].rotation.x = -walk * 0.55;
      ch.arms[0].rotation.x = -walk * 0.42;
      ch.arms[1].rotation.x = walk * 0.42;
      p.position.y = Math.abs(walk) * 2.4;
    } else if (pose === 'sit') {
      ch.legs[0].visible = false; ch.legs[1].visible = false;
      p.position.y = -8;
      ch.body.scale.y = 0.82;
      ch.head.position.y = 63;
      ch.arms[0].rotation.x = -0.5;
      ch.arms[1].rotation.x = -0.5;
    } else if (pose === 'worship') {
      ch.legs[0].visible = false; ch.legs[1].visible = false;
      var bow = 0.35 + Math.abs(Math.sin(t * 3.4)) * 0.55;
      /* 落座后 pivot 已绕 Y 转到「脸朝殿内 -Z」。Euler XYZ 下 rotation.x
         是再绕世界 X 轴：必须取负角，头才往 -Z 低下去叩拜财神；
         取正角会变成仰头后倒，看起来像拜错方向。
         相机本身有约 38 度俯角，鞠躬角再压到 0.44 倍即可，
         过深会让后脑勺与袍身在俯视投影里叠成一个锥形、看不出人形。 */
      p.rotation.x = -bow * 0.44;
      p.position.y = -8 - bow * 4;
      ch.body.scale.y = 0.84;
      ch.head.position.y = 64;
      ch.head.position.z = bow * 6;
      ch.arms[0].rotation.z = 0.62; ch.arms[1].rotation.z = -0.62;
      ch.arms[0].position.set(-9, 50, 8);
      ch.arms[1].position.set(9, 50, 8);
    } else if (pose === 'incense') {
      ch.arms[0].rotation.z = 0.95; ch.arms[1].rotation.z = -0.95;
      ch.arms[0].rotation.x = -0.55; ch.arms[1].rotation.x = -0.55;
      /* 上香同样朝神龛微微前倾，不要仰头。 */
      p.rotation.x = -0.12;
    } else if (pose === 'greet') {
      /* 合掌致意：双手在胸前合十、微微躬身，这是同殿唯一的社交动作。 */
      ch.arms[0].rotation.z = 0.62; ch.arms[1].rotation.z = -0.62;
      ch.arms[0].position.set(-9, 50, 8);
      ch.arms[1].position.set(9, 50, 8);
      p.rotation.x = -0.06;
    } else {
      ch.arms[0].rotation.z = 0.08; ch.arms[1].rotation.z = -0.08;
    }

    /* 叩拜俯身时把名牌抬高，避免它盖在低下去的头顶上。
       玩家与同殿真人香客都显示道号；本地巡礼 NPC 不显示。 */
    if (ch.tag) {
      ch.tag.visible = !!isPlayer || !!ch.showTag;
      ch.tag.position.y = (pose === 'worship' || pose === 'incense') ? 138 : 112;
    }
  };

  /* ---------- 相机与坐标 ---------- */

  World3D.prototype.resize = function (cssW, cssH, portrait) {
    this.w = cssW; this.h = cssH;
    this.portrait = !!portrait;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(cssW, cssH, false);
    this.renderer.shadowMap.enabled = cssW < 700 ? true : true;
    this.updateCamera(0);
  };

  /* follow 为 true 时启用跟随镜头（进入场景后）；登录页仍是宏大全景。 */
  World3D.prototype.setFocus = function (lx, ly, follow) {
    var on = !!follow;
    /* 刚进场景时直接对齐，避免镜头从中心「飞」到出生点。 */
    if (on && !this.followOn) { this.followX = lx; this.followY = ly; }
    this.focusLx = lx;
    this.focusLy = ly;
    this.followOn = on;
  };

  World3D.prototype.updateCamera = function (dt) {
    var aspect = Math.max(0.2, this.w / Math.max(1, this.h));
    var portrait = this.portrait;
    var cam = this.camera;
    cam.aspect = aspect;

    this.parX += (this.targetParX - this.parX) * Math.min(1, dt * 3);
    this.parY += (this.targetParY - this.parY) * Math.min(1, dt * 3);

    if (this.followOn) {
      /* 跟随镜头：相机恒定挂在玩家正后上方，lookAt 锁在玩家身上。
         只平滑机位、不做边界钳制，所以角色无论走到外庭还是龛前，
         都稳定落在画面正中； parallax 在跟随模式下关闭以保证严格居中。 */
      /* 严格对齐、不做滞后平滑：低帧率下平滑会让人物明显偏离中心，
         而用户要的是「一直居中」。玩家坐标本身逐帧连续，直接跟随不会抖。 */
      this.followX = this.focusLx;
      this.followY = this.focusLy;
      var px = wx(this.followX);
      var pz = wz(this.followY);
      /* 机位比原先的固定全景更远、俯角更平：人物仍严格居中，
         但前方三龛金身、殿额与柱列都能完整落在画面里，不会把财神的头
         裁出视口。视野只在跟随模式下放宽，登录页仍是饱满的宏大构图。 */
      cam.fov = portrait ? 52 : 48;
      var camDist = portrait ? 1350 : 1250;
      var pitch = portrait ? 0.68 : 0.60;
      cam.position.set(px, Math.sin(pitch) * camDist + 90, pz + Math.cos(pitch) * camDist);
      cam.lookAt(px, 60, pz);
    } else {
      /* 登录页：保留殿宇放大后的宏大全景机位，鼠标可轻微改变观景角度。 */
      cam.fov = portrait ? 50 : 42;
      var dist = portrait ? 1860 : 1500;
      var pitch0 = portrait ? 1.00 : 0.70;
      var fx = portrait ? wx(clamp(this.focusLx, 260, 1340)) : 0;
      var ox = portrait ? 0 : this.parX * 34;
      var oy = portrait ? 0 : this.parY * 20;
      cam.position.set(fx + ox, Math.sin(pitch0) * dist + 90 + oy, Math.cos(pitch0) * dist - 50);
      cam.lookAt(fx + ox * 0.35, 100, -90);
    }
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  };

  World3D.prototype.screenToLogical = function (clientX, clientY) {
    var r = this.canvas.getBoundingClientRect();
    var nx = ((clientX - r.left) / r.width) * 2 - 1;
    var ny = -((clientY - r.top) / r.height) * 2 + 1;
    this.raycaster.setFromCamera(new T.Vector2(nx, ny), this.camera);
    var hit = this.raycaster.ray.intersectPlane(this.ground, this.tmpVec);
    if (!hit) { return null; }
    return { x: hit.x + C.W / 2, y: hit.z + C.H / 2 };
  };

  /* 逻辑坐标 -> 屏幕 CSS 像素；height 为离地高度（用于浮字与火花）。 */
  World3D.prototype.project = function (lx, ly, height) {
    var v = this.tmpVec2.set(wx(lx), height || 0, wz(ly));
    v.project(this.camera);
    var d = this.camera.position.distanceTo(new T.Vector3(wx(lx), height || 0, wz(ly)));
    return {
      x: (v.x * 0.5 + 0.5) * this.w,
      y: (-v.y * 0.5 + 0.5) * this.h,
      s: clamp(1250 / Math.max(200, d), 0.55, 1.6),
      behind: v.z > 1
    };
  };

  /* ---------- 每帧同步 ---------- */

  World3D.prototype.sync = function (scene, player, dt, t) {
    this.time = t;
    this.updateCamera(dt);
    var M = this.M;
    /* 先刷新同殿香客，占用着色才能用当帧的 remoteBusy；
       否则香客离殿那一帧蒲团会多暗一帧。 */
    this.syncRemotes(scene.remotes, dt, t);

    /* 蒲团高亮与占用：实例化网格 + 单环，150 个也只需 3 个 draw call。
       占用状态只在发生变化时刷新 instanceColor，不逐帧写 GPU。 */
    var hotIdx = -1, busyChanged = false;
    for (var ci2 = 0; ci2 < this.cushionPos.length; ci2++) {
      var cp = this.cushionPos[ci2];
      if (cp.id === scene.highlightId) { hotIdx = ci2; }
      var busy = !!scene.occupied[cp.id] ||
        !!(this.remoteBusy && this.remoteBusy[cp.id]);
      if (busy !== this.cushionBusy[ci2]) {
        this.cushionBusy[ci2] = busy;
        busyChanged = true;
      }
    }
    if (hotIdx >= 0) {
      this.cushionRing.visible = true;
      this.cushionRing.position.set(this.cushionPos[hotIdx].x, 4, this.cushionPos[hotIdx].z);
      this.cushionRing.material.opacity = 0.55 + Math.sin(t * 4) * 0.22;
      this.cushionRing.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
    } else {
      this.cushionRing.visible = false;
    }
    if (busyChanged) {
      var dim = new T.Color(0.70, 0.64, 0.55);
      var lit = new T.Color(1, 1, 1);
      for (var bi = 0; bi < this.cushionPos.length; bi++) {
        var col = this.cushionBusy[bi] ? dim : lit;
        this.cushionSideInst.setColorAt(bi, col);
        this.cushionTopInst.setColorAt(bi, col);
      }
      this.cushionSideInst.instanceColor.needsUpdate = true;
      this.cushionTopInst.instanceColor.needsUpdate = true;
    }

    /* 香炉：按当前香火数显隐香支 */
    var count = clamp(scene.incenseCount, 0, 9);
    for (var k = 0; k < this.incenseSticks.length; k++) {
      var on = k < count;
      this.incenseSticks[k].stick.visible = on;
      this.incenseSticks[k].tip.visible = on;
      if (on) {
        this.incenseSticks[k].tip.scale.setScalar(0.85 + Math.sin(t * 6 + k) * 0.18);
      }
    }
    this.censerLight.intensity = 1.25 + Math.sin(t * 3.1) * 0.2 + (count > 3 ? 0.25 : 0);

    /* 灯笼摆动、火焰跳动、背光呼吸 */
    for (var l = 0; l < this.lanternObjs.length; l++) {
      var lo = this.lanternObjs[l];
      lo.group.rotation.z = Math.sin(t * 1.25 + lo.phase) * 0.055;
      lo.glow.material.opacity = 0.14 + Math.sin(t * 3 + lo.phase) * 0.05;
    }
    if (this.flames) {
      for (var f = 0; f < this.flames.length; f++) {
        this.flames[f].scale.set(1, 0.82 + Math.sin(t * 9 + f * 1.7) * 0.2, 1);
      }
    }
    for (var h = 0; h < this.halos.length; h++) {
      this.halos[h].material.opacity = 0.30 + Math.sin(t * 1.6 + h * 0.9) * 0.07;
    }
    for (var mi = 0; mi < this.mists.length; mi++) {
      var mm = this.mists[mi];
      mm.mesh.position.x = mm.base + Math.sin(t * 0.08 + mi) * 160 + (t * mm.speed) % 300;
    }

    /* 角色：本地巡礼香客 + 云端同殿真人香客 + 玩家 */
    this.ensureCharacters(player, scene.npcs);
    for (var n = 0; n < scene.npcs.length; n++) {
      this.poseCharacter(this.npcChars[n], scene.npcs[n], t, false);
    }
    if (player && this.playerChar) {
      var view = player;
      /* 自己合掌时也做合十动作，但绝不打断叩拜 / 上香 / 走动状态机。 */
      if (scene.selfGreetUntil && Date.now() < scene.selfGreetUntil &&
          (player.pose === 'idle' || player.pose === 'sit')) {
        view = {
          x: player.x, y: player.y, pose: 'greet',
          dir: player.dir, facing: player.facing, scale: 1
        };
      }
      this.poseCharacter(this.playerChar, view, t, true);
    }
    void M;
  };

  World3D.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
  };

  CS.World3D = World3D;
})(window.CS);
