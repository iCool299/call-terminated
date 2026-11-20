// All balance numbers and key bindings live here so they are easy to tune.
export const CONFIG = {
  view: { w: 640, h: 360 },            // internal resolution, scaled to fit any screen (keeps pixels crisp)
  floor: { top: 226, bottom: 338 },    // walkable band (y of Zee's feet)

  zee: {
    maxHp: 100,
    walkSpeed: 130,                    // px/sec (game is 640 wide, so a walk crosses the screen in ~5 s)
    runSpeed: 260,
    depthSpeedFactor: 0.62,            // vertical (depth) movement is slower than sideways
    runThreshold: 0.82,                // touch joystick push needed to run
    jumpStartTime: 0.10,              // crouch before leaving the ground
    jumpVelocity: 700,                // full jump (button held): about 115 px high (her whole height), ~0.65 s in the air
    jumpCutVelocity: 500,             // letting go early caps the rise at this speed, so even a tap is a ~58 px hop
    gravity: 2150,
    airControl: 0.85,
    dodgeDistance: 120,
    dodgeCooldown: 0.65,
    specialCooldown: 30.0,             // Printout Barrage recharges every 30 s
    makeupIdleDelay: 2.5,             // seconds standing still before the makeup idle plays
    invulnerabilityAfterHit: 0.9,
    knockdownHold: 0.7,                // seconds lying on the floor before getting up
    // forward step (px) during the swing of each attack
    lunge: { punch_1: 22, punch_2: 26, punch_3: 40, special: 0, jump_kick: 0 },
    // Printout Barrage: sheets of paper fired forward during the special's hit frames
    barrage: { speed: 330, life: 0.9, perFrame: 2, spread: 22, damage: 12 },
    // melee hits: damage, reach (px in front of her), knock = sends the enemy to the floor
    attacks: {
      punch_1:   { dmg: 8,  reach: 56, knock: false },
      punch_2:   { dmg: 9,  reach: 58, knock: false },
      punch_3:   { dmg: 15, reach: 64, knock: true },
      jump_kick: { dmg: 12, reach: 60, knock: true },
    },
    escapeMash: 9,                     // button presses while grabbed to break free
  },

  enemy: {
    hp: 60,
    walkSpeed: 78,
    attackRange: 46,                   // how close they stand to attack
    engageY: 12,                       // how well they line up in depth before attacking
    punchDmg: 6, kickDmg: 8,
    headsetDmg: 8, headsetSpeed: 250,  // thrown call-centre headset (jump over it!)
    grabRange: 54, grabChance: 0.35,   // grabbers (navy, sporty) try to grab Zee this often
    throwDamagePct: 0.2,               // being thrown costs this share of Zee's max HP
    throwSpeed: 300, throwLift: 520,
    cooldown: [0.9, 1.8],              // seconds between attacks
    keepDistance: 190,                 // headset throwers like to stay about this far away
    corpseTime: 1.8,
  },

  windupSpeed: 1.4,       // wind-up frames (before the first hit frame) play this much faster
  simStep: 1 / 120,        // fixed logic step (seconds); rendering runs at the display refresh rate

  keys: {
    left:    ['ArrowLeft', 'a', 'A'],
    right:   ['ArrowRight', 'd', 'D'],
    up:      ['ArrowUp', 'w', 'W'],
    down:    ['ArrowDown', 's', 'S'],
    run:     ['Shift'],
    light:   ['j', 'J'],
    dodge:   ['l', 'L'],
    special: [' '],
    jump:    ['i', 'I'],
    interact:['e', 'E'],
    pause:   ['Escape', 'p', 'P'],
    // developer shortcuts to preview reactions
    dev_hurt: ['1'], dev_knockdown: ['2'], dev_defeat: ['3'], dev_victory: ['4'], dev_revive: ['r', 'R'],
  },
};
