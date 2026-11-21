// All balance numbers and key bindings live here so they are easy to tune.
export const CONFIG = {
  view: { w: 640, h: 360 },            // the SCREEN (canvas) in logical units: the HUD is laid out in this space and never zooms
  // CAMERA: the world is drawn through a zoomed-out camera. zoom = view.w / viewW (about 0.71), so 900 x 506 world units are visible
  // and rendered into the 640 x 360 screen. Characters keep their world size (Zee is ~132 units tall): the camera makes them smaller.
  camera: { viewW: 900, lookAhead: 56, follow: 6 },
  // WORLD (506 units tall): Y 0-205 upper architecture, Y 205-325 furniture / doors / wall details, Y 325-485 the floor band.
  floor: { top: 325, bottom: 485 },    // walkable band: the y of the characters' FEET, in world units

  zee: {
    maxHp: 100,
    walkSpeed: 130,                    // world units / sec (the view is 900 wide, so a walk crosses it in ~7 s)
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
    proneHold: 1.1,                    // seconds lying face-down after a throw before she gets up
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
    hp: 100,                           // every enemy
    heavyHp: 140,                      // the two heavies (navy + sporty)
    heavyDmgMul: 1.4,                  // heavies hit 40% harder
    hitCool: 0.5,                      // after a flinch, light hits can't flinch them again for this long (no stun-lock)
    maxAttackers: 2,                   // at most this many attack at once (the rest circle and flank); 3 when the room is crowded
    walkSpeed: 96,
    attackRange: 46,                   // how close they stand to attack
    engageY: 12,                       // how well they line up in depth before attacking
    punchDmg: 9, kickDmg: 12,
    headsetDmg: 10, headsetSpeed: 270, // thrown call-centre headset (jump over it!)
    grabRange: 56, grabChance: 0.4,    // grabbers (navy, sporty) try to grab Zee this often
    throwDamagePct: 0.2,               // being thrown costs this share of Zee's max HP
    throwSpeed: 300, throwLift: 520,
    holdTime: 1.0,                     // seconds he holds her overhead (mash buttons to break free) before throwing
    cooldown: [0.45, 1.1],             // seconds between attacks
    keepDistance: 190,                 // headset throwers like to stay about this far away
    corpseTime: 1.8,
  },

  // Special is EARNED by fighting (hits charge it), not by waiting. Values are a share of a full meter.
  special: { perHit: 0.07, perKnock: 0.10, perKill: 0.15, perHurt: 0.05, trickle: 1 / 150 },   // trickle: share per second even with nobody to hit
  // Escalation: keep landing hits without being hit and the fight escalates (3 levels): Zee hits harder and charges her special
  // faster, the enemies attack more often. Getting hit costs one level; going quiet drains it slowly.
  escalation: { max: 3, perHit: 0.07, perKnock: 0.12, perKill: 0.2, hurtLoss: 1, idleAfter: 3.5, decay: 0.12, zeeDmg: 0.10, chargeBonus: 0.25, enemyAggr: 0.12 },
  // Iced coffee: sometimes dropped by a defeated enemy (more likely from heavies, and when Zee is low); walk over it to heal.
  coffee: { chance: 0.25, chanceLow: 0.45, lowHpPct: 0.4, heavyBonus: 0.15, heal: 30, life: 12, maxOnFloor: 2, pickupX: 20, pickupY: 14 },

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

CONFIG.camera.zoom = CONFIG.view.w / CONFIG.camera.viewW;      // 0.711
CONFIG.camera.viewH = CONFIG.view.h / CONFIG.camera.zoom;      // 506.25
