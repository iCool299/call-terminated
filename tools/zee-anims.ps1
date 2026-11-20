# v2 game-facing animation table (higher frame counts). from/to are 0-based inclusive frame indexes in the strip.
# 'active' = frames that can hit, 'iframes' = invulnerable frames, loopFrom = frame a looping animation returns to.
$anims = @(
    @{ name='idle';        strip='idle';        from=0; to=11; fps=10; loop=$true },
    @{ name='idle_makeup'; strip='idle_makeup'; from=0; to=15; fps=6.5; loop=$false },
    @{ name='walk';        strip='walk';        from=0; to=11; fps=12; loop=$true },
    @{ name='run';         strip='run';         from=0; to=11; fps=22; loop=$true },
    @{ name='jump_start';  strip='jump';        from=0; to=2;  fps=30; loop=$false },
    @{ name='jump_rise';   strip='jump';        from=3; to=5;  fps=15; loop=$false },
    @{ name='jump_fall';   strip='jump';        from=6; to=8;  fps=15; loop=$false },
    @{ name='jump_land';   strip='jump';        from=9; to=11; fps=26; loop=$false },
    @{ name='punch_1';     strip='punch_1';     from=0; to=9;  fps=26; loop=$false; active=@(4,5) },
    @{ name='punch_2';     strip='punch_2';     from=0; to=9;  fps=26; loop=$false; active=@(5,6) },
    @{ name='punch_3';     strip='punch_3';     from=0; to=11; fps=24; loop=$false; active=@(5,6,7) },
    @{ name='jump_kick';   strip='jump_kick';   from=0; to=7;  fps=20; loop=$false; active=@(4,5) },
    @{ name='dodge';       strip='dodge';       from=0; to=11; fps=24; loop=$false; iframes=@(2,3,4,5,6,7,8) },
    @{ name='special';     strip='special';     from=0; to=15; fps=20; loop=$false; active=@(6,7,8,9,10) },
    @{ name='hurt';        strip='hurt';        from=0; to=5;  fps=18; loop=$false },
    @{ name='knockdown';   strip='knockdown';   from=0; to=11; fps=16; loop=$false },
    @{ name='get_up';      strip='get_up';      from=0; to=11; fps=16; loop=$false; iframes=@(0,1,2,3,4,5,6,7,8,9,10,11) },
    @{ name='defeat';      strip='defeat';      from=0; to=11; fps=12; loop=$false },
    @{ name='victory';     strip='victory';     from=0; to=11; fps=10; loop=$true; loopFrom=6 },
    @{ name='interact';    strip='interact';    from=0; to=7;  fps=14; loop=$false }
)
