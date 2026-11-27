# v2 (more frames) sheets. Cfg name file frames rows standH.
# StandH = Zee's standing height in source pixels for that sheet. Measured, not eyeballed: each sheet is scaled halfway between matching her HEAD size
# and matching her BODY length (face-to-feet, allowing for the pose: a run is lower than a stand). The generator drew some sheets with a
# bigger head for the body, so matching only one of them made her shrink or grow; halfway keeps both changes small and smooth.
$sheets = @(
    (Cfg 'idle'        'idle_v4.png'        12 3 323),
    (Cfg 'idle_front'  'idle_front_v1.png'  12 3 -1),     # facing the camera   (-1: scaled so its first frame stands as tall as the side idle)
    (Cfg 'idle_back'   'idle_back_v1.png'   12 3 -1),     # facing away
    (Cfg 'idle_makeup' 'idle_makeup_v4.png' 16 4 282),
    (Cfg 'walk'        'walk_v4.png'        12 3 311),
    (Cfg 'run'         'run_v4.png'         12 3 347),
    (Cfg 'jump'        'jump_v4.png'        12 3 327),
    (Cfg 'punch_1'     'punch_1_v4.png'     10 2 359),
    (Cfg 'punch_2'     'punch_2_v4.png'     10 2 350),
    (Cfg 'punch_3'     'punch_3_v4.png'     12 3 349),
    (Cfg 'jump_kick'   'jump_kick_v4.png'    8 2 402),
    (Cfg 'dodge'       'dodge_v4.png'       12 3 338),
    (Cfg 'special'     'special_v4.png'     16 4 290),
    (Cfg 'hurt'        'hurt_v4.png'         6 2 514),
    (Cfg 'knockdown'   'knockdown_v4.png'   12 3 323),
    (Cfg 'get_up'      'get_up_v4.png'      12 3 340),
    (Cfg 'victory'     'victory_v4.png'     12 3 320),
    (Cfg 'interact'    'interact_v4.png'     8 2 386),
    (Cfg 'prone'       'prone_v4.png'       16 4 -1)    # frame 1 = neutral standing (scale only); 2-6 flight face-down, 7-8 belly flop, 9-10 lying, 11-16 get up from the floor
)
($sheets | Where-Object { $_.Name -eq 'knockdown' }).FrameMul = [double[]]@(1.226, 1.216, 1.206, 1.166, 1.186, 1.136, 1.146, 1.146, 1.136, 1.106, 1.086, 1.116)
($sheets | Where-Object { $_.Name -eq 'idle_makeup' }).ShiftX = 2      # her silhouette sat 2 px left of the idle's: lined up so the two blend
