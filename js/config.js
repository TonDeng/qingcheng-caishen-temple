/* 财神庙互动场景：逻辑坐标与场景配置。
   本文件只保存数据，不绘制任何内容。
   逻辑平面宽 1600，纵深随 15 排蒲团拉长到 3480（允许超出 900 的平面）；
   殿内法堂、殿外庭院与山门沿同一条中轴依次展开，
   配合跟随镜头形成可一路从山门走到三龛的宏大纵深。 */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var W = 1600;
  var H = 900;

  /* 蒲团阵列：尺寸与间距整体翻倍后，每排严格 10 个（中轴御道左右各 5 个），
     共 15 排，精确 150 个。
     半径 26 → 52（直径 104），列距 74 → 148、行距 76 → 152，
     相邻净空隙由 22 / 24 放大到 44 / 48；中轴御道由 160 放宽到 216，
     香炉仍稳稳坐在御道中央，不压任何一只蒲团。
     15 排往后铺到 y=2543，殿内法堂与外庭因此整体向后拉深约 2 倍。 */
  var CUSHION_RADIUS = 52;
  var CUSHION_HIT = 60;
  var CUSHION_COL_GAP = 148;
  var CUSHION_ROW_GAP = 152;
  var CUSHION_ROWS = 15;
  var CUSHION_PER_ROW = 10;
  var CUSHION_ROW_START = 415;
  var CUSHION_WEST_START = 100;
  var CUSHION_EAST_START = 908;
  var AISLE_WIDTH = 216;

  var CUSHIONS = [];
  (function buildCushions() {
    var n = 0;
    function add(x, y, zone) {
      n += 1;
      CUSHIONS.push({ id: 'mat-' + n, x: x, y: y, zone: zone });
    }
    var half = CUSHION_PER_ROW / 2;
    for (var r = 0; r < CUSHION_ROWS; r++) {
      for (var c = 0; c < half; c++) {
        add(CUSHION_WEST_START + c * CUSHION_COL_GAP,
          CUSHION_ROW_START + r * CUSHION_ROW_GAP, 'west');
        add(CUSHION_EAST_START + c * CUSHION_COL_GAP,
          CUSHION_ROW_START + r * CUSHION_ROW_GAP, 'east');
      }
    }
  })();

  /* 香炉热点。玩家会先走到 stand 坐标，再执行上香动作。 */
  var CENSER = {
    id: 'censer',
    x: 800,
    y: 355,
    stand: { x: 800, y: 425 },
    radius: 40
  };

  /* 可行走矩形并集。角色中心必须落在其中某个矩形内。
     跟随镜头需要更长的走动距离，所以除殿内拜台外，再向外扩出
     龛前横廊、东西廊庑与殿前月台/外庭；各矩形之间留重叠带，保证连通。
     注意重叠带必须明显大于 canStand 的外框缓冲，否则交界处会出现
     站不住的窄缝（拜台→外庭、拜台→廊庑都曾因此卡住角色）。
     逻辑坐标可以超出 1600x900：wx()/wz() 会自然映射到更远的 3D 世界坐标，
     殿宇、蒲团、香炉和三龛的既有坐标因此完全不用改。 */
  var WALKABLE = [
    { x: 40, y: 300, w: 1520, h: 2350 },     /* 殿内法堂，15 排 150 个蒲团 */
    { x: 40, y: 170, w: 1520, h: 145 },      /* 龛前横廊，连通三座神龛 */
    { x: -250, y: 300, w: 300, h: 2350 },    /* 西廊庑 */
    { x: 1550, y: 300, w: 300, h: 2350 },    /* 东廊庑 */
    { x: -250, y: 2600, w: 2100, h: 880 },   /* 殿前月台与外庭，一直退到山门 */
    { x: -250, y: 170, w: 300, h: 130 },     /* 西后角 */
    { x: 1550, y: 170, w: 300, h: 130 }      /* 东后角 */
  ];

  /* 可行走范围的外接框：既是角色可达的最外边界，也用于 2D 回退的背景填充。
     15 排蒲团把法堂推到 y=2650，庭院与山门同步后移；外院青石一直铺到
     边界之外，终点是明确的门，而不是一片空地上的隐形墙。
     拜台与外庭在 y=2600..2650 留 50 单位重叠带，远大于 canStand 的 6 单位
     外接框缓冲，交界处不会出现「站不住的窄缝」。 */
  var WORLD = { minX: -250, maxX: 1850, minY: 170, maxY: 3480 };

  /* 殿内法堂与殿外庭院的分界（逻辑坐标 y）。
     参考 Sansa 清缘堂：殿内一整片铺满参拜垫的木地板，殿外才是青石庭院。
     殿门位于月台外侧，玩家越过这条线就算「出殿」。 */
  var HALL_FRONT = 2650;
  var GATE_Y = 3420;

  /* 圆形障碍：香炉本体，加上三龛须弥座，防止角色穿进金身里。
     半径已避开全部 150 个蒲团的落座点。 */
  var OBSTACLES = [
    { x: 800, y: 355, r: 40 },
    { x: 520, y: 150, r: 88 },
    { x: 800, y: 140, r: 96 },
    { x: 1080, y: 150, r: 88 }
  ];

  /* 出生点放在殿门外庭中段：镜头居中后，玩家回身能看见一整堂
     15 排参拜垫沿纵深铺开，往前几步就是殿门与三龛。 */
  var SPAWN = { x: 800, y: 2840 };
  var SPEED = 330;

  /* 三套可选服饰。颜色值为 CSS 颜色字符串。 */
  var OUTFITS = [
    { id: 'red', label: '红袍', robe: '#d8323c', robeDark: '#a71f2b', trim: '#ffd45e' },
    { id: 'gold', label: '金袍', robe: '#eaa72c', robeDark: '#b8781a', trim: '#fff0b8' },
    { id: 'jade', label: '青袍', robe: '#2f8f7e', robeDark: '#1f6659', trim: '#ffd45e' }
  ];

  /* 三座财神雕像。中间的雕像略大。落座朝向会指向最近的一龛。 */
  var STATUES = [
    { x: 520, y: 218, scale: 0.86, title: '中路财神', prop: 'ingot' },
    { x: 800, y: 210, scale: 1.0, title: '正财神', prop: 'ruyi' },
    { x: 1080, y: 218, scale: 0.86, title: '偏财神', prop: 'coin' }
  ];

  /* 灯笼挂点：一律退到三龛视线通廊之外，绝不压住财神头部。 */
  var LANTERNS = [
    { x: 160, y: 172, phase: 0.0 },
    { x: 260, y: 172, phase: 1.1 },
    { x: 360, y: 172, phase: 2.2 },
    { x: 1240, y: 172, phase: 0.7 },
    { x: 1340, y: 172, phase: 1.8 },
    { x: 1440, y: 172, phase: 2.9 }
  ];

  CS.Config = {
    W: W,
    H: H,
    CUSHIONS: CUSHIONS,
    CUSHION_RADIUS: CUSHION_RADIUS,
    CUSHION_HIT: CUSHION_HIT,
    CUSHION_COUNT: CUSHIONS.length,
    CUSHION_COL_GAP: CUSHION_COL_GAP,
    CUSHION_ROW_GAP: CUSHION_ROW_GAP,
    CUSHION_ROWS: CUSHION_ROWS,
    CUSHION_PER_ROW: CUSHION_PER_ROW,
    CUSHION_ROW_START: CUSHION_ROW_START,
    CUSHION_WEST_START: CUSHION_WEST_START,
    CUSHION_EAST_START: CUSHION_EAST_START,
    AISLE_WIDTH: AISLE_WIDTH,
    CENSER: CENSER,
    WALKABLE: WALKABLE,
    WORLD: WORLD,
    HALL_FRONT: HALL_FRONT,
    GATE_Y: GATE_Y,
    OBSTACLES: OBSTACLES,
    SPAWN: SPAWN,
    SPEED: SPEED,
    OUTFITS: OUTFITS,
    STATUES: STATUES,
    LANTERNS: LANTERNS,
    MAX_PARTICLES: 260
  };
})(window.CS);
