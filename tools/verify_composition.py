#!/usr/bin/env python3
"""Ground-truth verification of the composition MCQ answers.

For each scenario we author real USDA layers, compose the stage with pxr, and
read the resolved opinion. The printed PASS/FAIL is the unambiguous answer.
"""
import os, shutil, tempfile
from pxr import Usd

ROOT = tempfile.mkdtemp(prefix="usd_mcq_")
results = []

def write_case(name, files):
    d = os.path.join(ROOT, name)
    os.makedirs(d, exist_ok=True)
    for fn, body in files.items():
        with open(os.path.join(d, fn), "w") as f:
            f.write(body.lstrip("\n"))
    return d

def check(name, desc, actual, expected):
    ok = actual == expected
    results.append((name, ok, actual, expected, desc))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: {desc}\n        got={actual!r} expected={expected!r}")

def vec(v):
    return (round(v[0], 6), round(v[1], 6), round(v[2], 6)) if v is not None else None

# ---- T1: root-layer local 'over' beats both sublayers ----
d = write_case("t1", {
 "strong.usda": '#usda 1.0\ndef "Car" {\n  custom string color = "red"\n}\n',
 "weak.usda":   '#usda 1.0\ndef "Car" {\n  custom string color = "blue"\n}\n',
 "root.usda":   '#usda 1.0\n(subLayers = [@strong.usda@, @weak.usda@])\nover "Car" {\n  custom string color = "root"\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "root.usda"))
check("T1(orig#1)", "root sublayer over beats both sublayers",
      s.GetAttributeAtPath("/Car.color").Get(), "root")

# ---- T2: no root opinion -> earlier sublayer wins ----
d = write_case("t2", {
 "strong.usda": '#usda 1.0\ndef "Car" {\n  custom string color = "red"\n}\n',
 "weak.usda":   '#usda 1.0\ndef "Car" {\n  custom string color = "blue"\n}\n',
 "root.usda":   '#usda 1.0\n(subLayers = [@strong.usda@, @weak.usda@])\n',
})
s = Usd.Stage.Open(os.path.join(d, "root.usda"))
check("T2(orig#2)", "earlier sublayer stronger",
      s.GetAttributeAtPath("/Car.color").Get(), "red")

# ---- T3: local opinion beats referenced opinion ----
d = write_case("t3", {
 "asset.usda": '#usda 1.0\ndef "Model" {\n  custom int size = 1\n}\n',
 "shot.usda":  '#usda 1.0\ndef "Model" (\n  prepend references = @asset.usda@</Model>\n) {\n  custom int size = 2\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "shot.usda"))
check("T3(orig#3)", "local beats reference",
      s.GetAttributeAtPath("/Model.size").Get(), 2)

# ---- T4: reference stronger than payload (payload loaded) ----
d = write_case("t4", {
 "ref.usda": '#usda 1.0\ndef "Model" {\n  custom int lod = 1\n}\n',
 "pay.usda": '#usda 1.0\ndef "Model" {\n  custom int lod = 2\n}\n',
 "root.usda":'#usda 1.0\ndef "Model" (\n  prepend references = @ref.usda@</Model>\n  prepend payload = @pay.usda@</Model>\n) {\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "root.usda"))
check("T4(orig#4)", "reference stronger than payload",
      s.GetAttributeAtPath("/Model.lod").Get(), 1)

# ---- T5: selected variant stronger than reference ----
d = write_case("t5", {
 "asset.usda": '#usda 1.0\ndef "Car" {\n  custom string color = "red"\n}\n',
 "root.usda": '#usda 1.0\n'
   'def "Car" (\n  prepend references = @asset.usda@</Car>\n'
   '  variants = { string look = "sport" }\n  prepend variantSets = "look"\n) {\n'
   '  variantSet "look" = {\n    "sport" {\n      custom string color = "green"\n    }\n  }\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "root.usda"))
check("T5(orig#5)", "variant stronger than reference",
      s.GetAttributeAtPath("/Car.color").Get(), "green")

# ---- T6: inherits stronger than variant ----
d = write_case("t6", {
 "root.usda": '#usda 1.0\n'
   'class "_class" {\n  custom token purpose = "render"\n}\n'
   'def "Asset" (\n  inherits = </_class>\n'
   '  variants = { string v = "a" }\n  prepend variantSets = "v"\n) {\n'
   '  variantSet "v" = {\n    "a" {\n      custom token purpose = "proxy"\n    }\n  }\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "root.usda"))
check("T6(orig#6)", "inherits stronger than variant",
      s.GetAttributeAtPath("/Asset.purpose").Get(), "render")

# ---- T7: local stronger than inherits ----
d = write_case("t7", {
 "root.usda": '#usda 1.0\n'
   'class "_class" {\n  custom float mass = 10\n}\n'
   'def "Robot" (\n  inherits = </_class>\n) {\n  custom float mass = 25\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "root.usda"))
check("T7(orig#7)", "local stronger than inherits",
      s.GetAttributeAtPath("/Robot.mass").Get(), 25.0)

# ---- T8: reference stronger than specializes (ref=0.2, base=0.8) ----
d = write_case("t8", {
 "asset.usda": '#usda 1.0\ndef "FancyMat" {\n  custom float roughness = 0.2\n}\n',
 "root.usda": '#usda 1.0\n'
   'def "BaseMat" {\n  custom float roughness = 0.8\n}\n'
   'def "FancyMat" (\n  prepend references = @asset.usda@</FancyMat>\n  specializes = </BaseMat>\n) {\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "root.usda"))
check("T8(orig#8)", "reference stronger than specializes",
      round(s.GetAttributeAtPath("/FancyMat.roughness").Get(), 6), 0.2)

# ---- T9: unloaded payload contributes nothing (no local) ----
d = write_case("t9", {
 "pay.usda": '#usda 1.0\ndef "Robot" {\n  custom float mass = 100\n}\n',
 "root.usda":'#usda 1.0\ndef "Robot" (\n  prepend payload = @pay.usda@</Robot>\n) {\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "root.usda"), load=Usd.Stage.LoadNone)
_a = s.GetAttributeAtPath("/Robot.mass")
check("T9(orig#9)", "unloaded payload -> no composed mass (attr not present)",
      (_a.Get() if _a and _a.IsValid() else None), None)

# ---- T10: local beats a reference nested inside a selected variant ----
d = write_case("t10", {
 "asset.usda": '#usda 1.0\ndef "X" {\n  custom int quality = 2\n}\n',
 "root.usda": '#usda 1.0\n'
   'def "Model" (\n  variants = { string v = "A" }\n  prepend variantSets = "v"\n) {\n'
   '  custom int quality = 5\n'
   '  variantSet "v" = {\n    "A" (\n      prepend references = @asset.usda@</X>\n    ) {\n    }\n  }\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "root.usda"))
check("T10(orig#10)", "local beats reference nested in variant",
      s.GetAttributeAtPath("/Model.quality").Get(), 5)

# ================= NEW HARD QUESTIONS =================

# ---- T11 (new#1): exact study-guide Q2 -> (0,1,0) ----
d = write_case("t11", {
 "chair_base.usda": '#usda 1.0\n(defaultPrim = "Chair")\n'
   'def Xform "Chair" {\n  double3 xformOp:translate = (0, 0, 0)\n'
   '  uniform token[] xformOpOrder = ["xformOp:translate"]\n}\n',
 "chair_repositioned.usda": '#usda 1.0\n(defaultPrim = "Chair")\n'
   'def Xform "Chair" {\n  double3 xformOp:translate = (1, 0, 0)\n}\n',
 "scene.usda": '#usda 1.0\n'
   'def Xform "World" {\n  def Xform "Chair" (\n'
   '    prepend references = [@chair_base.usda@, @chair_repositioned.usda@]\n  ) {\n'
   '    double3 xformOp:translate = (0, 1, 0)\n  }\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "scene.usda"))
check("T11(new#1)", "Q2: local opinion wins over both refs",
      vec(s.GetAttributeAtPath("/World/Chair.xformOp:translate").Get()), (0.0, 1.0, 0.0))

# ---- T12 (new#2): same, no local -> first prepend ref (0,0,0) ----
d = write_case("t12", {
 "chair_base.usda": '#usda 1.0\n(defaultPrim = "Chair")\n'
   'def Xform "Chair" {\n  double3 xformOp:translate = (0, 0, 0)\n'
   '  uniform token[] xformOpOrder = ["xformOp:translate"]\n}\n',
 "chair_repositioned.usda": '#usda 1.0\n(defaultPrim = "Chair")\n'
   'def Xform "Chair" {\n  double3 xformOp:translate = (1, 0, 0)\n}\n',
 "scene.usda": '#usda 1.0\n'
   'def Xform "World" {\n  def Xform "Chair" (\n'
   '    prepend references = [@chair_base.usda@, @chair_repositioned.usda@]\n  ) {\n  }\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "scene.usda"))
check("T12(new#2)", "no local: earliest prepend ref (base) wins",
      vec(s.GetAttributeAtPath("/World/Chair.xformOp:translate").Get()), (0.0, 0.0, 0.0))

# ---- T13 (new#3): prepend vs append references ----
d = write_case("t13", {
 "strong.usda": '#usda 1.0\ndef "Prop" {\n  custom int size = 2\n}\n',
 "weak.usda":   '#usda 1.0\ndef "Prop" {\n  custom int size = 1\n}\n',
 "scene.usda": '#usda 1.0\n'
   'def "Prop" (\n  prepend references = @strong.usda@</Prop>\n'
   '  append references = @weak.usda@</Prop>\n) {\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "scene.usda"))
check("T13(new#3)", "prepend ref beats append ref",
      s.GetAttributeAtPath("/Prop.size").Get(), 2)

# ---- T14 (new#4): weak sublayer (Local) beats reference ----
d = write_case("t14", {
 "detail.usda": '#usda 1.0\nover "Prop" {\n  custom token color = "blue"\n}\n',
 "asset.usda":  '#usda 1.0\ndef "Prop" {\n  custom token color = "red"\n}\n',
 "root.usda": '#usda 1.0\n(subLayers = [@detail.usda@])\n'
   'def "Prop" (\n  prepend references = @asset.usda@</Prop>\n) {\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "root.usda"))
check("T14(new#4)", "sublayer (Local) beats reference",
      s.GetAttributeAtPath("/Prop.color").Get(), "blue")

# ---- T15 (new#5): root variant selection overrides asset's selection ----
d = write_case("t15", {
 "asset.usda": '#usda 1.0\n(defaultPrim = "Car")\n'
   'def "Car" (\n  variants = { string lod = "high" }\n  prepend variantSets = "lod"\n) {\n'
   '  variantSet "lod" = {\n    "high" {\n      custom token res = "4k"\n    }\n'
   '    "low" {\n      custom token res = "1k"\n    }\n  }\n}\n',
 "scene.usda": '#usda 1.0\n'
   'def "Car" (\n  prepend references = @asset.usda@\n'
   '  variants = { string lod = "low" }\n) {\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "scene.usda"))
check("T15(new#5)", "root variant selection overrides referenced selection",
      s.GetAttributeAtPath("/Car.res").Get(), "1k")

# ---- T16 (new#6): inherits beats reference ----
d = write_case("t16", {
 "asset.usda": '#usda 1.0\ndef "Robot" {\n  custom token color = "red"\n}\n',
 "scene.usda": '#usda 1.0\n'
   'class "_Robots" {\n  custom token color = "green"\n}\n'
   'def "Robot" (\n  inherits = </_Robots>\n  prepend references = @asset.usda@</Robot>\n) {\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "scene.usda"))
check("T16(new#6)", "inherits beats reference",
      s.GetAttributeAtPath("/Robot.color").Get(), "green")

# ---- T17 (new#7): reference beats specializes base ----
d = write_case("t17", {
 "asset.usda": '#usda 1.0\ndef "FancyMat" {\n  custom float roughness = 0.9\n}\n',
 "scene.usda": '#usda 1.0\n'
   'def "BaseMat" {\n  custom float roughness = 0.1\n}\n'
   'def "FancyMat" (\n  prepend references = @asset.usda@</FancyMat>\n  specializes = </BaseMat>\n) {\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "scene.usda"))
check("T17(new#7)", "reference beats specializes",
      round(s.GetAttributeAtPath("/FancyMat.roughness").Get(), 6), 0.9)

# ---- T18 (new#8): nested references, encapsulation ----
d = write_case("t18", {
 "body.usda": '#usda 1.0\n(defaultPrim = "Body")\ndef "Body" {\n  custom int height = 170\n}\n',
 "char.usda": '#usda 1.0\n(defaultPrim = "Char")\n'
   'def "Char" (\n  prepend references = @body.usda@</Body>\n) {\n  custom int height = 180\n}\n',
 "shot.usda": '#usda 1.0\n'
   'def "Hero" (\n  prepend references = @char.usda@</Char>\n) {\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "shot.usda"))
check("T18(new#8)", "nested ref: inner local (180) travels through",
      s.GetAttributeAtPath("/Hero.height").Get(), 180)

# ---- T19 (new#9): active=false prunes the subtree ----
d = write_case("t19", {
 "asset.usda": '#usda 1.0\n(defaultPrim = "Lamp")\n'
   'def "Lamp" {\n  custom float intensity = 500\n  def Mesh "Shade" {\n  }\n}\n',
 "scene.usda": '#usda 1.0\n'
   'def "Lamp" (\n  prepend references = @asset.usda@\n  active = false\n) {\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "scene.usda"))
p = s.GetPrimAtPath("/Lamp")
pruned = (p.IsActive() is False) and (len(list(p.GetChildren())) == 0)
check("T19(new#9)", "active=false -> inactive + subtree pruned",
      pruned, True)

# ---- T20 (new#10): unloaded payload but local mass outside payload ----
d = write_case("t20", {
 "pay.usda": '#usda 1.0\ndef "Robot" {\n  custom float mass = 100\n}\n',
 "scene.usda": '#usda 1.0\n'
   'def "Robot" (\n  prepend payload = @pay.usda@</Robot>\n) {\n  custom float mass = 5\n}\n',
})
s = Usd.Stage.Open(os.path.join(d, "scene.usda"), load=Usd.Stage.LoadNone)
check("T20(new#10)", "unloaded payload, local mass=5 still composes",
      round(s.GetAttributeAtPath("/Robot.mass").Get(), 6), 5.0)

# ================= summary =================
print("\n" + "=" * 60)
passed = sum(1 for _, ok, *_ in results if ok)
print(f"RESULT: {passed}/{len(results)} scenarios verified by USD composition")
for name, ok, actual, expected, desc in results:
    if not ok:
        print(f"  !! {name} FAILED: got {actual!r}, expected {expected!r}")
shutil.rmtree(ROOT, ignore_errors=True)
print("(cleaned temp dir)")
