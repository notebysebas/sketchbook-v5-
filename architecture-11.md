# Sketch3D — Architecture (v11)

## File Structure

```
index.html          ← entire application (~6,920 lines, single-file constraint)
manifest.json       ← PWA manifest (real static file, not embedded)
sw.js               ← cache-first service worker
icons/              ← PWA icons 72–512px
.nojekyll           ← GitHub Pages config
```

**Single-file constraint is non-negotiable.** All JS, CSS, HTML live in `index.html`. Trivially deployable — drop file on any static host, works offline via SW.

---

## Tech Stack

| Concern | Solution |
|---|---|
| 3D rendering | Three.js r128 (CDN: cdnjs.cloudflare.com) |
| Typography | DM Mono 300/400/500 (Google Fonts) |
| Language | Vanilla JS — no framework, no build step |
| Storage | IndexedDB primary + localStorage fallback |
| Deployment | GitHub Pages (static) |

**Why Three.js r128:** Stable on Android WebView. Do not upgrade — newer versions break on older Android WebViews that are the primary target.

---

## Coordinate System

**Z-up**: X = right, Y = depth, Z = up. Grid lies flat in XZ plane.  
Default camera: `theta=−π/2, phi=π/2` → looking at XZ from front.  
All gizmo drawing uses camera right/up column vectors to project 3D axes to screen 2D.

---

## Script Initialization Order (TDZ-critical)

```
1.  renderer + DOM attachment
2.  _renderDirty + markDirty()
3.  Scene objects (lights, grid, axes)
4.  Export scale (let, not const)
5.  _cachedRect + _refreshRect()
6.  Surface system:
    6a. depthCuesOn declared          ← MUST be before buildSurf (TDZ)
    6b. _frostedMat/_frostedMesh vars
    6c. _surfGridMode, _depthOpSteps etc.
    6d. buildSurfGridTex / applyFrostedGridTex
    6e. buildSurf() + syncSurf() defined
    6f. buildSurf() called
7.  Camera (updCam)
8.  Raycasting, depth system stubs, material cache
9.  Stroke state + undo/redo stacks
10. Preview line
11. Gesture handlers
12. Mode system (setMode)
13. Gizmo IIFEs (local overlay, surface gizmo, stroke gizmo, loft)
    ← snapEnabled / SNAP_STEP / SNAP_THRESH declared HERE (module scope, before IIFEs)
14. NavCube IIFE
15. Nav joystick IIFE
16. Cycle button IIFE
17. UI event bindings
18. Layer system + mergeLayer()
19. Pages + Views system
20. Brush preview IIFE
21. IndexedDB init
22. Autosave setInterval
23. Init calls (syncSurf, setMode, updateLayoutMode)
24. tryRestore() IIFE
25. animate() loop
```

---

## UI Layout

### Topbar (wide mode, both orientations when not narrow)

Scrollable (`overflow-x: auto`) card fixed at `top:8px`, centered. Contains all top-level toggles, undo/redo, export, pages/views, file, hide-UI button.

### Sidecol (wide mode only)

Fixed `left:10px` (or `right:10px` for rside), `top:52px`, `bottom:64px`, `width:176px`. Two `sc-group` cards in `flex-direction:column-reverse`:

- **sg-bottom** (visual bottom): gizmo card (`#ghud`) + nav card
- **sg-top** (visual top): tools card + brush panel + colors

Both groups can be **detached** (hoisted to `body` as `position:fixed`, `z-index:260`) and dragged freely. No clamping — cards go anywhere. Redock by dragging back to sidecol edge.

### Sidecol resize

`#stab` (side tab) — tap to collapse/expand; drag to resize via `zoom` property on `#sidecol`.

### Floating LCL group (`#lcl-float-group`)

`position:fixed; z-index:270`. Display and position controlled **entirely by JS** (`positionLclFloat()`). Normal mode: 5px below `sg-bottom.getBoundingClientRect().bottom`. UI-hidden mode: `left:10px; bottom:52px` (above mini-toolbar toggle). Narrow mode: hidden.

### Portrait mode (`narrow-mode`)

Activated by `@media (max-aspect-ratio: 2/3)` — detected by JS `updateLayoutMode()` checking `visualViewport`. Sidecol hidden. Panels reparented into `#pb-float-card` (the narrow bar). Two panels: `#pb-panel-nav` and `#pb-panel-gizmo`.

### Narrow cycbar

Scrollable horizontal strip at bottom of `#narrow-bar`. Contains all drawing tools, brush modifiers, undo/redo, depth/grid, pages/views.

---

## Gizmo System (Three canvases + one overlay)

### Local Overlay (`_lgOverlay`)

Full-screen 2D canvas (`position:fixed; inset:0; pointer-events:none; z-index:15`). Rendered only when `_lgOn=true`. Uses `window.devicePixelRatio` for crisp HiDPI. Hit-testing via pointer events on the main renderer canvas (separate handler that checks `_lgHit()`).

**Ring rotation (v38+ turntable):**
- `prevAngle` = `atan2(clientY−cy, clientX−cx)` from previous frame
- `rawIncr` = short-angle delta from prev to cur
- Axis sign flips applied (`flipped[ax]`, z-convention)
- Snap: accumulate in `accumAngle`, snap total, diff vs `lastSnapped`
- Quaternion: `runQuat.premultiply(setFromAxisAngle(localAxis, incrProj3))`
- Decompose: strip base-plane quat, set `surfEuler`

### Card Gizmo (`#gc`, `#pb-gc`)

`#gc` is 150×130px. `#pb-gc` is 130×104px (mirrors `#gc` via `_pbGcDraw` which draws gc then copies via `drawImage`). Geometry constants all proportional: `_R = Math.min(CX,CY)`. Ring at `_R*0.68`, arrow tip at `_R*0.76`.

Modes: `gizmoMode` ('all'/'move'/'rotate'/'scale'), `axisFilter` ('all'/'x'/'y'/'z'), `_gcAxisLocal` (local vs world axes). All exposed on `window._setGizmoMode`, `window._setAxisFilter`, `window._gcToggleAxisMode`.

### Selection Gizmo (`#sg-gc`)

`#sg-gc` is 148×148px. Appears when `selectedStrokes.length > 0` as `#sgizmo` floating card. Same proportional geometry via `_SG_R = Math.min(CX,CY)`. `_sgAxisLocal` toggleable. Operates on `selectedStrokes` group matrix.

---

## Depth Cue System (frosted glass, v10+)

Two meshes added to `surfGroup`:

```
surfGroup
  ├── surfMesh          renderOrder 0  (surface fill, hover/raycast target)
  ├── wire              renderOrder 1  (edge wireframe — never hidden)
  ├── border lines      renderOrder 1  (plane border — never hidden)
  ├── _frostedMesh      renderOrder 5  (bg-colour tint, opacity-controlled)
  └── _frostedGridMesh  renderOrder 6  (dot/grid texture, always crisp)
```

- `_frostedMesh`: `depthTest:true`, `depthWrite:false`, `color = bgColor`, opacity = user setting (25/50/75/90%)
- `_frostedGridMesh`: `color:0xffffff` (texture not tinted), CanvasTexture dots/grid

**Why `depthTest:true`:** Strokes at `renderOrder:3`. Frosted mesh at `renderOrder:5` — by then strokes have written to depth buffer. Frosted fragments behind strokes fail depth test → only tints what's behind the plane.

---

## Stroke Geometry Pipeline

```
rawPts[] / smoothPts[]
    ↓ finStroke() — tail-trim reversals
    ↓ computeVels(pts)
    ↓ buildTube(pts, vels, sz, op, color, flat, layer)
  taper: tz = t > 0.88 ? (1-t)/0.12 : 1   (end only, no start taper)
  velZone: t < 0.12 ? t/0.12 : t > 0.88 ? (1-t)/0.12 : 1
  sc = taper * (1 - vn * velZone * 0.5)
    ↓ THREE.Group (tube + start cap + end cap)
    ↓ matrixAutoUpdate=false (manual matrix from surfGroup at draw time)
```

All strokes share materials via `_matCache` keyed by `color+op+flat`. No per-mesh material clones.

---

## Navigation

### Camera State
```js
cam = { theta, phi, radius, target: Vector3,
        active, sx, sy, st, sp,
        panActive, panAnchor, panTargetAtStart }
orthoZoom = 8  // half-height of ortho frustum in world units
useOrtho = false
```

### Ortho/Persp
- `setOrtho(on)` — single function, updates `useOrtho`, syncs all three PERSP buttons
- `alignCameraToFace()` → animates + `onComplete: () => setOrtho(true)`
- Manual orbit start → `setOrtho(false)` automatically

### NavCube
- `snapTo(axIdx, goOrtho)` — checks alignment → flips to opposite if already aligned
- Tap = `snapTo(h, false)` (persp), Hold 400ms = `snapTo(h, true)` (ortho)

### Contextual Zoom
- Wheel: `panUnproject(mousePos)` before and after zoom; shift target to keep world point fixed
- Pinch: same with touch midpoint

---

## Mode System

```
mode: 'draw' | 'erase' | 'select' | 'orbit' | 'pan'
```

`setMode(m)` syncs: topbar (`bpan`/`borbit`), sidebar (`sdraw`/`serase`/`sselect`), portrait (`pb-draw`/`pb-erase`/`pb-select`), hidden-UI scx buttons.

---

## Storage

| Property | Value |
|---|---|
| IndexedDB name | `sketch3d` |
| Object store | `autosave` |
| Key | `sk3d_auto` |
| Sidecol state key | `sk3d_sc` (localStorage only) |
| Autosave interval | 30s + on-demand `idbSave()` |
| Fallback | `localStorage` `sk3d_auto` |

---

## Key Systems Summary

| System | Notes |
|---|---|
| Render-on-dirty | `markDirty()` + RAF `animate()` |
| Material cache | `_matCache` — shared, no per-mesh clones |
| Depth cue | Frosted glass mesh, renderOrder 5+6 |
| Surface grid | CanvasTexture on `_frostedGridMesh`, plane scale compensation only |
| Rect cache | `_cachedRect` — no `getBoundingClientRect()` on hot path |
| Preview line | Pre-allocated `Float32Array`, no alloc per point |
| Brush preview | Always `#1a1a2e` — never follows `curColor` |
| Background | `setBgColor()` syncs scene, fog, BG_COL, CSS var, `_frostedMat.color` |
| Snap state | Module-scope `snapEnabled`, `_setSnapEnabled(v)` syncs all buttons |
| Pages/Views | `togglePages()` / `toggleViews()` shared |
| Sidecol state | `_scState` in localStorage, `topTop/botTop` clamped ≥ 52px |
