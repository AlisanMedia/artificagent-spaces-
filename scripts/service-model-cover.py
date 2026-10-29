"""Fixed local camera over the existing authored GLB. No new property geometry."""
import bpy, pathlib, math
from mathutils import Vector
root = pathlib.Path(__file__).resolve().parent.parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / 'public/golden-v5/property.glb'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 24
scene.cycles.seed = 55
scene.cycles.use_denoising = False
scene.render.threads_mode = 'FIXED'
scene.render.threads = 2
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
points = [o.matrix_world @ Vector(v) for o in scene.objects if o.type == 'MESH' for v in o.bound_box]
lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center = (lo + hi) * .5
scene.world = bpy.data.worlds.new('Warm ivory studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.85,.88,.84,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .8
bpy.ops.object.light_add(type='AREA', location=center + Vector((2,-3,10)))
bpy.context.object.data.energy = 1100
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 8
bpy.ops.object.camera_add(location=center + Vector((12,-16,16)))
camera = bpy.context.object
camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = max(hi.x-lo.x,hi.y-lo.y)*1.65
scene.camera = camera
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(root / '.spaces-local/service-media-inputs/model-cover.png')
bpy.ops.render.render(write_still=True)
