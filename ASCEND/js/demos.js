/* ASCEND — 2D Stylized Anatomical & Domain SVG Demonstration Engine.
   High-craft multi-layer vector models:
   - Reference prototype (refined): `face-jawline` (craniofacial & cervical alignment)
   - Pilot 1: `body-posture` (musculoskeletal spine, scapulae, doorway & hip-flexor mechanics)
   - Pilot 2: `face-smile` (maxillary/mandibular dental arches, 45° Bass sweep & tongue/floss care)
   - Pilot 3: `skin-sunscreen` (two-finger dosage, facial UV map & neck/ears/hands coverage)
   - Stage C / Batch 1 (16 rigs across 5 guides):
     · `body-strength` (squat, hip hinge, 45° push-up/plank, scapular pull)
     · `face-puffiness` (cool compress, under-eye-to-neck sweep, daily triggers/elevation)
     · `groom-beard` (warm water soften, grain & 2-finger neckline, cool soothe)
     · `groom-brows` (upward spoolie assess, conservative cleanup + rounded trimmer, tool sanitize)
     · `skin-routine` (60s gentle cleanse, damp pat & moisturize, AM SPF / PM barrier + 1-product rule)
   Remaining 19 guides fall back cleanly to LM.demoSVG until subsequent batches. */
window.LM = window.LM || {};

(function () {
  const tr = (k, fb) => (LM.I18n && LM.I18n.content ? LM.I18n.content(k, fb) : LM.t ? LM.t(k, fb) : fb);
  const E = s => (LM.esc ? LM.esc(s) : String(s == null ? '' : s));

  /* Reusable smooth craniofacial profile paths for face-jawline rigs */
  const PROF_HEAD_PATH = 'M140 144 C126 126 118 102 122 76 C127 46 154 32 184 36 C206 39 221 53 224 72 C226 80 230 88 236 96 C238 99 236 102 231 104 L225 106 C227 110 227 113 224 115 C226 118 225 121 222 123 C224 126 224 134 220 140 C215 147 205 150 192 149 L172 148';
  const PROF_GHOST_HEAD = 'M140 144 C126 126 118 102 122 76 C127 46 154 32 184 36 C206 39 221 53 224 72 C226 80 230 88 236 96 C238 99 236 102 231 104 L225 106 C227 110 227 113 224 115 C226 118 225 121 222 123 C224 126 224 134 220 140 C215 147 205 150 192 149 L172 148';
  const FRONT_HEAD_PATH = 'M180 34 C146 34 130 58 130 92 C130 115 136 134 148 150 C160 165 170 171 180 171 C190 171 200 165 212 150 C224 134 230 115 230 92 C230 58 214 34 180 34 Z';

  const REGS = {
    /* ══════════════════════════════════════════════════════════════════
       REFERENCE PROTOTYPE (REFINED): face-jawline
       ══════════════════════════════════════════════════════════════════ */
    'jaw-chin-tuck': {
      zoneKey: 'demo.zone.cervical',
      zoneFallback: 'Submental & deep neck alignment',
      views: ['profile', 'front'],
      phases: ['start', 'retract', 'hold'],
      render(view) {
        if (view === 'front') {
          return `
            <defs>
              <radialGradient id="jtZoneFront" cx="50%" cy="62%" r="44%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.42"/>
                <stop offset="65%" stop-color="var(--accent)" stop-opacity="0.12"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="jtSkinFront" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
                <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
              </linearGradient>
            </defs>
            <!-- Shoulders, trapezius & clavicular notch (static anchor) -->
            <path d="M62 258 C74 214 112 198 148 192 L154 166 H206 L212 192 C248 198 286 214 298 258" fill="url(#jtSkinFront)" class="rig-body"/>
            <path d="M118 212 Q152 218 176 205 Q180 203 184 205 Q208 218 242 212" class="rig-detail"/>
            <!-- Posture midline & eye horizon -->
            <line x1="180" y1="14" x2="180" y2="256" class="rig-axis"/>
            <line x1="86" y1="98" x2="274" y2="98" class="rig-guide-dash"/>
            <!-- Active submental & deep cervical zone -->
            <ellipse cx="180" cy="178" rx="34" ry="26" fill="url(#jtZoneFront)" class="rig-zone-pulse"/>
            <path d="M156 164 Q180 184 204 164" class="rig-zone-stroke"/>
            <!-- Animated head symmetry & vertical axial elongation -->
            <g class="rig-front-lift">
              <path d="M156 154 Q161 176 170 198 M204 154 Q199 176 190 198" class="rig-detail"/>
              <path d="M130 98 C120 98 119 124 130 128" class="rig-line"/>
              <path d="M230 98 C240 98 241 124 230 128" class="rig-line"/>
              <path d="${FRONT_HEAD_PATH}" fill="url(#jtSkinFront)" class="rig-head"/>
              <!-- Zygomatic shading lines & mandibular rim -->
              <path d="M140 112 Q146 124 152 132 M220 112 Q214 124 208 132" class="rig-subtle"/>
              <path d="M137 122 Q151 153 180 167 Q209 153 223 122" class="rig-jaw"/>
              <!-- Facial landmarks -->
              <path d="M148 87 Q160 82 171 86 M189 86 Q200 82 212 87" class="rig-detail"/>
              <line x1="152" y1="98" x2="167" y2="98" class="rig-landmark"/>
              <line x1="193" y1="98" x2="208" y2="98" class="rig-landmark"/>
              <path d="M180 92 V119 Q175 124 180 125 Q185 124 180 119" class="rig-detail"/>
              <path d="M167 139 Q180 142 193 139" class="rig-detail"/>
              <path d="M180 26 V12 M175 19 L180 11 L185 19" class="rig-arrow"/>
            </g>
            <circle cx="100" cy="98" r="3" class="rig-dot"/>
            <circle cx="260" cy="98" r="3" class="rig-dot"/>
          `;
        }

        // Default: Profile view
        return `
          <defs>
            <radialGradient id="jtZoneProf" cx="46%" cy="54%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.46"/>
              <stop offset="68%" stop-color="var(--accent)" stop-opacity="0.12"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="jtSkinProf" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <!-- Plumb axis (ear-to-shoulder alignment) & level gaze line -->
          <line x1="160" y1="18" x2="160" y2="256" class="rig-axis"/>
          <line x1="108" y1="92" x2="296" y2="92" class="rig-guide-dash"/>
          <!-- Shoulders & upper thorax anchor -->
          <path d="M90 258 C98 220 116 200 144 194 L152 170 H192 C206 200 218 222 222 258" fill="url(#jtSkinProf)" class="rig-body"/>
          <path d="M128 222 Q164 233 200 218" class="rig-detail"/>
          <!-- Ghost forward-head starting pose -->
          <g transform="translate(20, 4)" class="rig-ghost">
            <path d="${PROF_GHOST_HEAD}"/>
          </g>
          <!-- Animated head + cervical alignment rig -->
          <g class="rig-chin-head">
            <ellipse cx="186" cy="160" rx="34" ry="26" fill="url(#jtZoneProf)" class="rig-zone-pulse"/>
            <!-- Seamless neck volume + SCM anatomical contour + cervical column hint -->
            <path d="M142 198 C143 170 142 152 138 140 L190 146 L186 198 Z" fill="url(#jtSkinProf)"/>
            <path d="M142 196 C143 170 142 152 138 140 M186 196 C187 174 188 158 189 148" class="rig-neck-line"/>
            <!-- Subtle cervical vertebrae segments showing neutral stack -->
            <path d="M156 144 L155 154 M155 159 L155 169 M155 174 L156 184" class="rig-subtle" stroke-width="3.2"/>
            <!-- Sternocleidomastoid diagonal fiber -->
            <path d="M161 118 L178 194" class="rig-detail"/>
            <!-- Cranial & facial profile silhouette -->
            <path d="${PROF_HEAD_PATH}" fill="url(#jtSkinProf)" class="rig-head"/>
            <!-- Mandible / gonial angle & submental line -->
            <path d="M165 117 L167 137 Q169 147 184 148 L215 147" class="rig-jaw"/>
            <!-- Ear tragus landmark + orbital rim + closed lips -->
            <path d="M159 94 C152 94 151 114 159 116 C163 116 165 111 164 103" class="rig-detail"/>
            <path d="M204 80 Q214 78 220 82" class="rig-detail"/>
            <path d="M206 92 H218" class="rig-landmark"/>
            <path d="M214 114 H223" class="rig-detail"/>
            <!-- Deep neck & submental engagement stroke -->
            <path d="M174 149 Q193 153 207 148 M183 150 C184 166 185 180 186 192" class="rig-zone-stroke"/>
            <!-- Crown alignment indicator dot -->
            <circle cx="160" cy="36" r="3.2" class="rig-dot"/>
          </g>
          <!-- Horizontal retraction arrows -->
          <path d="M270 92 H242 M249 87 L240 92 L249 97" class="rig-arrow"/>
          <path d="M254 146 H226 M233 141 L224 146 L233 151" class="rig-arrow"/>
        `;
      }
    },

    'jaw-neck-flex': {
      zoneKey: 'demo.zone.anteriorNeck',
      zoneFallback: 'Anterior neck flexors',
      views: ['profile', 'front'],
      phases: ['neutral', 'press', 'return'],
      render(view) {
        if (view === 'front') {
          return `
            <defs>
              <radialGradient id="nfZoneFront" cx="50%" cy="55%" r="44%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.44"/>
                <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.12"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="nfSkinFront" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
                <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
              </linearGradient>
            </defs>
            <path d="M62 258 C74 214 112 198 148 192 L154 166 H206 L212 192 C248 198 286 214 298 258" fill="url(#nfSkinFront)" class="rig-body"/>
            <path d="M118 212 Q152 218 176 205 Q180 203 184 205 Q208 218 242 212" class="rig-detail"/>
            <line x1="180" y1="14" x2="180" y2="256" class="rig-axis"/>
            <ellipse cx="180" cy="182" rx="30" ry="26" fill="url(#nfZoneFront)" class="rig-zone-pulse"/>
            <path d="M161 160 Q165 178 170 198 M199 160 Q195 178 190 198" class="rig-zone-stroke"/>
            <g class="rig-front-nod">
              <path d="M130 98 C120 98 119 124 130 128 M230 98 C240 98 241 124 230 128" class="rig-line"/>
              <path d="${FRONT_HEAD_PATH}" fill="url(#nfSkinFront)" class="rig-head"/>
              <path d="M137 122 Q151 153 180 167 Q209 153 223 122" class="rig-jaw"/>
              <path d="M148 87 Q160 83 171 87 M189 87 Q200 83 212 87" class="rig-detail"/>
              <line x1="152" y1="99" x2="167" y2="99" class="rig-landmark"/>
              <line x1="193" y1="99" x2="208" y2="99" class="rig-landmark"/>
              <path d="M167 139 Q180 142 193 139" class="rig-detail"/>
              <circle cx="174" cy="64" r="5" class="rig-finger"/>
              <circle cx="186" cy="64" r="5" class="rig-finger"/>
              <circle cx="180" cy="64" r="15" class="rig-touch-ring"/>
            </g>
            <path d="M250 76 V114 M245 106 L250 115 L255 106" class="rig-arrow"/>
          `;
        }

        return `
          <defs>
            <radialGradient id="nfZoneProf" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.46"/>
              <stop offset="68%" stop-color="var(--accent)" stop-opacity="0.12"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="nfSkinProf" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <line x1="160" y1="18" x2="160" y2="256" class="rig-axis"/>
          <path d="M90 258 C98 220 116 200 144 194 L152 170 H192 C206 200 218 222 222 258" fill="url(#nfSkinProf)" class="rig-body"/>
          <ellipse cx="184" cy="172" rx="28" ry="26" fill="url(#nfZoneProf)" class="rig-zone-pulse"/>
          <g class="rig-ghost">
            <path d="${PROF_GHOST_HEAD}"/>
          </g>
          <g class="rig-neck-nod">
            <path d="M142 198 C143 170 142 152 138 140 L190 146 L186 198 Z" fill="url(#nfSkinProf)"/>
            <path d="M142 196 C143 170 142 152 138 140 M186 196 C187 174 188 158 189 148" class="rig-neck-line"/>
            <path d="${PROF_HEAD_PATH}" fill="url(#nfSkinProf)" class="rig-head"/>
            <path d="M165 117 L167 137 Q169 147 184 148 L215 147" class="rig-jaw"/>
            <path d="M159 94 C152 94 151 114 159 116" class="rig-detail"/>
            <path d="M206 91 H218" class="rig-landmark"/>
            <path d="M182 149 C184 166 185 181 186 194" class="rig-zone-stroke"/>
            <!-- Two-finger light resistance contact at forehead -->
            <g class="rig-hand-cue">
              <path d="M262 60 L224 66 L220 74 L262 72" class="rig-hand"/>
              <circle cx="222" cy="70" r="11" class="rig-touch-ring"/>
              <circle cx="222" cy="70" r="4" class="rig-finger"/>
            </g>
          </g>
          <path d="M246 98 C256 114 254 132 243 144 M242 135 L242 145 L252 143" class="rig-arrow"/>
          <circle cx="162" cy="182" r="3.5" class="rig-dot"/>
        `;
      }
    },

    'jaw-relax': {
      zoneKey: 'demo.zone.jawRest',
      zoneFallback: 'Relaxed jaw & nasal breath',
      views: ['profile'],
      phases: ['rest', 'gap', 'nasal'],
      render() {
        return `
          <defs>
            <radialGradient id="jrZone" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="jrSkin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <line x1="160" y1="18" x2="160" y2="256" class="rig-axis"/>
          <path d="M90 258 C98 220 116 200 144 194 L152 170 H192 C206 200 218 222 222 258" fill="url(#jrSkin)" class="rig-body"/>
          <path d="M142 198 C143 170 142 152 138 140 L190 146 L186 198 Z" fill="url(#jrSkin)"/>
          <path d="M142 196 C143 170 142 152 138 140 M186 196 C187 174 188 158 189 148" class="rig-neck-line"/>
          <path d="${PROF_HEAD_PATH}" fill="url(#jrSkin)" class="rig-head"/>
          <ellipse cx="186" cy="126" rx="22" ry="20" fill="url(#jrZone)" class="rig-relax-aura"/>
          <path d="M165 117 L167 137 Q169 147 184 148 L215 147" class="rig-jaw"/>
          <path d="M159 94 C152 94 151 114 159 116" class="rig-detail"/>
          <path d="M206 93 Q212 95 217 93" class="rig-detail"/>
          <!-- Lips sealed softly -->
          <path d="M214 114 Q220 115 224 114" class="rig-landmark"/>
          <!-- Slight 2mm teeth gap cue inside mouth -->
          <g class="rig-teeth-gap">
            <rect x="198" y="108" width="12" height="4" rx="1.5" class="rig-tooth"/>
            <rect x="198" y="118" width="12" height="4" rx="1.5" class="rig-tooth"/>
            <line x1="204" y1="113" x2="204" y2="117" class="rig-gap-mark"/>
          </g>
          <!-- Smooth nasal breath curve -->
          <path d="M278 100 H237 Q214 100 206 112 Q196 128 190 156 V196" class="rig-airflow"/>
          <path d="M264 95 L254 100 L264 105" class="rig-arrow"/>
          <circle cx="190" cy="204" r="14" class="rig-breath-ring"/>
        `;
      }
    },

    /* ══════════════════════════════════════════════════════════════════
       PILOT 1: body-posture (Musculoskeletal Posture & Mobility)
       ══════════════════════════════════════════════════════════════════ */
    'posture-wall-angels': {
      zoneKey: 'demo.zone.wallAngels',
      zoneFallback: 'Scapulae & thoracic wall line',
      views: ['front', 'profile'],
      phases: ['wall', 'w-pose', 'y-glide'],
      render(view) {
        if (view === 'profile') {
          return `
            <defs>
              <linearGradient id="waSkinP" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
                <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
              </linearGradient>
            </defs>
            <!-- Architectural Wall Line -->
            <rect x="108" y="18" width="10" height="236" rx="3" class="rig-prop"/>
            <line x1="84" y1="254" x2="276" y2="254" class="rig-axis"/>
            <!-- Head, Thorax, Pelvis & Legs pressed cleanly against wall -->
            <circle cx="136" cy="52" r="17" fill="url(#waSkinP)" class="rig-head"/>
            <path d="M132 69 L128 124 C126 144 132 162 136 178 L138 252 M148 178 L158 252" class="rig-body"/>
            <path d="M126 78 C144 78 156 96 154 128 C152 152 146 168 144 180" class="rig-detail"/>
            <!-- 4 Wall Contact Points (Head, Upper Back, Glutes, Heels) -->
            <circle cx="118" cy="52" r="4.5" class="rig-dot rig-zone-pulse"/>
            <circle cx="118" cy="96" r="4.5" class="rig-dot rig-zone-pulse"/>
            <circle cx="118" cy="172" r="4.5" class="rig-dot rig-zone-pulse"/>
            <circle cx="118" cy="249" r="4.5" class="rig-dot rig-zone-pulse"/>
            <!-- Sliding wall-angel arm in profile -->
            <g class="rig-wa-prof-arm">
              <path d="M140 94 L126 84 L124 44" class="rig-zone-stroke"/>
              <circle cx="124" cy="44" r="4" class="rig-finger"/>
            </g>
            <path d="M178 96 V46 M173 53 L178 44 L183 53" class="rig-arrow"/>
          `;
        }

        // Default: Front Y <-> W Glide
        return `
          <defs>
            <radialGradient id="waZoneF" cx="50%" cy="46%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.38"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="waSkinF" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <!-- Subtle wall backdrop grid -->
          <rect x="82" y="18" width="196" height="236" rx="14" class="rig-prop-frame"/>
          <line x1="180" y1="22" x2="180" y2="250" class="rig-axis"/>
          <!-- Active thoracic / scapular zone glow -->
          <ellipse cx="180" cy="112" rx="44" ry="30" fill="url(#waZoneF)" class="rig-zone-pulse"/>
          <!-- Ghost W start pose & Y top pose guides -->
          <path d="M142 96 L106 118 L100 84 M218 96 L254 118 L260 84" class="rig-ghost"/>
          <path d="M142 96 L112 64 L98 38 M218 96 L248 64 L262 38" class="rig-ghost"/>
          <!-- Sculpted torso + head silhouette -->
          <circle cx="180" cy="52" r="18" fill="url(#waSkinF)" class="rig-head"/>
          <path d="M150 92 L210 92 L202 168 H158 Z" fill="url(#waSkinF)" class="rig-body"/>
          <path d="M162 168 L158 248 M198 168 L202 248" class="rig-body"/>
          <!-- Scapula wing hints inside upper back -->
          <path d="M158 102 L172 114 L164 134 Z M202 102 L188 114 L196 134 Z" class="rig-detail"/>
          <!-- Articulated bilateral arms gliding smoothly between W and Y -->
          <g class="rig-wa-arm-l">
            <path d="M148 94 L110 92 L104 54" class="rig-zone-stroke"/>
            <circle cx="110" cy="92" r="4" class="rig-dot"/>
            <circle cx="104" cy="54" r="4.5" class="rig-finger"/>
          </g>
          <g class="rig-wa-arm-r">
            <path d="M212 94 L250 92 L256 54" class="rig-zone-stroke"/>
            <circle cx="250" cy="92" r="4" class="rig-dot"/>
            <circle cx="256" cy="54" r="4.5" class="rig-finger"/>
          </g>
          <!-- Bidirectional glide arrows -->
          <path d="M74 102 V50 M69 57 L74 48 L79 57" class="rig-arrow"/>
          <path d="M286 102 V50 M281 57 L286 48 L291 57" class="rig-arrow"/>
        `;
      }
    },

    'posture-pull-apart': {
      zoneKey: 'demo.zone.scapulaPull',
      zoneFallback: 'Rhomboids & rear deltoids',
      views: ['front'],
      phases: ['ribs', 'pull-wide', 'squeeze'],
      render() {
        return `
          <defs>
            <radialGradient id="paZone" cx="50%" cy="44%" r="44%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.44"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.12"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="paSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <line x1="180" y1="16" x2="180" y2="254" class="rig-axis"/>
          <!-- Active mid-back scapular squeeze zone -->
          <ellipse cx="180" cy="112" rx="34" ry="26" fill="url(#paZone)" class="rig-zone-pulse"/>
          <circle cx="180" cy="50" r="18" fill="url(#paSkin)" class="rig-head"/>
          <path d="M148 92 L212 92 L202 172 H158 Z" fill="url(#paSkin)" class="rig-body"/>
          <path d="M162 172 L158 248 M198 172 L202 248" class="rig-body"/>
          <!-- Scapulae squeezing inward -->
          <path d="M158 102 L173 114 L166 132 Z" class="rig-zone-stroke rig-pa-blades rig-pa-blade-l"/>
          <path d="M202 102 L187 114 L194 132 Z" class="rig-zone-stroke rig-pa-blades rig-pa-blade-r"/>
          <!-- Ribs down / core brace indicator -->
          <path d="M164 146 H196" class="rig-detail rig-pa-ribs"/>
          <!-- Resistance band stretching horizontally -->
          <line x1="76" y1="108" x2="284" y2="108" class="rig-band"/>
          <g class="rig-pa-l">
            <path d="M148 96 L84 108" class="rig-zone-stroke"/>
            <circle cx="84" cy="108" r="5" class="rig-finger"/>
          </g>
          <g class="rig-pa-r">
            <path d="M212 96 L276 108" class="rig-zone-stroke"/>
            <circle cx="276" cy="108" r="5" class="rig-finger"/>
          </g>
          <!-- Outward pull direction vectors -->
          <path d="M112 140 H66 M73 135 L64 140 L73 145" class="rig-arrow"/>
          <path d="M248 140 H294 M287 135 L296 140 L287 145" class="rig-arrow"/>
        `;
      }
    },

    'posture-chest-stretch': {
      zoneKey: 'demo.zone.chestOpen',
      zoneFallback: 'Pectoralis & anterior shoulder',
      views: ['profile'],
      phases: ['frame-height', 'gentle-step', 'switch-30s'],
      render() {
        return `
          <defs>
            <radialGradient id="csZone" cx="50%" cy="46%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.44"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="csSkin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <line x1="68" y1="252" x2="296" y2="252" class="rig-axis"/>
          <!-- Architectural Doorframe Upright -->
          <rect x="234" y="20" width="16" height="232" rx="4" class="rig-prop"/>
          <line x1="214" y1="104" x2="262" y2="104" class="rig-landmark rig-cs-frame-cue"/>
          <!-- Split stance + gentle forward thoracic lean -->
          <g class="rig-cs-lean">
            <ellipse cx="164" cy="108" rx="28" ry="24" fill="url(#csZone)" class="rig-zone-pulse"/>
            <circle cx="152" cy="54" r="16" fill="url(#csSkin)" class="rig-head"/>
            <path d="M150 70 L144 156 L118 250 M144 156 L174 250" class="rig-body"/>
            <!-- Raised forearm anchored at shoulder level on frame -->
            <path d="M150 96 L232 104 L232 62" class="rig-zone-stroke"/>
            <circle cx="232" cy="104" r="4.5" class="rig-dot rig-cs-elbow-cue"/>
            <circle cx="232" cy="62" r="4.5" class="rig-finger"/>
          </g>
          <!-- Mild forward chest expansion arrow -->
          <path d="M168 128 H210 M203 123 L212 128 L203 133" class="rig-arrow rig-cs-step-arrow"/>
          <!-- 30s side switch cue -->
          <g class="rig-cs-switch">
            <path d="M88 64 A16 16 0 1 1 114 78" class="rig-arrow"/>
            <path d="M110 71 L115 79 L106 80" class="rig-arrow"/>
            <text x="102" y="42" text-anchor="middle" class="rig-svg-lbl-acc">30s L/R</text>
          </g>
        `;
      }
    },

    'posture-hip-flexor': {
      zoneKey: 'demo.zone.hipFlexor',
      zoneFallback: 'Anterior hip flexor & pelvis',
      views: ['profile'],
      phases: ['lunge', 'tuck', 'shift'],
      render() {
        return `
          <defs>
            <radialGradient id="hfZone" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.46"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="hfSkin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <!-- Mat / Floor Ground Line -->
          <line x1="60" y1="234" x2="300" y2="234" class="rig-axis"/>
          <!-- Ghost Upright Split Lunge Start -->
          <g class="rig-ghost">
            <circle cx="150" cy="62" r="14"/>
            <path d="M150 78 L148 156 L220 158 L220 232 M148 156 L124 232 L92 232"/>
          </g>
          <!-- Active Half-Kneeling Split Lunge -->
          <g class="rig-hf-shift">
            <ellipse cx="164" cy="168" rx="30" ry="26" fill="url(#hfZone)" class="rig-zone-pulse"/>
            <circle cx="164" cy="62" r="15" fill="url(#hfSkin)" class="rig-head"/>
            <!-- Tall braced torso -->
            <path d="M162 78 L158 158" class="rig-body"/>
            <!-- Braced core / posterior pelvic tuck cue -->
            <path d="M146 148 Q160 162 176 150" class="rig-landmark rig-hf-pelvis"/>
            <!-- Lead leg forward at ~90 deg knee -->
            <path d="M158 158 L228 162 L228 232 H242" class="rig-body"/>
            <!-- Trailing hip-flexor stretched leg -->
            <path d="M158 158 L138 232 L106 232" class="rig-zone-stroke rig-hf-hip-line"/>
            <!-- Hands resting smoothly on front thigh -->
            <path d="M162 96 L184 128 L206 156" class="rig-detail"/>
            <circle cx="138" cy="232" r="4" class="rig-dot rig-hf-setup"/>
            <circle cx="228" cy="232" r="4" class="rig-dot rig-hf-setup"/>
          </g>
          <!-- Gentle forward glide cue -->
          <path d="M190 112 H234 M227 107 L236 112 L227 117" class="rig-arrow rig-hf-arrow"/>
        `;
      }
    },

    'posture-screen-eye': {
      zoneKey: 'demo.zone.screenEye',
      zoneFallback: 'Eye horizon & cervical plumb',
      views: ['profile'],
      phases: ['tall-spine', 'eye-horizon', 'micro-break'],
      render() {
        return `
          <defs>
            <linearGradient id="seSkin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <!-- Desk & Workstation Monitor -->
          <line x1="64" y1="242" x2="306" y2="242" class="rig-axis"/>
          <path d="M188 168 H302 M268 168 V140 M246 168 H292" class="rig-body"/>
          <rect x="266" y="74" width="12" height="72" rx="3" class="rig-prop"/>
          <!-- Horizontal Eye-Level Ray matching top edge of monitor -->
          <line x1="126" y1="78" x2="266" y2="78" class="rig-zone-stroke rig-se-ray"/>
          <circle cx="266" cy="78" r="4.5" class="rig-dot rig-se-ray-dot"/>
          <!-- Plumb spine reference -->
          <line x1="118" y1="24" x2="118" y2="240" class="rig-guide-dash rig-se-spine"/>
          <!-- Upright Seated Silhouette -->
          <path d="M88 182 H152 M122 182 V240 M90 118 V182" class="rig-detail"/>
          <g class="rig-se-body">
            <circle cx="122" cy="76" r="16" fill="url(#seSkin)" class="rig-head rig-se-head"/>
            <path d="M120 92 L116 174 L178 178 L184 240" class="rig-body rig-se-spine-line"/>
            <path d="M120 112 L154 152 H198" class="rig-detail"/>
            <!-- Crown lift cue -->
            <path d="M122 50 V26 M117 33 L122 24 L127 33" class="rig-arrow rig-se-crown"/>
          </g>
          <!-- Stand-up micro-break upward arrows -->
          <path d="M168 156 V112 M162 120 L168 110 L174 120" class="rig-arrow rig-se-break"/>
        `;
      }
    },

    /* ══════════════════════════════════════════════════════════════════
       PILOT 2: face-smile (Clinical Dental Arches & Oral Hygiene)
       ══════════════════════════════════════════════════════════════════ */
    'smile-upper-arch': {
      zoneKey: 'demo.zone.upperArch',
      zoneFallback: 'Upper gumline at 45° angle',
      views: ['front'],
      phases: ['angle-45', 'outer-sweep', 'inner-arc'],
      render() {
        return `
          <defs>
            <radialGradient id="suZone" cx="50%" cy="42%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="suTooth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <!-- Lip perimeter silhouette -->
          <path d="M58 134 Q180 42 302 134 Q180 218 58 134 Z" class="rig-prop-frame"/>
          <ellipse cx="180" cy="96" rx="108" ry="38" fill="url(#suZone)" class="rig-zone-pulse"/>
          <!-- Upper gingival gumline arch -->
          <path d="M74 128 Q180 56 286 128" class="rig-zone-stroke rig-su-outer-arc"/>
          <!-- Inner palatal gumline arc -->
          <path d="M98 136 Q180 94 262 136" class="rig-guide-dash rig-su-inner-arc"/>
          <!-- Individual contoured maxillary teeth across curved arcade -->
          <g class="rig-teeth-row">
            <rect x="82" y="106" width="20" height="24" rx="5" fill="url(#suTooth)" class="rig-line"/>
            <rect x="106" y="96" width="22" height="28" rx="6" fill="url(#suTooth)" class="rig-line"/>
            <rect x="132" y="88" width="22" height="32" rx="6" fill="url(#suTooth)" class="rig-line"/>
            <rect x="157" y="84" width="22" height="36" rx="6" fill="url(#suTooth)" class="rig-line"/>
            <rect x="181" y="84" width="22" height="36" rx="6" fill="url(#suTooth)" class="rig-line"/>
            <rect x="206" y="88" width="22" height="32" rx="6" fill="url(#suTooth)" class="rig-line"/>
            <rect x="232" y="96" width="22" height="28" rx="6" fill="url(#suTooth)" class="rig-line"/>
            <rect x="258" y="106" width="20" height="24" rx="5" fill="url(#suTooth)" class="rig-line"/>
          </g>
          <!-- Subtle lower teeth rest contour -->
          <path d="M90 156 Q180 184 270 156" class="rig-ghost"/>
          <!-- 45° Angle Indicator Guide -->
          <g class="rig-su-angle">
            <path d="M126 62 L158 84" class="rig-guide-dash"/>
            <path d="M138 68 A24 24 0 0 0 132 84" class="rig-landmark"/>
            <text x="112" y="54" class="rig-svg-lbl-acc">45°</text>
          </g>
          <!-- Animated 45° angled soft toothbrush head doing gentle circular Bass sweeps -->
          <g class="rig-brush-upper">
            <g transform="rotate(-24 180 112)">
              <rect x="148" y="102" width="54" height="12" rx="5" class="rig-hand"/>
              <rect x="148" y="90" width="44" height="12" rx="3" class="rig-zone-stroke"/>
              <line x1="156" y1="90" x2="156" y2="100" class="rig-landmark"/>
              <line x1="166" y1="90" x2="166" y2="100" class="rig-landmark"/>
              <line x1="176" y1="90" x2="176" y2="100" class="rig-landmark"/>
              <line x1="186" y1="90" x2="186" y2="100" class="rig-landmark"/>
              <line x1="202" y1="108" x2="294" y2="108" class="rig-head"/>
            </g>
          </g>
          <!-- Circular gentle stroke cue -->
          <path d="M94 56 A14 14 0 1 1 82 68 M80 60 L82 69 L91 67" class="rig-arrow rig-su-circle"/>
        `;
      }
    },

    'smile-lower-arch': {
      zoneKey: 'demo.zone.lowerArch',
      zoneFallback: 'Lower gumline & chewing ridge',
      views: ['front'],
      phases: ['gumline', 'outer-inner', 'bite-surface'],
      render() {
        return `
          <defs>
            <radialGradient id="slZone" cx="50%" cy="62%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="slTooth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <path d="M58 134 Q180 42 302 134 Q180 218 58 134 Z" class="rig-prop-frame"/>
          <ellipse cx="180" cy="166" rx="108" ry="38" fill="url(#slZone)" class="rig-zone-pulse"/>
          <path d="M90 106 Q180 80 270 106" class="rig-ghost"/>
          <!-- Contoured lower mandibular teeth -->
          <g class="rig-teeth-row">
            <rect x="84" y="138" width="20" height="24" rx="5" fill="url(#slTooth)" class="rig-line"/>
            <rect x="108" y="144" width="21" height="28" rx="6" fill="url(#slTooth)" class="rig-line"/>
            <rect x="133" y="148" width="21" height="30" rx="6" fill="url(#slTooth)" class="rig-line"/>
            <rect x="158" y="150" width="20" height="32" rx="6" fill="url(#slTooth)" class="rig-line"/>
            <rect x="182" y="150" width="20" height="32" rx="6" fill="url(#slTooth)" class="rig-line"/>
            <rect x="206" y="148" width="21" height="30" rx="6" fill="url(#slTooth)" class="rig-line"/>
            <rect x="231" y="144" width="21" height="28" rx="6" fill="url(#slTooth)" class="rig-line"/>
            <rect x="256" y="138" width="20" height="24" rx="5" fill="url(#slTooth)" class="rig-line"/>
          </g>
          <!-- Chewing occlusal ridge highlight -->
          <path d="M84 138 Q180 156 276 138" class="rig-guide-dash rig-sl-bite"/>
          <!-- Lower gingival margin -->
          <path d="M74 148 Q180 216 286 148" class="rig-zone-stroke rig-sl-gumline"/>
          <!-- Articulated angled brush sweeping across lower arch -->
          <g class="rig-brush-lower">
            <g transform="rotate(20 180 156)">
              <rect x="148" y="150" width="54" height="12" rx="5" class="rig-hand"/>
              <rect x="148" y="162" width="44" height="12" rx="3" class="rig-zone-stroke"/>
              <line x1="156" y1="162" x2="156" y2="172" class="rig-landmark"/>
              <line x1="166" y1="162" x2="166" y2="172" class="rig-landmark"/>
              <line x1="176" y1="162" x2="176" y2="172" class="rig-landmark"/>
              <line x1="186" y1="162" x2="186" y2="172" class="rig-landmark"/>
              <line x1="202" y1="156" x2="294" y2="156" class="rig-head"/>
            </g>
          </g>
          <path d="M126 226 H234 M227 221 L236 226 L227 231" class="rig-arrow rig-sl-sweep"/>
        `;
      }
    },

    'smile-tongue-floss': {
      zoneKey: 'demo.zone.tongueFloss',
      zoneFallback: 'Tongue dorsum & interdental gap',
      views: ['front'],
      phases: ['tongue', 'c-curve', 'between'],
      render() {
        return `
          <defs>
            <linearGradient id="tfTooth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <!-- Left Card Panel: Tongue Clean Back-to-Front -->
          <g class="rig-tf-left">
            <rect x="26" y="34" width="144" height="198" rx="16" class="rig-prop-frame"/>
            <path d="M62 190 V108 C62 74 134 74 134 108 V190" fill="url(#tfTooth)" class="rig-head"/>
            <line x1="98" y1="92" x2="98" y2="176" class="rig-guide-dash"/>
            <g class="rig-tongue-sweep">
              <rect x="66" y="104" width="64" height="8" rx="4" class="rig-zone-stroke"/>
            </g>
            <path d="M98 96 V154 M93 147 L98 156 L103 147" class="rig-arrow"/>
          </g>

          <!-- Right Card Panel: Magnified Interdental C-Curve Floss -->
          <g class="rig-tf-right">
            <rect x="190" y="34" width="144" height="198" rx="16" class="rig-prop-frame"/>
            <!-- Adjacent crowns + gingival papilla -->
            <path d="M214 148 Q262 128 310 148" class="rig-detail"/>
            <path d="M216 74 C216 62 256 62 256 74 V134 C256 140 242 142 236 142 C230 142 216 140 216 134 Z" fill="url(#tfTooth)" class="rig-head"/>
            <path d="M268 74 C268 62 308 62 308 74 V134 C308 140 294 142 288 142 C282 142 268 140 268 134 Z" fill="url(#tfTooth)" class="rig-head"/>
            <!-- Vertical floss hugging tooth wall smoothly -->
            <g class="rig-floss-glide">
              <path d="M262 56 V136 Q262 144 252 146" class="rig-zone-stroke"/>
              <circle cx="262" cy="56" r="3.5" class="rig-dot"/>
            </g>
            <!-- Explicit C-curve wrap cue around crown side -->
            <path d="M242 66 Q262 96 244 136" class="rig-zone-stroke rig-floss-c"/>
            <path d="M262 162 V198 M257 170 L262 161 L267 170 M257 190 L262 199 L267 190" class="rig-arrow rig-floss-arrows"/>
          </g>
        `;
      }
    },

    /* ══════════════════════════════════════════════════════════════════
       PILOT 3: skin-sunscreen (Dermatology Dosage & UV Protection Map)
       ══════════════════════════════════════════════════════════════════ */
    'spf-two-finger': {
      zoneKey: 'demo.zone.spfDose',
      zoneFallback: '2 full finger-lengths SPF 30+',
      views: ['front'],
      phases: ['two-fingers', 'full-strips', 'spf-30'],
      render() {
        return `
          <defs>
            <radialGradient id="spZoneD" cx="50%" cy="44%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.36"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="spSkinD" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <ellipse cx="180" cy="112" rx="68" ry="64" fill="url(#spZoneD)" class="rig-zone-pulse"/>
          <!-- Palmar silhouette with index & middle fingers extended cleanly -->
          <path d="M132 252 V176 C126 168 124 148 136 144 L148 148 V52 C148 40 168 40 168 52 V134 L176 134 V44 C176 32 196 32 196 44 V136 L204 138 C206 126 222 126 222 140 V152 C226 144 240 144 240 158 V206 C240 226 228 242 222 252 Z" fill="url(#spSkinD)" class="rig-head rig-spf-hand-shape"/>
          <!-- Finger highlight guides & joint crease landmarks -->
          <path d="M148 130 V52 C148 40 168 40 168 52 V130 M176 130 V44 C176 32 196 32 196 44 V130" class="rig-landmark rig-spf-fingers-cue"/>
          <path d="M152 84 H164 M152 112 H164 M180 78 H192 M180 108 H192" class="rig-detail"/>
          <!-- Calibrated SPF ribbon strips squeezed along both fingers -->
          <path d="M158 54 V132" class="rig-zone-stroke rig-spf-strip-a"/>
          <path d="M186 46 V132" class="rig-zone-stroke rig-spf-strip-b"/>
          <!-- Measurement ruler guide next to index finger -->
          <g class="rig-spf-ruler">
            <line x1="122" y1="50" x2="122" y2="134" class="rig-guide-dash"/>
            <path d="M116 50 H128 M116 92 H124 M116 134 H128" class="rig-detail"/>
          </g>
          <!-- SPF Shield Emblem -->
          <g class="rig-spf-shield" transform="translate(248, 52)">
            <path d="M24 2 L46 10 V24 C46 38 36 48 24 52 C12 48 2 38 2 24 V10 Z" class="rig-prop-frame"/>
            <text x="24" y="25" text-anchor="middle" class="rig-svg-lbl">SPF</text>
            <text x="24" y="39" text-anchor="middle" class="rig-svg-lbl-acc">30+</text>
          </g>
        `;
      }
    },

    'spf-face-zones': {
      zoneKey: 'demo.zone.spfFace',
      zoneFallback: 'Forehead, cheeks, nose & chin',
      views: ['front'],
      phases: ['dot-zones', 'outward-blend', 'eye-perimeter'],
      render() {
        return `
          <defs>
            <radialGradient id="spZoneF" cx="50%" cy="48%" r="46%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="spSkinF" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <path d="M116 254 C122 222 142 204 162 198 V176 H198 V198 C218 204 238 222 244 254" fill="url(#spSkinF)" class="rig-body"/>
          <path d="M128 96 C118 96 117 124 128 128 M232 96 C242 96 243 124 232 128" class="rig-line"/>
          <path d="${FRONT_HEAD_PATH}" fill="url(#spSkinF)" class="rig-head"/>
          <!-- Full-face protective UV veil aura -->
          <ellipse cx="180" cy="104" rx="46" ry="60" fill="url(#spZoneF)" class="rig-spf-veil"/>
          <!-- Regional coverage zone dashed maps (Forehead, Cheeks, Nose, Chin) -->
          <ellipse cx="180" cy="56" rx="28" ry="11" class="rig-guide-dash"/>
          <ellipse cx="152" cy="116" rx="14" ry="12" class="rig-guide-dash"/>
          <ellipse cx="208" cy="116" rx="14" ry="12" class="rig-guide-dash"/>
          <rect x="174" y="88" width="12" height="32" rx="6" class="rig-guide-dash"/>
          <ellipse cx="180" cy="152" rx="16" ry="9" class="rig-guide-dash"/>
          <!-- Eye perimeter landmarks & protective rings -->
          <ellipse cx="158" cy="92" rx="11" ry="6" class="rig-detail"/>
          <ellipse cx="202" cy="92" rx="11" ry="6" class="rig-detail"/>
          <ellipse cx="158" cy="92" rx="16" ry="10" class="rig-guide-dash rig-spf-eyes"/>
          <ellipse cx="202" cy="92" rx="16" ry="10" class="rig-guide-dash rig-spf-eyes"/>
          <path d="M167 136 Q180 139 193 136" class="rig-detail"/>
          <!-- 5 Calibrated Cream Droplets -->
          <circle cx="180" cy="56" r="5" class="rig-dot rig-spf-dot"/>
          <circle cx="152" cy="116" r="5" class="rig-dot rig-spf-dot"/>
          <circle cx="208" cy="116" r="5" class="rig-dot rig-spf-dot"/>
          <circle cx="180" cy="106" r="4.5" class="rig-dot rig-spf-dot"/>
          <circle cx="180" cy="152" r="5" class="rig-dot rig-spf-dot"/>
          <!-- Outward smooth blend arrows -->
          <g class="rig-spf-arrows">
            <path d="M150 116 Q134 114 134 100 M131 106 L134 98 L139 105" class="rig-arrow"/>
            <path d="M210 116 Q226 114 226 100 M221 105 L226 98 L229 106" class="rig-arrow"/>
          </g>
        `;
      }
    },

    'spf-neck-ears-hands': {
      zoneKey: 'demo.zone.spfNeckHands',
      zoneFallback: 'Neck sides, ears & hand backs',
      views: ['front'],
      phases: ['neck-sides', 'ears', 'hand-backs'],
      render() {
        return `
          <defs>
            <radialGradient id="spZoneNH" cx="50%" cy="52%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="spSkinNH" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <!-- Left Panel: Neck Sides & Ear Pinna -->
          <g class="rig-nh-left">
            <rect x="24" y="28" width="150" height="212" rx="16" class="rig-prop-frame"/>
            <path d="M44 236 C50 206 66 192 84 186 V154 C74 140 68 118 70 96 C74 64 96 50 120 54 C140 58 148 76 146 102 L154 114 L146 122 C146 138 140 150 126 154 L124 188 C142 194 156 208 162 236" fill="url(#spSkinNH)" class="rig-head"/>
            <ellipse cx="96" cy="144" rx="28" ry="34" fill="url(#spZoneNH)" class="rig-zone-pulse rig-nh-neck-glow"/>
            <!-- Highlighted ear contour & lateral neck swath -->
            <circle cx="84" cy="115" r="15" class="rig-touch-ring rig-spf-ear-ring"/>
            <path d="M84 102 C75 102 74 126 84 128 C90 129 93 122 92 112" class="rig-zone-stroke rig-spf-ear"/>
            <path d="M86 152 Q98 176 106 196 M108 148 Q116 172 120 194" class="rig-zone-stroke rig-spf-neck"/>
          </g>

          <!-- Right Panel: Dorsal Back of Hand -->
          <g class="rig-nh-right">
            <rect x="186" y="28" width="150" height="212" rx="16" class="rig-prop-frame"/>
            <path d="M236 236 V180 C226 172 214 152 216 138 C218 130 228 132 232 142 L236 148 V86 C236 76 248 76 248 86 V128 L254 126 V68 C254 58 266 58 266 68 V126 L272 128 V74 C272 64 284 64 284 74 V130 L290 132 V92 C290 82 302 82 302 92 V168 C302 184 294 196 286 204 V236 Z" fill="url(#spSkinNH)" class="rig-head"/>
            <ellipse cx="268" cy="160" rx="24" ry="26" fill="url(#spZoneNH)" class="rig-zone-pulse rig-nh-hand-glow"/>
            <circle cx="268" cy="158" r="14" class="rig-zone-stroke rig-spf-hand"/>
            <!-- Soft outward spread cue on hand dorsum -->
            <path d="M268 158 V138 M263 144 L268 136 L273 144" class="rig-arrow rig-nh-hand-arrow"/>
          </g>
        `;
      }
    },

    /* ══════════════════════════════════════════════════════════════════
       BATCH 1A: body-strength (Biomechanics & Proportions)
       ══════════════════════════════════════════════════════════════════ */
    'strength-squat': {
      zoneKey: 'demo.zone.strengthSquat',
      zoneFallback: 'Quads, glutes & knee tracking',
      views: ['profile', 'front'],
      phases: ['stance', 'hips-down', 'drive-up'],
      render(view) {
        if (view === 'front') {
          return `
            <defs>
              <radialGradient id="sqFZone" cx="50%" cy="56%" r="46%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/>
                <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="sqFSkin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
                <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
              </linearGradient>
            </defs>
            <line x1="64" y1="246" x2="296" y2="246" class="rig-axis"/>
            <line x1="180" y1="18" x2="180" y2="246" class="rig-axis"/>
            <!-- Shoulder-width stance plumb lines -->
            <line x1="142" y1="74" x2="132" y2="246" class="rig-guide-dash rig-sqf-stance"/>
            <line x1="218" y1="74" x2="228" y2="246" class="rig-guide-dash rig-sqf-stance"/>
            <ellipse cx="180" cy="176" rx="56" ry="38" fill="url(#sqFZone)" class="rig-zone-pulse"/>
            <!-- Symmetrical legs anchored firmly to floor y=246 -->
            <g class="rig-sqf-legs">
              <path d="M158 150 L132 188 L132 246 M202 150 L228 188 L228 246" class="rig-zone-stroke rig-sqf-knees"/>
              <circle cx="132" cy="188" r="7" class="rig-touch-ring rig-sqf-knee-ring"/>
              <circle cx="228" cy="188" r="7" class="rig-touch-ring rig-sqf-knee-ring"/>
            </g>
            <!-- Planted feet on floor -->
            <path d="M116 246 H140 M220 246 H244" class="rig-zone-stroke"/>
            <circle cx="132" cy="246" r="4" class="rig-dot rig-sqf-foot"/>
            <circle cx="228" cy="246" r="4" class="rig-dot rig-sqf-foot"/>
            <!-- Animated Upper Torso & Core -->
            <g class="rig-sqf-upper">
              <circle cx="180" cy="48" r="16" fill="url(#sqFSkin)" class="rig-head"/>
              <path d="M144 82 L216 82 L206 150 H154 Z" fill="url(#sqFSkin)" class="rig-body"/>
              <rect x="160" y="114" width="40" height="22" rx="6" class="rig-landmark rig-sqf-core"/>
              <path d="M144 86 L126 112 M216 86 L234 112" class="rig-body"/>
            </g>
            <!-- Vertical drive-up cue -->
            <path d="M84 196 V136 M79 144 L84 134 L89 144" class="rig-arrow rig-sqf-drive"/>
            <path d="M276 196 V136 M271 144 L276 134 L281 144" class="rig-arrow rig-sqf-drive"/>
          `;
        }

        // Default: Profile view
        return `
          <defs>
            <radialGradient id="sqPZone" cx="46%" cy="56%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.44"/>
              <stop offset="68%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="sqPSkin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <!-- Floor & vertical mid-foot plumb axis -->
          <line x1="68" y1="246" x2="292" y2="246" class="rig-axis"/>
          <line x1="178" y1="18" x2="178" y2="246" class="rig-axis"/>
          <!-- Ghost tall start stance -->
          <g class="rig-ghost">
            <circle cx="176" cy="48" r="15"/>
            <path d="M174 64 L170 134 L174 190 L182 246 M174 80 L216 90"/>
          </g>
          <!-- Ghost deep squat bottom target -->
          <g class="rig-ghost">
            <path d="M148 164 L208 186 L182 246"/>
          </g>
          <ellipse cx="164" cy="176" rx="44" ry="30" fill="url(#sqPZone)" class="rig-zone-pulse"/>
          <!-- Planted flat foot anchored firmly on floor y=246 -->
          <path d="M176 246 H214" class="rig-zone-stroke"/>
          <circle cx="182" cy="246" r="4" class="rig-dot"/>
          <!-- Articulated Femur & Tibia anchored at ankle (182, 246) -->
          <g class="rig-sqp-legs">
            <path d="M158 140 L204 188 L182 246" class="rig-zone-stroke rig-sqp-leg"/>
            <circle cx="204" cy="188" r="4.5" class="rig-dot"/>
          </g>
          <!-- Neutral Proud Torso, Head & Counterbalance Arms -->
          <g class="rig-sqp-upper">
            <circle cx="176" cy="54" r="15" fill="url(#sqPSkin)" class="rig-head"/>
            <path d="M172 70 L158 140" class="rig-body rig-sqp-torso"/>
            <path d="M170 84 L224 88" class="rig-detail"/>
            <circle cx="158" cy="140" r="4.5" class="rig-dot"/>
          </g>
          <!-- Down-back & Drive-up directional arrows -->
          <path d="M126 112 L106 144 M104 134 L105 145 L114 140" class="rig-arrow rig-sqp-down"/>
          <path d="M248 186 V126 M243 134 L248 124 L253 134" class="rig-arrow rig-sqp-up"/>
        `;
      }
    },

    'strength-hinge': {
      zoneKey: 'demo.zone.strengthHinge',
      zoneFallback: 'Hamstrings, glutes & neutral spine',
      views: ['profile', 'front'],
      phases: ['soft-knees', 'hips-back', 'drive-hips'],
      render(view) {
        if (view === 'front') {
          return `
            <defs>
              <radialGradient id="hgFZone" cx="50%" cy="62%" r="44%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/>
                <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="hgFSkin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
                <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
              </linearGradient>
            </defs>
            <line x1="68" y1="246" x2="292" y2="246" class="rig-axis"/>
            <line x1="180" y1="18" x2="180" y2="246" class="rig-axis"/>
            <ellipse cx="180" cy="164" rx="44" ry="30" fill="url(#hgFZone)" class="rig-zone-pulse"/>
            <!-- Grounded feet and nearly-vertical legs anchored permanently to floor y=246 -->
            <g class="rig-hgf-legs">
              <path d="M162 152 L160 194 L160 246 M198 152 L200 194 L200 246" class="rig-body"/>
              <path d="M144 246 H166 M194 246 H216" class="rig-zone-stroke"/>
              <circle cx="160" cy="246" r="4" class="rig-dot"/>
              <circle cx="200" cy="246" r="4" class="rig-dot"/>
              <circle cx="160" cy="194" r="7" class="rig-touch-ring rig-hgf-softknee"/>
              <circle cx="200" cy="194" r="7" class="rig-touch-ring rig-hgf-softknee"/>
            </g>
            <!-- Hip crease hinge fold axis -->
            <line x1="146" y1="152" x2="214" y2="152" class="rig-zone-stroke rig-hgf-crease"/>
            <!-- Foreshortening torso folding forward over hip crease (y=152) -->
            <path d="M148 86 L212 86 L202 152 H158 Z" fill="url(#hgFSkin)" class="rig-body rig-hgf-trunk"/>
            <!-- Head & arms descending along thighs cleanly without distorting head circle -->
            <g class="rig-hgf-head-arms">
              <circle cx="180" cy="54" r="16" fill="url(#hgFSkin)" class="rig-head"/>
              <path d="M150 90 L153 158 M210 90 L207 158" class="rig-detail"/>
            </g>
            <!-- Vertical return arrows -->
            <path d="M104 176 V126 M99 134 L104 124 L109 134" class="rig-arrow rig-hgf-drive"/>
            <path d="M256 176 V126 M251 134 L256 124 L261 134" class="rig-arrow rig-hgf-drive"/>
          `;
        }

        // Default: Profile Hip Hinge (nearly vertical shins, long neutral spine, posterior hamstring tension)
        return `
          <defs>
            <radialGradient id="hgPZone" cx="50%" cy="54%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.44"/>
              <stop offset="68%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="hgPSkin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <line x1="68" y1="246" x2="292" y2="246" class="rig-axis"/>
          <!-- Vertical shin plumb reference -->
          <line x1="184" y1="142" x2="184" y2="246" class="rig-guide-dash"/>
          <!-- Ghost upright start posture -->
          <g class="rig-ghost">
            <circle cx="182" cy="48" r="15"/>
            <path d="M182 64 L182 140 L186 190 L184 244"/>
          </g>
          <!-- Static lower shin with soft 15° knee bend -->
          <path d="M172 140 L188 190 L184 244 H210" class="rig-body"/>
          <circle cx="188" cy="190" r="8" class="rig-touch-ring rig-hgp-knee"/>
          <!-- Hamstring tension highlight behind femur -->
          <ellipse cx="164" cy="168" rx="22" ry="30" fill="url(#hgPZone)" class="rig-zone-pulse"/>
          <path d="M160 144 Q166 168 178 188" class="rig-zone-stroke rig-hgp-ham"/>
          <!-- Animated long-spine upper torso pivoting at hip joint (172, 140) -->
          <g class="rig-hgp-torso">
            <!-- Long neutral spine indicator rod -->
            <line x1="162" y1="138" x2="224" y2="78" class="rig-landmark rig-hgp-spine"/>
            <circle cx="234" cy="68" r="14" fill="url(#hgPSkin)" class="rig-head"/>
            <path d="M172 140 L224 80" class="rig-body"/>
            <!-- Arms hanging straight down near shins -->
            <path d="M212 94 L208 168" class="rig-detail"/>
            <circle cx="172" cy="140" r="4.5" class="rig-dot"/>
          </g>
          <!-- Backward hip push arrow & forward drive arrow -->
          <path d="M148 140 H102 M110 135 L100 140 L110 145" class="rig-arrow rig-hgp-back"/>
          <path d="M104 166 H148 M140 161 L150 166 L140 171" class="rig-arrow rig-hgp-fwd"/>
        `;
      }
    },

    'strength-push': {
      zoneKey: 'demo.zone.strengthPush',
      zoneFallback: 'Plank line, chest & 45° elbow track',
      views: ['profile', 'front'],
      phases: ['plank-line', 'lower-45', 'even-press'],
      render(view) {
        if (view === 'front') {
          return `
            <defs>
              <radialGradient id="puFZone" cx="50%" cy="48%" r="48%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.42"/>
                <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="puFSkin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
                <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
              </linearGradient>
            </defs>
            <!-- Overhead / Anterior Biomechanical 45° Elbow Angle Map -->
            <line x1="180" y1="22" x2="180" y2="248" class="rig-axis"/>
            <ellipse cx="180" cy="112" rx="48" ry="34" fill="url(#puFZone)" class="rig-zone-pulse"/>
            <g class="rig-puf-body">
              <circle cx="180" cy="48" r="15" fill="url(#puFSkin)" class="rig-head"/>
              <path d="M142 78 L218 78 L204 176 H156 Z" fill="url(#puFSkin)" class="rig-body"/>
              <path d="M160 176 L156 242 M200 176 L204 242" class="rig-body"/>
              <!-- Upper arms angled ~45° back from torso (NEVER 90° flare) -->
              <path d="M142 82 L106 118 L112 96" class="rig-zone-stroke rig-puf-arms"/>
              <path d="M218 82 L254 118 L248 96" class="rig-zone-stroke rig-puf-arms"/>
              <circle cx="112" cy="96" r="5" class="rig-finger"/>
              <circle cx="248" cy="96" r="5" class="rig-finger"/>
              <!-- 45° Arc Angle Callouts -->
              <path d="M142 82 V128" class="rig-guide-dash"/>
              <path d="M218 82 V128" class="rig-guide-dash"/>
              <path d="M142 110 A28 28 0 0 1 122 102" class="rig-landmark rig-puf-angle"/>
              <path d="M218 110 A28 28 0 0 0 238 102" class="rig-landmark rig-puf-angle"/>
              <text x="108" y="138" text-anchor="middle" class="rig-svg-lbl-acc rig-puf-angle">45°</text>
              <text x="252" y="138" text-anchor="middle" class="rig-svg-lbl-acc rig-puf-angle">45°</text>
            </g>
            <!-- Even press arrows -->
            <path d="M72 126 V84 M67 92 L72 82 L77 92" class="rig-arrow rig-puf-press"/>
            <path d="M288 126 V84 M283 92 L288 82 L293 92" class="rig-arrow rig-puf-press"/>
          `;
        }

        // Default: Profile Plank & Press
        return `
          <defs>
            <radialGradient id="puPZone" cx="50%" cy="50%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.42"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="puPSkin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <!-- Floor reference line -->
          <line x1="42" y1="214" x2="318" y2="214" class="rig-axis"/>
          <!-- Ghost top plank line -->
          <g class="rig-ghost">
            <line x1="76" y1="208" x2="254" y2="122"/>
            <circle cx="272" cy="112" r="13"/>
          </g>
          <!-- Anchor toes & hand contact -->
          <circle cx="76" cy="212" r="4" class="rig-dot"/>
          <circle cx="246" cy="212" r="4" class="rig-dot"/>
          <!-- Animated straight plank body + elbow bend -->
          <g class="rig-pup-plank">
            <ellipse cx="212" cy="142" rx="34" ry="26" fill="url(#puPZone)" class="rig-zone-pulse"/>
            <!-- Straight ankle-hip-shoulder-ear alignment guide -->
            <line x1="76" y1="208" x2="266" y2="116" class="rig-landmark rig-pup-line"/>
            <path d="M76 208 L244 128" class="rig-body"/>
            <circle cx="268" cy="116" r="14" fill="url(#puPSkin)" class="rig-head"/>
            <!-- Arm stacked under shoulder angling elbow back -->
            <path d="M238 132 L222 174 L246 212" class="rig-zone-stroke rig-pup-arm"/>
          </g>
          <!-- Lower & Press vertical vectors -->
          <path d="M294 128 V176 M289 168 L294 178 L299 168" class="rig-arrow rig-pup-lower"/>
          <path d="M310 176 V128 M305 136 L310 126 L315 136" class="rig-arrow rig-pup-press"/>
        `;
      }
    },

    'strength-pull': {
      zoneKey: 'demo.zone.strengthPull',
      zoneFallback: 'Lat depression & scapular squeeze',
      views: ['front', 'profile'],
      phases: ['shoulders-down', 'lead-elbows', 'full-squeeze'],
      render(view) {
        if (view === 'profile') {
          return `
            <defs>
              <radialGradient id="plPZone" cx="50%" cy="48%" r="46%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.44"/>
                <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="plPSkin" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
                <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
              </linearGradient>
            </defs>
            <line x1="68" y1="248" x2="292" y2="248" class="rig-axis"/>
            <line x1="164" y1="20" x2="164" y2="248" class="rig-axis"/>
            <ellipse cx="144" cy="112" rx="28" ry="26" fill="url(#plPZone)" class="rig-zone-pulse"/>
            <circle cx="164" cy="54" r="15" fill="url(#plPSkin)" class="rig-head"/>
            <path d="M162 70 L158 164 L148 246 M158 164 L172 246" class="rig-body"/>
            <!-- Depressed shoulder contour away from ear -->
            <path d="M150 80 L150 96 M146 90 L150 97 L154 90" class="rig-arrow rig-plp-depress"/>
            <!-- Ghost extended pull start -->
            <path d="M162 96 L246 112" class="rig-ghost"/>
            <!-- Elbow driving straight back past ribcage -->
            <g class="rig-plp-elbow">
              <path d="M162 96 L118 118 L174 128" class="rig-zone-stroke rig-plp-arm"/>
              <circle cx="118" cy="118" r="5" class="rig-dot"/>
              <circle cx="174" cy="128" r="4.5" class="rig-finger"/>
            </g>
            <!-- Scapular slide back vector -->
            <path d="M214 148 H128 M136 143 L126 148 L136 153" class="rig-arrow rig-plp-pull"/>
          `;
        }

        // Default: Posterior/Upper-Back Scapular Pull Control
        return `
          <defs>
            <radialGradient id="plFZone" cx="50%" cy="46%" r="44%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.44"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="plFSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <line x1="180" y1="18" x2="180" y2="252" class="rig-axis"/>
          <ellipse cx="180" cy="116" rx="36" ry="28" fill="url(#plFZone)" class="rig-zone-pulse"/>
          <circle cx="180" cy="50" r="17" fill="url(#plFSkin)" class="rig-head"/>
          <path d="M142 88 L218 88 L204 176 H156 Z" fill="url(#plFSkin)" class="rig-body"/>
          <path d="M162 176 L158 248 M198 176 L202 248" class="rig-body"/>
          <!-- Anti-shrug downward shoulder depression arrows -->
          <path d="M138 66 V86 M133 80 L138 88 L143 80" class="rig-arrow rig-plf-depress"/>
          <path d="M222 66 V86 M217 80 L222 88 L227 80" class="rig-arrow rig-plf-depress"/>
          <!-- Left & Right Scapular Blades sliding down and inward -->
          <path d="M156 100 L172 114 L164 136 Z" class="rig-zone-stroke rig-plf-blade-l"/>
          <path d="M204 100 L188 114 L196 136 Z" class="rig-zone-stroke rig-plf-blade-r"/>
          <!-- Elbows leading smoothly inward/down toward ribs -->
          <g class="rig-plf-arm-l">
            <path d="M142 92 L98 124 L118 148" class="rig-zone-stroke"/>
            <circle cx="98" cy="124" r="5" class="rig-dot"/>
          </g>
          <g class="rig-plf-arm-r">
            <path d="M218 92 L262 124 L242 148" class="rig-zone-stroke"/>
            <circle cx="262" cy="124" r="5" class="rig-dot"/>
          </g>
          <path d="M96 146 H132 M124 141 L134 146 L124 151" class="rig-arrow rig-plf-cue"/>
          <path d="M264 146 H228 M236 141 L226 146 L236 151" class="rig-arrow rig-plf-cue"/>
        `;
      }
    },

    /* ══════════════════════════════════════════════════════════════════
       BATCH 1B: face-puffiness (Safe Compress, Gentle Sweep & Daily Triggers)
       ══════════════════════════════════════════════════════════════════ */
    'puff-compress': {
      zoneKey: 'demo.zone.puffCompress',
      zoneFallback: 'Under-eye & upper cheek cool compress',
      views: ['front'],
      phases: ['cool-cloth', 'under-eye', 'calm-60s'],
      render() {
        return `
          <defs>
            <radialGradient id="pcFZone" cx="50%" cy="48%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="pcFSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <path d="M116 254 C122 222 142 204 162 198 V176 H198 V198 C218 204 238 222 244 254" fill="url(#pcFSkin)" class="rig-body"/>
          <path d="M128 96 C118 96 117 124 128 128 M232 96 C242 96 243 124 232 128" class="rig-line"/>
          <path d="${FRONT_HEAD_PATH}" fill="url(#pcFSkin)" class="rig-head"/>
          <!-- Calm morning brows, closed rest eyes & neutral lips -->
          <path d="M146 84 Q158 80 170 84 M190 84 Q202 80 214 84" class="rig-detail"/>
          <path d="M148 96 Q158 99 168 96 M192 96 Q202 99 212 96" class="rig-detail"/>
          <path d="M180 94 V118 Q175 123 180 124 Q185 123 180 118" class="rig-detail"/>
          <path d="M167 139 Q180 142 193 139" class="rig-detail"/>
          <!-- Under-eye & cheek calming crescent zones -->
          <ellipse cx="180" cy="112" rx="46" ry="26" fill="url(#pcFZone)" class="rig-relax-aura rig-pcf-aura"/>
          <path d="M142 106 Q158 118 172 108 M188 108 Q202 118 218 106" class="rig-zone-stroke rig-pcf-zone"/>
          <!-- Folded soft chilled compress cloth -->
          <g class="rig-pcf-cloth">
            <rect x="132" y="102" width="96" height="30" rx="12" class="rig-hand rig-pcf-pad"/>
            <line x1="146" y1="112" x2="214" y2="112" class="rig-detail"/>
            <line x1="152" y1="122" x2="208" y2="122" class="rig-detail"/>
          </g>
          <!-- Static 60s calm timer ring cue -->
          <g class="rig-pcf-timer">
            <circle cx="294" cy="64" r="22" class="rig-breath-ring"/>
            <text x="294" y="68" text-anchor="middle" class="rig-svg-lbl-acc">${E(tr('demo.svg.sec60', '60s'))}</text>
          </g>
        `;
      }
    },

    'puff-sweep': {
      zoneKey: 'demo.zone.puffSweep',
      zoneFallback: 'Under-eye -> temples -> lateral neck',
      views: ['front'],
      phases: ['feather-touch', 'out-temples', 'down-neck'],
      render() {
        return `
          <defs>
            <radialGradient id="psFZone" cx="50%" cy="54%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="psFSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <path d="M110 256 C118 220 138 202 158 196 V172 H202 V196 C222 202 242 220 250 256" fill="url(#psFSkin)" class="rig-body"/>
          <path d="M128 96 C118 96 117 124 128 128 M232 96 C242 96 243 124 232 128" class="rig-line"/>
          <path d="${FRONT_HEAD_PATH}" fill="url(#psFSkin)" class="rig-head"/>
          <ellipse cx="180" cy="146" rx="54" ry="52" fill="url(#psFZone)" class="rig-zone-pulse"/>
          <path d="M148 84 Q158 80 169 84 M191 84 Q202 80 212 84" class="rig-detail"/>
          <ellipse cx="158" cy="95" rx="10" ry="5" class="rig-detail"/>
          <ellipse cx="202" cy="95" rx="10" ry="5" class="rig-detail"/>
          <path d="M167 139 Q180 142 193 139" class="rig-detail"/>
          <!-- Phase 0: Feather-light fingertip touch rings under eyes -->
          <g class="rig-psf-touch">
            <circle cx="156" cy="109" r="9" class="rig-touch-ring"/>
            <circle cx="156" cy="109" r="3.5" class="rig-finger"/>
            <circle cx="204" cy="109" r="9" class="rig-touch-ring"/>
            <circle cx="204" cy="109" r="3.5" class="rig-finger"/>
          </g>
          <!-- Phase 1: Outward gentle sweep toward temples -->
          <path d="M156 109 Q136 109 124 96" class="rig-zone-stroke rig-psf-temple-l"/>
          <path d="M204 109 Q224 109 236 96" class="rig-zone-stroke rig-psf-temple-r"/>
          <path d="M132 96 L123 95 L126 104" class="rig-arrow rig-psf-temple-arr"/>
          <path d="M228 96 L237 95 L234 104" class="rig-arrow rig-psf-temple-arr"/>
          <!-- Phase 2: Down lateral neck sides -->
          <path d="M124 104 Q118 144 136 184 L152 216" class="rig-zone-stroke rig-psf-neck-l"/>
          <path d="M236 104 Q242 144 224 184 L208 216" class="rig-zone-stroke rig-psf-neck-r"/>
          <path d="M146 208 L153 218 L156 206" class="rig-arrow rig-psf-neck-arr"/>
          <path d="M214 208 L207 218 L204 206" class="rig-arrow rig-psf-neck-arr"/>
        `;
      }
    },

    'puff-triggers': {
      zoneKey: 'demo.zone.puffTriggers',
      zoneFallback: 'Hydration, low evening salt & 7–9h sleep',
      views: ['front', 'profile'],
      phases: ['hydration', 'low-salt', 'elevated-sleep'],
      render(view) {
        if (view === 'profile') {
          return `
            <defs>
              <radialGradient id="ptPZone" cx="50%" cy="48%" r="48%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34"/>
                <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="ptPSkin" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
                <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
              </linearGradient>
            </defs>
            <!-- Bed Frame & Slightly Elevated Wedge Pillow (Head slightly elevated) -->
            <line x1="44" y1="212" x2="316" y2="212" class="rig-axis"/>
            <path d="M56 212 L176 168 L176 212 Z" class="rig-prop rig-ptp-pillow"/>
            <line x1="56" y1="212" x2="176" y2="168" class="rig-guide-dash"/>
            <!-- Elevated Head & Calm Torso -->
            <g class="rig-ptp-sleep">
              <ellipse cx="144" cy="140" rx="34" ry="26" fill="url(#ptPZone)" class="rig-relax-aura"/>
              <circle cx="132" cy="144" r="22" fill="url(#ptPSkin)" class="rig-head"/>
              <path d="M150 156 L268 186 L284 210" class="rig-body"/>
              <path d="M126 140 Q134 143 142 140" class="rig-detail"/>
            </g>
            <!-- Gentle elevation angle arrow -->
            <path d="M74 176 L112 158 M104 156 L113 157 L109 165" class="rig-arrow rig-ptp-elev"/>
            <!-- Bedside Water Glass (Hydration cue) & Evening Moon Badge (Low Salt / 7-9h) -->
            <g transform="translate(248, 52)">
              <g class="rig-ptp-water">
                <rect x="0" y="0" width="44" height="58" rx="10" class="rig-prop-frame"/>
                <path d="M14 14 H30 L27 46 H17 Z" class="rig-line"/>
                <path d="M16 30 H28 L27 44 H17 Z" class="rig-zone-stroke"/>
              </g>
            </g>
            <g transform="translate(60, 48)">
              <g class="rig-ptp-night">
                <rect x="0" y="0" width="92" height="44" rx="10" class="rig-prop-frame"/>
                <text x="46" y="27" text-anchor="middle" class="rig-svg-lbl-acc">${E(tr('demo.svg.sleep79', '7–9h'))} · Na↓</text>
              </g>
            </g>
          `;
        }

        // Default: Front 3-pillar daily depuff habits
        return `
          <defs>
            <radialGradient id="ptFZone" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.32"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <!-- Card 1 (Top-Left): Hydration Glass -->
          <g class="rig-ptf-water">
            <rect x="28" y="28" width="142" height="106" rx="16" class="rig-prop-frame"/>
            <circle cx="99" cy="76" r="32" fill="url(#ptFZone)" class="rig-zone-pulse"/>
            <path d="M78 46 H120 L114 114 H84 Z" class="rig-line"/>
            <path d="M82 78 Q99 72 116 78 L113 111 H85 Z" class="rig-zone-stroke"/>
            <path d="M99 50 Q107 60 107 65 A8 8 0 0 1 91 65 Q91 60 99 50 Z" class="rig-landmark"/>
          </g>
          <!-- Card 2 (Top-Right): Low Evening Salt -->
          <g class="rig-ptf-salt">
            <rect x="190" y="28" width="142" height="106" rx="16" class="rig-prop-frame"/>
            <rect x="242" y="56" width="32" height="48" rx="8" class="rig-line"/>
            <path d="M244 56 Q258 42 272 56" class="rig-detail"/>
            <circle cx="252" cy="51" r="1.8" class="rig-dot"/>
            <circle cx="258" cy="49" r="1.8" class="rig-dot"/>
            <circle cx="264" cy="51" r="1.8" class="rig-dot"/>
            <line x1="234" y1="106" x2="286" y2="52" class="rig-zone-stroke"/>
            <text x="302" y="90" text-anchor="middle" class="rig-svg-lbl-acc">Na↓</text>
          </g>
          <!-- Card 3 (Bottom-Wide): 7-9h Slightly Elevated Sleep -->
          <g class="rig-ptf-sleep">
            <rect x="28" y="148" width="304" height="94" rx="16" class="rig-prop-frame"/>
            <line x1="56" y1="222" x2="214" y2="222" class="rig-axis"/>
            <path d="M62 222 L148 188 L148 222 Z" class="rig-prop"/>
            <circle cx="114" cy="176" r="15" class="rig-line"/>
            <path d="M128 184 L198 214" class="rig-body"/>
            <path d="M72 194 L104 178 M97 177 L105 178 L101 185" class="rig-arrow"/>
            <text x="270" y="198" text-anchor="middle" class="rig-svg-lbl-acc">${E(tr('demo.svg.sleep79', '7–9h'))}</text>
            <circle cx="270" cy="194" r="30" class="rig-breath-ring"/>
          </g>
        `;
      }
    },

    /* ══════════════════════════════════════════════════════════════════
       BATCH 1C: groom-beard (Warm Soften, Grain + 2-Finger Neckline, Cool Soothe)
       ══════════════════════════════════════════════════════════════════ */
    'beard-warm-prep': {
      zoneKey: 'demo.zone.beardWarm',
      zoneFallback: 'Cheek, jawline & neck whisker softening',
      views: ['front', 'profile'],
      phases: ['warm-water', 'soften-45s', 'low-drag'],
      render(view) {
        if (view === 'profile') {
          return `
            <defs>
              <radialGradient id="bwPZone" cx="50%" cy="58%" r="48%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/>
                <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="bwPSkin" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
                <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
              </linearGradient>
            </defs>
            <path d="M90 258 C98 220 116 200 144 194 L152 170 H192 C206 200 218 222 222 258" fill="url(#bwPSkin)" class="rig-body"/>
            <path d="M142 198 C143 170 142 152 138 140 L190 146 L186 198 Z" fill="url(#bwPSkin)"/>
            <path d="M142 196 C143 170 142 152 138 140 M186 196 C187 174 188 158 189 148" class="rig-neck-line"/>
            <path d="${PROF_HEAD_PATH}" fill="url(#bwPSkin)" class="rig-head"/>
            <path d="M165 117 L167 137 Q169 147 184 148 L215 147" class="rig-detail"/>
            <ellipse cx="196" cy="144" rx="34" ry="28" fill="url(#bwPZone)" class="rig-zone-pulse"/>
            <!-- Soft warm water arc waves -->
            <path d="M244 114 Q256 126 244 138 M258 110 Q272 126 258 142" class="rig-zone-stroke rig-bwp-steam"/>
            <!-- Cheek/jaw/neck whisker soften highlight -->
            <path d="M174 118 Q186 142 216 144 Q196 164 182 184" class="rig-zone-stroke rig-bwp-zone"/>
            <text x="272" y="84" text-anchor="middle" class="rig-svg-lbl-acc rig-bwp-45s">${E(tr('demo.svg.sec45', '45s'))}</text>
            <circle cx="272" cy="80" r="20" class="rig-breath-ring rig-bwp-45s"/>
          `;
        }

        // Default: Front warm water prep
        return `
          <defs>
            <radialGradient id="bwFZone" cx="50%" cy="62%" r="46%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="bwFSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <path d="M114 254 C120 222 140 204 160 198 V174 H200 V198 C220 204 240 222 246 254" fill="url(#bwFSkin)" class="rig-body"/>
          <path d="M128 96 C118 96 117 124 128 128 M232 96 C242 96 243 124 232 128" class="rig-line"/>
          <path d="${FRONT_HEAD_PATH}" fill="url(#bwFSkin)" class="rig-head"/>
          <path d="M148 86 Q160 82 171 86 M189 86 Q200 82 212 86" class="rig-detail"/>
          <line x1="152" y1="98" x2="167" y2="98" class="rig-detail"/>
          <line x1="193" y1="98" x2="208" y2="98" class="rig-detail"/>
          <path d="M167 136 Q180 139 193 136" class="rig-detail"/>
          <!-- Lower-face beard & stubble softening aura -->
          <ellipse cx="180" cy="148" rx="44" ry="30" fill="url(#bwFZone)" class="rig-zone-pulse"/>
          <path d="M138 118 Q144 158 180 168 Q216 158 222 118" class="rig-zone-stroke rig-bwf-beardline"/>
          <!-- Warm water droplets & steam waves -->
          <g class="rig-bwf-drops">
            <path d="M116 130 Q122 140 116 146 Q110 140 116 130 Z" class="rig-landmark"/>
            <path d="M244 130 Q250 140 244 146 Q238 140 244 130 Z" class="rig-landmark"/>
            <path d="M92 146 Q102 158 92 170 M268 146 Q258 158 268 170" class="rig-zone-stroke"/>
          </g>
          <!-- 45s warm soften badge -->
          <g class="rig-bwf-timer">
            <circle cx="292" cy="70" r="22" class="rig-breath-ring"/>
            <text x="292" y="74" text-anchor="middle" class="rig-svg-lbl-acc">${E(tr('demo.svg.sec45', '45s'))}</text>
          </g>
        `;
      }
    },

    'beard-grain-neck': {
      zoneKey: 'demo.zone.beardGrain',
      zoneFallback: 'Grain direction & 2-finger neckline above Adam\'s apple',
      views: ['profile', 'front'],
      phases: ['grain-dir', 'two-finger-line', 'light-stroke'],
      render(view) {
        if (view === 'front') {
          return `
            <defs>
              <radialGradient id="bgFZone" cx="50%" cy="62%" r="46%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/>
                <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="bgFSkin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
                <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
              </linearGradient>
            </defs>
            <path d="M114 254 C120 222 140 204 160 198 V174 H200 V198 C220 204 240 222 246 254" fill="url(#bgFSkin)" class="rig-body"/>
            <path d="M128 96 C118 96 117 124 128 128 M232 96 C242 96 243 124 232 128" class="rig-line"/>
            <path d="${FRONT_HEAD_PATH}" fill="url(#bgFSkin)" class="rig-head"/>
            <ellipse cx="180" cy="158" rx="44" ry="30" fill="url(#bgFZone)" class="rig-zone-pulse"/>
            <path d="M148 86 Q160 82 171 86 M189 86 Q200 82 212 86" class="rig-detail"/>
            <line x1="152" y1="98" x2="167" y2="98" class="rig-detail"/>
            <line x1="193" y1="98" x2="208" y2="98" class="rig-detail"/>
            <!-- Adam's apple landmark on anterior neck -->
            <circle cx="180" cy="196" r="5" class="rig-dot rig-bgf-apple"/>
            <!-- 2-Finger U-shaped neckline boundary well above Adam's apple -->
            <path d="M142 132 Q180 184 218 132" class="rig-zone-stroke rig-bgf-neckline"/>
            <!-- Cheek downward grain vectors -->
            <g class="rig-bgf-grain">
              <path d="M142 114 V138 M138 132 L142 140 L146 132" class="rig-arrow"/>
              <path d="M218 114 V138 M214 132 L218 140 L222 132" class="rig-arrow"/>
            </g>
            <!-- Clean razor gliding with grain -->
            <g class="rig-bgf-razor">
              <rect x="208" y="114" width="20" height="7" rx="2.5" class="rig-zone-stroke"/>
              <line x1="218" y1="121" x2="218" y2="146" class="rig-head"/>
            </g>
          `;
        }

        // Default: Profile view with explicit Adam's apple + 2-finger spacing & downward grain arrows
        return `
          <defs>
            <radialGradient id="bgPZone" cx="50%" cy="62%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.44"/>
              <stop offset="68%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="bgPSkin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <path d="M90 258 C98 220 116 200 144 194 L152 170 H192 C206 200 218 222 222 258" fill="url(#bgPSkin)" class="rig-body"/>
          <path d="M142 198 C143 170 142 152 138 140 L190 146 L186 198 Z" fill="url(#bgPSkin)"/>
          <!-- Neckline & Adam's apple notch in profile -->
          <path d="M142 196 C143 170 142 152 138 140 M186 196 L189 182 Q195 178 189 173 L189 148" class="rig-neck-line"/>
          <path d="${PROF_HEAD_PATH}" fill="url(#bgPSkin)" class="rig-head"/>
          <path d="M159 94 C152 94 151 114 159 116" class="rig-detail"/>
          <path d="M206 91 H218" class="rig-detail"/>
          <ellipse cx="192" cy="154" rx="34" ry="30" fill="url(#bgPZone)" class="rig-zone-pulse"/>
          <!-- Adam's apple landmark dot & dashed horizontal reference -->
          <circle cx="191" cy="177" r="4.5" class="rig-dot rig-bgp-apple"/>
          <line x1="191" y1="177" x2="256" y2="177" class="rig-guide-dash rig-bgp-apple"/>
          <!-- Two horizontal fingers spacing guide right above Adam's apple -->
          <g class="rig-bgp-fingers">
            <rect x="220" y="152" width="38" height="10" rx="5" class="rig-hand"/>
            <rect x="220" y="164" width="38" height="10" rx="5" class="rig-hand"/>
            <text x="278" y="166" text-anchor="middle" class="rig-svg-lbl-acc">${E(tr('demo.svg.twoFingers', '2F'))}</text>
          </g>
          <!-- Clean Beard Cheek Line & 2-Finger Neckline Cutoff -->
          <path d="M167 118 Q186 132 215 134" class="rig-detail"/>
          <path d="M164 134 Q174 153 206 152" class="rig-zone-stroke rig-bgp-neckline"/>
          <!-- Hair Grain Growth Vector (downward along cheek & jaw) -->
          <g class="rig-bgp-grain">
            <path d="M180 112 V136 M176 130 L180 138 L184 130" class="rig-arrow"/>
            <path d="M196 116 V140 M192 134 L196 142 L200 134" class="rig-arrow"/>
          </g>
          <!-- Razor Head Light With-Grain Glide -->
          <g class="rig-bgp-razor">
            <rect x="200" y="114" width="20" height="7" rx="2.5" class="rig-zone-stroke"/>
            <line x1="210" y1="121" x2="226" y2="140" class="rig-head"/>
          </g>
        `;
      }
    },

    'beard-cool-soothe': {
      zoneKey: 'demo.zone.beardSoothe',
      zoneFallback: 'Cool rinse, gentle pat & soothing balm',
      views: ['front'],
      phases: ['cool-rinse', 'pat-dry', 'soothe-balm'],
      render() {
        return `
          <defs>
            <radialGradient id="bcFZone" cx="50%" cy="62%" r="46%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.36"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="bcFSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <path d="M114 254 C120 222 140 204 160 198 V174 H200 V198 C220 204 240 222 246 254" fill="url(#bcFSkin)" class="rig-body"/>
          <path d="M128 96 C118 96 117 124 128 128 M232 96 C242 96 243 124 232 128" class="rig-line"/>
          <path d="${FRONT_HEAD_PATH}" fill="url(#bcFSkin)" class="rig-head"/>
          <path d="M148 86 Q160 82 171 86 M189 86 Q200 82 212 86" class="rig-detail"/>
          <line x1="152" y1="98" x2="167" y2="98" class="rig-detail"/>
          <line x1="193" y1="98" x2="208" y2="98" class="rig-detail"/>
          <path d="M167 136 Q180 139 193 136" class="rig-detail"/>
          <ellipse cx="180" cy="152" rx="46" ry="30" fill="url(#bcFZone)" class="rig-relax-aura"/>
          <!-- Phase 0: Cool downward rinse droplets -->
          <g class="rig-bcf-rinse">
            <path d="M138 118 V152 M134 146 L138 154 L142 146" class="rig-arrow"/>
            <path d="M222 118 V152 M218 146 L222 154 L226 146" class="rig-arrow"/>
          </g>
          <!-- Phase 1: Soft folded towel patting cheek gently -->
          <g class="rig-bcf-towel">
            <rect x="86" y="128" width="44" height="32" rx="9" class="rig-hand"/>
            <path d="M108 122 L124 134" class="rig-arrow"/>
          </g>
          <!-- Phase 2: Soothing fragrance-free barrier arc & droplet -->
          <path d="M136 122 Q144 162 180 172 Q216 162 224 122" class="rig-zone-stroke rig-bcf-balm"/>
          <path d="M266 130 Q274 144 266 152 Q258 144 266 130 Z" class="rig-landmark rig-bcf-balm"/>
        `;
      }
    },

    /* ══════════════════════════════════════════════════════════════════
       BATCH 1D: groom-brows (Detailed Brows, Upward Brush, Conservative Cleanup + Safe Trimmer)
       ══════════════════════════════════════════════════════════════════ */
    'brows-brush-assess': {
      zoneKey: 'demo.zone.browsAssess',
      zoneFallback: 'Natural brow arch & upward assessment',
      views: ['front'],
      phases: ['spoolie-up', 'natural-line', 'spot-strays'],
      render() {
        return `
          <defs>
            <radialGradient id="baFZone" cx="50%" cy="46%" r="52%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="baFSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <!-- Macro Upper-Face Brow Frame -->
          <rect x="34" y="34" width="292" height="202" rx="22" fill="url(#baFSkin)" class="rig-prop-frame"/>
          <ellipse cx="180" cy="108" rx="118" ry="44" fill="url(#baFZone)" class="rig-zone-pulse"/>
          <line x1="180" y1="42" x2="180" y2="224" class="rig-axis"/>
          <!-- Nasal bridge & calm symmetric eyes -->
          <path d="M168 122 Q166 164 156 184 Q180 198 204 184 Q194 164 192 122" class="rig-detail"/>
          <path d="M74 148 Q106 132 140 148 Q106 162 74 148 Z" class="rig-line"/>
          <circle cx="107" cy="148" r="10" class="rig-detail"/>
          <path d="M220 148 Q254 132 286 148 Q254 162 220 148 Z" class="rig-line"/>
          <circle cx="253" cy="148" r="10" class="rig-detail"/>
          <!-- Detailed multi-stroke brow hairs (Left & Right) -->
          <g class="rig-head">
            <path d="M62 114 L68 96 M74 110 L82 90 M86 106 L96 86 M98 104 L110 84 M112 104 L124 88 M126 108 L136 94 M138 112 L146 98" class="rig-line"/>
            <path d="M298 114 L292 96 M286 110 L278 90 M274 106 L264 86 M262 104 L250 84 M248 104 L236 88 M234 108 L224 94 M222 112 L214 98" class="rig-line"/>
          </g>
          <!-- Natural Top Arch Guide Curve -->
          <path d="M64 96 Q112 78 148 98" class="rig-zone-stroke rig-baf-line"/>
          <path d="M296 96 Q248 78 212 98" class="rig-zone-stroke rig-baf-line"/>
          <!-- Overlong stray tips slightly above arch -->
          <g class="rig-baf-strays">
            <line x1="94" y1="84" x2="97" y2="75" class="rig-zone-stroke"/>
            <line x1="112" y1="82" x2="115" y2="73" class="rig-zone-stroke"/>
            <circle cx="97" cy="75" r="4" class="rig-dot"/>
            <circle cx="115" cy="73" r="4" class="rig-dot"/>
          </g>
          <!-- Upward spoolie wand motion -->
          <g class="rig-baf-spoolie">
            <rect x="234" y="96" width="24" height="8" rx="3" class="rig-zone-stroke"/>
            <line x1="258" y1="100" x2="310" y2="100" class="rig-head"/>
            <path d="M246 88 V62 M241 69 L246 60 L251 69" class="rig-arrow"/>
          </g>
        `;
      }
    },

    'brows-cleanup': {
      zoneKey: 'demo.zone.browsCleanup',
      zoneFallback: 'Glabella center, under-arch & safe rounded trimmer',
      views: ['front'],
      phases: ['glabella-center', 'below-arch', 'rounded-trimmer'],
      render() {
        return `
          <defs>
            <radialGradient id="bnFZone" cx="50%" cy="44%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.36"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="bnFSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <!-- Left Panel: Conservative Glabella & Under-Arch Stray Zones -->
          <g class="rig-bnf-brows">
            <rect x="22" y="28" width="206" height="214" rx="16" fill="url(#bnFSkin)" class="rig-prop-frame"/>
            <ellipse cx="125" cy="108" rx="76" ry="38" fill="url(#bnFZone)" class="rig-zone-pulse"/>
            <!-- Intact Natural Brows -->
            <path d="M40 108 Q76 80 104 102 Q76 96 40 108 Z" class="rig-head"/>
            <path d="M210 102 Q174 80 146 102 Q174 96 210 102 Z" class="rig-head"/>
            <!-- Eyes -->
            <ellipse cx="74" cy="144" rx="22" ry="9" class="rig-detail"/>
            <ellipse cx="176" cy="144" rx="22" ry="9" class="rig-detail"/>
            <!-- Phase 0: Glabella center safe zone -->
            <rect x="111" y="88" width="28" height="24" rx="7" class="rig-zone-stroke rig-bnf-glabella"/>
            <line x1="121" y1="95" x2="122" y2="105" class="rig-detail rig-bnf-glabella"/>
            <line x1="129" y1="96" x2="128" y2="106" class="rig-detail rig-bnf-glabella"/>
            <!-- Phase 1: Well below the natural arch -->
            <ellipse cx="74" cy="116" rx="22" ry="7" class="rig-zone-stroke rig-bnf-under"/>
            <ellipse cx="176" cy="116" rx="22" ry="7" class="rig-zone-stroke rig-bnf-under"/>
            <!-- Conservative tweezers -->
            <path d="M125 60 L122 86 M125 60 L128 86" class="rig-landmark rig-bnf-tweeze"/>
          </g>
          <!-- Right Panel: Rounded-Tip Trimmer for Nose / Ears Safety -->
          <g class="rig-bnf-trimmer">
            <rect x="240" y="28" width="98" height="214" rx="16" class="rig-prop-frame"/>
            <!-- Nostril/Ear safe perimeter contour -->
            <path d="M270 96 C270 76 308 76 308 96 C308 112 296 118 289 118 C282 118 270 112 270 96 Z" class="rig-line"/>
            <!-- Rounded-tip rotary trimmer head (NOT sharp tweezers) -->
            <rect x="279" y="138" width="20" height="62" rx="8" class="rig-hand"/>
            <circle cx="289" cy="126" r="10" class="rig-zone-stroke rig-bnf-tip"/>
            <circle cx="289" cy="126" r="4" class="rig-dot rig-bnf-tip"/>
            <text x="289" y="224" text-anchor="middle" class="rig-svg-lbl-acc">${E(tr('demo.svg.safe', 'SAFE'))}</text>
          </g>
        `;
      }
    },

    'brows-sanitize': {
      zoneKey: 'demo.zone.browsSanitize',
      zoneFallback: 'Tweezers & trimmer metal sanitation',
      views: ['front'],
      phases: ['inspect-tools', 'alcohol-wipe', 'clean-metal'],
      render() {
        return `
          <defs>
            <radialGradient id="btFZone" cx="50%" cy="48%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.36"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect x="34" y="28" width="292" height="214" rx="18" class="rig-prop-frame"/>
          <ellipse cx="180" cy="126" rx="92" ry="62" fill="url(#btFZone)" class="rig-zone-pulse"/>
          <!-- Tool 1: Slanted Steel Tweezers -->
          <g class="rig-btf-tools">
            <path d="M98 188 L114 78 L120 78 L110 188" class="rig-head"/>
            <path d="M138 188 L124 78 L118 78 L128 188" class="rig-head"/>
            <rect x="108" y="68" width="22" height="24" rx="5" class="rig-zone-stroke rig-btf-tips"/>
            <!-- Tool 2: Rounded Trimmer Head & Body -->
            <rect x="220" y="104" width="32" height="86" rx="10" class="rig-hand"/>
            <circle cx="236" cy="86" r="14" class="rig-zone-stroke rig-btf-tips"/>
            <line x1="230" y1="86" x2="242" y2="86" class="rig-landmark"/>
          </g>
          <!-- Phase 1: Alcohol Cotton Wipe Sweeping Across Metal Tips -->
          <g class="rig-btf-wipe">
            <rect x="150" y="64" width="56" height="32" rx="10" class="rig-hand"/>
            <path d="M142 80 H216" class="rig-arrow"/>
          </g>
          <!-- Phase 2: Clean Sterile Sparkle Gleams -->
          <g class="rig-btf-clean">
            <path d="M119 42 V54 M113 48 H125" class="rig-zone-stroke"/>
            <path d="M236 42 V54 M230 48 H242" class="rig-zone-stroke"/>
            <text x="180" y="222" text-anchor="middle" class="rig-svg-lbl-acc">${E(tr('demo.svg.alcohol', 'ALCOHOL'))}</text>
          </g>
        `;
      }
    },

    /* ══════════════════════════════════════════════════════════════════
       BATCH 1E: skin-routine (60s Cleanse, Pat + Moisturize, AM SPF / PM Rest + 1-Product Rule)
       ══════════════════════════════════════════════════════════════════ */
    'skin-cleanse-60': {
      zoneKey: 'demo.zone.skinCleanse',
      zoneFallback: '60s circular cleanse & lukewarm rinse',
      views: ['front'],
      phases: ['damp-skin', 'circles-60s', 'lukewarm-rinse'],
      render() {
        return `
          <defs>
            <radialGradient id="scFZone" cx="50%" cy="48%" r="46%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="scFSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <path d="M114 254 C120 222 140 204 160 198 V174 H200 V198 C220 204 240 222 246 254" fill="url(#scFSkin)" class="rig-body"/>
          <path d="M128 96 C118 96 117 124 128 128 M232 96 C242 96 243 124 232 128" class="rig-line"/>
          <path d="${FRONT_HEAD_PATH}" fill="url(#scFSkin)" class="rig-head"/>
          <ellipse cx="180" cy="102" rx="46" ry="58" fill="url(#scFZone)" class="rig-zone-pulse"/>
          <path d="M148 86 Q160 82 171 86 M189 86 Q200 82 212 86" class="rig-detail"/>
          <ellipse cx="158" cy="96" rx="9" ry="5" class="rig-detail"/>
          <ellipse cx="202" cy="96" rx="9" ry="5" class="rig-detail"/>
          <path d="M167 136 Q180 139 193 136" class="rig-detail"/>
          <!-- Phase 0: Pre-damp droplets -->
          <g class="rig-scf-damp">
            <path d="M180 50 Q186 59 180 65 Q174 59 180 50 Z" class="rig-landmark"/>
            <path d="M146 124 Q152 133 146 139 Q140 133 146 124 Z" class="rig-landmark"/>
            <path d="M214 124 Q220 133 214 139 Q208 133 214 124 Z" class="rig-landmark"/>
          </g>
          <!-- Phase 1: Soft circular fingertip orbits across cheeks & forehead -->
          <g class="rig-scf-circles">
            <circle cx="152" cy="116" r="14" class="rig-zone-stroke rig-scf-orbit-l"/>
            <circle cx="208" cy="116" r="14" class="rig-zone-stroke rig-scf-orbit-r"/>
            <circle cx="180" cy="58" r="11" class="rig-zone-stroke"/>
            <text x="292" y="68" text-anchor="middle" class="rig-svg-lbl-acc">${E(tr('demo.svg.sec60', '60s'))}</text>
            <circle cx="292" cy="64" r="21" class="rig-breath-ring"/>
          </g>
          <!-- Phase 2: Gentle lukewarm rinse down face -->
          <g class="rig-scf-rinse">
            <path d="M138 148 V184 M134 178 L138 186 L142 178" class="rig-arrow"/>
            <path d="M222 148 V184 M218 178 L222 186 L226 178" class="rig-arrow"/>
          </g>
        `;
      }
    },

    'skin-pat-moisturize': {
      zoneKey: 'demo.zone.skinMoisturize',
      zoneFallback: 'Towel pat & damp barrier hydration',
      views: ['front'],
      phases: ['gentle-pat', 'damp-skin', 'seal-barrier'],
      render() {
        return `
          <defs>
            <radialGradient id="smFZone" cx="50%" cy="50%" r="48%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.38"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="smFSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--rig-fill-hi)"/>
              <stop offset="100%" stop-color="var(--rig-fill-lo)"/>
            </linearGradient>
          </defs>
          <path d="M114 254 C120 222 140 204 160 198 V174 H200 V198 C220 204 240 222 246 254" fill="url(#smFSkin)" class="rig-body"/>
          <path d="M128 96 C118 96 117 124 128 128 M232 96 C242 96 243 124 232 128" class="rig-line"/>
          <path d="${FRONT_HEAD_PATH}" fill="url(#smFSkin)" class="rig-head"/>
          <ellipse cx="180" cy="104" rx="46" ry="58" fill="url(#smFZone)" class="rig-zone-pulse"/>
          <path d="M148 86 Q160 82 171 86 M189 86 Q200 82 212 86" class="rig-detail"/>
          <ellipse cx="158" cy="96" rx="9" ry="5" class="rig-detail"/>
          <ellipse cx="202" cy="96" rx="9" ry="5" class="rig-detail"/>
          <path d="M167 136 Q180 139 193 136" class="rig-detail"/>
          <!-- Phase 0: Clean soft towel patting cheek lightly (no harsh rub) -->
          <g class="rig-smf-towel">
            <rect x="76" y="102" width="44" height="36" rx="10" class="rig-hand"/>
            <path d="M122 120 H138 M132 115 L140 120 L132 125" class="rig-arrow"/>
          </g>
          <!-- Phase 1: Slightly damp hydration shimmer drops -->
          <g class="rig-smf-damp">
            <circle cx="152" cy="116" r="4.5" class="rig-dot"/>
            <circle cx="208" cy="116" r="4.5" class="rig-dot"/>
            <circle cx="180" cy="56" r="4.5" class="rig-dot"/>
          </g>
          <!-- Phase 2: Protective moisturizer barrier seal contour -->
          <path d="M132 76 C132 42 228 42 228 76 C228 134 206 168 180 168 C154 168 132 134 132 76 Z" class="rig-zone-stroke rig-smf-seal"/>
        `;
      }
    },

    'skin-am-pm-finish': {
      zoneKey: 'demo.zone.skinAmPm',
      zoneFallback: 'AM SPF 30+, PM rest & 1-product discipline',
      views: ['front'],
      phases: ['am-spf', 'pm-rest', 'one-product'],
      render() {
        return `
          <defs>
            <radialGradient id="sfFZone" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34"/>
              <stop offset="70%" stop-color="var(--accent)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <!-- Left Card: AM Routine -> Broad-Spectrum SPF 30+ Shield -->
          <g class="rig-sff-am">
            <rect x="26" y="26" width="146" height="148" rx="16" class="rig-prop-frame"/>
            <ellipse cx="99" cy="100" rx="50" ry="50" fill="url(#sfFZone)" class="rig-zone-pulse"/>
            <text x="54" y="50" text-anchor="middle" class="rig-svg-lbl-acc">${E(tr('demo.svg.am', 'AM'))}</text>
            <!-- Sun UV rays + Shield icon -->
            <circle cx="144" cy="46" r="8" class="rig-landmark"/>
            <path d="M99 66 L132 78 V102 C132 122 118 136 99 144 C80 136 66 122 66 102 V78 Z" class="rig-zone-stroke"/>
            <text x="99" y="102" text-anchor="middle" class="rig-svg-lbl">SPF</text>
            <text x="99" y="118" text-anchor="middle" class="rig-svg-lbl-acc">30+</text>
          </g>
          <!-- Right Card: PM Routine -> Cleanse + Barrier Rest (No extra actives needed) -->
          <g class="rig-sff-pm">
            <rect x="188" y="26" width="146" height="148" rx="16" class="rig-prop-frame"/>
            <text x="218" y="50" text-anchor="middle" class="rig-svg-lbl-acc">${E(tr('demo.svg.pm', 'PM'))}</text>
            <!-- Crescent moon + Rested Barrier Face -->
            <path d="M306 38 A10 10 0 1 0 318 50 A8 8 0 1 1 306 38 Z" class="rig-landmark"/>
            <ellipse cx="261" cy="106" rx="28" ry="36" class="rig-line"/>
            <ellipse cx="261" cy="106" rx="35" ry="42" class="rig-zone-stroke rig-sff-barrier"/>
            <path d="M248 98 Q254 102 258 98 M264 98 Q270 102 274 98" class="rig-detail"/>
            <path d="M254 120 Q261 122 268 120" class="rig-detail"/>
          </g>
          <!-- Bottom Strip: 1 New Product At A Time (2-Week Rule) -->
          <g class="rig-sff-rule">
            <rect x="26" y="186" width="308" height="58" rx="14" class="rig-prop-frame"/>
            <circle cx="64" cy="215" r="16" class="rig-zone-stroke"/>
            <text x="64" y="220" text-anchor="middle" class="rig-svg-lbl-acc">+1</text>
            <path d="M96 215 H238 M231 210 L240 215 L231 220" class="rig-arrow"/>
            <text x="287" y="220" text-anchor="middle" class="rig-svg-lbl">${E(tr('demo.svg.twoWeeks', '2 WK'))}</text>
          </g>
        `;
      }
    }
  };

  LM.DemoEngine = {
    hasRich(rigId) {
      return !!(rigId && REGS[rigId]);
    },
    viewsFor(step) {
      const rigId = step && step.rig && step.rig.id;
      const r = rigId && REGS[rigId];
      if (r && r.views && r.views.length) return r.views.slice();
      if (step && step.rig && step.rig.views && step.rig.views.length) return step.rig.views.slice();
      return ['front'];
    },
    defaultViewFor(step) {
      return this.viewsFor(step)[0];
    },
    resolveView(step, preferred) {
      const views = this.viewsFor(step);
      return preferred && views.indexOf(preferred) >= 0 ? preferred : views[0];
    },
    phasesFor(rigId) {
      const r = rigId && REGS[rigId];
      return r && Array.isArray(r.phases) ? r.phases.slice() : [];
    },
    validatePhases(practices) {
      const issues = [];
      let checkedRigs = 0;
      const map = practices || LM.PRACTICES || {};
      Object.keys(map).forEach(gid => {
        const pr = map[gid];
        if (!pr || !Array.isArray(pr.steps)) return;
        pr.steps.forEach((st, idx) => {
          if (!st || !st.rig || !st.rig.id) return;
          const r = REGS[st.rig.id];
          checkedRigs += 1;
          if (!r) { issues.push({ guide: gid, step: idx, rigId: st.rig.id, reason: 'missing rig' }); return; }
          const expected = Array.isArray(st.phases) ? st.phases.length : 0;
          const registered = Array.isArray(r.phases) ? r.phases.length : 0;
          if (expected !== registered) {
            issues.push({ guide: gid, step: idx, rigId: st.rig.id, reason: 'phase count mismatch', expected, registered });
          }
        });
      });
      return { ok: issues.length === 0, checkedRigs, issues };
    },
    zoneLabel(step) {
      const rigId = step && step.rig && step.rig.id;
      const r = rigId && REGS[rigId];
      if (!r) return '';
      return tr(r.zoneKey, r.zoneFallback);
    },
    render(step, opts) {
      opts = opts || {};
      const rigId = step && step.rig && step.rig.id;
      const r = rigId && REGS[rigId];
      if (!r) {
        return LM.demoSVG(step ? step.demo : 'box-breath', !!opts.paused);
      }
      const view = this.resolveView(step, opts.view);
      const phase = (opts.phase === 0 || opts.phase === 1 || opts.phase === 2) ? opts.phase : 'all';
      const paused = !!opts.paused;
      const cls = [
        'demo-stage',
        'demo-stage-rich',
        'rig-' + rigId,
        'view-' + view,
        phase === 'all' ? 'phase-all' : 'phase-' + phase,
        paused ? 'paused' : ''
      ].filter(Boolean).join(' ');
      const animKey = Number(opts.animKey) || 0;
      const zoneText = tr(r.zoneKey, r.zoneFallback);
      const phaseLabel = phase !== 'all'
        ? (step.phases && step.phases[phase]
          ? tr('demo.phaseInspect', 'Phase {n}').replace('{n}', String(phase + 1)) + ' · ' + step.phases[phase]
          : tr('demo.phaseInspect', 'Phase {n}').replace('{n}', String(phase + 1)))
        : '';
      const statusPill = phase !== 'all'
        ? (paused ? phaseLabel + ' · ' + tr('practice.statusPaused', 'Paused') : phaseLabel)
        : (paused ? tr('practice.statusPaused', 'Paused') : tr('demo.liveTechnique', 'Technique loop'));

      return '<div class="' + cls + '" data-anim-key="' + animKey + '">' +
        '<div class="demo-stage-top">' +
          '<span class="demo-state-lbl">' + E(statusPill) + '</span>' +
        '</div>' +
        '<svg class="demo-svg demo-svg-rich" viewBox="0 0 360 270" aria-hidden="true">' +
          r.render(view, phase) +
        '</svg>' +
        '<div class="demo-stage-foot">' +
          '<span class="demo-zone-lbl">' + E(tr('demo.targetZone', 'Target zone')) + ': <b>' + E(zoneText) + '</b></span>' +
        '</div>' +
      '</div>';
    }
  };
})();
