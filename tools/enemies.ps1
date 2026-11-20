# The 8 enemies. id -> master sprite, height in game units (Zee = 132), and whether they can grab and throw Zee.
# Raw ChatGPT sheets live in sprites/agents/raw/<id>_<sheet>.png ; build with: tools\build-enemy.ps1 -Id navy
$enemies = [ordered]@{
    navy    = @{ master = 'sprites\agents\good_male_brown\good_male_brown_master_v3.png';     H = 152; grab = $true  }   # tall muscular suit man
    polo    = @{ master = 'sprites\agents\good_male_white\good_male_white_master_v2.png';     H = 112; grab = $false }   # short round polo man
    plum    = @{ master = 'sprites\agents\good_female_hijab\good_female_hijab_master_v2.png'; H = 128; grab = $false }   # plum suit, turban hijab
    cream   = @{ master = 'sprites\agents\good_female_nohijab\good_female_nohijab_master_v4.png'; H = 150; grab = $false } # tall slim, black bob, mustard hoodie + jeans
    fighter = @{ master = 'sprites\agents\bad_male_brown\bad_male_brown_master_v2.png';      H = 130; grab = $false }   # street fighter, headband
    gangly  = @{ master = 'sprites\agents\bad_male_white\bad_male_white_master_v2.png';      H = 148; grab = $false }   # thin hunched
    sporty  = @{ master = 'sprites\agents\bad_female_hijab\bad_female_hijab_master_v3.png';  H = 118; grab = $true  }   # short sturdy sport-hijab woman
    curvy   = @{ master = 'sprites\agents\bad_female_nohijab\bad_female_nohijab_master_v1.png'; H = 138; grab = $false } # curvy curly hair
}

# Sheets: name, frames, grid rows. Every sheet starts with the neutral standing pose (used to calibrate its scale automatically).
function Get-EnemySheets($grab) {
    $s = @(
        @{ name = 'a'; n = 16; rows = 4 },    # idle 8 + walk 8
        @{ name = 'b'; n = 16; rows = 4 },    # punch 8 + kick 8
        @{ name = 'c'; n = 16; rows = 4 },    # hurt 4 + knockdown 6 + get_up 6
        @{ name = 'd'; n = 16; rows = 4 }     # defeat 8 + (throw headset 8 | grab 8)
    )
    if ($grab) { $s += @{ name = 'e'; n = 12; rows = 3 } }    # throw Zee (lift, wind-up, throw, recover)
    return $s
}

# Game animations: name -> sheet, from, to (frame numbers in the strip), fps, loop; active/release = frame indexes INSIDE the animation (0-based)
function Get-EnemyAnims($grab) {
    $a = @(
        @{ name = 'idle';      strip = 'a'; from = 0;  to = 7;  fps = 8;  loop = $true },
        @{ name = 'walk';      strip = 'a'; from = 8;  to = 15; fps = 12; loop = $true },
        @{ name = 'punch';     strip = 'b'; from = 0;  to = 7;  fps = 22; loop = $false; active = @(3, 4) },
        @{ name = 'kick';      strip = 'b'; from = 8;  to = 15; fps = 22; loop = $false; active = @(3, 4) },
        @{ name = 'hurt';      strip = 'c'; from = 0;  to = 3;  fps = 14; loop = $false },
        @{ name = 'knockdown'; strip = 'c'; from = 4;  to = 9;  fps = 14; loop = $false },
        @{ name = 'get_up';    strip = 'c'; from = 10; to = 15; fps = 12; loop = $false },
        @{ name = 'defeat';    strip = 'd'; from = 0;  to = 7;  fps = 10; loop = $false }
    )
    if ($grab) {
        $a += @{ name = 'grab';  strip = 'd'; from = 8; to = 15; fps = 16; loop = $false; active = @(2, 3) }   # lunge, catch, lift Zee
        $a += @{ name = 'throw'; strip = 'e'; from = 0; to = 11; fps = 16; loop = $false; release = @(6, 7) }    # overhead, wind-up, throw
    } else {
        $a += @{ name = 'throw_headset'; strip = 'd'; from = 8; to = 15; fps = 18; loop = $false; release = @(3, 4) }
    }
    return $a
}
