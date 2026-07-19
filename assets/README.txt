FLAG FOUNDATION KIOSK — MEDIA FOLDERS
=====================================

One numbered folder per kiosk category, in on-screen order:

  0-home                home screen (background video, category cards, logo)
  1-monumental-flags    Monumental Flags (intro, map, installation photos)
  2-history-of-tiranga  History of Tiranga (one folder per year, 1857-1947)
  3-ashok-chakra        Ashok Chakra
  4-national-symbols    National Symbols (backgrounds, turntables)
  _shared               fonts + icons used everywhere — do not modify

THE BACKGROUND RULE (same everywhere)
-------------------------------------
Every folder called "background" accepts EITHER a video OR pictures.
Drop ONE of these and the app uses it automatically — no renaming, no
technical steps:

  bg.mp4                    a looping video (1920x1080, H.264, no audio)
  bg.png                    a single picture (1920x1080)
  bg-1.png ... bg-5.png     several pictures — the app slowly crossfades them

If both exist, the VIDEO wins. An optional poster.png shows while a video
loads. Each category folder has its own README.txt with exact sizes.

GENERAL RULES
-------------
- File names: exactly as documented, all lowercase, no spaces, no emoji.
- After swapping files, restart the kiosk app (or reload) to see changes.
- Never put text into images that should stay editable — all wording lives
  in data/content.xlsx.
