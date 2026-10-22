"""Allowlisted measured synthetic scene builder. No eval, URLs, uploaded code or .blend files.
Run: blender --background --factory-startup --disable-autoexec --python scripts/blender-scene.py -- --manifest FILE --output FILE.glb
"""
import argparse
import json
import math
import os
import sys


def checked_manifest(value):
    if value.get("source") != "synthetic" or not value.get("measuredBy"):
        raise ValueError("VERIFIED_SYNTHETIC_PLAN_REQUIRED")
    rooms = value.get("rooms", [])
    if not 1 <= len(rooms) <= 30:
        raise ValueError("ROOM_LIMIT")
    for room in rooms:
        if room.get("truth") != "E2" or not room.get("evidenceIds"):
            raise ValueError("E2_EVIDENCE_REQUIRED")
        for key in ["x", "z", "width", "depth", "height"]:
            number = room[key]
            if not isinstance(number, (int, float)) or not math.isfinite(number) or abs(number) > 100:
                raise ValueError("INVALID_MEASUREMENT")
        if min(room["width"], room["depth"]) < 1 or not 2 <= room["height"] <= 8:
            raise ValueError("INVALID_SCALE")
    return value


def wall_segments(room, doors):
    result = []
    for axis, at, start, end in [("x", room["x"], room["z"], room["z"] + room["depth"]), ("x", room["x"] + room["width"], room["z"], room["z"] + room["depth"]), ("z", room["z"], room["x"], room["x"] + room["width"]), ("z", room["z"] + room["depth"], room["x"], room["x"] + room["width"])]:
        gaps = sorted([(d["center"] - d["width"] / 2, d["center"] + d["width"] / 2) for d in doors if d["axis"] == axis and abs(d["at"] - at) < 0.001 and room["id"] in [d["from"], d["to"]]])
        cursor = start
        for low, high in gaps:
            if cursor < low:
                result.append((axis, at, cursor, low, 0, room["height"]))
            result.append((axis, at, low, high, 2.2, room["height"] - 2.2))
            cursor = high
        if cursor < end:
            result.append((axis, at, cursor, end, 0, room["height"]))
    return result


def build(manifest, output):
    import bpy
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    materials = {}
    for name, color in [("plaster", (0.77, 0.74, 0.68, 1)), ("oak", (0.43, 0.29, 0.17, 1)), ("stone", (0.45, 0.46, 0.45, 1))]:
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = color
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.55
        materials[name] = mat

    def box(name, center, dimensions, material):
        bpy.ops.mesh.primitive_cube_add(size=1, location=center)
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = dimensions
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.data.materials.append(materials[material])
        obj["synthetic"] = True
        obj["manifest_revision"] = manifest["revision"]

    seen = set()
    for room in manifest["rooms"]:
        box("floor_" + room["id"], (room["x"] + room["width"] / 2, -room["z"] - room["depth"] / 2, -0.06), (room["width"], room["depth"], 0.12), room.get("material", "oak"))
        for axis, at, low, high, bottom, height in wall_segments(room, manifest.get("doors", [])):
            key = (axis, at, low, high, bottom, height)
            if key in seen or height <= 0:
                continue
            seen.add(key)
            if axis == "x":
                center, dimensions = (at, -(low + high) / 2, bottom + height / 2), (0.12, high - low, height)
            else:
                center, dimensions = ((low + high) / 2, -at, bottom + height / 2), (high - low, 0.12, height)
            box("wall_" + str(len(seen)), center, dimensions, "plaster")
    # No invented windows, balconies, exterior or real furniture. Open roof is a cutaway representation.
    bpy.ops.export_scene.gltf(filepath=output, export_format="GLB", export_yup=True, export_extras=True)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    options = parser.parse_args(args)
    if not options.output.endswith(".glb") or os.path.getsize(options.manifest) > 200_000:
        raise ValueError("INVALID_BUILD_INPUT")
    with open(options.manifest, encoding="utf-8") as file:
        manifest = checked_manifest(json.load(file))
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (110, 115))
    except ImportError:
        pass
    build(manifest, options.output)
