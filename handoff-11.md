# Sketch3D — Handoff Document (v11 / Session 11)

## Project Overview

Sketch3D is a **single-file 3D spatial sketchbook** built in pure HTML/JS/CSS (no build step). Draw pressure-tapered tube strokes on 3D surfaces, orbit around them, and export to GLB/OBJ/USDA/USDZ/PNG. Primary target: Android mobile (portrait), also works on tablet and desktop.

**Current file:** `sketch3d_v39.html` (also served as `index.html` in the webapp deploy)  
**Deploy:** GitHub Pages PWA at `https://notebysebas.github.io/sketchbook-v3/`  
**Save format version:** 4.3  
**Line count:** ~6,920 lines

---

## Current Session Summary (Session 11)

This session focused on Gizmo unification, navigation improvements, visual cleanup, and bug fixes across multiple sub-sessions.

### Sub-session A — Gizmo visual/functional overhaul (v36)

**What changed:**
- `glocal` and `pb-glocal` buttons removed from their cards and replaced by a floating `#lcl-float-group` div (positioned by `positionLclFloat()`) that tracks below `sg-bottom` whether docked or detached
- `_syncButtons()` updated to use `lcl-float` as third button ID; hides `#gc` / `#pb-gc` canvas when local overlay is active
- `#ghud-bottom .btn` made `flex-shrink:0; overflow:visible` to prevent pill buttons from being compressed
- `pb-panel-hdr` gets `overflow:visible` to prevent cyc-btn text clipping
- `.btn-sft` gets `overflow:visible` to protect SVG icons

### Sub-session B — Navigation, snap, gizmo mechanics (v36 continued)

**What changed:**
- `togglePersp()` refactored → `setOrtho(on)` so all three PERSP buttons update atomically
- `alignCameraToFace()` passes `onComplete` callback to `animateCameraTo()` → snaps to ortho on arrival
- `startOrbit()` calls `setOrtho(false)` — any manual orbit drag returns to persp
- Two-finger orbit lock also calls `setOrtho(false)`
- NavCube: `snapTo(axIdx, goOrtho)` checks if already aligned → flips to opposite face; tap = persp, hold 400ms = ortho; drag = auto-persp return; old double-tap persp toggle removed
- Contextual zoom: wheel zoom and pinch zoom shift `cam.target` toward cursor/midpoint
- `snapEnabled`, `SNAP_STEP`, `SNAP_THRESH`, `snapAngle()`, `isSnapped()` **hoisted to module scope** so both card gizmo and local overlay gizmo share the same state
- `window._setSnapEnabled(v)` syncs all snap buttons atomically
- Local overlay ring drag: replaced tangent-projection with **turntable angle-delta** (later revised again in v38)
- All white ring outlines removed from all three gizmo canvases; idle arc alpha reduced to 0.45
- `#lcl-snap` snap toggle button added to float group

### Sub-session C — Canvas sizing, unified draw (v37)

**What changed:**
- `#gc` canvas shrunk 180×150 → 150×130 (was 22px wider than the 158px available inside card)
- `#pb-gc` canvas shrunk 138×110 → 130×104 with `max-width:100%`
- `#sg-gc` canvas shrunk 160×160 → 148×148
- Card gizmo geometry constants replaced with proportional `_R = Math.min(CX,CY)` system matching local overlay proportions
- `_gcDraw()` rewritten with same visual style as local gizmo (clean arcs, no white outlines, proportional scaling)
- `_sgUnifiedDraw()` updated to same proportional system
- `pb-glocal` (⊕LCL) restored in portrait panel bottom row with compact 6px labels
- Hint span removed from portrait bottom row (was 6th flex item causing compression)

### Sub-session D — Bug fixes (v38)

**What changed:**

1. **Local gizmo jitter fixed** — ring drag now uses pure turntable angle-delta:
   - Each frame: `curAngle = atan2(clientY−cy, clientX−cx)`
   - `incrAngle = shortAngleDelta(prevAngle, curAngle)` → no tangent-crossing spikes
   - Snap: accumulate total, snap total, diff against `lastSnapped` for frame delta
   - `_lgDrag` stores `prevAngle`, `accumAngle`, `lastSnapped`, `runQuat`

2. **Card drag invisible limit fixed** — removed all position clamping from drag `onMove`; cards can be freely placed anywhere

3. **Docked card overlapping topbar fixed** — `detachAll()` and localStorage restore both clamp `topTop/botTop` to `Math.max(52, value)`

4. **Card jump on undock fixed** — removed 8px nudge gap; `style.left/top` + `applyDetachedScale` set synchronously immediately after `appendChild` before `applySidecol()`

### Sub-session E — Final fixes + webapp deploy (v39)

**What changed:**
- `positionLclFloat()` handles `ui-hidden` mode explicitly: positions group at `left:10px; bottom:52px` (above mini-toolbar toggle), adds zero-rect guard for normal case
- CSS for `#lcl-float-group` stripped of `display:flex` overrides — JS owns all display logic
- Card drag clamping removed entirely (fix for persistent drag limit)
- Webapp files generated: `index.html`, `manifest.json`, `sw.js`, `icons/` (8 sizes), `.nojekyll`, `README.md`

---

## Deliberately Made Decisions — DO NOT REVERT

*(Carry forward all from handoff-10.md, plus:)*

- **`snapEnabled` / `SNAP_STEP` / `SNAP_THRESH` / `snapAngle()` / `isSnapped()` are module-scope** — not inside any IIFE. Both card gizmo and local overlay use these. Do not move them back inside an IIFE.
- **`window._setSnapEnabled(v)`** is the only correct way to toggle snap — it syncs all three buttons (`gsnap`, `pb-gsnap`, `lcl-snap`). Do not set `snapEnabled` directly.
- **`setOrtho(on)` not `togglePersp()`** — `togglePersp()` now calls `setOrtho(!useOrtho)`. All direct ortho changes should go through `setOrtho`.
- **Turntable ring rotation (local gizmo)** — `prevAngle` / `accumAngle` / `lastSnapped` / `runQuat` stored in `_lgDrag`. Do not revert to tangent-projection (`dx*tx + dy*ty`).
- **No clamping on card drag** — cards can go anywhere. The redock snap handles return-to-sidecol. Do not re-add `Math.max/Math.min` clamping.
- **`positionLclFloat()` owns all display logic for `#lcl-float-group`** — no CSS `display:flex` rules for this element. CSS only has the `display:none` default and the narrow-mode `!important` hide.
- **`detachAll()` has no nudge gap** — positions are captured exactly from `getBoundingClientRect()` and applied synchronously before `applySidecol()`.
- **Gizmo canvas sizes are critical** — `#gc` 150×130, `#pb-gc` 130×104, `#sg-gc` 148×148. These were chosen to fit their containers with 4–8px clearance. Container geometry: sidecol 176px − 16px padding − 2px border = 158px available for `#gc`.
- **Geometry proportional to `_R = Math.min(CX,CY)`** — both card gizmo and sgizmo use this. Do not restore fixed pixel constants.
- **`alignCameraToFace()` → ortho** — `animateCameraTo()` now accepts optional `onComplete` callback; `alignCameraToFace` passes `() => setOrtho(true)`. Do not remove this.
- **NavCube hold-to-ortho** — 400ms hold fires `snapTo(h, true)`. Tap fires `snapTo(h, false)`. `snapTo` checks if already aligned and flips to opposite face. Do not restore double-tap-to-toggle-persp.
- **Contextual zoom** — `panUnproject()` called before and after zoom; target shifted to keep world point under cursor/midpoint. Do not restore center-only zoom.

---

## Starting a New Session

1. Upload `sketch3d_v39.html` (or `index.html` from the webapp zip)
2. Upload `handoff-11.md`, `architecture-11.md`, `gotchas-11.md`, `schema-11.md`
3. Say: **"Continue Sketch3D from v39 — see handoff docs"**

Read all four docs before making any changes. The HTML file is the source of truth.

---

## Active TODOs / Next Session

### Drawing
- `pointerEvent.pressure` — stylus pressure support (S-Pen / Apple Pencil)
- Straight line mode (hold modifier to snap to straight)
- Stroke recolor after drawing

### Gizmo / Navigation
- Consider adding a visual snap indicator on the local overlay when snapping fires (currently only card gizmo has `snapFlash`)
- Local overlay: center dot tap-to-toggle scale mode should show a brief toast

### Pages & Views
- Drag-to-reorder pages/views (clean implementation, separate from long-press)

### Performance
- Frustum culling: `geo.computeBoundingSphere()` after taper to skip off-screen strokes

### Export
- PNG crop to content bounds (trim transparent border)

### Infrastructure
- Service worker cache-bust strategy when `index.html` updates (currently manual version bump in `CACHE` constant in `sw.js`)

### Known Pending Bugs
- Merge layer row stays visible after all merges undone — needs `strokes.some(s=>s.layer===3)` check after each undo
- `#selbadge` reserved for selection count badge — not yet implemented

---

## File Inventory (webapp deploy)

```
index.html        — full application (~6,920 lines)
manifest.json     — PWA manifest
sw.js             — cache-first service worker (version: sketch3d-v38)
.nojekyll         — disables Jekyll on GitHub Pages
icons/
  icon-72.png … icon-512.png  (8 sizes: 72, 96, 128, 144, 152, 192, 384, 512)
README.md
```
