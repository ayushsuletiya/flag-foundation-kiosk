MONUMENTAL FLAGS
================
intro/           intro.mp4 plays ONCE when the category opens (about 5s),
                 then the map appears. poster.png shows if the video is
                 missing or still loading.
map/background/  bg.mp4 (full-screen loop) OR bg.png — the India terrain
                 under the political map.
map/states/      the per-state map artwork and tap shapes. DO NOT TOUCH —
                 positions are calibrated in code.
map/flag-marker/ the waving flag marker: static.png today; drop numbered
                 frames f_0001.png, f_0002.png... (transparent, ~62x117 on
                 screen) to make it wave. No code change needed.
select-state/background/  bg.mp4 OR bg.png behind the "Select State" overlay.
installations/   one FOLDER per flag site, named by its row number in the
                 Excel "04 - Flag Installations" tab. Inside each folder:
                 1.jpg (the cover photo), then optionally 2.jpg, 3.jpg ...
                 With 2 or more photos the site's Know More screen shows
                 them as an auto-playing carousel with dots. Example:
                   installations/147/1.jpg
                   installations/147/2.jpg
                 (npm run mirror:photos downloads each site's Photo URL
                 into <row>/1.jpg automatically.)
