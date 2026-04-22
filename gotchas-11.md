# Sketch3D — Gotchas, Bugs & Workarounds (v11)

## Android WebView — Hard Compatibility Rules

| Rule | Consequence |
|---|---|
| No optional chaining `?.` | SyntaxError, silent crash on WebView pre-80 |
| No bare `catch{}` | Must be `catch(e){}` |
| No `<!-- -->` inside `<script>` | HTML parser terminates script block |
| `let` not `const` for TDZ-risk objects | See TDZ section |
| No CSS media queries for layout switching | Use JS class toggling only (`updateLayoutMode`) |
| `flex-shrink:0` on portrait row buttons | Without it, buttons collapse on ~360px phones |
| `matrixAutoUpdate=false` after manual matrix | Required in finStroke, loadData, duplicate, gizmo, merge |
| No `Math.max(...largeArray)` spread | Stack overflow on long strokes — use explicit loop |
| No optional chaining in event handlers | Crashes on Android 8/9 WebView |

---

## TDZ Crashes — #1 Recurring Issue

Android enforces TDZ strictly. `let`/`const` referenced before declaration = silent crash.

**v10/v11:** `depthCuesOn` declared at line ~885, immediately above `buildSurf()`. Must remain before `buildSurf()` is defined because `buildSurf` references it via `_frostedMesh.visible = depthCuesOn`.

**Rule:** Any variable referenced inside `buildSurf()` must be declared **before `buildSurf` is defined**, not just before it is called.

**Snap state:** `snapEnabled`, `SNAP_STEP`, `SNAP_THRESH`, `snapAngle`, `isSnapped` are at **module scope**, before the card gizmo IIFE that uses them. This is intentional TDZ safety — both IIFEs (local gizmo and card gizmo) can access them at call time.

---

## Frosted Glass Depth Cue — renderOrder Must Be > 3

Strokes have `renderOrder=3`. `_frostedMesh` must be `renderOrder=5`, `_frostedGridMesh` must be `renderOrder=6`. Never lower — depth test only works after strokes have written to the depth buffer.

---

## Frosted Glass — Geometry Must Be Larger Than surfMesh

The `surfMesh` plane is 10×10. The frosted mesh plane is 40×40. If coplanar and same size → z-fighting. Do NOT shrink frosted geometry to 10×10.

---

## Frosted Glass — depthTest Must Stay true

`depthTest:true` is what makes in-front/behind work. With `depthTest:false` the frosted mesh paints over everything regardless of depth. Do NOT set `depthTest:false`.

---

## Grid Mesh Color Must Be 0xffffff

`_frostedGridMat.color = 0xffffff`. CanvasTexture RGBA values are multiplied by material colour. If set to bgHex the dots/lines would be tinted/invisible.

---

## Surface Grid Scale Compensation — Plane Only

`syncSurf()` updates `texture.repeat` for the grid mesh when the plane is scaled:
```js
_frostedGridMat.map.repeat.set(80 * sx, 80 * sy);
```
**Do NOT apply to cylinder/sphere/cone/cube.** Their UV layout is non-linear.

---

## Gizmo Ring Rotation — Turntable Only (v38+)

The old tangent-projection approach `(dx*tx + dy*ty) * 0.022` caused jitter when the cursor crossed the tangent line (sign reversal). **Always use turntable:**

```js
var curAngle = Math.atan2(clientY - gcy, clientX - gcx);
var rawIncr = curAngle - _lgDrag.prevAngle;
while(rawIncr >  Math.PI) rawIncr -= Math.PI*2;
while(rawIncr < -Math.PI) rawIncr += Math.PI*2;
_lgDrag.prevAngle = curAngle;
```

Accumulate in `_lgDrag.accumAngle`, snap total, diff vs `_lgDrag.lastSnapped` for the frame delta. **Do not revert to tangent-projection.**

---

## Card Drag — No Clamping

Cards previously clamped with `Math.max(0, Math.min(window.innerWidth - w, nx))`. This caused an "invisible limit" bug because:
1. `g.offsetWidth` = 176px regardless of CSS zoom scale
2. On small viewports this clamped the right edge to a position the card couldn't reach visually

**Fix:** No clamping at all. Cards can go anywhere. Redock snap (drag toward screen edge) handles return. Do NOT re-add clamping.

---

## Card Jump on Undock

**Old behavior:** Cards jumped to top of screen on first undock.  
**Root cause:** `detachAll()` had an 8px nudge gap that offset the card from where `state.ox/oy` expected it.  
**Fix:** No nudge. `style.left/top` and `applyDetachedScale` set synchronously immediately after `appendChild`.

```js
document.body.appendChild(sgTop);
// Set synchronously BEFORE any paint
sgTop.style.left = _scState.topLeft + 'px';
sgTop.style.top  = _scState.topTop  + 'px';
applyDetachedScale(sgTop, _scState.detachedScale);
```

---

## LCL Float Button — Zero-Rect Guard

`positionLclFloat()` calls `getBoundingClientRect()` on `sg-bottom`. When the sidecol is hidden (ui-hidden mode), this returns a zero rect. Guard:

```js
var r = sgBot.getBoundingClientRect();
if(r.width === 0 && r.height === 0) { grp.style.display='none'; return; }
```

In ui-hidden mode, fall back to fixed `left:10px; bottom:52px` to stay above the mini-toolbar toggle.

---

## LCL Float Button — CSS Must Not Override JS

`#lcl-float-group` display is **entirely controlled by `positionLclFloat()`**. The CSS only has:
```css
#lcl-float-group { display: none; } /* default */
body.narrow-mode #lcl-float-group { display: none !important; }
```
Do NOT add `display:flex` rules in CSS for wide/ui-hidden modes — they fight the JS and cause the button to appear in the wrong position.

---

## Canvas Sizing — Container Overflow

The `sc-group` has `overflow:hidden` (required for border-radius). If a canvas exceeds its container width it gets clipped silently.

**Current sizes (must not be exceeded):**

| Canvas | Size | Container available |
|---|---|---|
| `#gc` | 150×130 | 158px (176 sidecol − 16 padding − 2 border) |
| `#pb-gc` | 130×104 | dynamic via `_fcResizeCanvases()`, `max-width:100%` |
| `#sg-gc` | 148×148 | 152px (168 min-width − 16 padding) |

---

## Delete Button Index Closure Bug (fixed v9)

Loop variable in `forEach` closures — always IIFE-wrap delete listeners:
```js
(function(idx){ del.addEventListener('click', function(e){ deleteView(idx); }); })(i);
```

---

## Undo Fallback Stack Drift (fixed v7)

`if(!_undoStack.length && strokes.length){...}` — fallback only fires when typed stack is empty. Do not remove this gate.

---

## Layer 0 Coercion

`layer||1` treats BG (0) as falsy. Always use `layer!=null?layer:1`.

---

## togglePersp → setOrtho

Never call `useOrtho = !useOrtho` directly. Always use `setOrtho(on)` which syncs all three PERSP buttons. `togglePersp()` now just calls `setOrtho(!useOrtho)`.

---

## rebuildStrokeMaterials Is a No-op (v10+)

`rebuildStrokeMaterials()` just calls `markDirty()`. Materials are always shared. Do not restore per-mesh clone logic.

---

## pgbtn / vwbtn Are In Topbar (v9+)

Do not recreate floating fixed-position versions.

---

## New Scene Dialog (v10+)

Always proceeds. `confirm()` only gates saving, not scene creation. Do not revert to blocking behaviour.

---

## Brush Preview Uses Fixed Color

`redrawAll()` brush preview always uses `#1a1a2e` — never `curColor`. Light colours are invisible on the beige background.

---

## setMode — Three Button Groups

```js
['pan','orbit']           → 'b'+id (topbar)
['draw','erase','select'] → 's'+id (sidebar)
['draw','erase','select'] → 'pb-'+id (portrait)
```
`bdraw`, `berase`, `bselect` do not exist — removed in v5.2.

---

## togglePersp — Three Buttons

`['bpersp', 'nav-persp', 'pb-nav-persp']` — all three must be synced. `setOrtho()` handles this.

---

## Joystick dy NOT Negated

Confirmed correct. Do not change.

---

## USDZ 64-byte Alignment (fixed v7)

`pad64(offset)` function. Do not remove padding logic.

---

## Preview Line Leaked Geometry (fixed v8)

Pre-allocated `Float32Array(_prevBuf)` + single persistent `prevLine`. Do not add `scene.remove(prevLine)`.

---

## getBoundingClientRect on Hot Path (fixed v8)

`_cachedRect` + `_refreshRect()` on resize. Do not revert to live calls.

---

## Math.max Spread on Large Arrays (fixed v8)

Explicit `for` loop in `buildTube`. Do not restore spread syntax.

---

## Stroke Start Taper (fixed v9)

`tz = t > 0.88 ? (1-t)/0.12 : 1` — no taper at start, only end. Do not restore start taper.

---

## End-of-Stroke Hook (fixed v9)

`finStroke` while loop, `dot < 0.0` threshold exactly. Do not loosen to -0.2.

---

## Depth Cue setBgColor (v10+)

`setBgColor()` must call `_frostedMat.color.set(hex)` so frosted glass matches new background.

---

## Snap State Scope (v11)

`snapEnabled` is module-scope, declared before the card gizmo IIFE. When reading or writing inside any IIFE, this is always the same shared variable — no closure issue. `_setSnapEnabled(v)` is on `window` for external callers.
