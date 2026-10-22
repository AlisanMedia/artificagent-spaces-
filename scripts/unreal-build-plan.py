"""Offline build-plan validator. Does not run Unreal, create cloud/GPU resources or assert EULA approval."""
import argparse
import hashlib
import json
from pathlib import Path


def plan(mesh_path):
    path = Path(mesh_path).resolve()
    if path.suffix != ".glb" or not path.is_file() or path.stat().st_size > 52428800:
        raise ValueError("LOCAL_GLB_REQUIRED")
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise ValueError("GLB_HEADER_REQUIRED")
    return {
        "enabled": False,
        "mesh_sha256": hashlib.sha256(data).hexdigest(),
        "engine_build_tested": False,
        "required_approvals": ["Unreal seats/distribution/EULA", "isolated local licensed project", "GPU budget for streaming"],
        "allowlisted_editor_steps": ["import reviewed local GLB into /Game/Spaces/Fixture", "metric meters to Unreal centimeters x100", "validate door collisions and navmesh", "project-approved Lumen settings", "optional fixed Niagara sunbeam dust", "package Win64/Linux after compatibility test", "isolated Pixel Streaming broker with expiring tenant leases"],
        "commands_as_documentation_only": ["UnrealEditor <reviewed-local-project>.uproject -unattended -NullRHI -ExecutePythonScript=<fixed-reviewed-import-template>", "RunUAT BuildCookRun -project=<reviewed-local-project>.uproject -build -cook -stage -pak -archive"],
        "actual_gpu_concurrency": None,
        "external_spend_usd": 0,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mesh", required=True)
    args = parser.parse_args()
    print(json.dumps(plan(args.mesh), indent=2))
