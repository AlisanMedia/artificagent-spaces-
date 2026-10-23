"""Fixed synthetic CAD builder/render fixture; never run customer Python or .blend files."""
import argparse
import hashlib
import json
import math
import os
import sys
from pathlib import Path

SOURCE_SHA = "ff04bf1b34623655d6c7161c616ee63abb632fe4db90279b50d67ce0a9364731"


def build(source, out):
    import bpy
    from mathutils import Vector
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = source["lighting"]["samples"]
    scene.cycles.seed = source["lighting"]["seed"]
    scene.cycles.use_denoising = False
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    scene.render.resolution_x = 640
    scene.render.resolution_y = 360
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0
    scene.world.color = (0.35, 0.35, 0.35)
    materials = {}
    for row in source["materials"]:
        mat = bpy.data.materials.new(row["id"])
        mat.use_nodes = True
        mat.diffuse_color = tuple(row["rgb"]) + (1,)
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = mat.diffuse_color
        bsdf.inputs["Roughness"].default_value = row["roughness"]
        materials[row["id"]] = mat

    def box(name, center, dimensions, material):
        bpy.ops.mesh.primitive_cube_add(size=1, location=center)
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = dimensions
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.data.materials.append(materials[material])
        obj["synthetic"] = True
        obj["source_sha256"] = SOURCE_SHA

    rooms = source["scene"]["rooms"]
    planes = {}
    for r in rooms:
        box("floor_"+r["id"], (r["x"]+r["width"]/2, -r["z"]-r["depth"]/2, -0.06), (r["width"],r["depth"],0.12),r["material"])
        for axis,at,low,high in [("x",r["x"],r["z"],r["z"]+r["depth"]),("x",r["x"]+r["width"],r["z"],r["z"]+r["depth"]),("z",r["z"],r["x"],r["x"]+r["width"]),("z",r["z"]+r["depth"],r["x"],r["x"]+r["width"])]:
            planes.setdefault((axis,at),[]).append((low,high,r["height"]))
    wall_count = 0
    for (axis,at),spans in sorted(planes.items()):
        gaps = []
        for d in source["scene"]["doors"]:
            if d["axis"]==axis and abs(d["at"]-at)<0.0001: gaps.append((d["center"]-d["width"]/2,d["center"]+d["width"]/2,0,2.2))
        for w in source["windows"]:
            if w["axis"]==axis and abs(w["at"]-at)<0.0001: gaps.append((w["center"]-w["width"]/2,w["center"]+w["width"]/2,w["sill"],w["sill"]+w["height"]))
        cuts=sorted(set([v for s in spans for v in s[:2]]+[v for g in gaps for v in g[:2]]))
        for low,high in zip(cuts,cuts[1:]):
            mid=(low+high)/2
            covering=[s for s in spans if s[0]<=mid<=s[1]]
            if not covering: continue
            height=max(s[2] for s in covering)
            gap=next((g for g in gaps if g[0]<=mid<=g[1]),None)
            vertical=[(0,height)] if gap is None else [(0,gap[2]),(gap[3],height)]
            for bottom,top in vertical:
                if top-bottom<0.0001: continue
                wall_count+=1
                if axis=="x": center,dims=(at,-mid,(bottom+top)/2),(0.12,high-low,top-bottom)
                else: center,dims=(mid,-at,(bottom+top)/2),(high-low,0.12,top-bottom)
                box("wall_"+str(wall_count),center,dims,"plaster")

    bpy.ops.object.light_add(type="AREA",location=(5,-3.5,6))
    light=bpy.context.object
    light.name="artistic-area-light-not-calibrated-sun"
    light.data.energy=1100
    light.data.shape="DISK"
    light.data.size=6
    glb=out/"property.glb"
    # Mesh-only export: no external texture, hidden camera or customer metadata.
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    observations=[]
    def blender_point(v): return Vector((v[0],-v[2],v[1]))
    for c in source["cameras"]:
        position,target=blender_point(c["position"]),blender_point(c["target"])
        bpy.ops.object.camera_add(location=position)
        camera=bpy.context.object
        camera.name=c["id"]
        camera.rotation_euler=(target-position).to_track_quat("-Z","Y").to_euler()
        camera.data.sensor_fit="VERTICAL"
        camera.data.angle=math.radians(c["verticalFovDegrees"])
        scene.camera=camera
        bpy.context.view_layer.update()
        visibility=[]
        for w in source["windows"]:
            if w["roomId"]!=c["roomId"]: continue
            p=[w["at"],w["sill"]+w["height"]/2,w["center"]] if w["axis"]=="x" else [w["center"],w["sill"]+w["height"]/2,w["at"]]
            ray=blender_point(p)-position
            hit=scene.ray_cast(bpy.context.evaluated_depsgraph_get(),position,ray.normalized(),distance=ray.length-0.001)[0]
            visibility.append({"windowId":w["id"],"unobstructedToAperture":not hit})
        scene.render.filepath=str(out/(c["roomId"]+".png"))
        bpy.ops.render.render(write_still=True)
        observations.append({"cameraId":c["id"],"roomId":c["roomId"],"position":c["position"],"target":c["target"],"verticalFovDegrees":c["verticalFovDegrees"],"resolution":[640,360],"visibility":visibility})
        bpy.data.objects.remove(camera,do_unlink=True)
    (out/"blender-observations.json").write_text(json.dumps({"sourceSha256":SOURCE_SHA,"blenderVersion":bpy.app.version_string,"metricScale":1,"openRoofCutaway":True,"denoising":False,"walls":wall_count,"observations":observations},indent=2)+"\n")


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--source",required=True)
    p.add_argument("--output",required=True)
    args=p.parse_args(sys.argv[sys.argv.index("--")+1:])
    data=Path(args.source).read_bytes()
    if len(data)>200000 or hashlib.sha256(data).hexdigest()!=SOURCE_SHA: raise ValueError("UNTRUSTED_GOLDEN_SOURCE")
    source=json.loads(data)
    if source["realProperty"] is not False or source["rights"]!="PROJECT_AUTHORED_SYNTHETIC": raise ValueError("SYNTHETIC_ONLY")
    out=Path(args.output)
    out.mkdir(parents=True,exist_ok=True)
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CPU,(170,175))
        resource.setrlimit(resource.RLIMIT_FSIZE,(16000000,16000000))
    except ImportError:
        raise RuntimeError("LINUX_RESOURCE_LIMITS_REQUIRED")
    build(source,out)
    if sum(f.stat().st_size for f in out.iterdir() if f.is_file())>24000000: raise ValueError("GOLDEN_OUTPUT_QUOTA")
