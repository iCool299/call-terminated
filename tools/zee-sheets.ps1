# One line per accepted raw sheet: name, file, frame count, grid rows, standing-height calibration (source px, 0 = auto).
# The generator did not always honor the requested size, so each sheet is calibrated by comparing matching poses and head size.
$sheets = @(
    (Cfg 'idle'        'idle_v1.png'        8 2 395),
    (Cfg 'idle_makeup' 'idle_makeup_v1.png' 8 2 395),
    (Cfg 'walk'        'walk_v1.png'        8 2 395),
    (Cfg 'run'         'run_v1.png'         8 2 395),
    (Cfg 'jump'        'jump_v1.png'        8 2 296),
    (Cfg 'punch_1'     'punch_1_v1.png'     6 2 420),
    (Cfg 'punch_2'     'punch_2_v1.png'     6 2 420),
    (Cfg 'punch_3'     'punch_3_v1.png'     6 2 420),
    (Cfg 'heavy'       'heavy_v1.png'       8 2 400),
    (Cfg 'jump_kick'   'jump_kick_v1.png'   6 2 350),
    (Cfg 'dodge'       'dodge_v1.png'       6 2 380),
    (Cfg 'special'     'special_v1.png'     8 2 380),
    (Cfg 'hurt'        'hurt_v1.png'        4 1 560),
    (Cfg 'knockdown'   'knockdown_v1.png'   6 2 410),
    (Cfg 'get_up'      'get_up_v1.png'      6 2 395),
    (Cfg 'defeat'      'defeat_v1.png'      8 2 350),
    (Cfg 'victory'     'victory_v1.png'     8 2 372),
    (Cfg 'interact'    'interact_v1.png'    6 2 416)
)
