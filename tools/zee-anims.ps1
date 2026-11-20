# Game-facing animation table for Zee. Each entry maps a game animation to frames of a generated strip.
# from/to are 0-based inclusive frame indexes in the strip. 'active' = frames that can hit (for combat later),
# 'iframes' = invulnerable frames, 'loopFrom' = frame to loop back to when the animation loops (default 0).
$anims = @(
    @{ name='idle';        strip='idle';        from=0; to=7; fps=6;  loop=$true },
    @{ name='idle_makeup'; strip='idle_makeup'; from=0; to=7; fps=8;  loop=$false },
    @{ name='walk';        strip='walk';        from=0; to=7; fps=11; loop=$true },
    @{ name='run';         strip='run';         from=0; to=7; fps=14; loop=$true },
    @{ name='jump_start';  strip='jump';        from=0; to=1; fps=12; loop=$false },
    @{ name='jump_rise';   strip='jump';        from=2; to=3; fps=10; loop=$false },
    @{ name='jump_fall';   strip='jump';        from=4; to=5; fps=10; loop=$false },
    @{ name='jump_land';   strip='jump';        from=6; to=7; fps=14; loop=$false },
    @{ name='punch_1';     strip='punch_1';     from=0; to=5; fps=16; loop=$false; active=@(3,4) },
    @{ name='punch_2';     strip='punch_2';     from=0; to=5; fps=16; loop=$false; active=@(3,4) },
    @{ name='punch_3';     strip='punch_3';     from=0; to=5; fps=14; loop=$false; active=@(3,4) },
    @{ name='heavy';       strip='heavy';       from=0; to=7; fps=12; loop=$false; active=@(4,5) },
    @{ name='jump_kick';   strip='jump_kick';   from=0; to=5; fps=12; loop=$false; active=@(3,4) },
    @{ name='dodge';       strip='dodge';       from=0; to=5; fps=14; loop=$false; iframes=@(1,2,3,4) },
    @{ name='special';     strip='special';     from=0; to=7; fps=12; loop=$false; active=@(5,6) },
    @{ name='hurt';        strip='hurt';        from=0; to=3; fps=10; loop=$false },
    @{ name='knockdown';   strip='knockdown';   from=0; to=5; fps=10; loop=$false },
    @{ name='get_up';      strip='get_up';      from=0; to=5; fps=10; loop=$false; iframes=@(0,1,2,3,4,5) },
    @{ name='defeat';      strip='defeat';      from=0; to=7; fps=8;  loop=$false },
    @{ name='victory';     strip='victory';     from=0; to=7; fps=8;  loop=$true; loopFrom=4 },
    @{ name='interact';    strip='interact';    from=0; to=5; fps=10; loop=$false }
)
