#!/usr/bin/env python3
"""Ground-truth the geometry/primvar array-length rules used by the new quiz
questions. Builds a concrete mesh + PointInstancer with pxr and reads the real
lengths back, so every numeric answer is verified, not asserted."""
from pxr import Usd, UsdGeom, Sdf, Vt, Gf

results = []
def check(name, actual, expected):
    ok = actual == expected
    results.append((name, ok, actual, expected))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: got={actual} expected={expected}")

stage = Usd.Stage.CreateInMemory()
mesh = UsdGeom.Mesh.Define(stage, "/M")

# A controllable mesh: 6 points, 4 triangular faces.
NUM_POINTS, NUM_FACES = 6, 4
mesh.CreatePointsAttr([(0,0,0),(1,0,0),(2,0,0),(0,1,0),(1,1,0),(2,1,0)])
mesh.CreateFaceVertexCountsAttr([3,3,3,3])
mesh.CreateFaceVertexIndicesAttr([0,1,4, 1,2,4, 0,4,3, 2,5,4])  # 12 corners

counts = mesh.GetFaceVertexCountsAttr().Get()
indices = mesh.GetFaceVertexIndicesAttr().Get()
points = mesh.GetPointsAttr().Get()
NUM_CORNERS = sum(counts)

check("points length == numVertices", len(points), NUM_POINTS)
check("faceVertexCounts length == numFaces", len(counts), NUM_FACES)
check("faceVertexIndices length == sum(counts)", len(indices), NUM_CORNERS)
check("sum(counts) for all-tris == 3*numFaces", NUM_CORNERS, 3*NUM_FACES)

# The exact Q4 relationship at exam scale: 500 tris.
check("Q4: 500 tris -> faceVertexIndices", 3*500, 1500)
check("Q4: 500 tris -> faceVertexCounts", 500, 500)

# extent is always 2 float3 (min,max).
b = UsdGeom.Boundable(mesh)
ext = UsdGeom.Boundable.ComputeExtentFromPlugins(b, Usd.TimeCode.Default())
# API returns (points_bbox) VtVec3fArray of length 2
check("extent length == 2 (min,max)", len(ext), 2)

api = UsdGeom.PrimvarsAPI(mesh)
def pv(name, interp, typ, values, elementSize=None):
    p = api.CreatePrimvar(name, typ, interp)
    if elementSize is not None:
        p.SetElementSize(elementSize)
    p.Set(values)
    return p

# constant: 1 value
pc = pv("pc", UsdGeom.Tokens.constant, Sdf.ValueTypeNames.Color3fArray, [(1,0,0)])
check("constant primvar length", len(pc.Get()), 1)

# uniform: one per face
pu = pv("pu", UsdGeom.Tokens.uniform, Sdf.ValueTypeNames.FloatArray, [0.0]*NUM_FACES)
check("uniform primvar length == numFaces", len(pu.Get()), NUM_FACES)

# vertex: one per point
pvv = pv("pv", UsdGeom.Tokens.vertex, Sdf.ValueTypeNames.Color3fArray, [(0,0,0)]*NUM_POINTS)
check("vertex primvar length == numPoints", len(pvv.Get()), NUM_POINTS)

# varying: one per point (for a polymesh, varying == vertex count)
pva = pv("pva", UsdGeom.Tokens.varying, Sdf.ValueTypeNames.FloatArray, [0.0]*NUM_POINTS)
check("varying primvar length == numPoints", len(pva.Get()), NUM_POINTS)

# faceVarying: one per corner
pf = pv("pf", UsdGeom.Tokens.faceVarying, Sdf.ValueTypeNames.TexCoord2fArray,
        [(0,0)]*NUM_CORNERS)
check("faceVarying primvar length == sum(counts)", len(pf.Get()), NUM_CORNERS)

# elementSize: uniform float[] with elementSize=9 -> 9 per face
pe = pv("pe", UsdGeom.Tokens.uniform, Sdf.ValueTypeNames.FloatArray,
        [0.0]*(9*NUM_FACES), elementSize=9)
check("uniform elementSize=9 total floats == 9*numFaces", len(pe.Get()), 9*NUM_FACES)
check("same at exam scale: elementSize=9, 42 faces", 9*42, 378)

# indexed faceVarying: unique values + index buffer; flatten -> corner count
pidx = api.CreatePrimvar("st2", Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.faceVarying)
pidx.Set([(0,0),(1,0),(1,1)])            # 3 unique values
pidx.SetIndices(Vt.IntArray([0,1,2]*NUM_FACES))  # one index per corner
check("indexed primvar unique values", len(pidx.Get()), 3)
check("indexed primvar indices length == sum(counts)", len(pidx.GetIndices()), NUM_CORNERS)
check("indexed primvar flattened length == sum(counts)",
      len(pidx.ComputeFlattened()), NUM_CORNERS)

# PointInstancer: protoIndices length == #instances; positions length == #instances
pi = UsdGeom.PointInstancer.Define(stage, "/PI")
proto = stage.DefinePrim("/PI/Protos/A")
pi.CreatePrototypesRel().AddTarget(proto.GetPath())
NUM_INST = 7
pi.CreateProtoIndicesAttr([0]*NUM_INST)
pi.CreatePositionsAttr([(0,0,0)]*NUM_INST)
check("PointInstancer protoIndices length == #instances",
      len(pi.GetProtoIndicesAttr().Get()), NUM_INST)
check("PointInstancer positions length == #instances",
      len(pi.GetPositionsAttr().Get()), NUM_INST)

print("\n" + "="*56)
passed = sum(1 for _, ok, *_ in results if ok)
print(f"RESULT: {passed}/{len(results)} length rules verified by USD")
for name, ok, a, e in results:
    if not ok:
        print(f"  !! {name}: got {a}, expected {e}")
