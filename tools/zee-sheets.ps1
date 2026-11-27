# v2 (more frames) sheets. Cfg name file frames rows standH.
# StandH = Zee's standing height in source pixels for that sheet. Measured, not eyeballed: each sheet is scaled halfway between matching her HEAD size
# and matching her BODY length (face-to-feet, allowing for the pose: a run is lower than a stand). The generator drew some sheets with a
# bigger head for the body, so matching only one of them made her shrink or grow; halfway keeps both changes small and smooth.
$sheets = @(
    (Cfg 'idlemk'      'idlemk_side_v1.png' 16 4 -1),     # row 1 = idle breathing loop, rows 2-4 = makeup; ONE drawing so both are the same size and look
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
# front / back sheets. StandH per sheet comes from tools/zee-views.json (-1 = the first frame stands as tall as the side idle)
$views = Get-Content (Join-Path $PSScriptRoot 'zee-views.json') -Raw | ConvertFrom-Json
$sheets += (Cfg 'walk_front' 'walk_front_v1.png' 12 3 ([double]$views.'walk_front'))
$sheets += (Cfg 'run_front' 'run_front_v1.png' 12 3 ([double]$views.'run_front'))
$sheets += (Cfg 'jump_front' 'jump_front_v1.png' 12 3 ([double]$views.'jump_front'))
$sheets += (Cfg 'punch_1_front' 'punch_1_front_v2.png' 10 2 ([double]$views.'punch_1_front'))
$sheets += (Cfg 'punch_2_front' 'punch_2_front_v2.png' 10 2 ([double]$views.'punch_2_front'))
$sheets += (Cfg 'punch_3_front' 'punch_3_front_v2.png' 12 3 ([double]$views.'punch_3_front'))
$sheets += (Cfg 'jump_kick_front' 'jump_kick_front_v1.png' 8 2 ([double]$views.'jump_kick_front'))
$sheets += (Cfg 'dodge_front' 'dodge_front_v2.png' 12 3 ([double]$views.'dodge_front'))
$sheets += (Cfg 'walk_back' 'walk_back_v1.png' 12 3 ([double]$views.'walk_back'))
$sheets += (Cfg 'run_back' 'run_back_v1.png' 12 3 ([double]$views.'run_back'))
$sheets += (Cfg 'jump_back' 'jump_back_v1.png' 12 3 ([double]$views.'jump_back'))
$sheets += (Cfg 'punch_1_back' 'punch_1_back_v2.png' 10 2 ([double]$views.'punch_1_back'))
$sheets += (Cfg 'punch_2_back' 'punch_2_back_v2.png' 10 2 ([double]$views.'punch_2_back'))
$sheets += (Cfg 'punch_3_back' 'punch_3_back_v2.png' 12 3 ([double]$views.'punch_3_back'))
$sheets += (Cfg 'jump_kick_back' 'jump_kick_back_v1.png' 8 2 ([double]$views.'jump_kick_back'))
$sheets += (Cfg 'dodge_back' 'dodge_back_v1.png' 12 3 ([double]$views.'dodge_back'))

$sheets += (Cfg 'idlemk_front' 'idlemk_front_v1.png' 16 4 -1)
$sheets += (Cfg 'idlemk_back' 'idlemk_back_v1.png' 16 4 -1)
