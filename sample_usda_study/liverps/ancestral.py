from pxr import Usd

if __name__ == '__main__':
    stage = Usd.Stage.Open("/Users/stevephu/Developer/OpenUSD-study/USD-study-guide/sample_usda_study/liverps/ancestral_arc.usda")
    flattened_layer_1 = stage.Flatten()
    print(flattened_layer_1.ExportToString())