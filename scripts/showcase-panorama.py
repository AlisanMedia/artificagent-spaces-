"""Allowlisted synthetic fixture only; a true equirectangular render, no customer inputs."""
import bpy, json, math, pathlib
from mathutils import Vector
root = pathlib.Path(__file__).resolve().parent.parent
plan = json.loads((root / 'fixtures/golden-v5/source.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / 'public/golden-v5/property.glb'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.seed = 55
scene.cycles.use_denoising = False
scene.render.threads_mode = 'FIXED'
scene.render.threads = 2
scene.render.resolution_x = 1024
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Synthetic daylight')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.65,.72,.8,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7
bpy.ops.object.light_add(type='SUN', rotation=(.5,-.4,-.6))
bpy.context.object.data.energy = 2
camera = next(c for c in plan['cameras'] if c['id'] == 'camera-living')
def xyz(p):
    return (p[0], -p[2], p[1])
bpy.ops.object.camera_add(location=xyz(camera['position']))
cam = bpy.context.object
cam.rotation_euler = (Vector(xyz(camera['target'])) - cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type = 'PANO'
cam.data.panorama_type = 'EQUIRECTANGULAR'
scene.camera = cam
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(root / '.spaces-local/showcase-v55/panorama.png')
bpy.ops.render.render(write_still=True)
print('SYNTHETIC_EQUIRECTANGULAR_1024_512_COMPLETE')
