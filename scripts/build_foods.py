"""Build js/data/foods.js from USDA FoodData Central (SR Legacy, April 2018).

Source: https://fdc.nal.usda.gov/download-datasets  ->  "SR Legacy" JSON
(FoodData_Central_sr_legacy_food_json_2018-04.json). USDA data is public domain (CC0).

Usage:  python3 scripts/build_foods.py /path/to/FoodData_Central_sr_legacy_food_json_2018-04.json

Every nutrient value in the output comes from the USDA record named in `desc`, per 100 g of the
food as described (raw, cooked, dry...). Nothing is estimated. Liquids also get a density (g/ml)
taken from the USDA "cup" or "fl oz" portion weight, so millilitres are converted properly.
Piece sizes (an egg, a slice) come from the USDA portion list too.

Our own additions are classification only: display name, category, role in a meal, which meals
it suits and allergen/diet flags.
"""
import json, sys

# id, display name, category, role, USDA description (exact), meals it suits, flags, pieces wanted
# role: protein | carb | fat | veg | fruit | drink   (drives the plan generator and replacements)
# meals: b = breakfast, m = lunch/dinner, s = snack
# flags: meat fish shellfish dairy egg gluten soy peanut treenut sesame  (for allergies / diets)
FOODS = [
 # --- Meat, poultry & fish
 ("chicken_breast_c","Chicken breast, roasted","meat","protein","Chicken, broilers or fryers, breast, meat only, cooked, roasted","m","meat",[]),
 ("chicken_breast_r","Chicken breast, raw","meat","protein","Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw","m","meat",[]),
 ("chicken_thigh_c","Chicken thigh, roasted","meat","protein","Chicken, broilers or fryers, thigh, meat only, cooked, roasted","m","meat",[]),
 ("turkey_breast_c","Turkey breast, roasted","meat","protein","Turkey, whole, breast, meat only, cooked, roasted","m s","meat",[]),
 ("turkey_ground_c","Ground turkey 93% lean, cooked","meat","protein","Turkey, ground, 93% lean, 7% fat, pan-broiled crumbles","m","meat",[]),
 ("beef_95_c","Lean beef mince 95%, cooked","meat","protein","Beef, ground, 95% lean meat / 5% fat, crumbles, cooked, pan-browned","m","meat",[]),
 ("beef_95_r","Lean beef mince 95%, raw","meat","protein","Beef, ground, 95% lean meat / 5% fat, raw","m","meat",[]),
 ("beef_90_c","Beef mince 90%, cooked","meat","protein","Beef, ground, 90% lean meat / 10% fat, crumbles, cooked, pan-browned","m","meat",[]),
 ("sirloin_c","Beef sirloin steak, grilled","meat","protein","Beef, top sirloin, steak, separable lean only, trimmed to 0\" fat, all grades, cooked, broiled","m","meat",[]),
 ("lamb_leg_c","Lamb leg, roasted (lean)","meat","protein","Lamb, leg, whole (shank and sirloin), separable lean only, trimmed to 1/4\" fat, choice, cooked, roasted","m","meat",[]),
 ("salmon_c","Salmon, cooked","meat","protein","Fish, salmon, Atlantic, farmed, cooked, dry heat","m","fish",[]),
 ("salmon_r","Salmon, raw","meat","protein","Fish, salmon, Atlantic, farmed, raw","m","fish",[]),
 ("tuna_can","Tuna, canned in water (drained)","meat","protein","Fish, tuna, light, canned in water, without salt, drained solids","m s","fish",[]),
 ("cod_c","Cod, cooked","meat","protein","Fish, cod, Atlantic, cooked, dry heat","m","fish",[]),
 ("tilapia_c","Tilapia, cooked","meat","protein","Fish, tilapia, cooked, dry heat","m","fish",[]),
 ("shrimp_c","Shrimp, cooked","meat","protein","Crustaceans, shrimp, cooked","m","shellfish",[]),
 ("sardine_can","Sardines, canned in oil (drained)","meat","protein","Fish, sardine, Atlantic, canned in oil, drained solids with bone","m s","fish",[]),
 # --- Eggs & dairy
 ("egg","Egg, whole","dairy","protein","Egg, whole, raw, fresh","b m s","egg",["large"]),
 ("egg_boiled","Egg, hard-boiled","dairy","protein","Egg, whole, cooked, hard-boiled","b s","egg",["large"]),
 ("egg_white","Egg white","dairy","protein","Egg, white, raw, fresh","b","egg",["large"]),
 ("greek_0","Greek yogurt, nonfat","dairy","protein","Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program)","b s","dairy",[]),
 ("greek_full","Greek yogurt, whole milk","dairy","protein","Yogurt, Greek, plain, whole milk","b s","dairy",[]),
 ("yogurt_low","Yogurt, plain low-fat","dairy","protein","Yogurt, plain, low fat","b s","dairy",[]),
 ("cottage","Cottage cheese 2%","dairy","protein","Cheese, cottage, lowfat, 2% milkfat","b s","dairy",[]),
 ("whey","Whey protein powder","dairy","protein","Beverages, Protein powder whey based","b s","dairy",[]),
 ("whey_iso","Whey protein isolate","dairy","protein","Beverages, Whey protein powder isolate","b s","dairy",[]),
 ("milk_skim","Milk, skim","dairy","drink","Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)","b s","dairy",[]),
 ("milk_2","Milk, 2% fat","dairy","drink","Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D","b s","dairy",[]),
 ("milk_whole","Milk, whole","dairy","drink","Milk, whole, 3.25% milkfat, with added vitamin D","b s","dairy",[]),
 ("cheddar","Cheddar cheese","dairy","fat","Cheese, cheddar, sharp, sliced","b m s","dairy",["slice"]),
 ("mozzarella","Mozzarella, part-skim","dairy","fat","Cheese, mozzarella, low moisture, part-skim","b m","dairy",[]),
 ("feta","Feta cheese","dairy","fat","Cheese, feta","b m","dairy",[]),
 ("parmesan","Parmesan, grated","dairy","fat","Cheese, parmesan, grated","m","dairy",["tbsp"]),
 ("ricotta","Ricotta, part-skim","dairy","protein","Cheese, ricotta, part skim milk","b s","dairy",[]),
 # --- Rice, pasta, bread & grains
 ("rice_white_c","White rice, cooked","grains","carb","Rice, white, long-grain, regular, enriched, cooked","m","",[]),
 ("rice_white_r","White rice, uncooked","grains","carb","Rice, white, long-grain, regular, raw, enriched","m","",[]),
 ("rice_brown_c","Brown rice, cooked","grains","carb","Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)","m","",[]),
 ("rice_brown_r","Brown rice, uncooked","grains","carb","Rice, brown, long-grain, raw (Includes foods for USDA's Food Distribution Program)","m","",[]),
 ("pasta_c","Pasta, cooked","grains","carb","Pasta, cooked, enriched, without added salt","m","gluten",[]),
 ("pasta_d","Pasta, dry","grains","carb","Pasta, dry, enriched","m","gluten",[]),
 ("pasta_ww_c","Whole-wheat pasta, cooked","grains","carb","Pasta, whole-wheat, cooked (Includes foods for USDA's Food Distribution Program)","m","gluten",[]),
 ("oats_d","Oats, dry","grains","carb","Cereals, oats, regular and quick, not fortified, dry","b s","gluten",[]),
 ("oats_c","Oatmeal, cooked with water","grains","carb","Cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt","b","gluten",[]),
 ("bread_ww","Whole-wheat bread","grains","carb","Bread, whole-wheat, commercially prepared","b m s","gluten",["slice"]),
 ("bread_white","White bread","grains","carb","Bread, white, commercially prepared (includes soft bread crumbs)","b m s","gluten",["slice"]),
 ("pita","Pita bread, white","grains","carb","Bread, pita, white, enriched","b m","gluten",["pita, large"]),
 ("pita_ww","Pita bread, whole-wheat","grains","carb","Bread, pita, whole-wheat","b m","gluten",["pita, large"]),
 ("tortilla","Flour tortilla","grains","carb","Tortillas, ready-to-bake or -fry, flour, refrigerated","m","gluten",["tortilla"]),
 ("quinoa_c","Quinoa, cooked","grains","carb","Quinoa, cooked","m","",[]),
 ("quinoa_d","Quinoa, uncooked","grains","carb","Quinoa, uncooked","m","",[]),
 ("couscous_c","Couscous, cooked","grains","carb","Couscous, cooked","m","gluten",[]),
 ("bulgur_c","Bulgur, cooked","grains","carb","Bulgur, cooked","m","gluten",[]),
 ("potato_boiled","Potato, boiled (no skin)","grains","carb","Potatoes, boiled, cooked without skin, flesh, without salt","m","",[]),
 ("potato_baked","Potato, baked with skin","grains","carb","Potatoes, baked, flesh and skin, without salt","m","",["potato medium"]),
 ("potato_r","Potato, raw","grains","carb","Potatoes, flesh and skin, raw","m","",[]),
 ("sweet_potato_c","Sweet potato, baked","grains","carb","Sweet potato, cooked, baked in skin, flesh, without salt","m","",[]),
 ("sweet_potato_r","Sweet potato, raw","grains","carb","Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program)","m","",[]),
 ("granola","Granola","grains","carb","Cereals ready-to-eat, granola, homemade","b s","gluten treenut",[]),
 ("rice_cakes","Rice cakes, brown rice","snacks","carb","Snacks, rice cakes, brown rice, plain, unsalted","s","",["cake"]),
 # --- Fruits
 ("banana","Banana","fruit","fruit","Bananas, raw","b s","",["medium"]),
 ("apple","Apple, with skin","fruit","fruit","Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)","b s","",["medium"]),
 ("orange","Orange","fruit","fruit","Oranges, raw, all commercial varieties","b s","",["fruit"]),
 ("strawberries","Strawberries","fruit","fruit","Strawberries, raw","b s","",[]),
 ("blueberries","Blueberries","fruit","fruit","Blueberries, raw","b s","",[]),
 ("grapes","Grapes","fruit","fruit","Grapes, red or green (European type, such as Thompson seedless), raw","s","",[]),
 ("dates_medjool","Dates, medjool","fruit","fruit","Dates, medjool","b s","",["date"]),
 ("dates_deglet","Dates, deglet noor","fruit","fruit","Dates, deglet noor","b s","",["date"]),
 ("mango","Mango","fruit","fruit","Mangos, raw","b s","",[]),
 ("watermelon","Watermelon","fruit","fruit","Watermelon, raw","s","",[]),
 ("pineapple","Pineapple","fruit","fruit","Pineapple, raw, all varieties","s","",[]),
 ("kiwi","Kiwi","fruit","fruit","Kiwifruit, green, raw","b s","",["fruit"]),
 ("pear","Pear","fruit","fruit","Pears, raw","s","",["medium"]),
 ("raisins","Raisins","fruit","fruit","Raisins, dark, seedless (Includes foods for USDA's Food Distribution Program)","b s","",[]),
 ("figs_dried","Figs, dried","fruit","fruit","Figs, dried, uncooked","b s","",["fig"]),
 ("avocado","Avocado","fruit","fat","Avocados, raw, all commercial varieties","b m","",["avocado"]),
 # --- Vegetables
 ("broccoli_r","Broccoli, raw","veg","veg","Broccoli, raw","m","",[]),
 ("broccoli_c","Broccoli, boiled","veg","veg","Broccoli, cooked, boiled, drained, without salt","m","",[]),
 ("spinach","Spinach, raw","veg","veg","Spinach, raw","b m","",[]),
 ("carrot","Carrots, raw","veg","veg","Carrots, raw","m s","",["medium"]),
 ("tomato","Tomato","veg","veg","Tomatoes, red, ripe, raw, year round average","b m","",["medium"]),
 ("cucumber","Cucumber","veg","veg","Cucumber, with peel, raw","b m s","",[]),
 ("lettuce","Romaine lettuce","veg","veg","Lettuce, cos or romaine, raw","m","",[]),
 ("pepper_red","Red bell pepper","veg","veg","Peppers, sweet, red, raw","b m","",[]),
 ("onion","Onion","veg","veg","Onions, raw","m","",[]),
 ("mushrooms","Mushrooms, white","veg","veg","Mushrooms, white, raw","b m","",[]),
 ("zucchini","Zucchini","veg","veg","Squash, summer, zucchini, includes skin, raw","m","",[]),
 ("cauliflower","Cauliflower","veg","veg","Cauliflower, raw","m","",[]),
 ("green_beans","Green beans","veg","veg","Beans, snap, green, raw","m","",[]),
 ("peas_c","Green peas, cooked","veg","veg","Peas, green, frozen, cooked, boiled, drained, without salt","m","",[]),
 ("corn_can","Sweet corn, canned (drained)","veg","carb","Corn, sweet, yellow, canned, whole kernel, drained solids","m","",[]),
 ("cabbage","Cabbage","veg","veg","Cabbage, raw","m","",[]),
 ("eggplant","Eggplant","veg","veg","Eggplant, raw","m","",[]),
 ("okra","Okra","veg","veg","Okra, raw","m","",[]),
 ("asparagus","Asparagus","veg","veg","Asparagus, raw","m","",[]),
 ("kale","Kale","veg","veg","Kale, raw","m","",[]),
 # --- Legumes
 ("lentils_c","Lentils, cooked","legumes","carb","Lentils, mature seeds, cooked, boiled, without salt","m","",[]),
 ("chickpeas_c","Chickpeas, cooked","legumes","carb","Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt","m","",[]),
 ("kidney_c","Kidney beans, cooked","legumes","carb","Beans, kidney, red, mature seeds, cooked, boiled, without salt","m","",[]),
 ("black_beans_c","Black beans, cooked","legumes","carb","Beans, black, mature seeds, cooked, boiled, without salt","m","",[]),
 ("fava_c","Fava beans (foul), cooked","legumes","carb","Broadbeans (fava beans), mature seeds, cooked, boiled, without salt","b m","",[]),
 ("hummus","Hummus","legumes","fat","Hummus, commercial","b m s","sesame",["tbsp"]),
 ("tofu","Tofu, firm","legumes","protein","Tofu, raw, firm, prepared with calcium sulfate","m","soy",[]),
 ("edamame","Edamame, prepared","legumes","protein","Edamame, frozen, prepared","m s","soy",[]),
 # --- Nuts & seeds
 ("almonds","Almonds","nuts","fat","Nuts, almonds","b s","treenut",[]),
 ("walnuts","Walnuts","nuts","fat","Nuts, walnuts, english","b s","treenut",[]),
 ("cashews","Cashews","nuts","fat","Nuts, cashew nuts, raw","s","treenut",[]),
 ("pistachios","Pistachios","nuts","fat","Nuts, pistachio nuts, raw","s","treenut",[]),
 ("peanuts","Peanuts","nuts","fat","Peanuts, all types, raw","s","peanut",[]),
 ("peanut_butter","Peanut butter, smooth","nuts","fat","Peanut butter, smooth style, without salt","b s","peanut",["tbsp"]),
 ("almond_butter","Almond butter","nuts","fat","Nuts, almond butter, plain, without salt added","b s","treenut",["tbsp"]),
 ("tahini","Tahini","nuts","fat","Seeds, sesame butter, tahini, from roasted and toasted kernels (most common type)","b m s","sesame",["tbsp"]),
 ("chia","Chia seeds","nuts","fat","Seeds, chia seeds, dried","b s","",["tbsp"]),
 ("flax","Flaxseed","nuts","fat","Seeds, flaxseed","b","",["tbsp"]),
 ("sunflower_seeds","Sunflower seeds","nuts","fat","Seeds, sunflower seed kernels, dried","s","",[]),
 ("pumpkin_seeds","Pumpkin seeds","nuts","fat","Seeds, pumpkin and squash seed kernels, dried","s","",[]),
 # --- Oils & fats
 ("olive_oil","Olive oil","fats","fat","Oil, olive, salad or cooking","b m","",["tablespoon","tsp"]),
 ("canola_oil","Canola oil","fats","fat","Oil, canola","m","",["tablespoon","tsp"]),
 ("sunflower_oil","Sunflower oil","fats","fat","Oil, sunflower, high oleic (70% and over)","m","",["tablespoon","tsp"]),
 ("coconut_oil","Coconut oil","fats","fat","Oil, coconut","m","",["tablespoon","tsp"]),
 ("butter","Butter, unsalted","fats","fat","Butter, without salt","b m","dairy",["tbsp","pat"]),
 ("mayo","Mayonnaise","fats","fat","Salad dressing, mayonnaise, regular","m","egg",["tablespoon"]),
 ("olives","Black olives","fats","fat","Olives, ripe, canned (small-extra large)","b m","",["large"]),
 # --- Snacks & sweet
 ("dark_choc","Dark chocolate 70–85%","snacks","fat","Chocolate, dark, 70-85% cacao solids","s","dairy",[]),
 ("honey","Honey","snacks","carb","Honey","b s","",["tbsp","tsp"]),
 ("jam","Jam","snacks","carb","Jams and preserves","b","",["tbsp"]),
 ("sugar","Sugar","snacks","carb","Sugars, granulated","b","",["tsp"]),
 ("popcorn","Popcorn, air-popped","snacks","carb","Snacks, popcorn, air-popped","s","",[]),
 ("granola_bar","Granola bar","snacks","carb","Snacks, granola bars, hard, plain","s","gluten",["bar"]),
 # --- Beverages
 ("water","Water","drinks","drink","Beverages, water, tap, drinking","b m s","",[]),
 ("coffee","Coffee, brewed","drinks","drink","Beverages, coffee, brewed, prepared with tap water","b s","",[]),
 ("tea","Black tea, brewed","drinks","drink","Beverages, tea, black, brewed, prepared with tap water","b s","",[]),
 ("orange_juice","Orange juice","drinks","drink","Orange juice, raw (Includes foods for USDA's Food Distribution Program)","b s","",[]),
 ("almond_milk","Almond milk, unsweetened","drinks","drink","Beverages, almond milk, unsweetened, shelf stable","b s","treenut",[]),
 ("soy_milk","Soy milk","drinks","drink","Soymilk, original and vanilla, unfortified","b s","soy",[]),
 ("coconut_water","Coconut water","drinks","drink","Beverages, Coconut water, ready-to-drink, unsweetened","s","",[]),
 ("cola","Cola","drinks","drink","Beverages, carbonated, cola, regular","s","",[]),
]
# Foods that are measured as liquids (ml). Their density comes from the USDA cup / fl oz weight.
LIQUID = {"milk_skim","milk_2","milk_whole","water","coffee","tea","orange_juice","almond_milk","soy_milk","coconut_water","cola","olive_oil","canola_oil","sunflower_oil"}
# What one piece is called in the app ("≈ 2 eggs", not "≈ 2 larges").
PIECE_NAME = {"egg": "egg", "egg_boiled": "egg", "egg_white": "egg white", "banana": "banana", "apple": "apple", "orange": "orange",
              "kiwi": "kiwi", "pear": "pear", "carrot": "carrot", "tomato": "tomato", "potato_baked": "potato", "olives": "olive",
              "rice_cakes": "rice cake", "figs_dried": "fig", "dates_medjool": "date", "dates_deglet": "date", "granola_bar": "bar"}
ML = {"cup": 236.588, "fl oz": 29.5735, "tablespoon": 14.787, "tbsp": 14.787, "tsp": 4.929}
N = {"kcal": 1008, "p": 1003, "c": 1005, "f": 1004, "fiber": 1079, "sugar": 2000, "satFat": 1258, "sodium": 1093}

def main(path):
    src = {f["description"]: f for f in json.load(open(path))["SRLegacyFoods"]}
    out, missing = [], []
    for fid, name, cat, role, desc, meals, flags, want in FOODS:
        f = src.get(desc)
        if not f:
            missing.append(desc); continue
        vals = {}
        for n in f["foodNutrients"]:
            nid = n["nutrient"]["id"]
            for k, v in N.items():
                if nid == v and n.get("amount") is not None:
                    vals[k] = n["amount"]
        if "kcal" not in vals:  # a few records only list kJ
            kj = next((n["amount"] for n in f["foodNutrients"] if n["nutrient"]["id"] == 1062), None)
            if kj is not None: vals["kcal"] = round(kj / 4.184, 1)
        for k in ("kcal", "p", "c", "f"):
            if k not in vals: raise SystemExit(f"{desc}: no {k}")
        portions = [(p.get("modifier") or "", p.get("amount") or 1, p["gramWeight"]) for p in f.get("foodPortions", [])]
        pieces = []
        for w in want:
            hit = next(((m, a, g) for m, a, g in portions if m.lower().startswith(w.lower())), None)
            if hit:
                m, a, g = hit
                label = {"tablespoon": "tbsp"}.get(w, w.split(",")[0].split(" ")[0] if w not in ("pita, large",) else "pita")
                pieces.append({"label": label, "g": round(g / a, 1)})
        for pc in pieces:
            pc["label"] = PIECE_NAME.get(fid, pc["label"])
        item = {"id": fid, "name": name, "cat": cat, "role": role, "meals": meals.split(), "flags": flags.split(),
                "per100g": {k: round(v, 2) for k, v in vals.items()}, "pieces": pieces,
                "src": {"db": "USDA FDC SR Legacy", "fdcId": f["fdcId"], "desc": desc}}
        if fid in LIQUID:
            dens = None
            for m, a, g in portions:
                key = m.lower().split(" (")[0].strip()
                if key in ML:
                    dens = round(g / (a * ML[key]), 3); break
            if not dens: raise SystemExit(f"{desc}: no volume portion for density")
            item["unit"] = "ml"; item["density"] = dens
        else:
            item["unit"] = "g"
        out.append(item)
    if missing:
        raise SystemExit("Not found in USDA file:\n  " + "\n  ".join(missing))
    js = ("// Generated by scripts/build_foods.py from USDA FoodData Central, SR Legacy (April 2018). Do not edit by hand.\n"
          "// Nutrients are per 100 g of the food as described. Liquids carry a density (g/ml) from the USDA portion data.\n"
          "export const FOOD_SOURCE = {name: \"USDA FoodData Central — SR Legacy\", version: \"April 2018\", url: \"https://fdc.nal.usda.gov/\"};\n"
          "export const FOODS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    open("js/data/foods.js", "w").write(js)
    print(f"wrote {len(out)} foods")

if __name__ == "__main__":
    main(sys.argv[1])
