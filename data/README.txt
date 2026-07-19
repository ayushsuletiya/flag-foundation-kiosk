KIOSK CONTENT — content.xlsx
============================
ALL text on every kiosk screen lives in this one workbook. It is kept
separate from assets/ on purpose: media files are drag-and-drop, while
wording is edited here in Excel. Save the file and the running kiosk
reloads it automatically (hot reload). Column matching is BY HEADER NAME,
so columns may be reordered but headers must not be renamed.

Tabs and what they feed:
  00 - Overview            notes for editors (not shown on screen)
  01 - Home Menu           the 4 category tiles' titles
  03 - NS Identity         National Symbols: name, title, milestone chips
  03b - NS Carousel        National Symbols: Did You Know fact cards
  04 - Flag Installations  Monumental Flags: all 219 sites (the "#" column
                           number = the site's photo folder name under
                           assets/1-monumental-flags/installations/)
  05 - History Timeline    History: year, titles, main copy per year
  05b - History Know More  History: Know More heading, bullets, description
  05c - Flag Code & Rights legal milestones 1950-2022
  06 - Ashok Chakra        chakra facts + the 24 virtues (spoke order)
  07 - Sources             every source used, incl. image provenance
  08 - Flag Facts          the 127 official Q&A facts
  09 - Flag Design & Sizes BIS specifications + 9 standard sizes

Rules:
  - Never edit this file on two computers at once (Excel files cannot be
    merged). Pull the latest before editing.
  - Run `npm run check:content` after big edits — it validates the whole
    workbook through the app's real loader and reports problems.
