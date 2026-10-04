/* Composition-arc MCQ scenarios. Every stage-computable answer is verified by
   composing real USDA layers in USD Python — see tools/verify_composition.py.
   Exposes window.COMPOSITION_MCQS, consumed by app/app.js. */
window.COMPOSITION_MCQS = [
    {
      q: "root.usda sublayers strong.usda above weak.usda. All three author /Car.color. What is composed?",
      code: `# root.usda
subLayers = [@strong.usda@, @weak.usda@]
over "Car" { string color = "root" }

# strong.usda: /Car.color = "red"
# weak.usda:   /Car.color = "blue"`,
      choices: ["root", "red", "blue", "No value because the opinions conflict"],
      answer: 0,
      why: "The root layer is the strongest layer in its local layer stack. Its local opinion wins over both sublayers."
    },
    {
      q: "The root layer has no color opinion. Which sublayer value composes?",
      code: `# root.usda
subLayers = [@strong.usda@, @weak.usda@]

# strong.usda: /Car.color = "red"
# weak.usda:   /Car.color = "blue"`,
      choices: ["red", "blue", "Both values are preserved as an array", "No value"],
      answer: 0,
      why: "Sublayer order is strength order: earlier entries are stronger than later entries. strong.usda therefore wins."
    },
    {
      q: "A prim references an asset that says size=1, while the referencing prim locally says size=2. What is composed?",
      code: `# asset.usda
def "Model" { int size = 1 }

# shot.usda
def "Model" (
    references = @asset.usda@</Model>
) {
    int size = 2
}`,
      choices: ["1", "2", "3", "The reference is invalid"],
      answer: 1,
      why: "A local opinion on the referencing prim is stronger than the opinion introduced through its reference."
    },
    {
      q: "A referenced asset and a payload both provide the same attribute. No stronger opinion exists. Which arc is stronger?",
      code: `# Conceptual prim index for /Model
reference contributes: int lod = 1
payload contributes:   int lod = 2
# payload is loaded`,
      choices: ["Reference → lod = 1", "Payload → lod = 2", "They have equal strength", "Whichever file was opened last"],
      answer: 0,
      why: "In composition strength ordering, references are stronger than payloads. Loading controls payload participation, not its strength relative to a reference."
    },
    {
      q: "A selected variant says color=green, while a reference says color=red. No local color opinion exists. What is composed?",
      code: `# /Car
variantSet "look" = {
  "sport" { string color = "green" }
}
variantSelection = { string look = "sport" }

# A reference on /Car contributes:
string color = "red"`,
      choices: ["green", "red", "Both, because variants do not participate in strength", "No value"],
      answer: 0,
      why: "Variant opinions are stronger than reference opinions in the prim index, so the selected variant's green value wins."
    },
    {
      q: "An inherited class says purpose=render, while a selected variant says purpose=proxy. No local opinion exists. What is composed?",
      code: `class "_class" { token purpose = "render" }

# /Asset inherits </_class>
# selected variant on /Asset authors:
token purpose = "proxy"`,
      choices: ["render", "proxy", "default", "No value"],
      answer: 0,
      why: "Inherits are stronger than variant opinions. The inherited purpose=render therefore wins."
    },
    {
      q: "A local opinion conflicts with an inherited opinion. What does the composed prim show?",
      code: `class "_class" { float mass = 10 }

def "Robot" (
    inherits = </_class>
) {
    float mass = 25
}`,
      choices: ["10", "25", "17.5", "An error because inherits cannot be overridden"],
      answer: 1,
      why: "Local opinions are strongest among these composition sources, so the local mass=25 overrides the inherited value."
    },
    {
      q: "A reference contributes roughness=0.2 and specializes contributes roughness=0.8. What is composed?",
      code: `# /Material receives:
reference:   float roughness = 0.2
specializes: float roughness = 0.8`,
      choices: ["0.2", "0.8", "0.5", "No value"],
      answer: 0,
      why: "References are stronger than specializes. Specializes is intentionally weak and is useful for fallback-style opinions."
    },
    {
      q: "A prim has only a payload opinion, but its payload is unloaded. What value is visible from that payload?",
      code: `def "Robot" (
    payload = @heavy.usda@</Robot>
) {}

# heavy.usda would contribute:
float mass = 100

# /Robot payload is UNLOADED`,
      choices: ["100", "0", "No authored mass value from the payload is composed", "100, but only in usdview"],
      answer: 2,
      why: "An unloaded payload does not contribute its payload contents to the composed stage. The prim itself can remain, but that payload-authored mass is absent."
    },
    {
      q: "A selected variant contains a reference. The referencing prim also has a local opinion. Which value wins?",
      code: `# selected variant "A" introduces a reference whose asset says:
int quality = 2

# outside the variant, locally on /Model:
int quality = 5`,
      choices: ["2, because the reference is inside the selected variant", "5, because the local opinion is stronger", "Both are equally strong", "The variant cannot contain a reference"],
      answer: 1,
      why: "The local opinion remains stronger. Nesting a reference inside a selected variant does not make that referenced value stronger than a local opinion."
    },
    {
      q: "The stronger sublayer authors an attribute but then deletes that property with a delete list-op in the relevant composition context. Does simple 'strongest authored value wins' reasoning always suffice?",
      code: `# Conceptual question:
# composition can include list-editing and structural effects,
# not only scalar value opinions.`,
      choices: ["Yes; composition only compares scalar values", "No; list-ops and structural composition can affect the result", "Yes; delete operations are ignored during composition", "No; because weaker layers always win for lists"],
      answer: 1,
      why: "Composition is broader than scalar value resolution. List-editing, prim/property specs, activation, variants, and arc structure can change what participates in the final result."
    },
    {
      q: "Which ordering correctly goes from strongest to weakest for these composition arc categories?",
      code: `Local opinions
Inherits
VariantSets
References
Payloads
Specializes`,
      choices: [
        "Local > Inherits > Variants > References > Payloads > Specializes",
        "Local > Variants > Inherits > References > Specializes > Payloads",
        "References > Local > Inherits > Variants > Payloads > Specializes",
        "Local > Inherits > References > Variants > Payloads > Specializes"
      ],
      answer: 0,
      why: "The standard mnemonic is LIVRPS / LIVERPS: Local, Inherits, Variants, References, Payloads, Specializes. Sublayer strength is resolved within the relevant local layer stack."
    },

    /* ===== Harder scenario questions (study-guide Q2 style) ===== */
    {
      q: "HARD — Reconstruct the study-guide case. What is the final composed value of xformOp:translate on /World/Chair?",
      code: `# chair_base.usda
def Xform "Chair" {
    double3 xformOp:translate = (0, 0, 0)
    uniform token[] xformOpOrder = ["xformOp:translate"]
}
# chair_repositioned.usda
def Xform "Chair" {
    double3 xformOp:translate = (1, 0, 0)
}
# scene.usda  (ROOT layer)
def Xform "World" {
    def Xform "Chair" (
        prepend references = [@./chair_base.usda@, @./chair_repositioned.usda@]
    ) {
        double3 xformOp:translate = (0, 1, 0)
    }
}`,
      choices: ["(0, 0, 0)", "(1, 0, 0)", "(0, 1, 0)", "(1, 1, 0)"],
      answer: 2,
      why: "The opinion authored directly on /World/Chair in the root layer is LOCAL — stronger than anything pulled in via the references. So translate = (0, 1, 0). The two referenced layers only supply fallbacks and the xformOpOrder (taken from chair_base, the stronger prepend entry). Opinions are NOT summed."
    },
    {
      q: "HARD — Same files, but now scene.usda authors NO local xformOp:translate on Chair. What composes?",
      code: `# chair_base.usda:         translate = (0, 0, 0)  (+ xformOpOrder)
# chair_repositioned.usda: translate = (1, 0, 0)
# scene.usda (ROOT):
def Xform "World" {
    def Xform "Chair" (
        prepend references = [@./chair_base.usda@, @./chair_repositioned.usda@]
    ) {
        # no local translate now
    }
}`,
      choices: ["(0, 0, 0)", "(1, 0, 0)", "(0, 1, 0)", "No value — the two references conflict"],
      answer: 0,
      why: "With the local opinion gone, the strongest *reference* wins. In a `prepend` list the EARLIEST entry is strongest, so chair_base (0,0,0) beats chair_repositioned (1,0,0). List order is strength order."
    },
    {
      q: "HARD — A prim both prepends and appends a reference, each authoring `size`. What is composed?",
      code: `# strong.usda:  int size = 2
# weak.usda:    int size = 1
# scene.usda (ROOT)
def "Prop" (
    prepend references = @strong.usda@
    append  references = @weak.usda@
) {}`,
      choices: ["1", "2", "They are equal strength", "Error — can't mix prepend and append"],
      answer: 1,
      why: "References are list-edited: the composed arc list is prepended-items, then any explicit, then appended-items. Earliest = strongest, so the prepended strong.usda (size=2) beats the appended weak.usda (size=1)."
    },
    {
      q: "HARD — A weak SUBLAYER and a reference both author color, and the root layer itself has no color opinion. What composes?",
      code: `# detail.usda  (a SUBLAYER of the root)
over "Prop" { token color = "blue" }
# asset.usda
def "Prop" { token color = "red" }
# root.usda
(subLayers = [@detail.usda@])
def "Prop" (
    references = @asset.usda@
) {}`,
      choices: ["red (from the reference)", "blue (from the sublayer)", "No value — sublayer `over` can't win", "Whichever file loads last"],
      answer: 1,
      why: "Every sublayer of the root layer stack contributes LOCAL opinions, and Local is stronger than References in LIVERPS. So the sublayer's blue wins over the referenced red — even though it's 'just' an `over` in a weak sublayer."
    },
    {
      q: "HARD — The referenced asset selects variant lod='high'; the root selects lod='low'. Which variant's opinion composes?",
      code: `# asset.usda
def "Car" (variants = { string lod = "high" }) {
    variantSet "lod" = {
        "high" { token res = "4k" }
        "low"  { token res = "1k" }
    }
}
# scene.usda (ROOT)
def "Car" (
    references = @asset.usda@
    variants = { string lod = "low" }
) {}`,
      choices: ["res = 4k", "res = 1k", "Both — variants merge", "No value — conflicting selections"],
      answer: 1,
      why: "Variant *selections* compose like metadata by LIVERPS strength: a selection in the root (local) layer is stronger than one authored inside the referenced asset. The root picks 'low', so res = 1k."
    },
    {
      q: "HARD — An inherited class and a reference both author color; no local color opinion exists. What composes?",
      code: `class "_Robots" { token color = "green" }
# asset.usda
def "Robot" { token color = "red" }
# scene.usda (ROOT)
def "Robot" (
    inherits = </_Robots>
    references = @asset.usda@
) {}`,
      choices: ["green (inherited)", "red (referenced)", "No value", "Whichever arc was authored first"],
      answer: 0,
      why: "In LIVERPS, Inherits (I) is stronger than References (R). With no local opinion, the inherited green beats the referenced red."
    },
    {
      q: "HARD — /FancyMat references an asset (roughness=0.9) and specializes /BaseMat (roughness=0.1). What is roughness on /FancyMat?",
      code: `def "BaseMat" { float roughness = 0.1 }
# asset.usda authors on FancyMat:
def "FancyMat" { float roughness = 0.9 }
# scene.usda (ROOT)
def "FancyMat" (
    references = @asset.usda@
    specializes = </BaseMat>
) {}`,
      choices: ["0.1 (the specialized base wins)", "0.9 (the reference wins)", "0.5", "No value"],
      answer: 1,
      why: "Specializes (S) is the WEAKEST arc — applied last. The reference's 0.9 beats the specialized base's 0.1. Specializes is for base/fallback opinions that should always yield to stronger ones while still shining through where nothing else is authored."
    },
    {
      q: "HARD — Nested references. What is /Hero.height on the composed stage?",
      code: `# body.usda
def "Body" { int height = 170 }
# char.usda
def "Char" (references = @body.usda@</Body>) {
    int height = 180
}
# shot.usda (ROOT)
def "Hero" (references = @char.usda@</Char>) {}`,
      choices: ["170", "180", "No value — shot never references body.usda", "Both 170 and 180"],
      answer: 1,
      why: "References encapsulate. Inside char.usda the LOCAL 180 beats its reference to body (170), so Char composes to 180. shot references the composed Char and gets 180 — it never 'sees' body.usda directly."
    },
    {
      q: "HARD — The root composes a referenced Lamp but authors `active = false`. What appears on the stage?",
      code: `# asset.usda
def "Lamp" {
    float intensity = 500
    def Mesh "Shade" { # ... geometry ... }
}
# scene.usda (ROOT)
def "Lamp" (
    references = @asset.usda@
    active = false
) {}`,
      choices: ["Lamp renders with intensity 500", "Lamp and its entire subtree are pruned from the stage", "Only Shade is hidden; intensity still composes", "`active` is ignored because it conflicts with the reference"],
      answer: 1,
      why: "`active = false` DEACTIVATES the prim: it and all descendants are excluded from stage composition and traversal, regardless of what the reference contributes. (Contrast `visibility`, which keeps the prim in the stage but hides it from rendering.)"
    },
    {
      q: "HARD — /Robot's payload is UNLOADED, but the root authors a local mass directly on /Robot. What is mass?",
      code: `# heavy.usda
def "Robot" { float mass = 100 }
# scene.usda (ROOT)
def "Robot" (
    payload = @heavy.usda@</Robot>
) {
    float mass = 5
}
# /Robot's payload is UNLOADED (e.g. opened with LoadNone)`,
      choices: ["5", "100", "No value — payload unloaded", "Average = 52.5"],
      answer: 0,
      why: "An unloaded payload contributes none of its contents, so mass=100 is absent. But mass=5 is authored directly in the root layer (OUTSIDE the payload), so it composes normally → 5. Local opinions on a prim don't require its payload to be loaded."
    }
  ];
