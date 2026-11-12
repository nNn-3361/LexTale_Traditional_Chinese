# Pseudo-character Maker

A small browser tool the team uses to build Traditional Chinese pseudo-characters (假字) for the lexical decision items, and to render real and pseudo-characters as matching images.

This is an internal working tool, shared here so others can see how the stimuli were made. It is not a polished public application.

![Screenshot of the tool](screenshot.png)

## Method

A pseudo-character is built by cropping a part from each of two real characters and joining the parts:

1. Choose a structure: left-right (⿰) or top-bottom (⿱). The structure sets the preset crops and the direction of the automatic layout.
2. Enter two real characters, A and B.
3. The tool renders both in the same font. Each source has a crop box with four edges (left, top, right, bottom, as a percentage of the glyph), and only the ink inside the box is kept. The box can be set in three ways:
   - Preset buttons: first half (left or top), second half (right or bottom), or the whole character. By default A keeps its first half and B its second half. Keeping the other half moves a component to a position it does not normally take (for example 氵 on the right), which is used to make position-illegal non-characters.
   - Dragging on the source glyph: drag an edge to move it, drag inside the box to move the whole box, or drag outside the box to draw a new one. This allows cuts in both directions at once, for example only the top-left corner of a character.
   - Number fields for the four edges.
4. For a half preset, the cut is placed automatically at the column (or row) with the least ink between 28% and 72% of the glyph width. "自動找切線" re-runs this for every source whose box comes from a preset; hand-drawn boxes are left as they are.
5. Stroke cutting (on by default): the glyph is split into connected groups of ink. A group with at least 80% of its pixels inside the box is kept whole; one with at most 20% is dropped whole. Only a group that lies clearly on both sides of a box edge, where strokes touch, is cut along the edge, and the tool shows a warning. Turning it off gives a plain straight cut along the box edges.
6. Automatic layout: when A is a first half and B a second half, the two parts are scaled along the structure's axis to meet at the midpoint of the two cuts. For any other box (swapped halves, whole character, hand-drawn box) the parts are placed by their ink, side by side (or one above the other) between the source characters' outer margins, with a small gap.
7. Move and scale (optional): in the "移動部件" mode, either part can be dragged on the result, nudged with the arrow keys (1 px, or 10 px with Shift, in 400 x 400 glyph coordinates), and scaled about the centre of its ink. Width and height are locked to the same scale by default; unlocking them shows a warning, because unequal scaling changes stroke thickness and can make a pseudo-character look different from real characters. "回到自動排版" removes all moves. The selected part is shown in red. A warning is shown when a part touches or leaves the image edge.
8. Eraser (optional): any remaining residue can be erased by hand on the result. Each eraser stroke is saved with the item (brush radius and points, in 400 x 400 glyph coordinates), so the image is regenerated exactly on every export and the edit is recorded in the CSV. Eraser strokes are drawn on the final picture, so changing a crop box, a move, the source characters or the structure clears them (the tool says so).

Example: 語 + 湖 keeps 訁 from 語 and 胡 from 湖, giving a left-right character ⿰言胡.

Cutting real glyphs, rather than scaling whole component characters, keeps each component in its proper positional form (for example 訁 on the left, not a squeezed 言).

### Real characters use the same pipeline

Real characters are rendered with the same font, size and placement as the pseudo-characters. This keeps real and pseudo items visually identical in style, so participants cannot tell them apart by rendering differences.

### Checking that a pseudo-character does not exist

The tool does not check this automatically. Every candidate is checked by hand against the Ministry of Education [Dictionary of Chinese Character Variants](https://dict.variants.moe.edu.tw/) and reviewed by 2 to 3 native speakers, who also remove items that look too much like a real character.

## Output

The item list can be downloaded as a ZIP containing one PNG per item and an `items.csv` file:

| Column | Description |
| --- | --- |
| `item_id` | `P001`... for pseudo-characters, `R001`... for real characters |
| `lexicality` | `pseudo` or `real` |
| `char` | The real character (empty for pseudo-characters) |
| `source_a`, `source_b` | The two source characters |
| `structure` | `⿰` or `⿱` |
| `cut_a`, `cut_b` | Cut positions, as a percentage of the glyph size. Empty when the crop box is not a half of the glyph |
| `keep_a`, `keep_b` | Which half of each source is kept: `left`/`right` or `top`/`bottom`. Default: `left`/`top` for A, `right`/`bottom` for B. Empty when the crop box is not a half of the glyph |
| `crop_a`, `crop_b` | Crop box as JSON `[left, top, right, bottom]`, percentages of the glyph size. Always filled; for a half it repeats `cut_*` and `keep_*` |
| `move_a`, `move_b` | Move and scale of each part as JSON `[dx, dy, sx, sy]`: offset in pixels of the 400 x 400 glyph, then width and height scale (1 = unchanged). `[0,0,1,1]` means the automatic layout |
| `cut_mode` | `stroke` (stroke cutting) or `line` (straight cut) |
| `manual_edit` | `yes` if the eraser was used |
| `erase_strokes` | Eraser strokes as JSON: `[{"r": radius, "p": [[x, y], ...]}]` |
| `font` | Font used for rendering |
| `image` | PNG file name |

Image size (256, 400 or 600 px) and background (white or transparent) can be set at the top of the page.

## Running it

Open `index.html` in a recent desktop browser. No build step or server is needed. An internet connection is needed to load the fonts (Noto Sans TC / Noto Serif TC from Google Fonts) and JSZip from cdnjs.

The item list is stored in the browser's local storage only. Items made with earlier versions of the tool (a cut and a kept half, no crop box) are still read and render exactly as before.

## Limitations

- Only two source characters per item. The automatic layout is left-right or top-bottom; other arrangements, including enclosing structures (such as 國 or 問), have to be built by moving and scaling the parts by hand.
- The automatic layout can stretch a part along the structure's axis (for example a whole character placed in the top half). Check the result and use move and scale where needed.
- When the two parts of a source character touch, stroke cutting falls back to a straight cut for that group of strokes. Use a different source character or the eraser.
- Eraser strokes are tied to the font, crop boxes and moves. The editor clears them when a box or move changes, but changing the font of an erased item can still make the erased areas miss.
- Fonts are loaded from Google Fonts, so rendering depends on that service. For final stimuli, the font files should be pinned locally and their license confirmed for release under CC BY.
