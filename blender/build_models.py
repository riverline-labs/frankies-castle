"""Frankie's Castle — low-poly cabinet, lever, and seven symbols.

Blender Z-up. The cabinet front faces -Y, which the glTF exporter (Y-up)
turns into +Z so a Three.js camera on +Z looks at the face of the machine.
Symbols are built facing -Y (glTF +Z). Reels are not animated here.

Run:
  blender --background --python blender/build_models.py
"""

from __future__ import annotations

import math
import os

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

try:
    HERE = os.path.dirname(os.path.abspath(__file__))
except NameError:
    HERE = "/Users/bwb/src/riverline/fcastle/blender"

ROOT = os.path.abspath(os.path.join(HERE, ".."))
MODEL_DIR = os.path.join(ROOT, "public", "models")
BLEND_PATH = os.path.join(HERE, "frankies_castle.blend")
LAYOUT_PATH = os.path.join(ROOT, "src", "scene", "layout.ts")

# Window the reels show through. Blender Z-up, front = -Y.
WIN_W = 1.22
WIN_H = 0.66
WIN_CZ = 1.24
REEL_Y = -0.16
CELL = WIN_H / 3.0
LEVER_HINGE = (0.92, -0.42, 1.16)


def log(msg: str) -> None:
    print(msg, flush=True)


def reel_xs() -> list[float]:
    spacing = WIN_W / 5.0
    return [-WIN_W / 2.0 + spacing / 2.0 + i * spacing for i in range(5)]


def gltf_point(x: float, y: float, z: float) -> tuple[float, float, float]:
    # Blender (x, y, z) Z-up, -Y forward → glTF (x, z, -y) Y-up, +Z forward.
    return (x, z, -y)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        import addon_utils
        addon_utils.enable("io_scene_gltf2")
    except Exception as exc:  # pragma: no cover
        log(f"gltf addon: {exc}")


def set_input(node, names: tuple[str, ...], value) -> None:
    for name in names:
        sock = node.inputs.get(name)
        if sock is not None:
            sock.default_value = value
            return
    log(f"missing bsdf input {names}")


def make_mat(
    name: str,
    color: tuple[float, float, float],
    metallic: float = 0.0,
    roughness: float = 0.5,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
    transmission: float = 0.0,
    alpha: float = 1.0,
    cull: bool = True,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = cull
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    set_input(bsdf, ("Base Color",), (*color, 1.0))
    set_input(bsdf, ("Metallic",), metallic)
    set_input(bsdf, ("Roughness",), roughness)
    if emission is not None:
        set_input(bsdf, ("Emission Color", "Emission"), (*emission, 1.0))
        set_input(bsdf, ("Emission Strength",), emission_strength)
    if transmission > 0:
        set_input(bsdf, ("Transmission Weight", "Transmission"), transmission)
        set_input(bsdf, ("IOR",), 1.45)
    if alpha < 1.0:
        set_input(bsdf, ("Alpha",), alpha)
        if hasattr(mat, "blend_method"):
            mat.blend_method = "BLEND"
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = "BLENDED"
    return mat


def materials() -> dict[str, bpy.types.Material]:
    return {
        "iron": make_mat("Iron", (0.09, 0.10, 0.13), 0.88, 0.52),
        "iron2": make_mat("IronTrim", (0.16, 0.17, 0.21), 0.84, 0.46),
        "brass": make_mat("Brass", (0.62, 0.48, 0.24), 1.0, 0.38),
        "brassdk": make_mat("BrassDark", (0.36, 0.28, 0.14), 1.0, 0.48),
        "ox": make_mat("Verdigris", (0.22, 0.34, 0.26), 0.45, 0.62),
        "dark": make_mat("BayDark", (0.015, 0.016, 0.02), 0.3, 0.8),
        "ceramic": make_mat("Ceramic", (0.72, 0.66, 0.52), 0.0, 0.55),
        "copper": make_mat("Copper", (0.55, 0.30, 0.16), 1.0, 0.32),
        "bulb": make_mat("BulbLive", (1.0, 0.86, 0.48), 0.0, 0.22, (1.0, 0.78, 0.35), 8.0, cull=False),
        "bulbdead": make_mat("BulbDead", (0.28, 0.24, 0.18), 0.0, 0.6, (0.15, 0.10, 0.05), 0.15),
        "practical": make_mat("PracticalGreen", (0.45, 0.95, 0.40), 0.0, 0.25, (0.40, 1.0, 0.35), 6.0, cull=False),
        "glass": make_mat("CabinetGlass", (0.85, 0.95, 0.88), 0.0, 0.06, transmission=0.55, alpha=0.18, cull=False),
        "bone": make_mat("Bone", (0.90, 0.86, 0.74), 0.0, 0.48),
        "black": make_mat("Black", (0.04, 0.04, 0.05), 0.15, 0.55),
        "cork": make_mat("Cork", (0.42, 0.28, 0.14), 0.0, 0.75),
        "skin": make_mat("FrankieSkin", (0.42, 0.70, 0.34), 0.0, 0.55),
        "wolf": make_mat("WolfFur", (0.40, 0.40, 0.48), 0.0, 0.72),
        "wolfdk": make_mat("WolfDark", (0.16, 0.15, 0.20), 0.0, 0.7),
        "eye": make_mat("EyeGold", (1.0, 0.86, 0.35), 0.0, 0.25, (1.0, 0.75, 0.2), 2.4),
        "moth": make_mat("MothWing", (0.74, 0.64, 0.44), 0.0, 0.68, cull=False),
        "mothdk": make_mat("MothMark", (0.38, 0.28, 0.16), 0.0, 0.65, cull=False),
        "skull": make_mat("MothSkull", (0.90, 0.86, 0.74), 0.0, 0.45),
        "bat": make_mat("BatWing", (0.34, 0.16, 0.50), 0.0, 0.58, cull=False),
        "batdk": make_mat("BatBody", (0.14, 0.07, 0.22), 0.0, 0.6),
        "bride": make_mat("BrideSkin", (0.90, 0.87, 0.84), 0.0, 0.48),
        "veil": make_mat("BrideVeil", (0.93, 0.91, 0.88), 0.0, 0.28, transmission=0.15, alpha=0.62, cull=False),
        "hair": make_mat("BrideHair", (0.08, 0.07, 0.10), 0.05, 0.5),
        "creature": make_mat("CreatureSkin", (0.36, 0.46, 0.40), 0.0, 0.62),
        "creaturedk": make_mat("CreatureShade", (0.18, 0.24, 0.20), 0.0, 0.65),
        "elixir": make_mat("ElixirLiquid", (0.35, 0.95, 0.32), 0.0, 0.22, (0.45, 1.0, 0.30), 3.5, cull=False),
        "eglass": make_mat("ElixirGlass", (0.82, 0.96, 0.84), 0.0, 0.05, transmission=0.9, alpha=0.35, cull=False),
        "metal": make_mat("BoltMetal", (0.72, 0.70, 0.62), 1.0, 0.28),
        "pupil": make_mat("Pupil", (0.02, 0.04, 0.03), 0.0, 0.3),
        "fang": make_mat("Fang", (0.92, 0.90, 0.82), 0.0, 0.35),
        "lip": make_mat("Lip", (0.45, 0.18, 0.22), 0.0, 0.45),
    }


def bake(bm: bmesh.types.BMesh, loc, rot, scale) -> None:
    scale_m = Matrix.Diagonal(Vector((scale[0], scale[1], scale[2], 1.0)))
    rot_m = Euler(rot, "XYZ").to_matrix().to_4x4()
    loc_m = Matrix.Translation(Vector(loc))
    bmesh.ops.transform(bm, verts=bm.verts, matrix=loc_m @ rot_m @ scale_m)


Part = tuple  # (bm, mat, smooth)


def cube(mat, loc, dim, rot=(0.0, 0.0, 0.0), smooth=False) -> Part:
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bake(bm, loc, rot, dim)
    return bm, mat, smooth


def sphere(mat, loc, radii, rot=(0.0, 0.0, 0.0), seg=14, ring=10, smooth=True) -> Part:
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=1.0)
    bake(bm, loc, rot, radii)
    return bm, mat, smooth


def cyl(mat, loc, radius, height, rot=(0.0, 0.0, 0.0), seg=12, smooth=True, radius2=None) -> Part:
    bm = bmesh.new()
    r2 = radius if radius2 is None else radius2
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=seg,
        radius1=1.0,
        radius2=(r2 / radius) if radius else 0.0,
        depth=1.0,
    )
    bake(bm, loc, rot, (radius, radius, height))
    return bm, mat, smooth


def prism(mat, pts: list[tuple[float, float]], y0=-0.004, y1=0.004, shift=(0.0, 0.0, 0.0)) -> Part:
    """Thin plate. pts are (x, z) in the sheet. The -Y face points at the cabinet front."""
    bm = bmesh.new()
    sx, sy, sz = shift
    front = [bm.verts.new((x + sx, y0 + sy, z + sz)) for x, z in pts]
    back = [bm.verts.new((x + sx, y1 + sy, z + sz)) for x, z in pts]
    bm.faces.new(list(reversed(front)))
    bm.faces.new(back)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        try:
            bm.faces.new((front[i], front[j], back[j], back[i]))
        except ValueError:
            pass
    return bm, mat, False


def mirror_x(pts: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return [(-x, z) for x, z in reversed(pts)]


def box_uv(mesh: bpy.types.Mesh) -> None:
    mesh.uv_layers.new(name="UVMap")
    uv = mesh.uv_layers.active
    for poly in mesh.polygons:
        n = poly.normal
        coords = []
        for li in poly.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
            if az >= ax and az >= ay:
                coords.append((co.x, co.y))
            elif ax >= ay:
                coords.append((co.y, co.z))
            else:
                coords.append((co.x, co.z))
        min_u = min(c[0] for c in coords)
        max_u = max(c[0] for c in coords)
        min_v = min(c[1] for c in coords)
        max_v = max(c[1] for c in coords)
        du = max(max_u - min_u, 1e-6)
        dv = max(max_v - min_v, 1e-6)
        for li, (u, v) in zip(poly.loop_indices, coords):
            uv.data[li].uv = ((u - min_u) / du, (v - min_v) / dv)


def commit(name: str, parts: list[Part]) -> bpy.types.Object:
    big = bmesh.new()
    mats: list[bpy.types.Material] = []
    index: dict[str, int] = {}
    for bm, mat, smooth in parts:
        if mat.name not in index:
            index[mat.name] = len(mats)
            mats.append(mat)
        mi = index[mat.name]
        bm.verts.ensure_lookup_table()
        bm.faces.ensure_lookup_table()
        vmap = {}
        for v in bm.verts:
            vmap[v] = big.verts.new(v.co)
        big.verts.index_update()
        for face in bm.faces:
            try:
                nf = big.faces.new([vmap[v] for v in face.verts])
            except ValueError:
                continue
            nf.material_index = mi
            nf.smooth = smooth
        bm.free()
    big.normal_update()
    mesh = bpy.data.meshes.new(name + "_mesh")
    big.to_mesh(mesh)
    big.free()
    box_uv(mesh)
    obj = bpy.data.objects.new(name, mesh)
    for mat in mats:
        mesh.materials.append(mat)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def bounds_of(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    xs, ys, zs = [], [], []
    for corner in obj.bound_box:
        xs.append(corner[0])
        ys.append(corner[1])
        zs.append(corner[2])
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def tri_count(obj: bpy.types.Object) -> int:
    return sum(max(len(poly.vertices) - 2, 0) for poly in obj.data.polygons)


# ── symbols ──────────────────────────────────────────────────────────

def build_frank(m) -> bpy.types.Object:
    p: list[Part] = []
    p.append(cube(m["skin"], (0, 0.0, 0.01), (0.094, 0.078, 0.102)))
    # Flat hair overhangs the forehead (toward -Y).
    p.append(cube(m["black"], (0, -0.012, 0.078), (0.112, 0.100, 0.034)))
    p.append(cube(m["black"], (0, -0.04, 0.034), (0.086, 0.016, 0.020)))  # brow
    p.append(cube(m["creaturedk"], (0.01, -0.042, 0.052), (0.036, 0.008, 0.010)))  # scar
    for i, x in enumerate((-0.016, -0.004, 0.008, 0.020)):
        p.append(cube(m["black"], (x, -0.044, 0.050), (0.006, 0.006, 0.014)))
    p.append(cube(m["skin"], (0, 0.0, -0.055), (0.052, 0.052, 0.040)))  # neck
    p.append(cube(m["skin"], (0, 0.006, -0.095), (0.150, 0.070, 0.048)))  # shoulders
    # Neck bolts stick out past the square head — the jackpot silhouette.
    p.append(cyl(m["metal"], (0, 0.0, -0.042), 0.013, 0.168, rot=(0, math.pi / 2, 0), seg=10))
    p.append(cyl(m["brass"], (-0.078, 0, -0.042), 0.028, 0.012, rot=(0, math.pi / 2, 0), seg=10))
    p.append(cyl(m["brass"], (0.078, 0, -0.042), 0.028, 0.012, rot=(0, math.pi / 2, 0), seg=10))
    for x in (-0.026, 0.026):
        p.append(sphere(m["bone"], (x, -0.046, 0.018), (0.014, 0.010, 0.012), seg=10, ring=8))
        p.append(sphere(m["pupil"], (x, -0.054, 0.018), (0.006, 0.006, 0.007), seg=8, ring=6))
    p.append(cube(m["black"], (0, -0.046, -0.022), (0.040, 0.008, 0.008)))
    p.append(cube(m["ox"], (-0.055, 0.01, -0.09), (0.03, 0.05, 0.03)))  # coat scrap
    return commit("frank", p)


def build_wolf(m) -> bpy.types.Object:
    p: list[Part] = []
    p.append(sphere(m["wolf"], (0, 0.0, 0.016), (0.066, 0.058, 0.062), seg=16, ring=12))
    p.append(sphere(m["wolfdk"], (0, -0.040, -0.008), (0.034, 0.030, 0.026), seg=12, ring=10))
    p.append(sphere(m["black"], (0, -0.068, -0.004), (0.016, 0.012, 0.012), seg=10, ring=8))
    p.append(cube(m["wolfdk"], (0, -0.02, 0.045), (0.074, 0.018, 0.018)))
    for sign in (-1, 1):
        p.append(cyl(
            m["wolfdk"],
            (sign * 0.040, -0.006, 0.078),
            0.026, 0.072,
            rot=(0.12, 0.0, sign * -0.35),
            seg=8, radius2=0.0,
        ))
        p.append(cyl(
            m["lip"],
            (sign * 0.034, -0.010, 0.086),
            0.012, 0.038,
            rot=(0.12, 0.0, sign * -0.35),
            seg=6, radius2=0.0,
        ))
    for x in (-0.026, 0.026):
        p.append(sphere(m["eye"], (x, -0.048, 0.018), (0.012, 0.008, 0.011), seg=8, ring=6))
        p.append(sphere(m["pupil"], (x, -0.054, 0.018), (0.004, 0.004, 0.008), seg=6, ring=5))
    p.append(cube(m["black"], (0, -0.058, -0.024), (0.040, 0.010, 0.010)))
    for x in (-0.012, 0.012):
        p.append(cyl(m["fang"], (x, -0.062, -0.034), 0.005, 0.016, rot=(0.5, 0, 0), seg=6, radius2=0.0))
    return commit("wolf", p)


def build_moth(m) -> bpy.types.Object:
    p: list[Part] = []
    upper = [(0.012, 0.012), (0.092, 0.030), (0.100, 0.078), (0.040, 0.062)]
    lower = [(0.010, -0.006), (0.086, -0.018), (0.072, -0.072), (0.018, -0.030)]
    for pts in (upper, mirror_x(upper), lower, mirror_x(lower)):
        p.append(prism(m["moth"], pts, y0=-0.006, y1=0.006))
    # Death's-head marks on the upper wings.
    for sign in (-1, 1):
        p.append(sphere(m["mothdk"], (sign * 0.055, -0.010, 0.048), (0.016, 0.006, 0.014), seg=8, ring=6))
    p.append(sphere(m["black"], (0, 0, 0.0), (0.016, 0.016, 0.055), seg=10, ring=8))
    p.append(sphere(m["skull"], (0, -0.012, 0.028), (0.020, 0.012, 0.022), seg=10, ring=8))
    p.append(sphere(m["black"], (-0.007, -0.020, 0.034), (0.004, 0.004, 0.004), seg=6, ring=5))
    p.append(sphere(m["black"], (0.007, -0.020, 0.034), (0.004, 0.004, 0.004), seg=6, ring=5))
    p.append(cyl(m["black"], (0, -0.018, 0.018), 0.004, 0.012, rot=(math.pi / 2, 0, 0), seg=6, radius2=0.0))
    for sign in (-1, 1):
        p.append(cyl(m["black"], (sign * 0.012, -0.01, 0.07), 0.003, 0.055, rot=(0.3, 0, sign * 0.5), seg=5))
        p.append(sphere(m["mothdk"], (sign * 0.030, -0.02, 0.092), (0.006, 0.004, 0.006), seg=6, ring=5))
    return commit("moth", p)


def build_bat(m) -> bpy.types.Object:
    p: list[Part] = []
    wing = [
        (0.012, 0.005),
        (0.050, 0.028),
        (0.102, 0.082),
        (0.055, 0.040),
        (0.090, 0.008),
        (0.040, -0.006),
        (0.016, -0.018),
    ]
    p.append(prism(m["bat"], wing, y0=-0.005, y1=0.004))
    p.append(prism(m["bat"], mirror_x(wing), y0=-0.005, y1=0.004))
    # Finger spars so the wing reads at thumbnail size.
    for sign in (-1, 1):
        p.append(cyl(m["batdk"], (sign * 0.055, -0.006, 0.048), 0.004, 0.09, rot=(0.5, 0, sign * -0.7), seg=5))
    p.append(sphere(m["batdk"], (0, 0.0, -0.005), (0.028, 0.022, 0.036), seg=12, ring=8))
    p.append(sphere(m["batdk"], (0, -0.008, 0.032), (0.022, 0.018, 0.020), seg=10, ring=8))
    for sign in (-1, 1):
        p.append(cyl(m["batdk"], (sign * 0.016, -0.01, 0.048), 0.010, 0.036, rot=(0.2, 0, sign * -0.3), seg=6, radius2=0.0))
        p.append(sphere(m["eye"], (sign * 0.010, -0.020, 0.034), (0.005, 0.004, 0.005), seg=6, ring=5))
    return commit("bat", p)


def build_bride(m) -> bpy.types.Object:
    p: list[Part] = []
    p.append(sphere(m["bride"], (0, 0.0, -0.012), (0.046, 0.040, 0.052), seg=14, ring=10))
    p.append(sphere(m["hair"], (0, 0.012, 0.02), (0.048, 0.030, 0.040), seg=12, ring=8))
    veil = [
        (-0.058, -0.055),
        (0.058, -0.055),
        (0.062, 0.02),
        (0.028, 0.095),
        (0.0, 0.128),
        (-0.028, 0.095),
        (-0.062, 0.02),
    ]
    # Veil sits just in front of the face; the material is translucent.
    p.append(prism(m["veil"], veil, y0=-0.030, y1=-0.012))
    p.append(cube(m["bride"], (0, 0.0, -0.07), (0.07, 0.04, 0.03)))  # collar
    for x in (-0.016, 0.016):
        p.append(sphere(m["black"], (x, -0.036, 0.0), (0.007, 0.004, 0.006), seg=6, ring=5))
    p.append(cube(m["lip"], (0, -0.040, -0.028), (0.018, 0.006, 0.006)))
    return commit("bride", p)


def build_creature(m) -> bpy.types.Object:
    """Hunched green-grey bust. No flat hair, no bolts — not Frankie."""
    p: list[Part] = []
    p.append(sphere(m["creature"], (0, 0.0, 0.01), (0.070, 0.058, 0.064), seg=14, ring=10))
    p.append(cube(m["creaturedk"], (0, -0.03, 0.03), (0.100, 0.022, 0.022)))  # heavy brow
    p.append(cube(m["creature"], (0, 0.01, -0.05), (0.060, 0.055, 0.045)))  # thick neck
    p.append(cube(m["creature"], (0, 0.02, -0.095), (0.168, 0.080, 0.055)))  # wide hunch
    p.append(sphere(m["creaturedk"], (-0.028, -0.04, 0.006), (0.016, 0.010, 0.012), seg=8, ring=6))
    p.append(sphere(m["bone"], (0.026, -0.04, 0.008), (0.014, 0.008, 0.012), seg=8, ring=6))  # milky eye
    p.append(sphere(m["pupil"], (-0.030, -0.048, 0.006), (0.006, 0.004, 0.006), seg=6, ring=5))
    p.append(cube(m["black"], (0, -0.048, -0.03), (0.046, 0.008, 0.008)))
    for x in (-0.02, 0.0, 0.02):
        p.append(cube(m["black"], (x, -0.05, -0.008), (0.006, 0.006, 0.016)))
    p.append(cube(m["creaturedk"], (0, -0.02, 0.055), (0.03, 0.02, 0.012)))  # scarred dome, no hair
    return commit("creature", p)


def build_elixir(m) -> bpy.types.Object:
    """Round-bottom flask. The paytable id is crow; the symbol is not a bird."""
    p: list[Part] = []
    p.append(sphere(m["elixir"], (0, 0, -0.012), (0.046, 0.046, 0.050), seg=16, ring=12))
    p.append(sphere(m["eglass"], (0, 0, -0.008), (0.058, 0.058, 0.062), seg=16, ring=12))
    p.append(cyl(m["eglass"], (0, 0, 0.062), 0.016, 0.055, seg=12))
    p.append(cyl(m["elixir"], (0, 0, 0.045), 0.010, 0.028, seg=10))
    p.append(cyl(m["brass"], (0, 0, 0.028), 0.062, 0.010, seg=12))
    p.append(cyl(m["cork"], (0, 0, 0.100), 0.020, 0.028, seg=10))
    p.append(sphere(m["practical"], (0.02, -0.03, 0.01), (0.012, 0.008, 0.016), seg=8, ring=6))
    return commit("elixir", p)


# ── cabinet ──────────────────────────────────────────────────────────

def build_cabinet(m) -> list[bpy.types.Object]:
    iron: list[Part] = []
    brass: list[Part] = []
    dark: list[Part] = []
    ox: list[Part] = []
    ceramic: list[Part] = []
    copper: list[Part] = []

    def add(bucket, mat, loc, dim, rot=(0.0, 0.0, 0.0)):
        bucket.append(cube(mat, loc, dim, rot))

    # Shell. Pieces overlap slightly so the silhouette stays closed.
    add(iron, m["iron"], (0, 0.255, 1.02), (1.58, 0.06, 1.66))          # back
    add(iron, m["iron"], (-0.76, -0.02, 1.02), (0.06, 0.56, 1.66))       # left
    add(iron, m["iron"], (0.76, -0.02, 1.02), (0.06, 0.56, 1.66))        # right
    add(iron, m["iron"], (0, -0.02, 1.82), (1.58, 0.58, 0.06))           # top
    add(iron, m["iron"], (0, -0.02, 0.22), (1.58, 0.58, 0.08))           # deck
    # Front bezel around the reel window (opening x ±0.61, z 0.91–1.57).
    add(iron, m["iron"], (0, -0.285, 1.715), (1.64, 0.07, 0.30))         # header
    add(iron, m["iron"], (0, -0.285, 0.835), (1.64, 0.07, 0.15))         # sill over the belly
    add(iron, m["iron"], (0, -0.285, 0.29), (1.64, 0.07, 0.26))          # lower front
    add(iron, m["iron"], (-0.705, -0.285, WIN_CZ), (0.19, 0.07, WIN_H))  # left jamb
    add(iron, m["iron"], (0.705, -0.285, WIN_CZ), (0.19, 0.07, WIN_H))   # right jamb
    add(brass, m["brass"], (0, -0.322, 1.715), (1.68, 0.012, 0.035))
    add(brass, m["brass"], (0, -0.322, 0.835), (1.68, 0.012, 0.028))
    add(brass, m["brassdk"], (-0.79, -0.02, 1.02), (0.025, 0.50, 1.50))
    add(brass, m["brassdk"], (0.79, -0.02, 1.02), (0.025, 0.50, 1.50))

    # Reel bay: back wall, hood, and sill so the strip stays masked.
    add(dark, m["dark"], (0, 0.10, WIN_CZ), (1.20, 0.04, 0.64))
    add(dark, m["dark"], (0, -0.02, 1.70), (1.20, 0.24, 0.16))
    add(dark, m["dark"], (0, -0.02, 0.82), (1.20, 0.24, 0.12))
    for x in reel_xs()[:-1]:
        mid = x + (WIN_W / 5.0) / 2.0
        add(brass, m["brassdk"], (mid, -0.255, WIN_CZ), (0.016, 0.045, WIN_H - 0.02))

    # Plinth and coin tray.
    add(iron, m["iron"], (0, -0.05, 0.09), (1.82, 0.82, 0.16))
    add(brass, m["brassdk"], (0, -0.05, 0.175), (1.74, 0.74, 0.025))
    add(dark, m["dark"], (0, -0.40, 0.105), (0.92, 0.24, 0.028))
    add(brass, m["brass"], (0, -0.515, 0.125), (1.00, 0.035, 0.055))
    add(brass, m["brassdk"], (-0.48, -0.40, 0.13), (0.03, 0.24, 0.06))
    add(brass, m["brassdk"], (0.48, -0.40, 0.13), (0.03, 0.24, 0.06))
    for i, x in enumerate((-0.22, -0.10, 0.00, 0.11, 0.22, 0.05)):
        copper.append(cyl(
            m["brass"] if i % 2 == 0 else m["brassdk"],
            (x, -0.40 - (i % 3) * 0.02, 0.128),
            0.030, 0.007,
            rot=(math.pi / 2, 0, i * 0.4),
            seg=12,
        ))

    # Marquee housing. The plate itself is a separate mesh so three.js can
    # paint the title and the jackpot onto it.
    add(iron, m["iron"], (0, -0.08, 2.06), (1.46, 0.40, 0.52))
    add(brass, m["brass"], (0, -0.08, 2.34), (1.56, 0.32, 0.10))
    add(brass, m["brassdk"], (0, -0.30, 2.06), (1.36, 0.02, 0.40))
    add(ox, m["ox"], (-0.78, -0.10, 1.35), (0.012, 0.16, 0.28))
    add(ox, m["ox"], (0.775, 0.05, 0.70), (0.012, 0.20, 0.22))
    add(ox, m["ox"], (0.70, 0.20, 1.55), (0.10, 0.012, 0.18))

    # Conduit piers.
    for sign in (-1, 1):
        x = sign * 1.02
        add(iron, m["iron"], (x, -0.02, 1.05), (0.11, 0.11, 1.72))
        add(iron, m["iron2"], (x, -0.02, 0.18), (0.24, 0.24, 0.18))
        for z in (0.45, 0.85, 1.25, 1.65):
            add(brass, m["brass"], (x, -0.02, z), (0.145, 0.145, 0.035))
        ceramic.append(cyl(m["ceramic"], (x, -0.02, 1.90), 0.09, 0.028, seg=12))
        ceramic.append(cyl(m["ceramic"], (x, -0.02, 1.945), 0.065, 0.022, seg=12))
        ceramic.append(cyl(m["ceramic"], (x, -0.02, 1.98), 0.042, 0.018, seg=10))
        copper.append(cyl_between(
            m["copper"],
            (x, -0.08, 2.00),
            (sign * 0.62, -0.22, 2.22),
            0.008,
        ))

    # Rivets on the front frame and piers.
    rivets: list[Part] = []
    rivet_pts = []
    for x in (-0.74, 0.74):
        for z in (0.34, 0.78, 1.00, 1.48, 1.66, 1.82):
            rivet_pts.append((x, -0.325, z))
    for z in (0.90, 1.58):
        for x in (-0.55, -0.25, 0.25, 0.55):
            rivet_pts.append((x, -0.325, z))
    for sign in (-1, 1):
        for z in (0.40, 0.70, 1.10, 1.50):
            rivet_pts.append((sign * 1.02 - 0.04, -0.08, z))
            rivet_pts.append((sign * 1.02 + 0.04, -0.08, z))
    for pt in rivet_pts:
        rivets.append(sphere(m["brass"], pt, (0.012, 0.012, 0.012), seg=8, ring=6, smooth=True))

    objs = [
        commit("CabinetIron", iron),
        commit("CabinetBrass", brass),
        commit("CabinetDark", dark),
        commit("CabinetOx", ox),
        commit("CabinetCeramic", ceramic),
        commit("CabinetCopper", copper),
        commit("Rivets", rivets),
        commit("ReelGlass", [cube(m["glass"], (0, -0.300, WIN_CZ), (1.18, 0.008, 0.62))]),
        commit("BellyPlate", [cube(m["dark"], (0, -0.262, 0.58), (1.12, 0.012, 0.34))]),
        commit("BellyGlass", [cube(m["glass"], (0, -0.308, 0.58), (1.16, 0.008, 0.38))]),
        commit("MarqueePlate", [cube(m["dark"], (0, -0.292, 2.04), (1.18, 0.012, 0.32))]),
    ]

    # Bulb rim just outside the reel opening. A few are dead on purpose.
    dead = {3, 14, 25}
    rim = rect_rim(-0.66, 0.66, 0.86, 1.62, 0.105)
    for i, (x, z) in enumerate(rim):
        mat = m["bulbdead"] if i in dead else m["bulb"]
        name = f"BulbDead_{i:02d}" if i in dead else f"Bulb_{i:02d}"
        objs.append(commit(name, [sphere(mat, (x, -0.345, z), (0.017, 0.017, 0.017), seg=10, ring=7)]))
    # Galvanic practicals on the conduit caps. These stay lit.
    objs.append(commit("PracticalL", [sphere(m["practical"], (-1.02, -0.02, 2.04), (0.032, 0.032, 0.032), seg=12, ring=8)]))
    objs.append(commit("PracticalR", [sphere(m["practical"], (1.02, -0.02, 2.04), (0.032, 0.032, 0.032), seg=12, ring=8)]))
    return objs


def cyl_between(mat, a, b, radius) -> Part:
    a_v = Vector(a)
    b_v = Vector(b)
    mid = (a_v + b_v) / 2
    direction = b_v - a_v
    length = max(direction.length, 1e-5)
    quat = direction.to_track_quat("Z", "Y")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=radius, radius2=radius, depth=length)
    bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix.Translation(mid) @ quat.to_matrix().to_4x4())
    return bm, mat, True


def rect_rim(x0: float, x1: float, z0: float, z1: float, step: float) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []

    def push(x, z):
        key = (round(x, 3), round(z, 3))
        if key not in {(round(p[0], 3), round(p[1], 3)) for p in pts}:
            pts.append((x, z))

    x = x0
    while x <= x1 + 1e-6:
        push(x, z0)
        x += step
    z = z0 + step
    while z <= z1 + 1e-6:
        push(x1, z)
        z += step
    x = x1 - step
    while x >= x0 - 1e-6:
        push(x, z1)
        x -= step
    z = z1 - step
    while z >= z0 + step - 1e-6:
        push(x0, z)
        z -= step
    return pts


def build_lever(m) -> bpy.types.Object:
    """Hinge at the origin, arm along +Z (glTF +Y). Three.js rotates X to pull it."""
    p: list[Part] = []
    p.append(cyl(m["iron"], (0, 0, 0), 0.032, 0.12, rot=(0, math.pi / 2, 0), seg=12))
    p.append(cyl(m["brassdk"], (0, 0, 0), 0.045, 0.03, rot=(0, math.pi / 2, 0), seg=12))
    p.append(cyl(m["iron2"], (0, 0, 0.26), 0.016, 0.50, seg=10))
    p.append(sphere(m["brass"], (0, 0, 0.55), (0.058, 0.058, 0.058), seg=14, ring=10))
    p.append(sphere(m["brassdk"], (0, 0, 0.55), (0.064, 0.064, 0.022), seg=12, ring=8))
    p.append(cyl(m["ox"], (0, 0, 0.40), 0.022, 0.03, seg=8))
    return commit("Lever", p)


def write_layout() -> None:
    xs = ", ".join(f"{x:.6f}" for x in reel_xs())
    hx, hy, hz = LEVER_HINGE
    lx, ly, lz = gltf_point(hx, hy, hz)
    _rx, ry, rz = gltf_point(0.0, REEL_Y, WIN_CZ)
    text = f"""// Generated by blender/build_models.py. Do not hand-edit the reel window;
// camera framing is part of the same file so the view stays next to the hinge.

export const layout = {{
  cell: {CELL:.6f},
  reelCenterY: {ry:.6f},
  reelZ: {rz:.6f},
  reelX: [{xs}],
  window: {{ width: {WIN_W:.6f}, height: {WIN_H:.6f} }},
  lever: [{lx:.6f}, {ly:.6f}, {lz:.6f}] as [number, number, number],
  camera: {{
    position: [0, 0.98, 3.85] as [number, number, number],
    target: [0, 1.18, 0.02] as [number, number, number],
    fov: 36,
  }},
  cameraPhone: {{
    position: [0, 1.15, 5.4] as [number, number, number],
    target: [0, 0.92, 0] as [number, number, number],
    fov: 38,
  }},
}} as const;
"""
    os.makedirs(os.path.dirname(LAYOUT_PATH), exist_ok=True)
    with open(LAYOUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(text)
    log(f"wrote {LAYOUT_PATH}")


def export_glb(path: str, objs: list[bpy.types.Object]) -> None:
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    kwargs = {
        "filepath": path,
        "export_format": "GLB",
        "use_selection": True,
    }
    rna = bpy.ops.export_scene.gltf.get_rna_type()
    names = {prop.identifier for prop in rna.properties}
    if "export_yup" in names:
        kwargs["export_yup"] = True
    if "export_apply" in names:
        kwargs["export_apply"] = True
    if "export_texcoords" in names:
        kwargs["export_texcoords"] = True
    if "export_normals" in names:
        kwargs["export_normals"] = True
    if "export_materials" in names:
        kwargs["export_materials"] = "EXPORT"
    bpy.ops.export_scene.gltf(**kwargs)
    size = os.path.getsize(path)
    if size < 800:
        raise RuntimeError(f"{path} is only {size} bytes")
    log(f"exported {os.path.basename(path)} ({size} bytes)")


def assert_symbol(obj: bpy.types.Object) -> None:
    lo, hi = bounds_of(obj)
    size = hi - lo
    # Front of each icon is -Y. Something must stick toward the camera.
    if lo.y > -0.02:
        raise RuntimeError(f"{obj.name} does not face -Y (min Y {lo.y:.3f})")
    if size.z < 0.08 or size.x < 0.06:
        raise RuntimeError(f"{obj.name} silhouette too small {tuple(size)}")
    if size.z > 0.32 or size.x > 0.30:
        raise RuntimeError(f"{obj.name} too large {tuple(size)}")
    log(f"  {obj.name:10}  {tri_count(obj):5d} tris  size {size.x:.3f} × {size.y:.3f} × {size.z:.3f}  front Y {lo.y:.3f}")


def main() -> None:
    log("reset")
    reset_scene()
    m = materials()
    log("cabinet")
    cabinet = build_cabinet(m)
    log("lever")
    lever = build_lever(m)
    log("symbols")
    builders = [
        ("frank", build_frank),
        ("wolf", build_wolf),
        ("moth", build_moth),
        ("bat", build_bat),
        ("bride", build_bride),
        ("creature", build_creature),
        ("elixir", build_elixir),
    ]
    symbols = [(name, fn(m)) for name, fn in builders]
    log("bounds")
    for _name, obj in symbols:
        assert_symbol(obj)
    lo, hi = bounds_of(lever)
    if lo.z > -0.02 or hi.z < 0.4:
        raise RuntimeError(f"lever extent unexpected {lo} {hi}")
    log(f"  lever tris {tri_count(lever)} height {hi.z - lo.z:.3f}")

    os.makedirs(MODEL_DIR, exist_ok=True)
    write_layout()

    log("export symbols and lever at the origin")
    for name, obj in symbols:
        loc = obj.location.copy()
        obj.location = (0.0, 0.0, 0.0)
        export_glb(os.path.join(MODEL_DIR, f"{name}.glb"), [obj])
        obj.location = loc
    lever_loc = lever.location.copy()
    lever.location = (0.0, 0.0, 0.0)
    export_glb(os.path.join(MODEL_DIR, "lever.glb"), [lever])
    lever.location = Vector(LEVER_HINGE)

    export_glb(os.path.join(MODEL_DIR, "cabinet.glb"), cabinet)

    # Line the icons up beside the machine so the .blend is inspectable.
    for i, (_name, obj) in enumerate(symbols):
        obj.location = (-1.6 + i * 0.42, -1.15, 0.25)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    log(f"saved {BLEND_PATH}")
    log("DONE")


if __name__ == "__main__":
    main()
