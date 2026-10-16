// Ready-made workout programs. A user's plan starts as a copy of one of these (or blank) and is then theirs to edit.
export const PROGRAM_TEMPLATES = [
 {
  "id": "recomp",
  "name": "Body Recomp",
  "daysPerWeek": 4,
  "level": "Intermediate",
  "goal": "Lose fat & build muscle",
  "about": "Push, pull and legs plus a full-body day. Built to lose fat and build muscle at the same time.",
  "days": [
   {
    "name": "Push",
    "exercises": [
     {
      "exId": "Barbell_Bench_Press_-_Medium_Grip",
      "sets": 3,
      "reps": "4–6",
      "rest": "90–120 s"
     },
     {
      "exId": "Dumbbell_Shoulder_Press",
      "sets": 2,
      "reps": "8–10",
      "rest": "60–90 s"
     },
     {
      "exId": "Incline_Dumbbell_Press",
      "sets": 4,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Front_Dumbbell_Raise",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Side_Lateral_Raise",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Butterfly",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Triceps_Pushdown_-_Rope_Attachment",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Cable_Rope_Overhead_Triceps_Extension",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Dumbbell_Shrug",
      "sets": 2,
      "reps": "15",
      "rest": "90–120 s"
     }
    ]
   },
   {
    "name": "Pull + Biceps",
    "exercises": [
     {
      "exId": "Wide-Grip_Lat_Pulldown",
      "sets": 3,
      "reps": "8–10",
      "rest": "60–90 s"
     },
     {
      "exId": "Reverse_Machine_Flyes",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Leverage_High_Row",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Leverage_Iso_Row",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Seated_Cable_Rows",
      "sets": 2,
      "reps": "8–10",
      "rest": "60–90 s"
     },
     {
      "exId": "Dumbbell_Bicep_Curl",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Hammer_Curls",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Hyperextensions_Back_Extensions",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Stiff-Legged_Dumbbell_Deadlift",
      "sets": 2,
      "reps": "10–12",
      "rest": "90–120 s"
     }
    ]
   },
   {
    "name": "Legs + Abs + Arms",
    "exercises": [
     {
      "exId": "Barbell_Squat",
      "sets": 3,
      "reps": "4–6",
      "rest": "90–120 s"
     },
     {
      "exId": "Leg_Press",
      "sets": 3,
      "reps": "8–10",
      "rest": "60–90 s"
     },
     {
      "exId": "Standing_Leg_Curl",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Leg_Extensions",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Lying_Leg_Curls",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Standing_Calf_Raises",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Crunches",
      "sets": 3,
      "reps": "To failure",
      "rest": "60–90 s"
     },
     {
      "exId": "Flat_Bench_Lying_Leg_Raise",
      "sets": 3,
      "reps": "To failure",
      "rest": "60–90 s"
     },
     {
      "exId": "EZ-Bar_Curl",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Triceps_Pushdown_-_Rope_Attachment",
      "sets": 2,
      "reps": "12–15",
      "rest": "60–90 s"
     }
    ]
   },
   {
    "name": "Active rest",
    "rest": "Light walking, mobility drills or stretching."
   },
   {
    "name": "Active rest",
    "rest": "Light walking, mobility drills or stretching."
   },
   {
    "name": "Full body",
    "exercises": [
     {
      "exId": "Barbell_Shoulder_Press",
      "sets": 2,
      "reps": "4–6",
      "rest": "90–120 s"
     },
     {
      "exId": "Side_Lateral_Raise",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Underhand_Cable_Pulldowns",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Reverse_Machine_Flyes",
      "sets": 2,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Butterfly",
      "sets": 4,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "One_Arm_Dumbbell_Preacher_Curl",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Reverse_Grip_Triceps_Pushdown",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Leg_Press",
      "sets": 2,
      "reps": "8–10",
      "rest": "60–90 s",
      "group": "Lower body and abs"
     },
     {
      "exId": "Leg_Extensions",
      "sets": 2,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Lying_Leg_Curls",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Standing_Calf_Raises",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Crunches",
      "sets": 3,
      "reps": "To failure",
      "rest": "60–90 s"
     },
     {
      "exId": "Flat_Bench_Lying_Leg_Raise",
      "sets": 3,
      "reps": "To failure",
      "rest": "60–90 s"
     }
    ]
   },
   {
    "name": "Rest",
    "rest": "Full rest. Sleep well and let your muscles recover."
   }
  ]
 },
 {
  "id": "fullbody",
  "name": "Full Body",
  "daysPerWeek": 3,
  "level": "Beginner",
  "goal": "General strength & muscle",
  "about": "Train your whole body 3 times a week with a rest day in between. The best start if you're new or short on time.",
  "days": [
   {
    "name": "Full body A",
    "exercises": [
     {
      "exId": "Barbell_Squat",
      "sets": 3,
      "reps": "6–8",
      "rest": "2–3 min"
     },
     {
      "exId": "Barbell_Bench_Press_-_Medium_Grip",
      "sets": 3,
      "reps": "6–8",
      "rest": "2–3 min"
     },
     {
      "exId": "Bent_Over_Barbell_Row",
      "sets": 3,
      "reps": "8–10",
      "rest": "90–120 s"
     },
     {
      "exId": "Dumbbell_Shoulder_Press",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Lying_Leg_Curls",
      "sets": 2,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Dumbbell_Bicep_Curl",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Triceps_Pushdown_-_Rope_Attachment",
      "sets": 2,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Plank",
      "sets": 3,
      "reps": "30–60 s",
      "rest": "60 s"
     }
    ]
   },
   {
    "name": "Active rest",
    "rest": "Light walking, mobility drills or stretching."
   },
   {
    "name": "Full body B",
    "exercises": [
     {
      "exId": "Romanian_Deadlift",
      "sets": 3,
      "reps": "8–10",
      "rest": "2–3 min"
     },
     {
      "exId": "Incline_Dumbbell_Press",
      "sets": 3,
      "reps": "8–10",
      "rest": "90–120 s"
     },
     {
      "exId": "Wide-Grip_Lat_Pulldown",
      "sets": 3,
      "reps": "8–10",
      "rest": "90–120 s"
     },
     {
      "exId": "Dumbbell_Lunges",
      "sets": 2,
      "reps": "10–12 / leg",
      "rest": "90 s"
     },
     {
      "exId": "Side_Lateral_Raise",
      "sets": 3,
      "reps": "12–15",
      "rest": "60 s"
     },
     {
      "exId": "Hammer_Curls",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Cable_Rope_Overhead_Triceps_Extension",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Standing_Calf_Raises",
      "sets": 3,
      "reps": "12–15",
      "rest": "60 s"
     }
    ]
   },
   {
    "name": "Active rest",
    "rest": "Light walking, mobility drills or stretching."
   },
   {
    "name": "Full body C",
    "exercises": [
     {
      "exId": "Leg_Press",
      "sets": 3,
      "reps": "10–12",
      "rest": "90–120 s"
     },
     {
      "exId": "Barbell_Shoulder_Press",
      "sets": 3,
      "reps": "6–8",
      "rest": "2–3 min"
     },
     {
      "exId": "Pullups",
      "sets": 3,
      "reps": "To failure",
      "rest": "90–120 s"
     },
     {
      "exId": "Butterfly",
      "sets": 2,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Seated_Cable_Rows",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Leg_Extensions",
      "sets": 2,
      "reps": "12–15",
      "rest": "60 s"
     },
     {
      "exId": "Crunches",
      "sets": 3,
      "reps": "To failure",
      "rest": "60 s"
     }
    ]
   },
   {
    "name": "Active rest",
    "rest": "Light walking, mobility drills or stretching."
   },
   {
    "name": "Rest",
    "rest": "Full rest. Sleep well and let your muscles recover."
   }
  ]
 },
 {
  "id": "upperlower",
  "name": "Upper / Lower",
  "daysPerWeek": 4,
  "level": "Intermediate",
  "goal": "Strength & muscle",
  "about": "Two upper-body and two lower-body days. One heavy strength day and one volume day for each half.",
  "days": [
   {
    "name": "Upper · strength",
    "exercises": [
     {
      "exId": "Barbell_Bench_Press_-_Medium_Grip",
      "sets": 3,
      "reps": "4–6",
      "rest": "2–3 min"
     },
     {
      "exId": "Bent_Over_Barbell_Row",
      "sets": 3,
      "reps": "6–8",
      "rest": "2–3 min"
     },
     {
      "exId": "Barbell_Shoulder_Press",
      "sets": 3,
      "reps": "6–8",
      "rest": "2–3 min"
     },
     {
      "exId": "Wide-Grip_Lat_Pulldown",
      "sets": 3,
      "reps": "8–10",
      "rest": "90–120 s"
     },
     {
      "exId": "EZ-Bar_Curl",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "EZ-Bar_Skullcrusher",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     }
    ]
   },
   {
    "name": "Lower · strength",
    "exercises": [
     {
      "exId": "Barbell_Squat",
      "sets": 3,
      "reps": "4–6",
      "rest": "2–3 min"
     },
     {
      "exId": "Romanian_Deadlift",
      "sets": 3,
      "reps": "6–8",
      "rest": "2–3 min"
     },
     {
      "exId": "Leg_Press",
      "sets": 3,
      "reps": "10–12",
      "rest": "90–120 s"
     },
     {
      "exId": "Lying_Leg_Curls",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Standing_Calf_Raises",
      "sets": 4,
      "reps": "10–12",
      "rest": "60 s"
     },
     {
      "exId": "Hanging_Leg_Raise",
      "sets": 3,
      "reps": "To failure",
      "rest": "60 s"
     }
    ]
   },
   {
    "name": "Active rest",
    "rest": "Light walking, mobility drills or stretching."
   },
   {
    "name": "Upper · volume",
    "exercises": [
     {
      "exId": "Incline_Dumbbell_Press",
      "sets": 3,
      "reps": "8–10",
      "rest": "90–120 s"
     },
     {
      "exId": "Seated_Cable_Rows",
      "sets": 3,
      "reps": "10–12",
      "rest": "90 s"
     },
     {
      "exId": "Dumbbell_Shoulder_Press",
      "sets": 3,
      "reps": "10–12",
      "rest": "90 s"
     },
     {
      "exId": "Butterfly",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Face_Pull",
      "sets": 3,
      "reps": "12–15",
      "rest": "60 s"
     },
     {
      "exId": "Side_Lateral_Raise",
      "sets": 3,
      "reps": "12–15",
      "rest": "60 s"
     },
     {
      "exId": "Hammer_Curls",
      "sets": 2,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Triceps_Pushdown_-_Rope_Attachment",
      "sets": 2,
      "reps": "12–15",
      "rest": "60–90 s"
     }
    ]
   },
   {
    "name": "Lower · volume",
    "exercises": [
     {
      "exId": "Split_Squat_with_Dumbbells",
      "sets": 3,
      "reps": "8–10 / leg",
      "rest": "90–120 s"
     },
     {
      "exId": "Barbell_Hip_Thrust",
      "sets": 3,
      "reps": "8–10",
      "rest": "90–120 s"
     },
     {
      "exId": "Leg_Extensions",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Standing_Leg_Curl",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Seated_Calf_Raise",
      "sets": 3,
      "reps": "12–15",
      "rest": "60 s"
     },
     {
      "exId": "Crunches",
      "sets": 3,
      "reps": "To failure",
      "rest": "60 s"
     }
    ]
   },
   {
    "name": "Active rest",
    "rest": "Light walking, mobility drills or stretching."
   },
   {
    "name": "Rest",
    "rest": "Full rest. Sleep well and let your muscles recover."
   }
  ]
 },
 {
  "id": "bodypart",
  "name": "Body Part Split",
  "daysPerWeek": 5,
  "level": "Advanced",
  "goal": "Muscle size",
  "about": "One main muscle group a day: chest, back, shoulders, legs, then arms. High volume for each muscle once a week.",
  "days": [
   {
    "name": "Chest",
    "exercises": [
     {
      "exId": "Barbell_Bench_Press_-_Medium_Grip",
      "sets": 4,
      "reps": "6–8",
      "rest": "2–3 min"
     },
     {
      "exId": "Incline_Dumbbell_Press",
      "sets": 3,
      "reps": "8–10",
      "rest": "90–120 s"
     },
     {
      "exId": "Butterfly",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Cable_Crossover",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Dips_-_Chest_Version",
      "sets": 3,
      "reps": "To failure",
      "rest": "90 s"
     },
     {
      "exId": "Crunches",
      "sets": 3,
      "reps": "To failure",
      "rest": "60 s"
     }
    ]
   },
   {
    "name": "Back",
    "exercises": [
     {
      "exId": "Barbell_Deadlift",
      "sets": 3,
      "reps": "4–6",
      "rest": "2–3 min"
     },
     {
      "exId": "Pullups",
      "sets": 3,
      "reps": "To failure",
      "rest": "90–120 s"
     },
     {
      "exId": "Bent_Over_Barbell_Row",
      "sets": 3,
      "reps": "8–10",
      "rest": "90–120 s"
     },
     {
      "exId": "Wide-Grip_Lat_Pulldown",
      "sets": 3,
      "reps": "10–12",
      "rest": "90 s"
     },
     {
      "exId": "Leverage_Iso_Row",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Hyperextensions_Back_Extensions",
      "sets": 2,
      "reps": "12–15",
      "rest": "60–90 s"
     }
    ]
   },
   {
    "name": "Shoulders",
    "exercises": [
     {
      "exId": "Barbell_Shoulder_Press",
      "sets": 4,
      "reps": "6–8",
      "rest": "2–3 min"
     },
     {
      "exId": "Arnold_Dumbbell_Press",
      "sets": 3,
      "reps": "8–10",
      "rest": "90 s"
     },
     {
      "exId": "Side_Lateral_Raise",
      "sets": 4,
      "reps": "12–15",
      "rest": "60 s"
     },
     {
      "exId": "Reverse_Machine_Flyes",
      "sets": 3,
      "reps": "12–15",
      "rest": "60 s"
     },
     {
      "exId": "Front_Dumbbell_Raise",
      "sets": 2,
      "reps": "10–12",
      "rest": "60 s"
     },
     {
      "exId": "Dumbbell_Shrug",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     }
    ]
   },
   {
    "name": "Legs",
    "exercises": [
     {
      "exId": "Barbell_Squat",
      "sets": 4,
      "reps": "6–8",
      "rest": "2–3 min"
     },
     {
      "exId": "Leg_Press",
      "sets": 3,
      "reps": "10–12",
      "rest": "90–120 s"
     },
     {
      "exId": "Romanian_Deadlift",
      "sets": 3,
      "reps": "8–10",
      "rest": "2 min"
     },
     {
      "exId": "Leg_Extensions",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Lying_Leg_Curls",
      "sets": 3,
      "reps": "12–15",
      "rest": "60–90 s"
     },
     {
      "exId": "Standing_Calf_Raises",
      "sets": 4,
      "reps": "12–15",
      "rest": "60 s"
     }
    ]
   },
   {
    "name": "Arms + Abs",
    "exercises": [
     {
      "exId": "EZ-Bar_Curl",
      "sets": 3,
      "reps": "8–10",
      "rest": "90 s"
     },
     {
      "exId": "Close-Grip_Barbell_Bench_Press",
      "sets": 3,
      "reps": "8–10",
      "rest": "90–120 s"
     },
     {
      "exId": "Hammer_Curls",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "EZ-Bar_Skullcrusher",
      "sets": 3,
      "reps": "10–12",
      "rest": "60–90 s"
     },
     {
      "exId": "Concentration_Curls",
      "sets": 2,
      "reps": "12–15",
      "rest": "60 s"
     },
     {
      "exId": "Triceps_Pushdown_-_Rope_Attachment",
      "sets": 2,
      "reps": "12–15",
      "rest": "60 s"
     },
     {
      "exId": "Hanging_Leg_Raise",
      "sets": 3,
      "reps": "To failure",
      "rest": "60 s"
     }
    ]
   },
   {
    "name": "Active rest",
    "rest": "Light walking, mobility drills or stretching."
   },
   {
    "name": "Rest",
    "rest": "Full rest. Sleep well and let your muscles recover."
   }
  ]
 }
];
// Exercise names used before the exercise library existed -> library ids. Used to migrate logged sets.
export const LEGACY_EXERCISE_NAMES = {"Flat Bench Press":"Barbell_Bench_Press_-_Medium_Grip","DB Shoulder Press":"Dumbbell_Shoulder_Press","Incline DB Press":"Incline_Dumbbell_Press","DB Front Raises":"Front_Dumbbell_Raise","DB Lateral Raises":"Side_Lateral_Raise","Chest Flies (Machine)":"Butterfly","Cable Triceps Pushdown (rope)":"Triceps_Pushdown_-_Rope_Attachment","Overhead Triceps Extension (DB / rope)":"Cable_Rope_Overhead_Triceps_Extension","Shrugs":"Dumbbell_Shrug","Lat Pulldown":"Wide-Grip_Lat_Pulldown","Rear Delt Flies (Machine)":"Reverse_Machine_Flyes","Wide Grip Row (Machine)":"Leverage_High_Row","One Arm Row (Machine)":"Leverage_Iso_Row","Close Grip Cable Row":"Seated_Cable_Rows","Standing DB Curls":"Dumbbell_Bicep_Curl","Hammer Curls":"Hammer_Curls","Lower Back Exercise":"Hyperextensions_Back_Extensions","DB Romanian Deadlift":"Stiff-Legged_Dumbbell_Deadlift","Barbell Squat (strength)":"Barbell_Squat","Leg Press":"Leg_Press","One-Leg Leg Curls (hamstring)":"Standing_Leg_Curl","Leg Extension":"Leg_Extensions","Leg Curls":"Lying_Leg_Curls","Standing Calf Raises":"Standing_Calf_Raises","Crunches":"Crunches","Leg Raises":"Flat_Bench_Lying_Leg_Raise","EZ Bar Curls":"EZ-Bar_Curl","Rope Triceps Pushdown":"Triceps_Pushdown_-_Rope_Attachment","Overhead Barbell Shoulder Press":"Barbell_Shoulder_Press","Reverse Grip Lat Pulldown":"Underhand_Cable_Pulldowns","DB Preacher Curls":"One_Arm_Dumbbell_Preacher_Curl","Reverse Grip Triceps Pushdown":"Reverse_Grip_Triceps_Pushdown","Deadlift":"Barbell_Deadlift","Pull-Ups":"Pullups","Barbell Row":"Bent_Over_Barbell_Row","Romanian Deadlift":"Romanian_Deadlift","Walking Lunges (DB)":"Dumbbell_Lunges","Dips":"Dips_-_Chest_Version","Plank":"Plank","Cable Crossover":"Cable_Crossover","Face Pulls":"Face_Pull","Skull Crushers (EZ bar)":"EZ-Bar_Skullcrusher","Seated Calf Raises":"Seated_Calf_Raise","Hip Thrust":"Barbell_Hip_Thrust","Close-Grip Bench Press":"Close-Grip_Barbell_Bench_Press","Arnold Press":"Arnold_Dumbbell_Press","Concentration Curls":"Concentration_Curls","Hanging Leg Raises":"Hanging_Leg_Raise","Bulgarian Split Squat":"Split_Squat_with_Dumbbells"};
