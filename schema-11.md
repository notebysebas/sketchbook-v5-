# Sketch3D — Data Schema & Save Format (v11)

## JSON Save Format — Version 4.3 (current)

```json
{
  "version": 4.3,
  "curPage": 0,
  "pages": [
    {
      "strokes": [ ...serialisedStrokeArray... ],
      "views":   [ ...viewArray... ]
    }
  ],
  "strokes": [ ...current page strokes... ],
  "surf": {
    "type":  "plane|cube|cylinder|sphere|cone",
    "plane": "xz|xy|yz",
    "px": 0, "py": 0, "pz": 0,
    "rx": 0, "ry": 0, "rz": 0,
    "sc": 1,
    "sax": 1, "say": 1, "saz": 1
  }
}
```

UI state NOT persisted: `depthCuesOn`, `_depthOpIdx`, `_surfGridMode` reset to defaults on load.  
Loft geometry is ephemeral — saves as `"type":"plane"`.

---

## Backwards Compatibility

| Version | Format | Handler |
|---|---|---|
| 4.3 | `pages[].views[]` added | `loadAllPages()` current |
| 4.2 | No views | `loadAllPages()` fills `views:[]` |
| 4.1 | Single page | `loadAllPages()` → `loadData()` fallback |
| < 4.1 | Missing `layer`, `mx`, `flat` | `||` defaults in `loadData()` |

---

## Stroke Object (in-memory)

```js
{
  pts:       Vector3[],
  vels:      number[],
  color:     string,      // hex e.g. "#1a1a2e"
  sz:        number,      // 1–20
  op:        number,      // 0.1–1.0
  flat:      boolean,
  layer:     number,      // 0=BG, 1=Sketch, 2=Notes, 3=Merged
  mesh:      THREE.Group,
  _depthKey: string       // legacy field, always '' — kept for JSON compat only
}
```

`_depthKey` is never read by any active code in v11. Kept on stroke objects so saved JSON from older sessions loads cleanly.

**Layer coercion:** Always use `layer != null ? layer : 1` — never `layer || 1`. Layer 0 (BG) is falsy.

---

## Serialised Stroke (in JSON)

```json
{
  "pts":   [{"x": 0, "y": 0, "z": 0}],
  "color": "#1a1a2e",
  "sz":    1,
  "op":    0.95,
  "flat":  false,
  "layer": 1,
  "mx":    [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
}
```

---

## View Object

```json
{
  "cam": {
    "theta": -1.5708, "phi": 1.5708, "radius": 10,
    "tx": 0, "ty": 0, "tz": 0,
    "ortho": false, "orthoZoom": 8
  },
  "surf": {
    "type": "plane", "plane": "xz",
    "px": 0, "py": 0, "pz": 0,
    "rx": 0, "ry": 0, "rz": 0,
    "sc": 1, "sax": 1, "say": 1, "saz": 1
  },
  "thumb": "data:image/jpeg;base64,..."
}
```

---

## Layer System

| Index | Name | Default color | Popover row |
|---|---|---|---|
| 0 | BG | `#b03020` | `tb-lrow0` + ⊕ |
| 1 | Sketch | `#1a1a2e` | `tb-lrow1` + ⊕ |
| 2 | Notes | `#1a9940` | `tb-lrow2` + ⊕ |
| 3 | Merged | first-stroke color | `tb-lrow3` (hidden default) |

---

## Depth / Frosted Glass State (v10+, unchanged v11)

```js
let depthCuesOn        = true;
var _depthOpSteps      = [0.25, 0.50, 0.75, 0.90];
var _depthOpLabels     = ['25%', '50%', '75%', '90%'];
var _depthOpIdx        = 0;     // default 25%
var _surfGridMode      = 2;     // 0=off, 1=grid, 2=dots (default dots)
var _surfGridLabels    = ['OFF', 'GRD', 'DOT'];
```

---

## Undo/Redo Action Types

```js
{ type: 'stroke_add',             stroke }
{ type: 'stroke_delete',          stroke, index }
{ type: 'stroke_transform',       stroke, oldMatrix }
{ type: 'stroke_transform_multi', strokes, oldMatrices }
{ type: 'stroke_duplicate',       newStroke }
{ type: 'merge_layer',            srcLayer, origStrokes, savedOrigIndices,
                                   mergedStroke, replacedMerged }
```

---

## Pages Object (in-memory)

```js
pages[i] = {
  strokes: serialisedStrokeArray,
  thumb:   string | null,
  views:   viewArray
}
```

---

## IndexedDB Storage

| Property | Value |
|---|---|
| DB name | `sketch3d` |
| Object store | `autosave` |
| Key | `sk3d_auto` |
| Write interval | 30s + `idbSave()` |
| Fallback | `localStorage` `sk3d_auto` |

---

## Sidecol State (localStorage only)

Key: `sk3d_sc`. Stored as JSON string.

```js
_scState = {
  sideOpen:      true,
  rside:         false,
  scale:         1.0,    // sidecol zoom (0.6–1.5)
  detached:      false,
  topLeft:       40,     // sg-top CSS left when detached
  topTop:        80,     // sg-top CSS top when detached — clamped ≥ 52
  botLeft:       40,     // sg-bottom CSS left when detached
  botTop:        200,    // sg-bottom CSS top when detached — clamped ≥ 52
  detachedScale: 1.0,    // zoom for detached cards
  fcScale:       1.0,    // float card zoom (narrow mode)
  detachedHidden:false   // user hid detached cards via ×; show FAB to restore
}
```

`topTop` and `botTop` are always ≥ 52px (topbar height). Enforced on restore and in `detachAll()`.

---

## Brush State

```js
let curColor      = '#000000';
let brushSz       = 1;
let brushOp       = 0.95;
let flatBrush     = false;
let smoothingOn   = false;
let velocityTaper = true;
let LAZY          = LAZY_OFF;  // 1.0
```

---

## Background Colour

```js
const BG_COL = new THREE.Color(0xcdb899);  // kept for fog; synced in setBgColor
```

`setBgColor(hex)` syncs: `scene.background`, `scene.fog.color`, `BG_COL`, `_frostedMat.color`, CSS `--bg`.

---

## Snap State (module scope, v11+)

```js
var snapEnabled = true;
var SNAP_STEP   = Math.PI / 4;   // 45°
var SNAP_THRESH = Math.PI / 16;  // 11.25° — snap engages within this of a 45° multiple
function snapAngle(raw) { ... }
function isSnapped(raw) { ... }
window._setSnapEnabled = function(v) { ... }; // syncs gsnap, pb-gsnap, lcl-snap
window._getSnapEnabled = function()  { return snapEnabled; };
```

---

## Export Scale

```js
const SCALE_STEPS  = [null, 0.001, 0.01, 0.1, 0.5, 1, 5, 10, 50, 100];
const SCALE_LABELS = ['OFF','1:0.001','1:0.01','1:0.1','1:0.5','1:1','1:5','1:10','1:50','1:100'];
let exportScaleIdx = 0;
```

---

## Key Element IDs — New/Changed in v11

| ID | Location | Purpose |
|---|---|---|
| `#lcl-float-group` | Body (fixed) | Floating LCL + snap button group |
| `#lcl-float` | Inside `#lcl-float-group` | Toggle local overlay |
| `#lcl-snap` | Inside `#lcl-float-group` | Toggle 45° snap |
| `#gc` | Sidecol gizmo card | Card gizmo canvas (150×130) |
| `#pb-gc` | Portrait gizmo panel | Portrait gizmo canvas (130×104) |
| `#sg-gc` | Sgizmo float card | Selection gizmo canvas (148×148) |
| `#bdepth-op` | Topbar | Depth plane opacity cycle (25/50/75/90%) |
| `#bsurfgrid` | Topbar | Surface grid cycle (DOT/GRD/OFF) |
| `#pb-depthop` | Portrait cycbar | Depth plane opacity (portrait) |
| `#pb-surfgrid` | Portrait cycbar | Surface grid (portrait) |
| `#sc-hidden-toggle` | Body (fixed, ui-hidden) | Mini-toolbar hamburger (bottom-left) |
| `#pb-glocal` | Portrait gizmo bottom row | LCL toggle in narrow mode |
| `#pb-gc-axmode` | Portrait gizmo bottom row | Local/world axis toggle (narrow) |
