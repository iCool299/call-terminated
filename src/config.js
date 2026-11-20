// All balance numbers and key bindings live here so they are easy to tune.
export const CONFIG = {
  view: { w: 640, h: 360 },            // internal resolution, scaled to fit any screen (keeps pixels crisp)
  floor: { top: 226, bottom: 338 },    // walkable band (y of Zee's feet)

  zee: {
    maxHp: 100,
    walkSpeed: 62,                     // px/sec
    runSpeed: 128,
    depthSpeedFactor: 0.62,            // vertical (depth) movement is slower than sideways
    runThreshold: 0.82,                // touch joystick push needed to run
    jumpStartTime: 0.14,               // crouch before leaving the ground
    jumpVelocity: 250,
    gravity: 760,
    airControl: 0.85,
    dodgeDistance: 120,
    dodgeCooldown: 0.65,
    heavyCooldown: 0.9,
    specialCooldown: 6.0,
    makeupIdleDelay: 6.0,              // seconds standing still before the makeup idle plays
    invulnerabilityAfterHit: 0.9,
    knockdownHold: 0.7,                // seconds lying on the floor before getting up
    // forward step (px) during the swing of each attack
    lunge: { punch_1: 22, punch_2: 26, punch_3: 40, heavy: 34, special: 16, jump_kick: 0 },
  },

  windupSpeed: 1.6,        // wind-up frames (before the first hit frame) play this much faster
  simStep: 1 / 120,        // fixed logic step (seconds); rendering runs at the display refresh rate

  keys: {
    left:    ['ArrowLeft', 'a', 'A'],
    right:   ['ArrowRight', 'd', 'D'],
    up:      ['ArrowUp', 'w', 'W'],
    down:    ['ArrowDown', 's', 'S'],
    run:     ['Shift'],
    light:   ['j', 'J'],
    heavy:   ['k', 'K'],
    dodge:   ['l', 'L'],
    special: [' '],
    jump:    ['i', 'I'],
    interact:['e', 'E'],
    pause:   ['Escape', 'p', 'P'],
    // developer shortcuts to preview reactions
    dev_hurt: ['1'], dev_knockdown: ['2'], dev_defeat: ['3'], dev_victory: ['4'], dev_revive: ['r', 'R'],
  },
};
