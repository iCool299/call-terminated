# Per-sheet calibration: StandH = height (in SOURCE pixels) a standing Zee would have in that sheet.
# Sheets come from different generations, so their raw character sizes differ; this normalizes them.
$standH = @{
    'idle' = 590; 'idle_makeup' = 543; 'walk' = 580; 'run' = 560
    'punch_1' = 585; 'punch_2' = 625; 'hurt' = 900
}
foreach ($c in $cfgs) { if ($standH.ContainsKey($c.Name)) { $c.StandH = $standH[$c.Name] } }
