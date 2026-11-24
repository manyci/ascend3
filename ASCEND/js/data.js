/* ASCEND — static content: categories, guides, task pool, achievements.
   Pure data, no logic. Edit/extend here; nothing else needs to change.
   Evidence scale: STRONG (RCTs / meta-analyses) · MODERATE · LIMITED · WEAK (unproven)
                   · PRACTICE (common professional practice, not formally studied) */
window.LM = window.LM || {};

LM.CATEGORIES = [
  { id: 'face',     label: 'FACE',     code: 'F' },
  { id: 'skin',     label: 'SKIN',     code: 'S' },
  { id: 'hair',     label: 'HAIR',     code: 'H' },
  { id: 'body',     label: 'BODY',     code: 'B' },
  { id: 'style',    label: 'STYLE',    code: 'Y' },
  { id: 'grooming', label: 'GROOMING', code: 'G' },
  { id: 'health',   label: 'HEALTH',   code: '+' }
];

LM.EVIDENCE = {
  STRONG:   { label: 'STRONG',   note: 'Supported by randomized trials or meta-analyses.' },
  MODERATE: { label: 'MODERATE', note: 'Some good studies, but results are mixed or indirect.' },
  LIMITED:  { label: 'LIMITED',  note: 'Small or low-quality studies. Treat results as uncertain.' },
  WEAK:     { label: 'WEAK',     note: 'Little to no reliable evidence. Popular online, not proven.' },
  PRACTICE: { label: 'PRACTICE', note: 'Standard professional practice (tailors, barbers, stylists). Not formally studied.' }
};

/* eff = effectiveness 1–5 (realistic expected impact if done properly) */
LM.GUIDES = [
/* ───────────── FACE ───────────── */
{
  id: 'face-jawline', cat: 'face', title: 'Jawline Workout', eff: 2, evidence: 'LIMITED',
  desc: 'Chewing and neck exercises for a sharper lower face.',
  improves: 'Masseter (chewing muscle) size and neck tone. A visible jawline depends mostly on bone structure and body fat.',
  mechanism: 'Resistance on the masseter can make it larger (hypertrophy), which widens the lower face. Neck exercises improve posture and the neck-to-jaw line. Exercise cannot burn fat from the face specifically.',
  steps: ['Chew sugar-free gum or firm food on both sides equally, 10–15 minutes.', 'Do chin tucks: pull the chin straight back, hold 5 s, 10 reps.', 'Do neck flexion/extension with light resistance (hand pressure), 2 sets of 10.', 'Keep teeth apart and lips together at rest.'],
  frequency: '3–4 times per week, 10–15 min',
  timeline: '6–12 weeks for subtle changes; many people see none',
  risks: 'Overworking the jaw can cause TMJ pain, headaches, tooth wear and uneven muscle growth. Stop if the jaw clicks or hurts. Avoid with existing TMJ disorders or bruxism. Very hard gum or "jaw trainer" devices carry higher risk.'
},
{
  id: 'face-puffiness', cat: 'face', title: 'Reduce Facial Puffiness', eff: 3, evidence: 'MODERATE',
  desc: 'Cut water retention and inflammation that blur facial definition.',
  improves: 'Facial definition, under-eye swelling, morning puffiness.',
  mechanism: 'High sodium intake, alcohol, poor sleep and allergies cause fluid retention and mild swelling in loose facial tissue. Reducing these triggers lowers swelling within days.',
  steps: ['Limit very salty food, especially late in the evening.', 'Keep alcohol low; it dehydrates and dilates blood vessels.', 'Sleep 7–9 hours with the head slightly elevated.', 'Use a cold compress for 5 minutes in the morning.', 'Treat allergies with a doctor or pharmacist if they are chronic.'],
  frequency: 'Daily habits; cold compress as needed',
  timeline: '2–7 days for water-related puffiness',
  risks: 'Persistent or one-sided swelling, swelling with pain, or sudden changes can indicate thyroid, kidney, dental or allergic problems. See a doctor. Do not cut sodium to extreme levels.'
},
{
  id: 'face-tongue', cat: 'face', title: 'Tongue Posture (Mewing)', eff: 1, evidence: 'WEAK',
  desc: 'Resting the tongue on the palate. Popular online, weakly supported.',
  improves: 'Awareness of nasal breathing and relaxed jaw posture. Claims of reshaping adult facial bones are NOT supported by reliable evidence.',
  mechanism: 'The idea is that constant gentle tongue pressure remodels the upper jaw. Orthodontic research suggests growing children can be influenced by habits and breathing, but there is no good evidence of meaningful bone change in adults.',
  steps: ['Rest the whole tongue (not just the tip) lightly against the roof of the mouth.', 'Keep lips closed, teeth lightly apart, breathe through the nose.', 'Do not press hard or clench.'],
  frequency: 'Passive habit through the day',
  timeline: 'No reliable timeline. Do not expect structural change as an adult.',
  risks: 'Pushing hard or clenching can cause jaw tension, headaches and TMJ pain. It is not a replacement for orthodontic or breathing assessment. Persistent mouth breathing deserves a doctor/ENT or orthodontist visit.'
},
{
  id: 'face-smile', cat: 'face', title: 'Smile & Dental Care', eff: 4, evidence: 'STRONG',
  desc: 'Clean, healthy teeth change how the whole face reads.',
  improves: 'Teeth colour, breath, gum health, confidence when smiling.',
  mechanism: 'Brushing and flossing remove plaque that causes stains, bad breath and gum disease. Whitening agents (peroxides) oxidize surface and deeper stains. Professional cleaning removes tartar you cannot.',
  steps: ['Brush 2 minutes, twice a day, with fluoride toothpaste.', 'Floss or use interdental brushes once a day.', 'Clean your tongue.', 'See a dentist for cleaning every 6–12 months.', 'If whitening, use dentist-approved products and follow the label.'],
  frequency: 'Twice daily brushing, daily flossing',
  timeline: 'Breath and gum health in 1–2 weeks; whitening in 1–4 weeks',
  risks: 'Over-whitening or abrasive "charcoal" products can damage enamel and cause sensitivity. Bleeding gums that persist, loose teeth or pain need a dentist. Avoid DIY braces or aligners.'
},
/* ───────────── SKIN ───────────── */
{
  id: 'skin-sunscreen', cat: 'skin', title: 'Daily Sunscreen', eff: 5, evidence: 'STRONG',
  desc: 'The single most effective anti-aging and skin-health habit.',
  improves: 'Prevents sun damage, uneven tone, dark spots, wrinkles and skin cancer risk.',
  mechanism: 'UV radiation breaks down collagen and triggers pigment production. Broad-spectrum SPF filters UVA/UVB before they damage skin cells.',
  steps: ['Use broad-spectrum SPF 30 or higher.', 'Apply about 2 finger-lengths for face and neck.', 'Apply 15 minutes before going outside.', 'Reapply every 2 hours in direct sun or after swimming/sweating.', 'Do not forget ears, neck and the back of the hands.'],
  frequency: 'Every morning, all year',
  timeline: 'Prevention is immediate; visible improvement in tone over 2–3 months',
  risks: 'Some people react to certain filters; try mineral (zinc/titanium) formulas if irritated. Sunscreen reduces but does not eliminate sun damage. Check moles regularly; see a dermatologist for changing spots.'
},
{
  id: 'skin-routine', cat: 'skin', title: 'Skincare Routine', eff: 4, evidence: 'STRONG',
  desc: 'Cleanser, moisturizer, sunscreen. Simple, clean, effective.',
  improves: 'Skin barrier, hydration, oiliness, overall texture.',
  mechanism: 'A gentle cleanser removes oil and dirt without stripping the barrier. A moisturizer holds water in the outer layer. Sunscreen prevents damage. More products do not mean better results.',
  steps: ['Morning: rinse or gentle cleanse, moisturizer, sunscreen.', 'Evening: gentle cleanse (double-cleanse only if you wear sunscreen/makeup), moisturizer.', 'Introduce only one new product at a time, wait 2 weeks.', 'Patch test new products on the inside of the arm.'],
  frequency: 'Morning and evening',
  timeline: '2–4 weeks for hydration and comfort; skin cycle is about 28+ days',
  risks: 'Over-washing, scrubs and many actives together damage the barrier (redness, stinging, flaking). Fragrance and essential oils are common irritants. Stop a product that burns or itches.'
},
{
  id: 'skin-retinoid', cat: 'skin', title: 'Retinoids', eff: 4, evidence: 'STRONG',
  desc: 'Vitamin A derivatives for acne, texture and early aging.',
  improves: 'Acne, clogged pores, rough texture, fine lines, uneven tone.',
  mechanism: 'Retinoids speed up skin cell turnover and normalize pore lining. Prescription tretinoin and OTC adapalene have the strongest evidence; retinol is weaker but gentler.',
  steps: ['Start with a pea-sized amount for the whole face, 2 evenings per week.', 'Apply on dry skin after cleansing; moisturize after.', 'Increase to every other night, then nightly if tolerated.', 'Use sunscreen every morning without exception.'],
  frequency: '2–7 evenings per week as tolerated',
  timeline: '8–12 weeks to see benefits; early purging and dryness are common',
  risks: 'Irritation, peeling, sun sensitivity. NOT for use during pregnancy or when trying to conceive (oral and topical retinoids). Do not combine with other strong actives at first. Prescription strengths need a dermatologist or doctor.'
},
{
  id: 'skin-acne', cat: 'skin', title: 'Acne Care Basics', eff: 4, evidence: 'STRONG',
  desc: 'Evidence-based steps for mild to moderate acne.',
  improves: 'Active breakouts and the risk of scarring and dark marks.',
  mechanism: 'Acne comes from clogged pores, excess oil, bacteria and inflammation. Benzoyl peroxide reduces bacteria, adapalene unclogs pores, salicylic acid exfoliates inside the pore.',
  steps: ['Wash gently once or twice a day; do not scrub.', 'Use adapalene 0.1% in the evening.', 'Use benzoyl peroxide 2.5–5% as a wash or spot treatment.', 'Never pick or squeeze; it causes scars and dark marks.', 'Use non-comedogenic moisturizer and sunscreen.'],
  frequency: 'Daily, consistently for at least 12 weeks',
  timeline: '6–12 weeks to see clear improvement',
  risks: 'Dryness and irritation; benzoyl peroxide bleaches fabric. See a dermatologist early for painful cysts, scarring, or no improvement after 3 months. Oral options (antibiotics, isotretinoin, hormonal) are prescription only and need medical supervision.'
},
/* ───────────── HAIR ───────────── */
{
  id: 'hair-care', cat: 'hair', title: 'Hair Care Basics', eff: 3, evidence: 'MODERATE',
  desc: 'Strong, healthy-looking hair starts with the basics.',
  improves: 'Shine, breakage, frizz, manageability.',
  mechanism: 'Hair is dead keratin: you cannot "repair" it, only reduce damage and protect it. Shampoo cleans the scalp, conditioner smooths the hair shaft, and heat and friction cause most damage.',
  steps: ['Shampoo the scalp (not the lengths) as often as needed, typically 2–4 times a week.', 'Condition the mid-lengths and ends.', 'Pat dry with a soft towel instead of rubbing.', 'Limit hot tools; use heat protectant when you do.', 'Trim every 6–10 weeks to remove split ends.'],
  frequency: 'Per wash cycle; trim every 6–10 weeks',
  timeline: '2–4 weeks for feel and shine; hair grows about 1 cm per month',
  risks: 'Over-bleaching, relaxers and constant heat cause lasting damage. Sudden hair thinning or patchy loss may have medical causes (thyroid, iron deficiency, stress). See a doctor.'
},
{
  id: 'hair-scalp', cat: 'hair', title: 'Scalp & Dandruff Care', eff: 4, evidence: 'STRONG',
  desc: 'A healthy scalp means less flaking, itching and oiliness.',
  improves: 'Dandruff, itching, flaking, oily scalp.',
  mechanism: 'Most dandruff is linked to a reaction to Malassezia yeast on the scalp. Antifungal agents such as ketoconazole, zinc pyrithione and selenium sulfide reduce it.',
  steps: ['Use an anti-dandruff shampoo 2–3 times a week.', 'Massage into the scalp and leave 3–5 minutes before rinsing.', 'Rotate shampoo if effectiveness drops.', 'Rinse thoroughly.', 'After control, reduce to once a week for maintenance.'],
  frequency: '2–3 times per week, then weekly maintenance',
  timeline: '2–4 weeks',
  risks: 'Can dry hair or irritate the scalp. Thick scales, red patches, pain or hair loss may be seborrheic dermatitis or psoriasis. See a dermatologist.'
},
{
  id: 'hair-loss', cat: 'hair', title: 'Hair Loss Basics', eff: 3, evidence: 'STRONG',
  desc: 'What actually works for pattern hair loss, and what does not.',
  improves: 'Slows pattern hair loss; can regrow some hair in early stages.',
  mechanism: 'Pattern hair loss is driven by genetics and DHT. Topical minoxidil prolongs the growth phase. Finasteride (prescription) lowers DHT. Both need continuous use. Most shampoos, oils and "hair vitamins" have little evidence unless you are deficient.',
  steps: ['See a doctor or dermatologist to confirm the cause first.', 'Ask about minoxidil and prescription options.', 'Check iron, vitamin D, thyroid if the loss is diffuse.', 'Take photos monthly in the same light.', 'Be consistent for at least 6–12 months before judging.'],
  frequency: 'Daily treatment as prescribed',
  timeline: '3–6 months to slow shedding; 6–12 months for regrowth',
  risks: 'Minoxidil: scalp irritation, initial shedding. Finasteride: possible sexual or mood side effects in a minority; not for women who are or may become pregnant (should not even handle crushed tablets). Never self-prescribe. Stopping treatment usually reverses the gains.'
},
{
  id: 'hair-style', cat: 'hair', title: 'Haircut & Style', eff: 4, evidence: 'PRACTICE',
  desc: 'A good cut for your hair type and face shape beats any product.',
  improves: 'Overall look, proportions, how well-groomed you appear.',
  mechanism: 'A cut works with your hair density, growth patterns and head shape. Balanced volume and clean edges frame the face. This is craft, not science.',
  steps: ['Bring 2–3 reference photos of people with similar hair type.', 'Tell the barber how much time you spend styling.', 'Ask what product they recommend for your hair.', 'Book a regular trim before it grows out of shape (3–5 weeks for short cuts).', 'Use a small amount of product; less is cleaner.'],
  frequency: 'Haircut every 3–6 weeks',
  timeline: 'Immediate',
  risks: 'Trends can look wrong on your hair type. Over-use of strong hold products and bleach can damage hair and scalp. Rules about "face shape" are guidelines, not laws.'
},
/* ───────────── BODY ───────────── */
{
  id: 'body-posture', cat: 'body', title: 'Posture Fix', eff: 3, evidence: 'LIMITED',
  desc: 'Better posture changes how tall and confident you look.',
  improves: 'Shoulder and neck position, perceived height, back and neck discomfort.',
  mechanism: 'Weak upper-back muscles and tight chest/hip flexors from sitting pull the shoulders forward and the head ahead of the body. Strengthening and mobility work can shift your resting position.',
  steps: ['Do wall angels, 2 sets of 10.', 'Do rows or band pull-aparts, 3 sets of 12.', 'Stretch chest in a doorway, 30 s each side.', 'Stretch hip flexors, 30 s each side.', 'Set a desk with the screen at eye level; stand and move every 30–45 min.'],
  frequency: '3–4 times per week plus daily movement breaks',
  timeline: '4–8 weeks',
  risks: 'Evidence for long-term "posture correction" is mixed; strength and movement habits matter more than a fixed pose. Avoid posture braces as a long-term fix. Numbness, radiating pain or severe back pain needs a doctor or physiotherapist.'
},
{
  id: 'body-strength', cat: 'body', title: 'Strength Training Basics', eff: 5, evidence: 'STRONG',
  desc: 'Build muscle and a stronger, more balanced physique.',
  improves: 'Muscle mass, shoulder-to-waist proportions, body composition, posture, energy.',
  mechanism: 'Progressive overload (gradually more weight or reps) signals muscle to grow, supported by enough protein and sleep. It also raises metabolic health and bone density.',
  steps: ['Train full body 3 times per week or upper/lower 4 times.', 'Base it on squat, hinge (deadlift/RDL), push, pull, carry.', 'Use a weight where the last 1–2 reps are hard but clean.', 'Add reps or weight gradually.', 'Learn form from a coach or reliable tutorials; record yourself.'],
  frequency: '3–4 sessions per week, 45–60 min',
  timeline: '4–8 weeks for noticeable strength; 3–6 months for visible muscle',
  risks: 'Injury risk rises with poor form and ego lifting. Warm up and build gradually. Check with a doctor if you have heart conditions, joint problems, or are returning from injury. Never use steroids or unregulated supplements.'
},
{
  id: 'body-fat', cat: 'body', title: 'Body Composition & Nutrition', eff: 4, evidence: 'STRONG',
  desc: 'Lose fat or build muscle with realistic nutrition basics.',
  improves: 'Body fat level, muscle retention, energy, facial leanness as a side effect of fat loss.',
  mechanism: 'Fat loss needs a modest calorie deficit; muscle gain needs a modest surplus. Higher protein (about 1.6–2.2 g/kg bodyweight for people who train) helps keep and build muscle. You cannot choose where fat leaves.',
  steps: ['Estimate maintenance calories with a reputable calculator.', 'For fat loss, eat 10–20% below maintenance. Aim for 0.25–0.75 kg loss per week.', 'Include protein at every meal.', 'Eat mostly whole foods; keep room for foods you enjoy.', 'Track weight weekly (average), waist and photos.'],
  frequency: 'Daily habit; review every 2–4 weeks',
  timeline: '4–8 weeks to see body changes',
  risks: 'Not suitable for people with a history of eating disorders, pregnancy, or medical conditions without medical advice. Aggressive crash diets lose muscle and harm health. If food or weight thoughts feel obsessive, talk to a professional.'
},
{
  id: 'body-walk', cat: 'body', title: 'Daily Walking', eff: 3, evidence: 'STRONG',
  desc: 'Simple, low-stress movement that quietly changes everything.',
  improves: 'General fitness, body fat, circulation, mood, sleep quality.',
  mechanism: 'Regular walking raises daily energy expenditure, improves cardiovascular and metabolic health, and reduces stress hormones. Daylight exposure helps regulate sleep.',
  steps: ['Aim for 7,000–10,000 steps a day, or 30 minutes of brisk walking.', 'Walk outside in daylight when possible.', 'Break up long sitting with 2–5 minute walks.', 'Increase gradually by about 1,000 steps a week.'],
  frequency: 'Daily',
  timeline: '2–4 weeks for energy and sleep; months for body changes',
  risks: 'Low risk. Wear proper footwear, build up slowly if sedentary, and consult a doctor if you have heart, joint or balance problems.'
},
/* ───────────── STYLE ───────────── */
{
  id: 'style-fit', cat: 'style', title: 'Fit First', eff: 5, evidence: 'PRACTICE',
  desc: 'Clothes that fit your body matter more than brand or price.',
  improves: 'Silhouette, proportions, overall polish.',
  mechanism: 'Shoulders, sleeve length, torso and trouser length define how clothing sits. A well-fitted cheap garment looks better than a poorly fitted expensive one.',
  steps: ['Shoulder seams should sit at the end of your shoulders.', 'Sleeves end at the wrist bone (shirts) or just above (jackets).', 'Trousers should skim the leg and break lightly at the shoe.', 'Take clothes to a tailor to hem trousers and take in waists.', 'Re-measure yourself every few months; bodies change.'],
  frequency: 'When buying and every wardrobe review',
  timeline: 'Immediate',
  risks: 'Tailoring cannot fix a wrong shoulder fit. Buying "to grow into" or too tight clothes both hurt the look and comfort. Sizes differ by brand; always try on.'
},
{
  id: 'style-palette', cat: 'style', title: 'Color & Capsule Wardrobe', eff: 4, evidence: 'PRACTICE',
  desc: 'A small set of clothes that all work together.',
  improves: 'Outfit consistency, ease of dressing, perceived taste.',
  mechanism: 'A limited palette of neutrals plus 1–2 accent colors means any top goes with any bottom. Fewer, better pieces reduce decision fatigue.',
  steps: ['Pick a base of neutrals (black, white, grey, navy, beige).', 'Add 1–2 accent colors that suit your skin tone.', 'Build around ~10 tops, 3–4 bottoms, 2 jackets, 2–3 pairs of shoes.', 'Remove what you have not worn in a year.', 'Add pieces one at a time and check they match at least 3 other items.'],
  frequency: 'Wardrobe review every season',
  timeline: 'Immediate',
  risks: 'Over-minimalism can feel boring; add texture and one statement piece. Fast-fashion hauls and impulse buys defeat the purpose and your budget.'
},
{
  id: 'style-proportions', cat: 'style', title: 'Dress for Your Proportions', eff: 3, evidence: 'PRACTICE',
  desc: 'Use cuts and layers to balance your frame.',
  improves: 'Visual balance of shoulders, waist, legs and height.',
  mechanism: 'Clothing creates lines and volume. Vertical lines and tonal outfits elongate; structured shoulders broaden the frame; tapered legs balance a larger upper body.',
  steps: ['Identify your goal: add shoulder width, add height, or balance volume.', 'Tonal outfits (similar colors) elongate the body.', 'Choose structured shoulders if narrow; avoid oversized tops if short.', 'Tuck or half-tuck to define the waist.', 'Photograph outfits and judge the proportions objectively.'],
  frequency: 'When planning outfits',
  timeline: 'Immediate',
  risks: 'These are guidelines, not rules. Comfort and confidence matter more than rigid formulas. Avoid clothing that restricts breathing or movement.'
},
{
  id: 'style-care', cat: 'style', title: 'Clothing & Shoe Care', eff: 3, evidence: 'PRACTICE',
  desc: 'Clean, pressed, well-kept clothes read as well-groomed.',
  improves: 'How clean, crisp and expensive your clothes look.',
  mechanism: 'Wrinkles, pilling, stains and worn-out shoes make any outfit look careless. Washing correctly and repairing small issues extends the life of garments.',
  steps: ['Read care labels; wash dark clothes inside out in cold water.', 'Use a fabric shaver for pilling.', 'Steam or iron shirts before wearing.', 'Clean white sneakers and polish leather shoes regularly.', 'Replace worn heels and stretched collars.'],
  frequency: 'Weekly laundry; shoe care every 2 weeks',
  timeline: 'Immediate',
  risks: 'Over-washing and high heat shorten garment life. Test cleaning products on a hidden spot first.'
},
/* ───────────── GROOMING ───────────── */
{
  id: 'groom-beard', cat: 'grooming', title: 'Beard & Shaving', eff: 4, evidence: 'PRACTICE',
  desc: 'Clean lines and good technique for facial hair.',
  improves: 'Face frame, jaw definition, skin irritation from shaving.',
  mechanism: 'Facial hair shape changes the apparent face outline. Proper shaving reduces ingrown hairs and razor bumps.',
  steps: ['Wash face with warm water before shaving to soften hair.', 'Use a sharp razor, shave with the grain, light pressure.', 'Rinse with cool water and apply fragrance-free moisturizer.', 'Beard: keep neckline about two fingers above the Adam\'s apple, trim cheek lines cleanly.', 'Wash and condition beard 2–3 times per week.'],
  frequency: 'Shave or trim every 1–3 days',
  timeline: 'Immediate; beard growth takes 4–12 weeks to judge',
  risks: 'Razor bumps, folliculitis and ingrown hairs, especially with curly hair. Replace blades often. Persistent painful bumps need a dermatologist. Patchy growth is genetic; it can\'t be forced.'
},
{
  id: 'groom-brows', cat: 'grooming', title: 'Eyebrow & Hair Cleanup', eff: 3, evidence: 'PRACTICE',
  desc: 'Light cleanup around brows, nose and ears.',
  improves: 'Eye area definition, cleaner, more groomed face.',
  mechanism: 'Stray hairs between brows or growing from nose and ears draw attention. Removing them neatly keeps natural shape.',
  steps: ['Brush brows upward and trim only hairs longer than the line.', 'Tweeze strays below the brow and between the brows only.', 'Do not change the natural shape or thin the brow heavily.', 'Trim nose and ear hair with a rounded trimmer; never pluck inside the nose.', 'Clean tools with alcohol.'],
  frequency: 'Every 1–2 weeks',
  timeline: 'Immediate',
  risks: 'Over-plucking can cause permanent thin patches. Plucking nose hair can lead to infection. Use clean tools and stop if skin becomes red or inflamed.'
},
{
  id: 'groom-scent', cat: 'grooming', title: 'Fragrance Basics', eff: 3, evidence: 'PRACTICE',
  desc: 'Smell clean first, fragrance second.',
  improves: 'Overall impression and how others perceive you up close.',
  mechanism: 'Scent is closely linked to memory and impression. Good hygiene is the base; fragrance adds on top and should never mask poor hygiene.',
  steps: ['Shower daily, use deodorant or antiperspirant, wash clothes often.', 'Apply 1–3 sprays to pulse points (neck, chest), not clothes you cannot wash.', 'Choose a scent you like, test on skin for several hours.', 'Match intensity to setting: lighter for office and warm weather.', 'Store away from heat and sunlight.'],
  frequency: 'Daily as desired',
  timeline: 'Immediate',
  risks: 'Over-application bothers others and can cause headaches. Fragrance can cause skin allergies or asthma triggers; stop use if irritation occurs. Avoid use on broken skin.'
},
{
  id: 'groom-hands', cat: 'grooming', title: 'Nails, Hands & Lips', eff: 2, evidence: 'MODERATE',
  desc: 'Small details that signal care.',
  improves: 'Nail cleanliness, hand skin, chapped lips.',
  mechanism: 'Short, clean nails and moisturized hands and lips look cared for. Lip balm and hand cream protect the skin barrier in dry or cold weather.',
  steps: ['Trim nails straight across, file rough edges, clean under nails.', 'Do not bite nails or pick cuticles.', 'Apply hand cream after washing hands.', 'Use lip balm with SPF in the day.', 'Drink enough water and avoid licking the lips.'],
  frequency: 'Nails weekly; creams daily',
  timeline: '1–2 weeks',
  risks: 'Persistent nail changes (color, ridges, pain) can signal infection or illness. Cutting cuticles can cause infections; push back gently instead.'
},
/* ───────────── HEALTH ───────────── */
{
  id: 'health-sleep', cat: 'health', title: 'Sleep Hygiene', eff: 5, evidence: 'STRONG',
  desc: 'Sleep is the foundation of skin, mood, weight and energy.',
  improves: 'Skin appearance, under-eye circles, energy, recovery, appetite control.',
  mechanism: 'During sleep the body repairs tissue, regulates hormones and consolidates memory. Short sleep raises stress hormones, hunger and inflammation, and makes skin look dull.',
  steps: ['Go to bed and wake up at the same time daily.', 'Aim for 7–9 hours.', 'Dim lights and reduce screens 60 minutes before bed.', 'Keep the room cool, dark and quiet.', 'Avoid caffeine after midday and heavy meals or alcohol close to bedtime.'],
  frequency: 'Every night',
  timeline: '1–3 weeks to notice improvement',
  risks: 'Ongoing insomnia, loud snoring, or daytime sleepiness may point to a sleep disorder such as sleep apnea. See a doctor. Do not self-medicate with sleeping pills.'
},
{
  id: 'health-hydration', cat: 'health', title: 'Hydration & Diet Quality', eff: 3, evidence: 'MODERATE',
  desc: 'Drink enough, eat real food, and avoid extremes.',
  improves: 'Energy, digestion, general health; modest effect on skin.',
  mechanism: 'Mild dehydration affects mood, concentration and how skin feels. Evidence that extra water clears skin is weak; a diet rich in fruit, vegetables and protein supports overall health.',
  steps: ['Drink when thirsty and aim for pale yellow urine; about 2 L a day is a rough guide.', 'Eat vegetables or fruit with most meals.', 'Reduce sugary drinks and ultra-processed snacks.', 'Include protein and healthy fats.', 'Limit alcohol.'],
  frequency: 'Daily',
  timeline: '2–4 weeks for energy and digestion',
  risks: 'Drinking excessive water can be harmful. People with kidney or heart conditions need medical advice about fluids. Avoid extreme or elimination diets without professional guidance.'
},
{
  id: 'health-smoke', cat: 'health', title: 'Quit Smoking, Cut Alcohol', eff: 5, evidence: 'STRONG',
  desc: 'The two biggest avoidable things that age skin and health.',
  improves: 'Skin tone and elasticity, teeth, breath, lung and heart health.',
  mechanism: 'Smoking narrows blood vessels, reduces oxygen to skin and breaks down collagen. Alcohol dehydrates, disrupts sleep, causes inflammation and facial flushing.',
  steps: ['Set a quit date and tell someone.', 'Ask a doctor about nicotine replacement or approved medication.', 'Keep alcohol to low or no consumption; have alcohol-free days.', 'Replace the habit with a walk or other routine.', 'Track money saved.'],
  frequency: 'Daily commitment',
  timeline: 'Skin and breath improve within weeks; larger benefits over months and years',
  risks: 'Heavy alcohol dependence should not be stopped suddenly without medical help, as withdrawal can be dangerous. Seek support from a doctor or local helpline.'
},
{
  id: 'health-mind', cat: 'health', title: 'Healthy Mindset', eff: 4, evidence: 'MODERATE',
  desc: 'Self-improvement should help you, not consume you.',
  improves: 'Self-image, stress levels, motivation that lasts.',
  mechanism: 'Constant comparison and checking in mirrors or online can increase anxiety. Improving habits works best when tied to health and wellbeing rather than perfection. Stress management supports sleep, skin and mood.',
  steps: ['Focus on habits you control, not on comparing yourself to others.', 'Limit time spent in "looksmaxxing" communities and edited photos.', 'Take progress photos at set intervals, not every day.', 'Practise stress relief: walking, breathing exercises, time with friends.', 'Talk to someone you trust if the mirror or your appearance bothers you a lot.'],
  frequency: 'Daily check-in, weekly review',
  timeline: 'Gradual over weeks and months',
  risks: 'If thoughts about your appearance take hours a day, cause distress, or lead you to avoid people or take drastic action, this may be body dysmorphic disorder or anxiety/depression. Contact a doctor or mental health professional. Do not use extreme methods, unregulated drugs or risky procedures.'
}
];

/* Habit task pool. type: habit. guide: optional related guide id (for the label only). */
LM.TASK_POOL = [
  { id: 't-water',    title: 'Drink 2L of water',             cat: 'health',   xp: 15 },
  { id: 't-pushups',  title: 'Do 20 push-ups',                cat: 'body',     xp: 20 },
  { id: 't-spf',      title: 'Apply sunscreen (SPF 30+)',     cat: 'skin',     xp: 20 },
  { id: 't-am',       title: 'Morning skincare routine',      cat: 'skin',     xp: 20 },
  { id: 't-pm',       title: 'Evening skincare routine',      cat: 'skin',     xp: 20 },
  { id: 't-posture',  title: 'Posture work: 5 min wall angels', cat: 'body',   xp: 15 },
  { id: 't-walk',     title: 'Walk 30 minutes',               cat: 'body',     xp: 20 },
  { id: 't-sleep',    title: 'Sleep 7+ hours last night',     cat: 'health',   xp: 25 },
  { id: 't-floss',    title: 'Floss and brush twice',         cat: 'face',     xp: 15 },
  { id: 't-stretch',  title: 'Stretch for 10 minutes',        cat: 'body',     xp: 15 },
  { id: 't-outfit',   title: 'Plan tomorrow\'s outfit',        cat: 'style',    xp: 10 },
  { id: 't-sugar',    title: 'No sugary drinks today',        cat: 'health',   xp: 15 },
  { id: 't-scalp',    title: 'Scalp massage, 3 minutes',      cat: 'hair',     xp: 10 },
  { id: 't-protein',  title: 'Protein with every meal',       cat: 'body',     xp: 20 },
  { id: 't-veg',      title: 'Eat 2 servings of vegetables',  cat: 'health',   xp: 15 },
  { id: 't-strength', title: '20-minute strength workout',    cat: 'body',     xp: 25 },
  { id: 't-nails',    title: 'Check nails and hands',         cat: 'grooming', xp: 10 },
  { id: 't-screen',   title: 'No screens 30 min before bed',  cat: 'health',   xp: 15 }
];

/* XP table — single place to tune rewards. */
LM.XP = {
  guideStudy: 0,         // no XP for reading / marking a guide as studied (status only)
  guideTask: 0,          // today's guide task: counts for the plan, no XP (practice tasks replace it in Stages 6-7)
  perfectDay: 25,        // all daily tasks done
  photo: 15              // progress photo check-in (once per day)
};

/* Achievements. Each: id, name, desc, icon, test(stats) -> bool, prog(stats) -> [cur, goal].
   stats: { xp, level, streakBest, tasks, guides, perfect, photos, favorites, cats } */
LM.ACHIEVEMENTS = [
  { id: 'a-first',   name: 'FIRST MOVE',     desc: 'Complete your first task.',               icon: 'bolt',   goal: 1,   key: 'tasks' },
  { id: 'a-xp100',   name: '100 CLUB',       desc: 'Earn 100 XP.',                            icon: 'star',   goal: 100, key: 'xp' },
  { id: 'a-xp1000',  name: 'GRINDER',        desc: 'Earn 1,000 XP.',                          icon: 'star',   goal: 1000, key: 'xp' },
  { id: 'a-s3',      name: 'THREE IN A ROW', desc: 'Reach a 3-day streak.',                   icon: 'flame',  goal: 3,   key: 'streakBest' },
  { id: 'a-s7',      name: 'WEEK ONE',       desc: 'Reach a 7-day streak.',                   icon: 'crown',  goal: 7,   key: 'streakBest' },
  { id: 'a-s30',     name: 'IRON HABIT',     desc: 'Reach a 30-day streak.',                  icon: 'trophy', goal: 30,  key: 'streakBest' },
  { id: 'a-g1',      name: 'STUDENT',        desc: 'Study your first guide.',                 icon: 'book',   goal: 1,   key: 'guides' },
  { id: 'a-g10',     name: 'SCHOLAR',        desc: 'Study 10 guides.',                        icon: 'book',   goal: 10,  key: 'guides' },
  { id: 'a-t30',     name: 'WORKHORSE',      desc: 'Complete 30 tasks.',                      icon: 'dumbbell', goal: 30, key: 'tasks' },
  { id: 'a-t100',    name: 'RELENTLESS',     desc: 'Complete 100 tasks.',                     icon: 'dumbbell', goal: 100, key: 'tasks' },
  { id: 'a-perfect', name: 'PERFECT DAY',    desc: 'Complete every task in a single day.',    icon: 'check',  goal: 1,   key: 'perfect' },
  { id: 'a-l5',      name: 'LEVEL 5',        desc: 'Reach level 5.',                          icon: 'crown',  goal: 5,   key: 'level' },
  { id: 'a-l10',     name: 'LEVEL 10',       desc: 'Reach level 10.',                         icon: 'trophy', goal: 10,  key: 'level' },
  { id: 'a-photo',   name: 'DOCUMENTED',     desc: 'Add your first progress photo.',          icon: 'camera', goal: 1,   key: 'photos' },
  { id: 'a-fav5',    name: 'CURATOR',        desc: 'Save 5 guides to favorites.',             icon: 'star',   goal: 5,   key: 'favorites' },
  { id: 'a-cats',    name: 'ALL ROUNDER',    desc: 'Study a guide in every category.',        icon: 'grid',   goal: 7,   key: 'cats' }
];
