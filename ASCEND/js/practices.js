/* ASCEND — Stage 3.3: safe interactive practices, step durations, articulated SVG motion demos, local practice persistence. */
window.LM = window.LM || {};

(function () {
  const KEY = 'ascend.practice';

  /* Safe, evidence-aligned practice routines for all 28 guides.
     Note: avoids extreme/unproven structural claims (e.g. adult bone remodeling or excessive TMJ clenching). */
  LM.PRACTICES = {
    'face-jawline': {
      mode: 'Animated technique · Posture & neck tone',
      steps: [
        {
          title: 'Chin Tuck Alignment',
          kind: 'reps',
          sets: 1,
          repsTarget: 10,
          sec: 45,
          demo: 'chin-tuck',
          rig: { id: 'jaw-chin-tuck', views: ['profile', 'front'] },
          phases: ['Start', 'Retract', 'Hold 3–4s'],
          reps: '10 slow reps',
          cue: 'Glide your chin straight back horizontally as if making a double chin. Keep eyes level, hold 3–4 seconds, then relax.'
        },
        {
          title: 'Gentle Neck Flexion',
          kind: 'reps',
          sets: 2,
          repsTarget: 8,
          sec: 40,
          demo: 'neck-tilt',
          rig: { id: 'jaw-neck-flex', views: ['profile', 'front'] },
          phases: ['Neutral', 'Light press', 'Return'],
          reps: '2 sets × 8',
          cue: 'Place two fingers lightly on your forehead or chin for gentle resistance. Move slowly without straining the neck.'
        },
        {
          title: 'Relaxed Jaw Check',
          kind: 'hold',
          sets: 1,
          repsTarget: 0,
          sec: 20,
          demo: 'nasal-breathe',
          rig: { id: 'jaw-relax', views: ['profile'] },
          phases: ['Soft jaw', '2mm gap', 'Nasal flow'],
          reps: 'Rest check',
          cue: 'Keep teeth slightly apart, lips closed, and jaw muscles completely relaxed. Stop any exercise if you feel TMJ clicking or pain.'
        }
      ]
    },
    'face-puffiness': {
      mode: 'Gentle morning care & daily habits',
      steps: [
        {
          title: 'Cool Morning Compress',
          sec: 60,
          demo: 'lymph-drain',
          rig: { id: 'puff-compress', views: ['front'] },
          phases: ['Cool cloth', 'Under-eye & cheek', '60s calm'],
          reps: '60 sec hold',
          cue: 'Hold a cool cloth or chilled compress gently over puffy under-eye and cheek areas for comfort.'
        },
        {
          title: 'Gentle Facial Sweep',
          sec: 45,
          demo: 'lymph-drain',
          rig: { id: 'puff-sweep', views: ['front'] },
          phases: ['Feather touch', 'Out to temples', 'Down neck sides'],
          reps: 'Light sweeps',
          cue: 'Using feather-light fingertip pressure with moisturizer, sweep lightly from under the eyes toward temples and down neck sides (never press the front of the neck). Offers gentle comfort rather than guaranteed depuffing.'
        },
        {
          title: 'Hydration & Sodium Reset',
          sec: 0,
          demo: 'box-breath',
          rig: { id: 'puff-triggers', views: ['front', 'profile'] },
          phases: ['Hydration', 'Low evening salt', 'Sleep · head raised'],
          reps: 'Daily check',
          cue: 'Drink a glass of water, limit evening sodium, and sleep 7–9h with your head slightly elevated.'
        }
      ]
    },
    'face-tongue': {
      mode: 'Safe breathing & relaxed posture awareness',
      steps: [
        { title: 'Nasal Breathing Posture', sec: 45, demo: 'nasal-breathe', reps: 'Calm cadence', cue: 'Sit tall with shoulders relaxed. Breathe slowly in and out through the nose only with lips comfortably closed.' },
        { title: 'Light Palate Rest (Zero Force)', sec: 30, demo: 'nasal-breathe', reps: 'Passive rest', cue: 'Let the tongue rest lightly without pressing hard. Teeth remain slightly apart; avoid clenching or tension.' },
        { title: 'Evidence & Comfort Check', sec: 0, demo: 'chin-tuck', reps: 'Safety note', cue: 'Note: adult facial bone shape does not remodel from tongue posture. Use this purely as calm nasal-breathing and jaw-relaxation awareness.' }
      ]
    },
    'face-smile': {
      mode: '2-minute timed dental sequence',
      steps: [
        {
          title: 'Upper Arch (Outer & Inner)',
          kind: 'hold',
          sec: 60,
          demo: 'dental-brush',
          rig: { id: 'smile-upper-arch', views: ['front'] },
          phases: ['45° angle', 'Outer sweep', 'Inner arc'],
          reps: '30s each side',
          cue: 'Angle a soft brush 45° toward the gumline. Use gentle small circular strokes across upper teeth without scrubbing hard.'
        },
        {
          title: 'Lower Arch (Outer & Inner)',
          kind: 'hold',
          sec: 60,
          demo: 'dental-brush',
          rig: { id: 'smile-lower-arch', views: ['front'] },
          phases: ['Lower gumline', 'Outer & inner', 'Bite surface'],
          reps: '30s each side',
          cue: 'Brush lower outer, inner, and chewing surfaces evenly for a full 60 seconds with fluoride toothpaste.'
        },
        {
          title: 'Tongue Clean & Floss',
          kind: 'hold',
          sec: 45,
          demo: 'dental-brush',
          rig: { id: 'smile-tongue-floss', views: ['front'] },
          phases: ['Tongue sweep', 'Floss curve', 'Between teeth'],
          reps: 'Once daily',
          cue: 'Gently clean the tongue from back to front and floss cleanly between every tooth.'
        }
      ]
    },
    'skin-sunscreen': {
      mode: 'Animated coverage flow',
      steps: [
        {
          title: 'Two-Finger Measure',
          kind: 'hold',
          sec: 15,
          demo: 'spf-apply',
          rig: { id: 'spf-two-finger', views: ['front'] },
          phases: ['Two fingers', 'Full strips', 'SPF 30+'],
          reps: 'SPF 30+ broad',
          cue: 'Dispense two full finger-lengths of broad-spectrum SPF 30+ onto index and middle fingers.'
        },
        {
          title: 'Even Face Coverage',
          kind: 'hold',
          sec: 30,
          demo: 'spf-apply',
          rig: { id: 'spf-face-zones', views: ['front'] },
          phases: ['Dot 5 zones', 'Outward blend', 'Eye perimeter'],
          reps: 'Dot & blend',
          cue: 'Dot evenly across forehead, cheeks, nose, and chin, then smooth gently outward without missing hairline or around eyes.'
        },
        {
          title: 'Neck, Ears & Hands',
          kind: 'hold',
          sec: 25,
          demo: 'spf-apply',
          rig: { id: 'spf-neck-ears-hands', views: ['front'] },
          phases: ['Neck sides', 'Ears', 'Hand backs'],
          reps: '15 min pre-sun',
          cue: 'Cover neck sides, ears, and backs of hands. Apply 15 minutes before going outside.'
        }
      ]
    },
    'skin-routine': {
      mode: '3-step barrier care sequence',
      steps: [
        {
          title: '60-Second Gentle Cleanse',
          sec: 60,
          demo: 'skincare-flow',
          rig: { id: 'skin-cleanse-60', views: ['front'] },
          phases: ['Damp skin', '60s soft circles', 'Lukewarm rinse'],
          reps: 'Lukewarm water',
          cue: 'Massage gentle cleanser over damp skin in soft circles for 60 seconds, then rinse with lukewarm (never hot) water.'
        },
        {
          title: 'Pat Dry & Moisturize',
          sec: 30,
          demo: 'skincare-flow',
          rig: { id: 'skin-pat-moisturize', views: ['front'] },
          phases: ['Gentle pat', 'Damp skin', 'Seal moisture'],
          reps: 'Damp lock-in',
          cue: 'Pat gently with a clean towel and apply moisturizer while skin is still slightly damp to seal hydration.'
        },
        {
          title: 'Daytime Protection / Night Rest',
          sec: 20,
          demo: 'spf-apply',
          rig: { id: 'skin-am-pm-finish', views: ['front'] },
          phases: ['AM · SPF 30+', 'PM · Barrier rest', '1 product rule'],
          reps: 'AM SPF · PM rest',
          cue: 'Morning only: finish with broad-spectrum SPF 30+. Evening: skip SPF and stop after gentle cleansing and moisturizer for barrier rest. Add only one new product at a time (~2 weeks apart).'
        }
      ]
    },
    'skin-retinoid': {
      mode: 'Safe evening application sequence',
      steps: [
        { title: 'Cleanse & Dry Wait', sec: 60, demo: 'skincare-flow', reps: 'Fully dry skin', cue: 'Wash gently and wait until skin feels completely dry before applying retinoid to reduce stinging and irritation.' },
        { title: 'Pea-Sized Even Application', sec: 30, demo: 'spf-apply', reps: 'Pea size total', cue: 'Use only a pea-sized drop split across forehead, cheeks, and chin. Avoid corners of eyes, nostrils, and lips.' },
        { title: 'Moisturizer & Safety Check', sec: 20, demo: 'skincare-flow', reps: 'Daily AM SPF', cue: 'Follow with gentle moisturizer. Never use retinoids during pregnancy, and wear SPF 30+ every morning.' }
      ]
    },
    'skin-acne': {
      mode: 'Calm anti-breakout sequence',
      steps: [
        { title: 'Non-Stripping Cleanse', sec: 45, demo: 'skincare-flow', reps: 'No scrubbing', cue: 'Cleanse gently once or twice daily with fingertips only. Avoid rough scrubs or squeezing spots, which cause marks.' },
        { title: 'Targeted Thin Treatment', sec: 30, demo: 'spf-apply', reps: 'Thin layer', cue: 'Apply one active at a time cleanly (e.g. evening adapalene or benzoyl peroxide wash) without layering harsh acids.' },
        { title: 'Barrier Moisturizer & SPF', sec: 20, demo: 'spf-apply', reps: 'Non-comedogenic', cue: 'Finish with a lightweight non-comedogenic moisturizer and daily sunscreen.' }
      ]
    },
    'hair-care': {
      mode: 'Wash & protect technique',
      steps: [
        { title: 'Scalp-Focused Cleanse', sec: 45, demo: 'scalp-massage', reps: 'Fingertips only', cue: 'Work shampoo onto the scalp with gentle fingertip pads, letting suds rinse down the hair lengths naturally.' },
        { title: 'Mid-Lengths & Ends Condition', sec: 60, demo: 'scalp-massage', reps: '60s detangle', cue: 'Smooth conditioner through mid-lengths and ends (avoid weighing down roots), detangle gently with wide fingers or comb.' },
        { title: 'Soft Towel Pat', sec: 20, demo: 'hair-towel', reps: 'Zero rough rub', cue: 'Blot moisture gently with a soft towel or T-shirt instead of rubbing aggressively, reducing breakage and frizz.' }
      ]
    },
    'hair-scalp': {
      mode: 'Timed 3-minute scalp treatment',
      steps: [
        { title: 'Targeted Scalp Massage', sec: 45, demo: 'scalp-massage', reps: 'Gentle circles', cue: 'Apply anti-dandruff shampoo directly to the scalp and massage lightly with fingertip pads for 45 seconds.' },
        { title: 'Active Leave-On Timer', sec: 180, demo: 'scalp-massage', reps: '3 min soak', cue: 'Let the active formula sit on the scalp for 3 minutes so antifungal ingredients can work before rinsing.' },
        { title: 'Thorough Rinse', sec: 30, demo: 'scalp-massage', reps: 'Cool/lukewarm', cue: 'Rinse scalp completely with lukewarm water so no residue remains.' }
      ]
    },
    'hair-loss': {
      mode: 'Routine consistency & tracking',
      steps: [
        { title: 'Consistent Treatment Check', sec: 30, demo: 'scalp-massage', reps: 'As prescribed', cue: 'Apply topical treatment cleanly to dry scalp areas as directed by your doctor or label.' },
        { title: 'Monthly Photo Baseline', sec: 0, demo: 'outfit-check', reps: 'Same lighting', cue: 'Track progress monthly using the same angle, distance, and overhead lighting rather than checking daily.' },
        { title: 'Medical Review Reminder', sec: 0, demo: 'box-breath', reps: '6–12 mo horizon', cue: 'Confirm causes with a dermatologist and keep realistic 6–12 month expectations.' }
      ]
    },
    'hair-style': {
      mode: 'Prep & light styling sequence',
      steps: [
        { title: 'Reference & Density Check', sec: 0, demo: 'outfit-check', reps: 'Barber prep', cue: 'Save 2–3 reference cuts matching your real hair density and curl pattern before visiting a barber.' },
        { title: 'Small-Amount Product Blend', sec: 30, demo: 'scalp-massage', reps: 'Pea size first', cue: 'Warm a small pea-sized amount of clay or cream fully across palms before working cleanly from back to front.' },
        { title: 'Natural Silhouette Finish', sec: 20, demo: 'groom-brows', reps: 'Clean edges', cue: 'Check side profiles and neckline balance. Less product gives cleaner natural movement.' }
      ]
    },
    'body-posture': {
      mode: 'Animated mobility & upper-back flow',
      steps: [
        {
          title: 'Wall Angels',
          kind: 'reps',
          sets: 2,
          repsTarget: 10,
          sec: 60,
          demo: 'wall-angels',
          rig: { id: 'posture-wall-angels', views: ['front', 'profile'] },
          phases: ['Wall contact', 'W-position', 'Y-glide up'],
          reps: '2 sets × 10 reps',
          cue: 'Stand with heels, glutes, upper back, and head gently touching a wall. Slide arms slowly up into a Y and back down to a W.'
        },
        {
          title: 'Scapular Pull-Aparts',
          kind: 'reps',
          sets: 3,
          repsTarget: 12,
          sec: 45,
          demo: 'pull-apart',
          rig: { id: 'posture-pull-apart', views: ['front'] },
          phases: ['Ribs down', 'Pull wide', 'Squeeze blades'],
          reps: '3 sets × 12 reps',
          cue: 'Keep ribs down and shoulders away from ears. Pull arms open smoothly, squeezing shoulder blades together cleanly.'
        },
        {
          title: 'Doorway Chest Stretch',
          kind: 'hold',
          sec: 60,
          demo: 'chest-stretch',
          rig: { id: 'posture-chest-stretch', views: ['profile'] },
          phases: ['Frame height', 'Gentle step', '30s switch'],
          reps: '30s per side',
          cue: 'Place forearm on a doorframe at shoulder height and step gently forward until you feel a mild chest stretch—never pinch the shoulder.'
        },
        {
          title: 'Hip Flexor Lunge Stretch',
          kind: 'hold',
          sec: 60,
          demo: 'hip-flexor',
          rig: { id: 'posture-hip-flexor', views: ['profile'] },
          phases: ['Split lunge', 'Pelvic tuck', 'Shift forward'],
          reps: '30s per side',
          cue: 'Kneel in a split lunge, lightly brace your core, tuck pelvis subtly, and shift forward slightly to open the front hip.'
        },
        {
          title: 'Eye-Level Screen Check',
          kind: 'hold',
          sec: 15,
          demo: 'chin-tuck',
          rig: { id: 'posture-screen-eye', views: ['profile'] },
          phases: ['Tall spine', 'Eye horizon', 'Micro-break'],
          reps: 'Ergonomic cue',
          cue: 'Set monitor top near eye level and stand every 30–45 minutes.'
        }
      ]
    },
    'body-strength': {
      mode: 'Animated foundational lift patterns',
      steps: [
        {
          title: 'Bodyweight Squat Pattern',
          sec: 45,
          demo: 'squat-hinge',
          rig: { id: 'strength-squat', views: ['profile', 'front'] },
          phases: ['Shoulder stance', 'Hips back & down', 'Drive up'],
          reps: '8–12 clean reps',
          cue: 'Feet shoulder-width, brace core, sit hips back and down keeping knees tracking over toes and chest proud.'
        },
        {
          title: 'Hip Hinge Pattern',
          sec: 45,
          demo: 'squat-hinge',
          rig: { id: 'strength-hinge', views: ['profile', 'front'] },
          phases: ['Soft knees', 'Hips back', 'Drive hips'],
          reps: '10 slow reps',
          cue: 'Soft knees, push hips straight backward keeping spine long and neutral, feel hamstring tension, then drive hips forward.'
        },
        {
          title: 'Push-Up / Plank Line',
          sec: 45,
          demo: 'push-plank',
          rig: { id: 'strength-push', views: ['profile', 'front'] },
          phases: ['Plank line', '45° lower', 'Even press'],
          reps: 'Clean tempo',
          cue: 'Hands under shoulders, body in one straight plank line. Lower chest with elbows angled ~45° back, then press evenly.'
        },
        {
          title: 'Upper-Back Pull Control',
          sec: 45,
          demo: 'pull-apart',
          rig: { id: 'strength-pull', views: ['front', 'profile'] },
          phases: ['Shoulders down', 'Lead with elbows', 'Full squeeze'],
          reps: 'Full scapular pull',
          cue: 'Lead every pulling movement with the elbows and shoulder blades rather than shrugging up toward the ears.'
        }
      ]
    },
    'body-fat': {
      mode: 'Nutrition & weekly tracking habit',
      steps: [
        { title: 'Protein-First Plate Check', sec: 0, demo: 'outfit-check', reps: 'Every main meal', cue: 'Anchor each meal with a clear whole-food protein source plus fiber-rich vegetables before calorie-dense extras.' },
        { title: 'Calorie Target Check', sec: 0, demo: 'box-breath', reps: 'Modest 10–20%', cue: 'Avoid crash diets. Keep a sustainable modest deficit or surplus and prioritize sleep recovery.' },
        { title: 'Weekly Average Review', sec: 0, demo: 'outfit-check', reps: 'Weekly trend', cue: 'Judge progress by 7-day weight averages, waist fit, and monthly photos—never single-day fluctuations.' }
      ]
    },
    'body-walk': {
      mode: 'Timed brisk movement break',
      steps: [
        { title: 'Upright Stride Warm-Up', sec: 60, demo: 'brisk-walk', reps: 'Tall posture', cue: 'Stand tall, look forward at the horizon, relax shoulders, and swing arms naturally from the shoulders.' },
        { title: 'Brisk Daylight Walk', sec: 300, demo: 'brisk-walk', reps: '5-min block', cue: 'Maintain a steady brisk pace where you can still speak in short sentences. Build toward 7,000–10,000 daily steps.' },
        { title: 'Calm Cool-Down Breath', sec: 30, demo: 'box-breath', reps: 'Slow nasal', cue: 'Ease your stride and take slow nasal breaths to finish cleanly.' }
      ]
    },
    'style-fit': {
      mode: 'Interactive silhouette fit check',
      steps: [
        { title: 'Shoulder Seam Alignment', sec: 20, demo: 'outfit-check', reps: 'Upper frame', cue: 'Check that shirt and jacket shoulder seams sit cleanly right where your shoulder bone ends—not drooping past.' },
        { title: 'Sleeve & Wrist Bone Line', sec: 20, demo: 'outfit-check', reps: 'Proportion cue', cue: 'Shirt cuffs should end right at the wrist bone; jacket sleeves show about 1 cm of shirt cuff.' },
        { title: 'Trouser Break & Waist Check', sec: 20, demo: 'outfit-check', reps: 'Clean drape', cue: 'Trousers should skim the leg cleanly with zero or a subtle single break over your shoes.' }
      ]
    },
    'style-palette': {
      mode: 'Capsule wardrobe audit',
      steps: [
        { title: 'Neutral Base Pairing', sec: 25, demo: 'outfit-check', reps: '3-item match', cue: 'Verify today\'s outfit uses cohesive neutrals (black, charcoal, navy, white, stone) plus at most 1–2 muted accents.' },
        { title: '1-Year Unworn Sweep', sec: 0, demo: 'outfit-check', reps: 'Closet check', cue: 'Set aside one item you have not worn in 12 months so everyday choices become sharper and faster.' }
      ]
    },
    'style-proportions': {
      mode: 'Visual frame balance check',
      steps: [
        { title: 'Rule of Thirds Waistline', sec: 20, demo: 'outfit-check', reps: 'Balanced ratio', cue: 'Avoid splitting your silhouette 50/50; try 1/3 upper + 2/3 lower proportions or clean tonal layering.' },
        { title: 'Objective Mirror/Photo Check', sec: 20, demo: 'outfit-check', reps: 'Full length', cue: 'Step back from the mirror to check overall posture, shoulder structure, and pant drape as one clean line.' }
      ]
    },
    'style-care': {
      mode: 'Garment & footwear upkeep',
      steps: [
        { title: 'Collar, Wrinkle & Lint Pass', sec: 45, demo: 'outfit-check', reps: 'Quick steam', cue: 'Smooth shirt collars, steam or press visible creases, and clear lint or pilling before heading out.' },
        { title: 'Shoe Midsole & Heel Wipe', sec: 45, demo: 'outfit-check', reps: 'Clean finish', cue: 'Wipe sneaker midsoles or brush leather shoes—clean footwear elevates even a simple tee and jeans.' }
      ]
    },
    'groom-beard': {
      mode: 'Grain-mapped shaving & trim sequence',
      steps: [
        {
          title: 'Warm Prep & Soften',
          sec: 45,
          demo: 'skincare-flow',
          rig: { id: 'beard-warm-prep', views: ['front', 'profile'] },
          phases: ['Warm water', '45s soften', 'Low drag ready'],
          reps: 'Softens hair',
          cue: 'Wash face with warm water for 45 seconds before shaving or trimming to soften whiskers and reduce razor drag.'
        },
        {
          title: 'Shave / Edge With the Grain',
          sec: 60,
          demo: 'groom-razor',
          rig: { id: 'beard-grain-neck', views: ['profile', 'front'] },
          phases: ['Check grain', '2-finger neckline', 'Light stroke'],
          reps: 'Light strokes',
          cue: 'Map your own hair growth direction first (cheek and neck grain varies by person). Use a sharp blade with light pressure strictly with your grain; keep neckline ~2 fingers above Adam\'s apple.'
        },
        {
          title: 'Cool Rinse & Soothe',
          sec: 25,
          demo: 'skincare-flow',
          rig: { id: 'beard-cool-soothe', views: ['front'] },
          phases: ['Cool rinse', 'Pat dry', 'Soothe balm'],
          reps: 'Alcohol-free',
          cue: 'Rinse with cool water, pat dry gently, and apply fragrance-free moisturizer to calm skin.'
        }
      ]
    },
    'groom-brows': {
      mode: 'Natural brow & ear/nose tidy',
      steps: [
        {
          title: 'Brush Upward & Assess',
          sec: 20,
          demo: 'groom-brows',
          rig: { id: 'brows-brush-assess', views: ['front'] },
          phases: ['Spoolie up', 'Natural line', 'Spot strays'],
          reps: 'Natural arch',
          cue: 'Brush brow hairs straight up with a clean spoolie to see only genuine strays outside your natural arch.'
        },
        {
          title: 'Conservative Stray Cleanup',
          sec: 45,
          demo: 'groom-brows',
          rig: { id: 'brows-cleanup', views: ['front'] },
          phases: ['Glabella center', 'Well below arch', 'Rounded trimmer'],
          reps: 'Center + under only',
          cue: 'Remove only clear strays between brows or well below the arch; never thin heavily. Use rounded trimmer for nose/ears—never pluck nose hair.'
        },
        {
          title: 'Sanitize Tools',
          sec: 15,
          demo: 'groom-brows',
          rig: { id: 'brows-sanitize', views: ['front'] },
          phases: ['Inspect tools', 'Alcohol wipe', 'Clean metal'],
          reps: 'Clean metal',
          cue: 'Wipe tweezers and trimmers cleanly with rubbing alcohol after every use.'
        }
      ]
    },
    'groom-scent': {
      mode: 'Clean base & pulse-point guide',
      steps: [
        { title: 'Hygiene Base First', sec: 0, demo: 'skincare-flow', reps: 'Clean skin', cue: 'Fragrance layers on clean, moisturized skin and deodorant—never masks poor hygiene.' },
        { title: 'Controlled Pulse-Point Sprays', sec: 20, demo: 'spf-apply', reps: '1–3 sprays max', cue: 'Apply 1–3 sprays to pulse points (sides of neck or upper chest) from ~15 cm away; do not rub wrists together harshly.' }
      ]
    },
    'groom-hands': {
      mode: 'Nail, cuticle & lip care sequence',
      steps: [
        { title: 'Trim Straight & File Edges', sec: 45, demo: 'skincare-flow', reps: 'Clean line', cue: 'Trim nails straight across cleanly, smooth sharp corners with a fine file, and never bite cuticles.' },
        { title: 'Hydrate Hands & SPF Lip Balm', sec: 20, demo: 'spf-apply', reps: 'Daily lock-in', cue: 'Massage hand cream after washing and apply SPF lip balm before stepping outside.' }
      ]
    },
    'health-sleep': {
      mode: 'Evening wind-down & breath routine',
      steps: [
        { title: 'Dim Screens & Room Prep', sec: 30, demo: 'box-breath', reps: 'Cool & dark', cue: 'Lower room lighting, put screens on night silence 30–60 min before sleep, and cool the bedroom.' },
        { title: 'Slow Physiological Wind-Down', sec: 90, demo: 'box-breath', reps: '4-4-4-4 rhythm', cue: 'Follow the calm breathing pace to lower heart rate and prepare your nervous system for deep sleep.' },
        { title: 'Consistent Wake Target', sec: 0, demo: 'nasal-breathe', reps: '7–9h anchor', cue: 'Set a steady wake time within 30 minutes daily to anchor circadian energy and skin recovery.' }
      ]
    },
    'health-hydration': {
      mode: 'Mindful hydration & whole-food check',
      steps: [
        { title: 'Steady Hydration Check', sec: 20, demo: 'box-breath', reps: 'Pale yellow cue', cue: 'Pour a glass of water now; aim for steady hydration across the day (~2 L total guide) rather than chugging late at night.' },
        { title: 'Whole-Food Meal Audit', sec: 0, demo: 'outfit-check', reps: 'Veg + protein', cue: 'Check that your next meal includes real vegetables or fruit, protein, and zero sugary drinks.' }
      ]
    },
    'health-smoke': {
      mode: '3-minute craving urge-surfing reset',
      steps: [
        { title: 'Box Breathing Urge Reset', sec: 90, demo: 'box-breath', reps: 'Ride the wave', cue: 'Cravings peak and fade within minutes. Breathe calmly in the 4-4-4-4 cadence and observe the impulse pass without acting.' },
        { title: '5-Minute Replacement Walk', sec: 90, demo: 'brisk-walk', reps: 'Change state', cue: 'Stand up and take a brisk short walk or drink cold water to shift your environment cleanly.' }
      ]
    },
    'health-mind': {
      mode: 'Grounded breathing & perspective reset',
      steps: [
        { title: 'Box Breathing (4 · 4 · 4 · 4)', sec: 96, demo: 'box-breath', reps: '6 calm cycles', cue: 'Inhale cleanly for 4s, hold 4s, exhale slowly 4s, rest 4s. Keep shoulders dropped and jaw soft.' },
        { title: 'Process Over Comparison', sec: 0, demo: 'nasal-breathe', reps: 'Habit focus', cue: 'Step away from mirrors and edited social comparisons; direct energy strictly toward habits you control today.' }
      ]
    }
  };

  LM.guidePractice = function (id) {
    const p = LM.PRACTICES[id];
    const g = LM.Game.guideById(id);
    if (!p && !g) return null;
    const I = LM.I18n;
    const tr = (k, fb) => (I && I.content ? I.content(k, fb) : fb);
    const rawSteps = p ? p.steps : (g.steps || []).map((s, i) => ({
      title: 'Step ' + (i + 1), sec: 30, demo: 'box-breath', reps: 'Guided', cue: s
    }));
    const steps = rawSteps.map((st, idx) => ({
      title: tr('practice.' + id + '.s' + idx + '.title', st.title),
      kind: st.kind || (st.sec > 0 ? 'hold' : 'self'),
      sets: st.sets || 1,
      repsTarget: st.repsTarget || 0,
      sec: st.sec,
      demo: st.demo,
      rig: st.rig || null,
      phases: st.phases
        ? st.phases.map((ph, pi) => tr('practice.' + id + '.s' + idx + '.p' + pi, ph))
        : null,
      reps: tr('practice.' + id + '.s' + idx + '.reps', st.reps),
      cue: tr('practice.' + id + '.s' + idx + '.cue', st.cue)
    }));
    const totalSec = steps.reduce((a, s) => a + (s.sec || 0), 0);
    const mins = Math.max(1, Math.round(totalSec / 60) || Math.ceil(steps.length * 0.5));
    const durLabel = totalSec > 0 && totalSec < 90
      ? (LM.t ? LM.t('common.secUnit', { s: totalSec }) : totalSec + ' sec')
      : (LM.t ? LM.t('common.minUnit', { m: mins }) : '~' + mins + ' min');
    return {
      mode: tr('practice.' + id + '.mode', (p && p.mode) || 'Guided step-by-step practice'),
      steps: steps,
      totalSec: totalSec,
      durationLabel: durLabel
    };
  };

  /* Local storage for practice completions & mid-session resume.
     Prefix 'ascend.' ensures Store.eraseAll() wipes it cleanly without modifying store.js. */
  function readStore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && typeof o === 'object') return Object.assign({ sessions: {}, resume: null }, o);
      }
    } catch (e) {}
    return { sessions: {}, resume: null };
  }
  function writeStore(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  LM.PracticeStore = {
    getAll() { return readStore(); },
    stats(id) { return readStore().sessions[id] || { count: 0, totalSec: 0, lastAt: null }; },
    resumeFor(id) {
      const r = readStore().resume;
      return (r && r.id === id) ? r : null;
    },
    saveResume(r) {
      const d = readStore();
      d.resume = r;
      writeStore(d);
    },
    clearResume() {
      const d = readStore();
      if (d.resume) { d.resume = null; writeStore(d); }
    },
    recordComplete(id, elapsedSec) {
      const d = readStore();
      const prev = d.sessions[id] || { count: 0, totalSec: 0, lastAt: null };
      d.sessions[id] = {
        count: prev.count + 1,
        totalSec: prev.totalSec + Math.max(0, Math.round(elapsedSec || 0)),
        lastAt: Date.now()
      };
      if (d.resume && d.resume.id === id) d.resume = null;
      writeStore(d);
      return d.sessions[id];
    },
    reset() {
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  };

  /* Articulated SVG motion demonstrations (OBS / Accent Orange vectors on obsidian stage). */
  const DEMOS = {
    'wall-angels': {
      badge: 'Animated · Shoulder & Thoracic',
      svg: `<g class="anim-wall-angels">
        <line x1="140" y1="18" x2="140" y2="182" class="d-guide"/>
        <circle cx="140" cy="48" r="14" class="d-fig"/>
        <path d="M140 62 V140 M120 140 H160 M126 140 V180 M154 140 V180" class="d-fig"/>
        <g class="arm-l"><path d="M140 78 L108 78 L108 50" class="d-acc"/></g>
        <g class="arm-r"><path d="M140 78 L172 78 L172 50" class="d-acc"/></g>
        <path d="M84 82 V46 M80 52 L84 44 L88 52" class="d-arrow"/>
        <path d="M196 82 V46 M192 52 L196 44 L200 52" class="d-arrow"/>
      </g>`
    },
    'pull-apart': {
      badge: 'Animated · Scapular Retraction',
      svg: `<g class="anim-pull-apart">
        <circle cx="140" cy="48" r="14" class="d-fig"/>
        <path d="M140 62 V142 M122 142 H158 M128 142 V180 M152 142 V180" class="d-fig"/>
        <line x1="86" y1="88" x2="194" y2="88" class="d-band"/>
        <g class="pull-l"><path d="M140 78 L98 88" class="d-acc"/><circle cx="96" cy="88" r="4" class="d-dot"/></g>
        <g class="pull-r"><path d="M140 78 L182 88" class="d-acc"/><circle cx="184" cy="88" r="4" class="d-dot"/></g>
        <path d="M98 112 L78 112 M84 108 L76 112 L84 116" class="d-arrow"/>
        <path d="M182 112 L202 112 M196 108 L204 112 L196 116" class="d-arrow"/>
      </g>`
    },
    'chest-stretch': {
      badge: 'Animated · Pectoral Open',
      svg: `<g class="anim-chest-stretch">
        <rect x="174" y="24" width="12" height="156" rx="3" class="d-prop"/>
        <g class="lean-body">
          <circle cx="122" cy="54" r="13" class="d-fig"/>
          <path d="M122 68 L116 132 L104 176 M116 132 L136 176" class="d-fig"/>
          <path d="M121 80 L174 78 L174 52" class="d-acc"/>
        </g>
        <path d="M128 106 L154 106 M148 102 L156 106 L148 110" class="d-arrow"/>
      </g>`
    },
    'hip-flexor': {
      badge: 'Animated · Split Lunge Mobility',
      svg: `<g class="anim-hip-flexor">
        <line x1="56" y1="178" x2="224" y2="178" class="d-guide"/>
        <g class="lunge-shift">
          <circle cx="132" cy="52" r="13" class="d-fig"/>
          <path d="M132 66 V118" class="d-fig"/>
          <path d="M132 118 L170 120 L170 176" class="d-acc"/>
          <path d="M132 118 L108 174 L84 176" class="d-fig"/>
          <path d="M132 82 L152 102" class="d-fig"/>
        </g>
        <path d="M148 92 L176 92 M170 88 L178 92 L170 96" class="d-arrow"/>
      </g>`
    },
    'squat-hinge': {
      badge: 'Animated · Lower Body Form',
      svg: `<g class="anim-squat">
        <line x1="70" y1="178" x2="210" y2="178" class="d-guide"/>
        <g class="squat-torso">
          <circle cx="136" cy="48" r="13" class="d-fig"/>
          <path d="M136 62 L130 112" class="d-fig"/>
          <path d="M134 74 L166 86" class="d-acc"/>
        </g>
        <path d="M130 112 L158 142 L144 176" class="d-acc anim-knee"/>
        <path d="M130 112 L144 176" class="d-ghost"/>
        <path d="M84 96 V136 M80 130 L84 138 L88 130" class="d-arrow"/>
      </g>`
    },
    'push-plank': {
      badge: 'Animated · Plank & Press',
      svg: `<g class="anim-pushup">
        <line x1="48" y1="168" x2="232" y2="168" class="d-guide"/>
        <circle cx="72" cy="166" r="3" class="d-dot"/>
        <g class="push-body">
          <path d="M72 164 L182 108" class="d-fig"/>
          <circle cx="196" cy="100" r="12" class="d-fig"/>
        </g>
        <path d="M178 114 L184 168" class="d-acc"/>
        <path d="M214 114 V148 M210 142 L214 150 L218 142" class="d-arrow"/>
      </g>`
    },
    'brisk-walk': {
      badge: 'Animated · Upright Stride',
      svg: `<g class="anim-walk">
        <line x1="56" y1="178" x2="224" y2="178" class="d-guide"/>
        <circle cx="140" cy="46" r="13" class="d-fig"/>
        <path d="M140 60 L140 118" class="d-fig"/>
        <path d="M140 118 L164 176" class="d-acc leg-a"/>
        <path d="M140 118 L116 176" class="d-fig leg-b"/>
        <path d="M140 76 L164 102" class="d-fig arm-a"/>
        <path d="M140 76 L116 102" class="d-acc arm-b"/>
        <path d="M186 58 L210 58 M204 54 L212 58 L204 62" class="d-arrow"/>
      </g>`
    },
    'chin-tuck': {
      badge: 'Animated · Cervical Retraction',
      svg: `<g class="anim-chin-tuck">
        <line x1="148" y1="22" x2="148" y2="180" class="d-guide"/>
        <path d="M116 176 C116 146 132 132 148 132 C164 132 178 146 178 176" class="d-fig"/>
        <g class="head-glide">
          <path d="M132 118 V98 C126 94 122 82 124 68 C126 52 138 42 154 44 C168 46 176 58 176 74 L182 82 L174 88 L174 96 C174 104 166 110 156 110 L152 126" class="d-acc"/>
        </g>
        <path d="M196 84 H168 M174 80 L166 84 L174 88" class="d-arrow"/>
      </g>`
    },
    'neck-tilt': {
      badge: 'Animated · Light Resistance',
      svg: `<g class="anim-neck-tilt">
        <line x1="140" y1="24" x2="140" y2="180" class="d-guide"/>
        <path d="M108 176 C108 148 124 134 140 134 C156 134 172 148 172 176" class="d-fig"/>
        <g class="neck-nod">
          <circle cx="140" cy="76" r="24" class="d-fig"/>
          <path d="M140 100 V134" class="d-acc"/>
        </g>
        <path d="M174 74 C186 74 186 92 174 96" class="d-arrow"/>
      </g>`
    },
    'lymph-drain': {
      badge: 'Animated · Gentle Drainage Path',
      svg: `<g class="anim-lymph">
        <path d="M140 34 C112 34 98 56 98 86 C98 118 118 144 140 144 C162 144 182 118 182 86 C182 56 168 34 140 34 Z" class="d-fig"/>
        <path d="M122 140 V172 M158 140 V172" class="d-fig"/>
        <path d="M126 94 Q106 94 102 116 L112 152" class="d-acc sweep-l"/>
        <path d="M154 94 Q174 94 178 116 L168 152" class="d-acc sweep-r"/>
        <circle cx="116" cy="94" r="4" class="d-dot pulse-dot"/>
        <circle cx="164" cy="94" r="4" class="d-dot pulse-dot"/>
      </g>`
    },
    'nasal-breathe': {
      badge: 'Animated · Nasal Cadence',
      svg: `<g class="anim-breathe">
        <path d="M104 174 C104 148 120 134 136 134 C152 134 166 146 168 174" class="d-fig"/>
        <path d="M122 116 V98 C114 90 112 72 118 58 C126 42 146 38 160 48 L168 74 L174 82 L166 88 L164 104 L148 108 V130" class="d-fig"/>
        <path d="M196 80 L170 80 Q152 80 148 112 V148" class="d-acc flow-dash"/>
        <circle cx="148" cy="154" r="14" class="d-ring breath-ring"/>
      </g>`
    },
    'dental-brush': {
      badge: 'Animated · 45° Quadrant Sweep',
      svg: `<g class="anim-brush">
        <path d="M88 86 Q140 54 192 86" class="d-fig"/>
        <path d="M88 116 Q140 148 192 116" class="d-fig"/>
        <rect x="108" y="84" width="14" height="14" rx="3" class="d-prop"/>
        <rect x="125" y="81" width="14" height="16" rx="3" class="d-prop"/>
        <rect x="142" y="81" width="14" height="16" rx="3" class="d-prop"/>
        <rect x="159" y="84" width="14" height="14" rx="3" class="d-prop"/>
        <g class="brush-head">
          <rect x="122" y="92" width="32" height="10" rx="4" class="d-acc"/>
          <line x1="154" y1="97" x2="212" y2="97" class="d-acc"/>
        </g>
      </g>`
    },
    'spf-apply': {
      badge: 'Animated · 2-Finger Even Zones',
      svg: `<g class="anim-spf">
        <path d="M140 36 C114 36 100 58 100 88 C100 120 118 144 140 144 C162 144 180 120 180 88 C180 58 166 36 140 36 Z" class="d-fig"/>
        <path d="M122 140 V172 M158 140 V172" class="d-fig"/>
        <circle cx="140" cy="58" r="5" class="d-dot pulse-dot"/>
        <circle cx="118" cy="96" r="5" class="d-dot pulse-dot"/>
        <circle cx="162" cy="96" r="5" class="d-dot pulse-dot"/>
        <circle cx="140" cy="124" r="5" class="d-dot pulse-dot"/>
        <path d="M116 94 Q140 76 164 94" class="d-arrow"/>
      </g>`
    },
    'skincare-flow': {
      badge: 'Animated · Gentle Circular Cleanse',
      svg: `<g class="anim-cleanse">
        <path d="M140 36 C114 36 100 58 100 88 C100 120 118 144 140 144 C162 144 180 120 180 88 C180 58 166 36 140 36 Z" class="d-fig"/>
        <circle cx="116" cy="96" r="14" class="d-acc orbit-a"/>
        <circle cx="164" cy="96" r="14" class="d-acc orbit-b"/>
        <path d="M124 148 Q140 164 156 148" class="d-guide"/>
      </g>`
    },
    'scalp-massage': {
      badge: 'Animated · Fingertip Pads Only',
      svg: `<g class="anim-scalp">
        <path d="M98 118 C98 70 116 42 140 42 C164 42 182 70 182 118" class="d-fig"/>
        <path d="M104 118 V142 C104 162 122 174 140 174 C158 174 176 162 176 142 V118" class="d-fig"/>
        <circle cx="118" cy="58" r="10" class="d-acc ripple-1"/>
        <circle cx="162" cy="58" r="10" class="d-acc ripple-2"/>
        <circle cx="140" cy="46" r="4" class="d-dot"/>
      </g>`
    },
    'hair-towel': {
      badge: 'Technique · Gentle Blot',
      svg: `<g class="anim-cleanse">
        <circle cx="140" cy="96" r="40" class="d-fig"/>
        <path d="M92 84 C92 52 114 36 140 36 C166 36 188 52 188 84" class="d-acc orbit-a"/>
        <path d="M110 154 H170" class="d-guide"/>
      </g>`
    },
    'groom-razor': {
      badge: 'Animated · Follow Hair Grain',
      svg: `<g class="anim-razor">
        <path d="M140 36 C112 36 98 58 98 92 C98 124 118 148 140 148 C162 148 182 124 182 92 C182 58 168 36 140 36 Z" class="d-fig"/>
        <path d="M108 110 C122 134 158 134 172 110" class="d-guide"/>
        <path d="M122 150 Q140 160 158 150" class="d-arrow"/>
        <g class="razor-glide">
          <rect x="104" y="88" width="22" height="8" rx="2" class="d-acc"/>
          <line x1="115" y1="96" x2="115" y2="122" class="d-acc"/>
        </g>
        <path d="M168 90 V118 M164 112 L168 120 L172 112" class="d-arrow"/>
      </g>`
    },
    'groom-brows': {
      badge: 'Guided · Natural Brow Line',
      svg: `<g class="anim-brows">
        <path d="M74 88 Q102 68 126 84" class="d-acc"/>
        <path d="M154 84 Q178 68 206 88" class="d-acc"/>
        <ellipse cx="102" cy="108" rx="18" ry="9" class="d-fig"/>
        <ellipse cx="178" cy="108" rx="18" ry="9" class="d-fig"/>
        <line x1="140" y1="68" x2="140" y2="112" class="d-guide" stroke-dasharray="3 3"/>
        <circle cx="140" cy="86" r="4" class="d-dot pulse-dot"/>
      </g>`
    },
    'box-breath': {
      badge: 'Animated · 4·4·4·4 Rhythm',
      svg: `<g class="anim-box-breath">
        <rect x="86" y="46" width="108" height="108" rx="18" class="d-guide"/>
        <circle cx="140" cy="100" r="36" class="d-ring breath-pacer"/>
        <circle cx="140" cy="100" r="14" class="d-acc breath-core"/>
        <text x="140" y="34" text-anchor="middle" class="d-lbl">4s IN · 4s HOLD · 4s OUT</text>
      </g>`
    },
    'outfit-check': {
      badge: 'Interactive · 3 Fit Checkpoints',
      svg: `<g class="anim-fit">
        <path d="M108 48 L128 42 H152 L172 48 L194 94 L174 102 L164 78 V164 H144 V116 H136 V164 H116 V78 L106 102 L86 94 Z" class="d-fig"/>
        <circle cx="108" cy="48" r="5" class="d-dot pulse-dot"/>
        <circle cx="172" cy="48" r="5" class="d-dot pulse-dot"/>
        <line x1="84" y1="98" x2="108" y2="98" class="d-acc"/>
        <line x1="112" y1="164" x2="168" y2="164" class="d-acc"/>
      </g>`
    }
  };

  LM.demoSVG = function (demoId, paused) {
    const d = DEMOS[demoId] || DEMOS['box-breath'];
    const I = LM.I18n;
    const tr = (k, fb) => (I && I.content ? I.content(k, fb) : fb);
    let svg = d.svg;
    if (demoId === 'box-breath') {
      svg = svg.replace('4s IN · 4s HOLD · 4s OUT', LM.esc(tr('demo.boxCue', '4s IN · 4s HOLD · 4s OUT')));
    }
    const badge = tr('demo.' + demoId, d.badge);
    return '<div class="demo-stage' + (paused ? ' paused' : '') + '">' +
      '<svg class="demo-svg" viewBox="0 0 280 200" aria-hidden="true">' + svg + '</svg>' +
      '<span class="demo-tag">' + LM.esc(badge) + '</span>' +
    '</div>';
  };
})();
