# v2 (more frames) sheets. Cfg name file frames rows standH.
# StandH = Zee's standing height in source pixels for that sheet (measured from guard/idle frames; the generator keeps one pixel scale per sheet).
$sheets = @(
    (Cfg 'idle'        'idle_v4.png'        12 3 323),
    (Cfg 'idle_makeup' 'idle_makeup_v4.png' 16 4 277),
    (Cfg 'walk'        'walk_v4.png'        12 3 323),
    (Cfg 'run'         'run_v4.png'         12 3 323),
    (Cfg 'jump'        'jump_v4.png'        12 3 323),
    (Cfg 'punch_1'     'punch_1_v4.png'     10 2 353),
    (Cfg 'punch_2'     'punch_2_v4.png'     10 2 353),
    (Cfg 'punch_3'     'punch_3_v4.png'     12 3 346),
    (Cfg 'jump_kick'   'jump_kick_v4.png'    8 2 390),
    (Cfg 'dodge'       'dodge_v4.png'       12 3 323),
    (Cfg 'special'     'special_v4.png'     16 4 275),
    (Cfg 'hurt'        'hurt_v4.png'         6 2 460),
    (Cfg 'knockdown'   'knockdown_v4.png'   12 3 323),
    (Cfg 'get_up'      'get_up_v4.png'      12 3 323),
    (Cfg 'victory'     'victory_v4.png'     12 3 323),
    (Cfg 'interact'    'interact_v4.png'     8 2 387),
    (Cfg 'prone'       'prone_v4.png'       16 4 -1)    # frame 1 = neutral standing (scale only); 2-6 flight face-down, 7-8 belly flop, 9-10 lying, 11-16 get up from the floor
)


