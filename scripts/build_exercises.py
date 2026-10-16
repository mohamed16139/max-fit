"""Build js/data/exercises.js and img/ex/ from free-exercise-db.

Source: https://github.com/yuhonas/free-exercise-db (Unlicense / public domain) — dist/exercises.json
and exercises/<id>/0.jpg, 1.jpg (start and end position photos).

Usage:  python3 scripts/build_exercises.py /path/to/exercises.json [--images]

Names, muscles, equipment, level, force, mechanic and instructions come from the source.
Our own additions are the movement `pattern` (used to find equivalent replacements) and a short
display name where the source name is awkward.
"""
import json, os, sys, urllib.request

# pattern -> exercise ids. A pattern groups exercises that train the same movement, so a
# replacement keeps the role of the original in the workout.
PATTERNS = {
 "horizontal_push": ["Barbell_Bench_Press_-_Medium_Grip","Dumbbell_Bench_Press","Dumbbell_Bench_Press_with_Neutral_Grip","Machine_Bench_Press","Leverage_Chest_Press","Smith_Machine_Bench_Press","Cable_Chest_Press","Pushups","Push-Up_Wide"],
 "decline_push": ["Decline_Barbell_Bench_Press","Decline_Dumbbell_Bench_Press"],
 "incline_push": ["Barbell_Incline_Bench_Press_-_Medium_Grip","Incline_Dumbbell_Press","Hammer_Grip_Incline_DB_Bench_Press","Leverage_Incline_Chest_Press","Smith_Machine_Incline_Bench_Press","Incline_Cable_Chest_Press","Push-Ups_With_Feet_Elevated"],
 "chest_fly": ["Butterfly","Dumbbell_Flyes","Incline_Dumbbell_Flyes","Cable_Crossover","Low_Cable_Crossover","Flat_Bench_Cable_Flyes","Incline_Cable_Flye"],
 "dip": ["Dips_-_Chest_Version","Dips_-_Triceps_Version","Dip_Machine","Bench_Dips"],
 "vertical_push": ["Barbell_Shoulder_Press","Standing_Military_Press","Dumbbell_Shoulder_Press","Seated_Dumbbell_Press","Arnold_Dumbbell_Press","Standing_Dumbbell_Press","Machine_Shoulder_Military_Press","Leverage_Shoulder_Press","Smith_Machine_Overhead_Shoulder_Press","Seated_Cable_Shoulder_Press"],
 "lateral_raise": ["Side_Lateral_Raise","Seated_Side_Lateral_Raise","One-Arm_Side_Laterals","Cable_Seated_Lateral_Raise","Standing_Low-Pulley_Deltoid_Raise"],
 "front_raise": ["Front_Dumbbell_Raise","Front_Two-Dumbbell_Raise","Front_Cable_Raise","Front_Incline_Dumbbell_Raise"],
 "rear_delt": ["Reverse_Machine_Flyes","Reverse_Flyes","Cable_Rear_Delt_Fly","Seated_Bent-Over_Rear_Delt_Raise","Face_Pull"],
 "upright_row": ["Upright_Barbell_Row","Standing_Dumbbell_Upright_Row","Upright_Cable_Row"],
 "shrug": ["Barbell_Shrug","Dumbbell_Shrug","Cable_Shrugs","Leverage_Shrug"],
 "vertical_pull": ["Wide-Grip_Lat_Pulldown","Close-Grip_Front_Lat_Pulldown","Underhand_Cable_Pulldowns","V-Bar_Pulldown","One_Arm_Lat_Pulldown","Full_Range-Of-Motion_Lat_Pulldown","Pullups","Chin-Up","V-Bar_Pullup"],
 "lat_isolation": ["Straight-Arm_Pulldown","Rope_Straight-Arm_Pulldown","Straight-Arm_Dumbbell_Pullover"],
 "horizontal_pull": ["Bent_Over_Barbell_Row","Reverse_Grip_Bent-Over_Rows","Bent_Over_Two-Dumbbell_Row","One-Arm_Dumbbell_Row","Dumbbell_Incline_Row","Seated_Cable_Rows","Seated_One-arm_Cable_Pulley_Rows","T-Bar_Row_with_Handle","Lying_T-Bar_Row","Leverage_High_Row","Leverage_Iso_Row","Smith_Machine_Bent_Over_Row","Inverted_Row"],
 "hinge": ["Barbell_Deadlift","Sumo_Deadlift","Romanian_Deadlift","Stiff-Legged_Barbell_Deadlift","Stiff-Legged_Dumbbell_Deadlift","Smith_Machine_Stiff-Legged_Deadlift","Good_Morning","Rack_Pulls","Kettlebell_One-Legged_Deadlift","Pull_Through"],
 "back_extension": ["Hyperextensions_Back_Extensions","Hyperextensions_With_No_Hyperextension_Bench"],
 "squat": ["Barbell_Squat","Barbell_Full_Squat","Front_Barbell_Squat","Box_Squat","Goblet_Squat","Dumbbell_Squat","Hack_Squat","Smith_Machine_Squat","Leg_Press","Narrow_Stance_Leg_Press","Bodyweight_Squat"],
 "lunge": ["Dumbbell_Lunges","Barbell_Lunge","Barbell_Walking_Lunge","Dumbbell_Rear_Lunge","Split_Squat_with_Dumbbells","Smith_Single-Leg_Split_Squat","Dumbbell_Step_Ups","Barbell_Step_Ups"],
 "hip_thrust": ["Barbell_Hip_Thrust","Barbell_Glute_Bridge","Single_Leg_Glute_Bridge","Butt_Lift_Bridge"],
 "glute_isolation": ["One-Legged_Cable_Kickback","Glute_Kickback","Thigh_Abductor"],
 "adductor": ["Thigh_Adductor","Cable_Hip_Adduction"],
 "knee_extension": ["Leg_Extensions","Single-Leg_Leg_Extension"],
 "knee_flexion": ["Lying_Leg_Curls","Seated_Leg_Curl","Standing_Leg_Curl","Glute_Ham_Raise","Natural_Glute_Ham_Raise"],
 "calf_raise": ["Standing_Calf_Raises","Seated_Calf_Raise","Calf_Press_On_The_Leg_Press_Machine","Standing_Dumbbell_Calf_Raise","Smith_Machine_Calf_Raise","Standing_Barbell_Calf_Raise","Barbell_Seated_Calf_Raise"],
 "biceps_curl": ["Barbell_Curl","EZ-Bar_Curl","Dumbbell_Bicep_Curl","Dumbbell_Alternate_Bicep_Curl","Incline_Dumbbell_Curl","Preacher_Curl","One_Arm_Dumbbell_Preacher_Curl","Machine_Preacher_Curls","Concentration_Curls","Standing_Biceps_Cable_Curl","Spider_Curl","Machine_Bicep_Curl"],
 "hammer_curl": ["Hammer_Curls","Alternate_Hammer_Curl","Cross_Body_Hammer_Curl","Cable_Hammer_Curls_-_Rope_Attachment","Incline_Hammer_Curls","Reverse_Barbell_Curl"],
 "triceps_extension": ["Triceps_Pushdown","Triceps_Pushdown_-_Rope_Attachment","Triceps_Pushdown_-_V-Bar_Attachment","Reverse_Grip_Triceps_Pushdown","Cable_Rope_Overhead_Triceps_Extension","Triceps_Overhead_Extension_with_Rope","Standing_Dumbbell_Triceps_Extension","EZ-Bar_Skullcrusher","Lying_Triceps_Press","Tricep_Dumbbell_Kickback","Machine_Triceps_Extension","Seated_Triceps_Press"],
 "triceps_press": ["Close-Grip_Barbell_Bench_Press","Close-Grip_Dumbbell_Press","Smith_Machine_Close-Grip_Bench_Press","Push-Ups_-_Close_Triceps_Position"],
 "core_flexion": ["Crunches","Cable_Crunch","Ab_Crunch_Machine","Decline_Crunch","Reverse_Crunch","Sit-Up","Rope_Crunch"],
 "leg_raise": ["Hanging_Leg_Raise","Flat_Bench_Lying_Leg_Raise","Leg_Pull-In","Seated_Leg_Tucks","Bent-Knee_Hip_Raise"],
 "core_stability": ["Plank","Dead_Bug","Pallof_Press","Barbell_Ab_Rollout_-_On_Knees"],
 "core_rotation": ["Russian_Twist","Cable_Russian_Twists","Standing_Cable_Wood_Chop","Oblique_Crunches_-_On_The_Floor"],
 "wrist_curl": ["Palms-Up_Barbell_Wrist_Curl_Over_A_Bench","Palms-Down_Wrist_Curl_Over_A_Bench","Seated_Dumbbell_Palms-Up_Wrist_Curl"],
}
# Shorter display names for a few awkward source names.
NAMES = {
 "Barbell_Bench_Press_-_Medium_Grip": "Barbell Bench Press",
 "Barbell_Incline_Bench_Press_-_Medium_Grip": "Incline Barbell Bench Press",
 "Butterfly": "Pec Deck (Machine Fly)",
 "Reverse_Machine_Flyes": "Reverse Pec Deck (Rear Delt Machine)",
 "Leverage_High_Row": "Machine High Row",
 "Leverage_Iso_Row": "Machine Row (one arm)",
 "Leverage_Chest_Press": "Machine Chest Press",
 "Leverage_Incline_Chest_Press": "Machine Incline Chest Press",
 "Leverage_Shoulder_Press": "Machine Shoulder Press",
 "Leverage_Shrug": "Machine Shrug",
 "Hyperextensions_Back_Extensions": "Back Extension",
 "Hyperextensions_With_No_Hyperextension_Bench": "Back Extension (no bench)",
 "Triceps_Pushdown_-_Rope_Attachment": "Triceps Pushdown (rope)",
 "Triceps_Pushdown_-_V-Bar_Attachment": "Triceps Pushdown (V-bar)",
 "Cable_Hammer_Curls_-_Rope_Attachment": "Cable Hammer Curl (rope)",
 "Dips_-_Chest_Version": "Dips (chest)",
 "Dips_-_Triceps_Version": "Dips (triceps)",
 "Push-Ups_-_Close_Triceps_Position": "Close-Grip Push-Up",
 "Barbell_Ab_Rollout_-_On_Knees": "Ab Rollout (kneeling)",
 "Split_Squat_with_Dumbbells": "Bulgarian Split Squat (dumbbells)",
 "Standing_Low-Pulley_Deltoid_Raise": "Cable Lateral Raise (standing)",
 "Oblique_Crunches_-_On_The_Floor": "Oblique Crunch",
}

def main(path, images):
    src = {x["id"]: x for x in json.load(open(path))}
    out, seen = [], set()
    for pat, ids in PATTERNS.items():
        for i in ids:
            if i in seen: raise SystemExit(f"{i} listed twice")
            seen.add(i)
            x = src.get(i)
            if not x: raise SystemExit(f"{i} not in source")
            out.append({"id": i, "name": NAMES.get(i, x["name"]), "pattern": pat,
                        "primary": x["primaryMuscles"], "secondary": x["secondaryMuscles"],
                        "equipment": x["equipment"] or "other", "level": x["level"],
                        "mechanic": x["mechanic"] or ("compound" if pat in ("dip",) else "isolation"),
                        "force": x["force"], "category": x["category"], "steps": x["instructions"]})
    os.makedirs("img/ex", exist_ok=True)
    if images:
        from PIL import Image
        import io
        for e in out:
            for n in (0, 1):
                dst = f"img/ex/{e['id']}-{n}.jpg"
                if os.path.exists(dst): continue
                url = f"https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{e['id']}/{n}.jpg"
                im = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=30).read())).convert("RGB")
                im.thumbnail((560, 560)); im.save(dst, "JPEG", quality=70, optimize=True, progressive=True)
    missing = [e["id"] for e in out if not os.path.exists(f"img/ex/{e['id']}-0.jpg")]
    if missing: raise SystemExit("missing photos (run with --images): " + ", ".join(missing))
    js = ("// Generated by scripts/build_exercises.py from free-exercise-db (public domain). Do not edit by hand.\n"
          "export const EXERCISE_SOURCE = {name: \"free-exercise-db\", url: \"https://github.com/yuhonas/free-exercise-db\"};\n"
          "export const EXERCISES = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    open("js/data/exercises.js", "w").write(js)
    print(f"wrote {len(out)} exercises")

if __name__ == "__main__":
    main(sys.argv[1], "--images" in sys.argv)
