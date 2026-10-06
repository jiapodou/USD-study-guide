from pxr import Usd, UsdGeom, Sdf, Vt, Gf

# if __name__ == '__main__':
#     stage = Usd.Stage.Open("/Users/stevephu/Developer/OpenUSD-study/USD-study-guide/sample_usda_study/inherit/root.usda")
#     print(stage.GetPrimAtPath("/Model_1/Anim/LAnim").GetAttribute("rootClassALAnim").Get())

#     flattened_layer = stage.Flatten()
#     print(flattened_layer.ExportToString())

if __name__ == '__main__':
    # stage = Usd.Stage.Open("/Users/stevephu/Developer/OpenUSD-study/USD-study-guide/sample_usda_study/inherit/inherit.usda")
    # flattened_layer = stage.Flatten()
    # print(flattened_layer.ExportToString())

    stage_1 = Usd.Stage.Open("/Users/stevephu/Developer/OpenUSD-study/USD-study-guide/sample_usda_study/inherit/model.usda")
    flattened_layer_1 = stage_1.Flatten()
    print(flattened_layer_1.ExportToString())