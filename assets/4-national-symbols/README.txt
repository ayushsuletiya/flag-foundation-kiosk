NATIONAL SYMBOLS
================
carousel-background/  bg.mp4 OR bg.png — the navy stage behind the symbol
                      carousel (wide, ~2113x1056 or 1920x1080).
detail-background/    bg.mp4 OR bg.png — the podium stage on the symbol
                      detail screen.
symbols/              one folder per symbol (tiger, peacock, lotus, mango,
                      flag, ganga, indian-elephant, indian-banyan,
                      indian-rupee, lion-capital-of-ashoka,
                      ganges-river-dolphin, jana-gana-mana, vande-mataram,
                      saka-calendar). Inside each:

  turntable/          static.png (poster) + optionally f_0001.png ...
                      f_0107.png rotation frames (460x818, transparent).
                      Drop frames next to static.png and the turntable
                      plays automatically.

  did-you-know/       1.png, 2.png, 3.png ... — photos for the "Did You
                      Know" card. Any number works: the card cycles them
                      as the visitor pages through the facts (more facts
                      than photos or more photos than facts is fine).
                      No folder / empty folder = the card reuses the
                      symbol's cutout image.
