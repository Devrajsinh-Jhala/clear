# PDF font asset

`DejaVuSans.ttf` is the unmodified DejaVu Sans font distributed with Poppler in the bundled workspace runtime. It provides Latin, Greek, Cyrillic, and common mathematical symbols. The upstream license is included in `LICENSE.txt` and attached to every exported PDF. See https://dejavu-fonts.github.io/ and https://github.com/dejavu-fonts/dejavu-fonts/blob/master/LICENSE.

Characters absent from this font are represented explicitly with Unicode codepoint notation in the PDF; the first page explains this. JSON and Markdown retain the exact original strings. This keeps an unsupported character from becoming a silent blank or a replacement square.

Both assets are read only from this fixed directory. Include `./src/lib/export/fonts/DejaVuSans.ttf` and `./src/lib/export/fonts/LICENSE.txt` in Next.js output traces for PDF export routes. Lesson content never controls an asset path or causes a network fetch.
