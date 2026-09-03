/**
 * Procedural High-Quality Vector Artwork Generator for Puzzles & Memory Cards
 * Generates rich, distinct, full-color vector illustrations for any theme or subject.
 */

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateProceduralPuzzleArtwork(prompt: string, style: string = "Desenho infantil"): string {
  const rawPrompt = (prompt || "").trim();
  const p = rawPrompt.toLowerCase();
  const seed = stringToSeed(rawPrompt);

  let bgGradient: [string, string, string] = ["#1e1b4b", "#4338ca", "#6366f1"];
  let mainGraphic = "";
  let badgeLabel = "";

  // 1. EASTER & EGGS (Multiple rich varieties based on prompt)
  if (p.includes("ovo") || p.includes("páscoa") || p.includes("pascoa") || p.includes("easter")) {
    const isPink = p.includes("rosa") || p.includes("floral") || (seed % 3 === 0);
    const isBlue = p.includes("azul") || p.includes("estrel") || (seed % 3 === 1);
    const isGold = p.includes("dourad") || p.includes("ouro") || (seed % 3 === 2);

    bgGradient = isPink 
      ? ["#fdf2f8", "#fce7f3", "#f472b6"]
      : isBlue 
      ? ["#ecfeff", "#cffafe", "#38bdf8"]
      : ["#fefce8", "#fef08a", "#f59e0b"];

    const eggColor1 = isPink ? "#ec4899" : isBlue ? "#0284c7" : "#d97706";
    const eggColor2 = isPink ? "#f43f5e" : isBlue ? "#06b6d4" : "#fbbf24";
    const ribbonColor = isGold ? "#fef08a" : isPink ? "#fef08a" : "#f472b6";

    mainGraphic = `
      <!-- EASTER EGG -->
      <defs>
        <radialGradient id="eggGrad_${seed}" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8" />
          <stop offset="50%" stop-color="${eggColor2}" />
          <stop offset="100%" stop-color="${eggColor1}" />
        </radialGradient>
      </defs>
      <!-- Sparkles / Glow -->
      <circle cx="250" cy="250" r="190" fill="#ffffff" opacity="0.4" />
      <g id="eggArt">
        <!-- Egg Body -->
        <path d="M 250 70 C 170 70, 110 180, 110 280 C 110 380, 170 430, 250 430 C 330 430, 390 380, 390 280 C 390 180, 330 70, 250 70 Z" 
              fill="url(#eggGrad_${seed})" stroke="#3f3f46" stroke-width="5" />
        
        <!-- Decorative bands -->
        <path d="M 125 210 Q 250 235 375 210 Q 250 260 125 210 Z" fill="#fbbf24" opacity="0.95" />
        <path d="M 112 280 Q 250 310 388 280 Q 250 335 112 280 Z" fill="#38bdf8" opacity="0.9" />
        <path d="M 135 350 Q 250 380 365 350 Q 250 400 135 350 Z" fill="#a855f7" opacity="0.9" />
        
        <!-- Polka Dots -->
        <circle cx="190" cy="160" r="10" fill="#ffffff" opacity="0.8" />
        <circle cx="310" cy="160" r="10" fill="#ffffff" opacity="0.8" />
        <circle cx="250" cy="180" r="14" fill="#ffffff" opacity="0.9" />
        <circle cx="180" cy="310" r="8" fill="#ffffff" />
        <circle cx="250" cy="310" r="8" fill="#ffffff" />
        <circle cx="320" cy="310" r="8" fill="#ffffff" />

        <!-- Festive Bow -->
        <g transform="translate(250, 240)">
          <path d="M 0 0 C -40 -30, -60 10, -15 25 C -60 40, -40 80, 0 35 C 40 80, 60 40, 15 25 C 60 10, 40 -30, 0 0 Z" fill="${ribbonColor}" stroke="#b45309" stroke-width="3" />
          <circle cx="0" cy="25" r="14" fill="#f59e0b" stroke="#78350f" stroke-width="2" />
        </g>
      </g>
    `;
    badgeLabel = "Páscoa";
  }

  // 2. RABBIT / BUNNY
  else if (p.includes("coelh") || p.includes("bunny") || p.includes("rabbit")) {
    bgGradient = ["#fce7f3", "#fbcfe8", "#f472b6"];
    mainGraphic = `
      <!-- CUTE RABBIT -->
      <!-- Ears -->
      <ellipse cx="190" cy="140" rx="30" ry="85" fill="#ffffff" stroke="#e11d48" stroke-width="4" transform="rotate(-10 190 140)" />
      <ellipse cx="190" cy="140" rx="16" ry="60" fill="#fda4af" transform="rotate(-10 190 140)" />
      <ellipse cx="310" cy="140" rx="30" ry="85" fill="#ffffff" stroke="#e11d48" stroke-width="4" transform="rotate(10 310 140)" />
      <ellipse cx="310" cy="140" rx="16" ry="60" fill="#fda4af" transform="rotate(10 310 140)" />
      
      <!-- Head -->
      <ellipse cx="250" cy="270" rx="110" ry="95" fill="#ffffff" stroke="#e11d48" stroke-width="4" />
      <!-- Cheeks -->
      <circle cx="170" cy="285" r="18" fill="#fda4af" opacity="0.7" />
      <circle cx="330" cy="285" r="18" fill="#fda4af" opacity="0.7" />
      <!-- Big Eyes -->
      <ellipse cx="205" cy="250" rx="14" ry="20" fill="#18181b" />
      <circle cx="200" cy="242" r="6" fill="#ffffff" />
      <ellipse cx="295" cy="250" rx="14" ry="20" fill="#18181b" />
      <circle cx="290" cy="242" r="6" fill="#ffffff" />
      <!-- Cute Nose & Mouth -->
      <polygon points="242,275 258,275 250,285" fill="#f43f5e" />
      <path d="M 250 285 Q 238 298 226 288 M 250 285 Q 262 298 274 288" fill="none" stroke="#be123c" stroke-width="3.5" stroke-linecap="round" />
      <!-- Whiskers -->
      <line x1="140" y1="275" x2="190" y2="280" stroke="#fb7185" stroke-width="2.5" stroke-linecap="round" />
      <line x1="140" y1="290" x2="190" y2="290" stroke="#fb7185" stroke-width="2.5" stroke-linecap="round" />
      <line x1="310" y1="280" x2="360" y2="275" stroke="#fb7185" stroke-width="2.5" stroke-linecap="round" />
      <line x1="310" y1="290" x2="360" y2="290" stroke="#fb7185" stroke-width="2.5" stroke-linecap="round" />
      <!-- Carrot accessory -->
      <g transform="translate(250, 370) rotate(-15)">
        <polygon points="0,0 -15,-60 15,-60" fill="#f97316" stroke="#c2410c" stroke-width="3" />
        <path d="M -15 -60 Q -25 -80 -10 -85 Q 0 -60 0 -60 Q 10 -85 20 -75 Q 15 -60 15 -60" fill="#22c55e" />
      </g>
    `;
    badgeLabel = "Coelho";
  }

  // 3. LION / SAFARI
  else if (p.includes("leão") || p.includes("leao") || p.includes("lion")) {
    bgGradient = ["#fef08a", "#fdba74", "#f97316"];
    mainGraphic = `
      <!-- LION -->
      <circle cx="250" cy="240" r="140" fill="#ea580c" />
      <circle cx="250" cy="240" r="125" fill="#f97316" />
      <circle cx="250" cy="240" r="90" fill="#fde047" stroke="#ca8a04" stroke-width="5" />
      <!-- Ears -->
      <circle cx="170" cy="165" r="28" fill="#fde047" stroke="#ca8a04" stroke-width="5" />
      <circle cx="170" cy="165" r="15" fill="#f43f5e" />
      <circle cx="330" cy="165" r="28" fill="#fde047" stroke="#ca8a04" stroke-width="5" />
      <circle cx="330" cy="165" r="15" fill="#f43f5e" />
      <!-- Eyes -->
      <ellipse cx="215" cy="225" rx="13" ry="18" fill="#18181b" />
      <circle cx="211" cy="218" r="5" fill="#ffffff" />
      <ellipse cx="285" cy="225" rx="13" ry="18" fill="#18181b" />
      <circle cx="281" cy="218" r="5" fill="#ffffff" />
      <!-- Snout -->
      <ellipse cx="250" cy="265" rx="30" ry="22" fill="#ffffff" />
      <polygon points="238,252 262,252 250,265" fill="#713f12" />
      <path d="M 250 265 L 250 278 M 250 278 Q 240 286 232 278 M 250 278 Q 260 286 268 278" fill="none" stroke="#713f12" stroke-width="4" stroke-linecap="round" />
    `;
    badgeLabel = "Leão";
  }

  // 4. ELEPHANT
  else if (p.includes("elefante") || p.includes("elephant")) {
    bgGradient = ["#e0f2fe", "#bae6fd", "#7dd3fc"];
    mainGraphic = `
      <!-- ELEPHANT -->
      <!-- Big Ears -->
      <ellipse cx="140" cy="230" rx="70" ry="75" fill="#94a3b8" stroke="#475569" stroke-width="5" />
      <ellipse cx="140" cy="230" rx="45" ry="50" fill="#cbd5e1" />
      <ellipse cx="360" cy="230" rx="70" ry="75" fill="#94a3b8" stroke="#475569" stroke-width="5" />
      <ellipse cx="360" cy="230" rx="45" ry="50" fill="#cbd5e1" />
      <!-- Head -->
      <circle cx="250" cy="240" r="95" fill="#94a3b8" stroke="#475569" stroke-width="5" />
      <!-- Eyes -->
      <circle cx="205" cy="215" r="12" fill="#0f172a" />
      <circle cx="202" cy="210" r="5" fill="#ffffff" />
      <circle cx="295" cy="215" r="12" fill="#0f172a" />
      <circle cx="292" cy="210" r="5" fill="#ffffff" />
      <!-- Trunk -->
      <path d="M 235 240 C 235 320, 210 350, 240 370 C 265 385, 290 350, 270 330 C 255 315, 265 240, 265 240" fill="#94a3b8" stroke="#475569" stroke-width="5" />
      <!-- Cheeks -->
      <circle cx="180" cy="255" r="15" fill="#f472b6" opacity="0.6" />
      <circle cx="320" cy="255" r="15" fill="#f472b6" opacity="0.6" />
    `;
    badgeLabel = "Elefante";
  }

  // 5. GIRAFFE
  else if (p.includes("girafa") || p.includes("giraffe")) {
    bgGradient = ["#fef9c3", "#fde047", "#eab308"];
    mainGraphic = `
      <!-- GIRAFFE -->
      <!-- Horns -->
      <line x1="220" y1="140" x2="210" y2="90" stroke="#854d0e" stroke-width="8" stroke-linecap="round" />
      <circle cx="210" cy="85" r="12" fill="#713f12" />
      <line x1="280" y1="140" x2="290" y2="90" stroke="#854d0e" stroke-width="8" stroke-linecap="round" />
      <circle cx="290" cy="85" r="12" fill="#713f12" />
      <!-- Ears -->
      <ellipse cx="165" cy="150" rx="35" ry="18" fill="#fde047" stroke="#a16207" stroke-width="4" transform="rotate(-20 165 150)" />
      <ellipse cx="335" cy="150" rx="35" ry="18" fill="#fde047" stroke="#a16207" stroke-width="4" transform="rotate(20 335 150)" />
      <!-- Head & Neck -->
      <path d="M 215 380 L 215 240 C 190 220, 190 140, 250 140 C 310 140, 310 220, 285 240 L 285 380 Z" fill="#fde047" stroke="#a16207" stroke-width="5" />
      <!-- Spots -->
      <circle cx="250" cy="280" r="18" fill="#a16207" />
      <circle cx="235" cy="330" r="14" fill="#a16207" />
      <circle cx="265" cy="355" r="12" fill="#a16207" />
      <!-- Eyes -->
      <circle cx="225" cy="180" r="10" fill="#0f172a" />
      <circle cx="222" cy="177" r="4" fill="#ffffff" />
      <circle cx="275" cy="180" r="10" fill="#0f172a" />
      <circle cx="272" cy="177" r="4" fill="#ffffff" />
      <!-- Snout -->
      <ellipse cx="250" cy="225" rx="35" ry="25" fill="#fef08a" stroke="#a16207" stroke-width="3" />
      <circle cx="240" cy="225" r="4" fill="#713f12" />
      <circle cx="260" cy="225" r="4" fill="#713f12" />
    `;
    badgeLabel = "Girafa";
  }

  // 6. COW / FARM
  else if (p.includes("vaca") || p.includes("cow") || p.includes("boi")) {
    bgGradient = ["#dcfce7", "#86efac", "#22c55e"];
    mainGraphic = `
      <!-- COW -->
      <!-- Horns -->
      <path d="M 180 160 C 160 110, 140 120, 140 130 C 150 150, 180 170, 180 170" fill="#e2e8f0" stroke="#475569" stroke-width="4" />
      <path d="M 320 160 C 340 110, 360 120, 360 130 C 350 150, 320 170, 320 170" fill="#e2e8f0" stroke="#475569" stroke-width="4" />
      <!-- Ears -->
      <ellipse cx="140" cy="190" rx="35" ry="20" fill="#ffffff" stroke="#0f172a" stroke-width="4" transform="rotate(-15 140 190)" />
      <ellipse cx="360" cy="190" rx="35" ry="20" fill="#ffffff" stroke="#0f172a" stroke-width="4" transform="rotate(15 360 190)" />
      <!-- Head -->
      <ellipse cx="250" cy="220" rx="90" ry="80" fill="#ffffff" stroke="#0f172a" stroke-width="5" />
      <!-- Black Spots -->
      <path d="M 190 155 Q 230 170 200 210 Q 165 190 190 155 Z" fill="#0f172a" />
      <path d="M 300 170 Q 340 180 320 220 Q 280 210 300 170 Z" fill="#0f172a" />
      <!-- Eyes -->
      <circle cx="210" cy="205" r="11" fill="#0f172a" />
      <circle cx="207" cy="201" r="4" fill="#ffffff" />
      <circle cx="290" cy="205" r="11" fill="#0f172a" />
      <circle cx="287" cy="201" r="4" fill="#ffffff" />
      <!-- Big Pink Muzzle -->
      <ellipse cx="250" cy="275" rx="65" ry="45" fill="#fbcfe8" stroke="#db2777" stroke-width="4" />
      <circle cx="230" cy="275" r="8" fill="#831843" />
      <circle cx="270" cy="275" r="8" fill="#831843" />
      <path d="M 235 295 Q 250 305 265 295" fill="none" stroke="#831843" stroke-width="3.5" stroke-linecap="round" />
    `;
    badgeLabel = "Vaca";
  }

  // 7. PIG / PIGLET
  else if (p.includes("porco") || p.includes("porquinho") || p.includes("pig")) {
    bgGradient = ["#fdf2f8", "#fce7f3", "#f472b6"];
    mainGraphic = `
      <!-- PIG -->
      <!-- Ears -->
      <polygon points="170,160 140,90 210,130" fill="#f472b6" stroke="#db2777" stroke-width="4" />
      <polygon points="330,160 360,90 290,130" fill="#f472b6" stroke="#db2777" stroke-width="4" />
      <!-- Head -->
      <circle cx="250" cy="240" r="100" fill="#fbcfe8" stroke="#db2777" stroke-width="5" />
      <!-- Cheeks -->
      <circle cx="175" cy="255" r="16" fill="#f43f5e" opacity="0.6" />
      <circle cx="325" cy="255" r="16" fill="#f43f5e" opacity="0.6" />
      <!-- Eyes -->
      <ellipse cx="210" cy="215" rx="10" ry="14" fill="#18181b" />
      <circle cx="207" cy="210" r="4" fill="#ffffff" />
      <ellipse cx="290" cy="215" rx="10" ry="14" fill="#18181b" />
      <circle cx="287" cy="210" r="4" fill="#ffffff" />
      <!-- Snout -->
      <ellipse cx="250" cy="265" rx="42" ry="32" fill="#f472b6" stroke="#db2777" stroke-width="4" />
      <ellipse cx="236" cy="265" rx="6" ry="10" fill="#831843" />
      <ellipse cx="264" cy="265" rx="6" ry="10" fill="#831843" />
    `;
    badgeLabel = "Porquinho";
  }

  // 8. DOG / PUPPY
  else if (p.includes("cachorro") || p.includes("cão") || p.includes("cao") || p.includes("dog") || p.includes("filhote")) {
    bgGradient = ["#fef3c7", "#fde68a", "#f59e0b"];
    mainGraphic = `
      <!-- DOG -->
      <!-- Floppy Ears -->
      <ellipse cx="140" cy="220" rx="35" ry="65" fill="#78350f" stroke="#451a03" stroke-width="4" transform="rotate(20 140 220)" />
      <ellipse cx="360" cy="220" rx="35" ry="65" fill="#78350f" stroke="#451a03" stroke-width="4" transform="rotate(-20 360 220)" />
      <!-- Head -->
      <circle cx="250" cy="230" r="95" fill="#d97706" stroke="#78350f" stroke-width="5" />
      <!-- Patch over eye -->
      <ellipse cx="210" cy="205" rx="28" ry="32" fill="#78350f" />
      <!-- Eyes -->
      <circle cx="210" cy="205" r="11" fill="#ffffff" />
      <circle cx="210" cy="205" r="7" fill="#000000" />
      <circle cx="290" cy="205" r="11" fill="#18181b" />
      <circle cx="287" cy="201" r="4" fill="#ffffff" />
      <!-- Muzzle -->
      <ellipse cx="250" cy="265" rx="45" ry="35" fill="#fef3c7" stroke="#78350f" stroke-width="3" />
      <ellipse cx="250" cy="250" rx="16" ry="12" fill="#18181b" />
      <path d="M 250 262 L 250 275 M 250 275 Q 235 285 225 275 M 250 275 Q 265 285 275 275" fill="none" stroke="#18181b" stroke-width="3.5" stroke-linecap="round" />
      <!-- Tongue -->
      <path d="M 242 278 C 242 300, 258 300, 258 278" fill="#f43f5e" />
    `;
    badgeLabel = "Cachorrinho";
  }

  // 9. CAT / KITTEN
  else if (p.includes("gato") || p.includes("gatinho") || p.includes("cat") || p.includes("kitten")) {
    bgGradient = ["#ede9fe", "#ddd6fe", "#8b5cf6"];
    mainGraphic = `
      <!-- CAT -->
      <!-- Pointy Ears -->
      <polygon points="160,170 140,90 210,130" fill="#8b5cf6" stroke="#5b21b6" stroke-width="4" />
      <polygon points="165,155 150,105 195,130" fill="#fbcfe8" />
      <polygon points="340,170 360,90 290,130" fill="#8b5cf6" stroke="#5b21b6" stroke-width="4" />
      <polygon points="335,155 350,105 305,130" fill="#fbcfe8" />
      <!-- Head -->
      <circle cx="250" cy="235" r="95" fill="#a78bfa" stroke="#5b21b6" stroke-width="5" />
      <!-- Big Cute Eyes -->
      <ellipse cx="205" cy="215" rx="18" ry="24" fill="#10b981" stroke="#047857" stroke-width="3" />
      <ellipse cx="205" cy="215" rx="8" ry="20" fill="#064e3b" />
      <circle cx="200" cy="208" r="5" fill="#ffffff" />
      <ellipse cx="295" cy="215" rx="18" ry="24" fill="#10b981" stroke="#047857" stroke-width="3" />
      <ellipse cx="295" cy="215" rx="8" ry="20" fill="#064e3b" />
      <circle cx="290" cy="208" r="5" fill="#ffffff" />
      <!-- Nose & Mouth -->
      <polygon points="244,248 256,248 250,256" fill="#f43f5e" />
      <path d="M 250 256 Q 240 268 230 258 M 250 256 Q 260 268 270 258" fill="none" stroke="#4c1d95" stroke-width="3.5" stroke-linecap="round" />
      <!-- Whiskers -->
      <line x1="140" y1="245" x2="200" y2="250" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
      <line x1="140" y1="260" x2="200" y2="260" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
      <line x1="300" y1="250" x2="360" y2="245" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
      <line x1="300" y1="260" x2="360" y2="260" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
    `;
    badgeLabel = "Gatinho";
  }

  // 10. HORSE
  else if (p.includes("cavalo") || p.includes("horse") || p.includes("pônei") || p.includes("ponei")) {
    bgGradient = ["#ffedd5", "#fed7aa", "#ea580c"];
    mainGraphic = `
      <!-- HORSE -->
      <!-- Mane -->
      <path d="M 220 120 C 180 80, 160 200, 170 260 L 230 240 Z" fill="#78350f" />
      <!-- Ears -->
      <polygon points="210,130 200,80 230,110" fill="#9a3412" stroke="#431407" stroke-width="3" />
      <polygon points="255,120 270,75 275,115" fill="#9a3412" stroke="#431407" stroke-width="3" />
      <!-- Head & Muzzle -->
      <path d="M 220 120 Q 280 120 270 190 L 300 270 C 300 320, 240 330, 220 290 L 200 220 Z" fill="#c2410c" stroke="#431407" stroke-width="5" />
      <!-- Eye -->
      <circle cx="245" cy="180" r="10" fill="#0f172a" />
      <circle cx="242" cy="177" r="4" fill="#ffffff" />
      <!-- Nostril -->
      <circle cx="270" cy="290" r="6" fill="#431407" />
    `;
    badgeLabel = "Cavalo";
  }

  // 11. DUCK / ROOSTER / BIRD
  else if (p.includes("pato") || p.includes("duck") || p.includes("galo") || p.includes("pintinho") || p.includes("galinha")) {
    bgGradient = ["#ecfeff", "#a5f3fc", "#06b6d4"];
    mainGraphic = `
      <!-- DUCK / CHICK -->
      <!-- Body & Wings -->
      <circle cx="250" cy="270" r="105" fill="#facc15" stroke="#ca8a04" stroke-width="5" />
      <path d="M 180 260 Q 150 220 180 300 Q 210 280 180 260 Z" fill="#eab308" />
      <!-- Head -->
      <circle cx="250" cy="180" r="65" fill="#facc15" stroke="#ca8a04" stroke-width="5" />
      <!-- Eye -->
      <circle cx="225" cy="165" r="10" fill="#0f172a" />
      <circle cx="222" cy="162" r="4" fill="#ffffff" />
      <circle cx="275" cy="165" r="10" fill="#0f172a" />
      <circle cx="272" cy="162" r="4" fill="#ffffff" />
      <!-- Beak -->
      <ellipse cx="250" cy="205" rx="35" ry="18" fill="#f97316" stroke="#c2410c" stroke-width="3.5" />
    `;
    badgeLabel = "Pato";
  }

  // 12. DINOSAUR / T-REX
  else if (p.includes("dino") || p.includes("t-rex") || p.includes("dinossauro")) {
    bgGradient = ["#f0fdf4", "#bbf7d0", "#16a34a"];
    mainGraphic = `
      <!-- DINOSAUR -->
      <!-- Spikes -->
      <polygon points="160,110 180,75 200,115" fill="#ea580c" />
      <polygon points="215,120 235,85 250,130" fill="#ea580c" />
      <polygon points="260,140 275,105 285,155" fill="#ea580c" />
      <!-- Body -->
      <path d="M 160 140 C 130 90, 230 70, 270 90 C 300 110, 300 190, 260 200 C 230 200, 220 280, 280 320 C 240 330, 160 320, 150 240 Z" fill="#22c55e" stroke="#15803d" stroke-width="5" />
      <!-- Big Eye -->
      <circle cx="240" cy="120" r="14" fill="#0f172a" />
      <circle cx="236" cy="116" r="5" fill="#ffffff" />
      <!-- Teeth & Smile -->
      <path d="M 200 170 Q 240 185 270 160" fill="none" stroke="#15803d" stroke-width="4" stroke-linecap="round" />
      <polygon points="220,173 225,182 230,175" fill="#ffffff" />
      <polygon points="240,177 245,186 250,178" fill="#ffffff" />
    `;
    badgeLabel = "Dinossauro";
  }

  // 13. ROCKET / SPACE / ASTRONAUT
  else if (p.includes("foguete") || p.includes("espao") || p.includes("espaço") || p.includes("space") || p.includes("astro") || p.includes("saturno")) {
    bgGradient = ["#09090b", "#1e1b4b", "#4338ca"];
    mainGraphic = `
      <!-- ROCKET & SPACE -->
      <!-- Stars -->
      <circle cx="100" cy="100" r="4" fill="#fde047" />
      <circle cx="390" cy="80" r="5" fill="#fde047" />
      <circle cx="120" cy="380" r="4" fill="#fde047" />
      <circle cx="410" cy="360" r="3" fill="#fde047" />
      <!-- Planet -->
      <g transform="translate(370, 130)">
        <circle cx="0" cy="0" r="35" fill="#f97316" />
        <ellipse cx="0" cy="0" rx="55" ry="10" fill="none" stroke="#fdba74" stroke-width="5" transform="rotate(-20)" />
      </g>
      <!-- Rocket -->
      <g transform="translate(200, 160) rotate(25)">
        <!-- Flames -->
        <path d="M 20 170 Q 35 230 50 170 Q 35 200 20 170 Z" fill="#ea580c" />
        <path d="M 26 170 Q 35 210 44 170 Z" fill="#facc15" />
        <!-- Fins -->
        <path d="M 0 130 L -25 160 L 10 160 Z" fill="#ef4444" stroke="#991b1b" stroke-width="3" />
        <path d="M 70 130 L 95 160 L 60 160 Z" fill="#ef4444" stroke="#991b1b" stroke-width="3" />
        <!-- Body -->
        <path d="M 35 20 C 5 80, 5 160, 10 160 L 60 160 C 65 160, 65 80, 35 20 Z" fill="#f8fafc" stroke="#334155" stroke-width="4" />
        <path d="M 35 20 C 20 50, 15 70, 15 70 L 55 70 C 55 70, 50 50, 35 20 Z" fill="#ef4444" />
        <!-- Window -->
        <circle cx="35" cy="100" r="16" fill="#0284c7" stroke="#cbd5e1" stroke-width="4" />
        <circle cx="30" cy="95" r="5" fill="#ffffff" />
      </g>
    `;
    badgeLabel = "Espaço";
  }

  // 14. VEHICLE / CAR / TRUCK / AIRPLANE
  else if (p.includes("carro") || p.includes("veículo") || p.includes("veiculo") || p.includes("avião") || p.includes("aviao") || p.includes("trem")) {
    bgGradient = ["#fef2f2", "#fee2e2", "#ef4444"];
    mainGraphic = `
      <!-- SPORTS CAR / VEHICLE -->
      <!-- Car Body -->
      <path d="M 80 280 L 120 220 Q 180 170 300 170 L 370 230 L 420 250 Q 430 280 410 290 L 80 290 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="5" />
      <!-- Windows -->
      <path d="M 150 220 L 180 185 L 260 185 L 260 220 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="3" />
      <path d="M 275 185 L 340 220 L 275 220 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="3" />
      <!-- Wheels -->
      <circle cx="150" cy="290" r="38" fill="#18181b" stroke="#71717a" stroke-width="6" />
      <circle cx="150" cy="290" r="16" fill="#e4e4e7" />
      <circle cx="350" cy="290" r="38" fill="#18181b" stroke="#71717a" stroke-width="6" />
      <circle cx="350" cy="290" r="16" fill="#e4e4e7" />
      <!-- Headlight -->
      <polygon points="410,255 425,260 410,270" fill="#facc15" />
    `;
    badgeLabel = "Veículo";
  }

  // 15. SPECIFIC FRUITS & VEGETABLES (Each has its own unique drawing and color palette)
  else if (p.includes("morango") || p.includes("strawberry")) {
    bgGradient = ["#fdf2f8", "#fce7f3", "#ec4899"];
    mainGraphic = `
      <!-- STRAWBERRY -->
      <!-- Stem / Leaves -->
      <path d="M 250 140 C 230 90, 200 110, 180 120 C 220 140, 230 150, 250 150 C 270 150, 280 140, 320 120 C 300 110, 270 90, 250 140 Z" fill="#16a34a" stroke="#14532d" stroke-width="3" />
      <path d="M 250 140 Q 255 100 245 80" fill="none" stroke="#15803d" stroke-width="6" stroke-linecap="round" />
      <!-- Berry Body -->
      <path d="M 160 170 C 130 250, 190 370, 250 390 C 310 370, 370 250, 340 170 C 310 130, 190 130, 160 170 Z" fill="#ef4444" stroke="#991b1b" stroke-width="5" />
      <!-- Seeds -->
      <ellipse cx="210" cy="200" rx="4" ry="7" fill="#fef08a" transform="rotate(-15 210 200)" />
      <ellipse cx="290" cy="200" rx="4" ry="7" fill="#fef08a" transform="rotate(15 290 200)" />
      <ellipse cx="250" cy="240" rx="4" ry="7" fill="#fef08a" />
      <ellipse cx="190" cy="270" rx="4" ry="7" fill="#fef08a" transform="rotate(-15 190 270)" />
      <ellipse cx="310" cy="270" rx="4" ry="7" fill="#fef08a" transform="rotate(15 310 270)" />
      <ellipse cx="250" cy="310" rx="4" ry="7" fill="#fef08a" />
      <!-- Cute Face -->
      <circle cx="215" cy="235" r="8" fill="#0f172a" />
      <circle cx="285" cy="235" r="8" fill="#0f172a" />
      <path d="M 238 255 Q 250 268 262 255" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />
    `;
    badgeLabel = "Morango";
  }

  else if (p.includes("maçã") || p.includes("maca") || p.includes("apple")) {
    bgGradient = ["#fef2f2", "#fee2e2", "#ef4444"];
    mainGraphic = `
      <!-- RED APPLE -->
      <!-- Stem and Leaf -->
      <path d="M 250 140 Q 260 90 275 80" fill="none" stroke="#78350f" stroke-width="7" stroke-linecap="round" />
      <path d="M 255 110 Q 300 90 310 115 Q 285 135 255 110 Z" fill="#22c55e" stroke="#15803d" stroke-width="3" />
      <!-- Apple Body -->
      <path d="M 250 160 C 210 120, 140 150, 140 240 C 140 330, 200 370, 250 370 C 300 370, 360 330, 360 240 C 360 150, 290 120, 250 160 Z" fill="#dc2626" stroke="#991b1b" stroke-width="5" />
      <!-- Highlight -->
      <ellipse cx="190" cy="190" rx="20" ry="35" fill="#fca5a5" opacity="0.6" transform="rotate(-25 190 190)" />
      <!-- Eyes & Smile -->
      <circle cx="210" cy="245" r="9" fill="#18181b" />
      <circle cx="207" cy="241" r="3" fill="#ffffff" />
      <circle cx="290" cy="245" r="9" fill="#18181b" />
      <circle cx="287" cy="241" r="3" fill="#ffffff" />
      <path d="M 235 270 Q 250 285 265 270" fill="none" stroke="#18181b" stroke-width="4" stroke-linecap="round" />
      <circle cx="180" cy="260" r="10" fill="#f87171" opacity="0.5" />
      <circle cx="320" cy="260" r="10" fill="#f87171" opacity="0.5" />
    `;
    badgeLabel = "Maçã";
  }

  else if (p.includes("banana")) {
    bgGradient = ["#fefce8", "#fef08a", "#eab308"];
    mainGraphic = `
      <!-- BANANA -->
      <!-- Banana Body -->
      <path d="M 170 120 Q 140 260 220 340 Q 340 380 370 280 Q 300 310 230 270 Q 170 210 200 130 Z" fill="#fde047" stroke="#ca8a04" stroke-width="5" />
      <!-- Ends -->
      <rect x="165" y="110" width="18" height="20" rx="4" fill="#65a30d" stroke="#3f6212" stroke-width="3" transform="rotate(-15 165 110)" />
      <circle cx="370" cy="280" r="8" fill="#713f12" />
      <!-- Shading line -->
      <path d="M 185 140 Q 160 250 225 315 Q 310 345 350 285" fill="none" stroke="#ca8a04" stroke-width="3" stroke-dasharray="8 6" />
      <!-- Eyes & Smile -->
      <circle cx="230" cy="235" r="8" fill="#18181b" />
      <circle cx="228" cy="232" r="3" fill="#ffffff" />
      <circle cx="280" cy="260" r="8" fill="#18181b" />
      <circle cx="278" cy="257" r="3" fill="#ffffff" />
      <path d="M 245 265 Q 260 280 270 270" fill="none" stroke="#18181b" stroke-width="3.5" stroke-linecap="round" />
    `;
    badgeLabel = "Banana";
  }

  else if (p.includes("melancia") || p.includes("watermelon")) {
    bgGradient = ["#f0fdf4", "#bbf7d0", "#22c55e"];
    mainGraphic = `
      <!-- WATERMELON SLICE -->
      <g transform="translate(250, 240)">
        <!-- Green Rind -->
        <path d="M -160 0 C -160 160, 160 160, 160 0 Z" fill="#15803d" stroke="#14532d" stroke-width="5" />
        <path d="M -150 0 C -150 145, 150 145, 150 0 Z" fill="#bbf7d0" />
        <!-- Red Flesh -->
        <path d="M -140 0 C -140 130, 140 130, 140 0 Z" fill="#ef4444" />
        <!-- Black Seeds -->
        <ellipse cx="-80" cy="40" rx="6" ry="10" fill="#18181b" transform="rotate(-20 -80 40)" />
        <ellipse cx="-30" cy="70" rx="6" ry="10" fill="#18181b" transform="rotate(-10 -30 70)" />
        <ellipse cx="30" cy="70" rx="6" ry="10" fill="#18181b" transform="rotate(10 30 70)" />
        <ellipse cx="80" cy="40" rx="6" ry="10" fill="#18181b" transform="rotate(20 80 40)" />
        <ellipse cx="0" cy="30" rx="6" ry="10" fill="#18181b" />
        <!-- Eyes & Smile -->
        <circle cx="-35" cy="15" r="7" fill="#ffffff" />
        <circle cx="-35" cy="15" r="4" fill="#18181b" />
        <circle cx="35" cy="15" r="7" fill="#ffffff" />
        <circle cx="35" cy="15" r="4" fill="#18181b" />
        <path d="M -12 25 Q 0 35 12 25" fill="none" stroke="#7f1d1d" stroke-width="3" stroke-linecap="round" />
      </g>
    `;
    badgeLabel = "Melancia";
  }

  else if (p.includes("laranja") || p.includes("orange") || p.includes("tangerina")) {
    bgGradient = ["#fff7ed", "#ffedd5", "#f97316"];
    mainGraphic = `
      <!-- ORANGE -->
      <!-- Leaf -->
      <path d="M 250 120 Q 255 70 260 60" fill="none" stroke="#78350f" stroke-width="6" stroke-linecap="round" />
      <path d="M 255 90 Q 305 70 315 100 Q 285 120 255 90 Z" fill="#22c55e" stroke="#15803d" stroke-width="3" />
      <!-- Orange Sphere -->
      <circle cx="250" cy="250" r="125" fill="#f97316" stroke="#c2410c" stroke-width="5" />
      <!-- Texture spots -->
      <circle cx="180" cy="190" r="3" fill="#ea580c" />
      <circle cx="195" cy="310" r="3" fill="#ea580c" />
      <circle cx="310" cy="200" r="3" fill="#ea580c" />
      <circle cx="320" cy="300" r="3" fill="#ea580c" />
      <!-- Big Cute Eyes -->
      <circle cx="210" cy="240" r="12" fill="#18181b" />
      <circle cx="206" cy="235" r="4" fill="#ffffff" />
      <circle cx="290" cy="240" r="12" fill="#18181b" />
      <circle cx="286" cy="235" r="4" fill="#ffffff" />
      <!-- Blush & Smile -->
      <circle cx="175" cy="260" r="14" fill="#fdba74" opacity="0.8" />
      <circle cx="325" cy="260" r="14" fill="#fdba74" opacity="0.8" />
      <path d="M 235 265 Q 250 282 265 265" fill="none" stroke="#7c2d12" stroke-width="4" stroke-linecap="round" />
    `;
    badgeLabel = "Laranja";
  }

  else if (p.includes("uva") || p.includes("grape")) {
    bgGradient = ["#faf5ff", "#f3e8ff", "#a855f7"];
    mainGraphic = `
      <!-- GRAPES CLUSTER -->
      <!-- Stem & Curly Tendril -->
      <path d="M 250 140 L 250 80" stroke="#78350f" stroke-width="7" stroke-linecap="round" />
      <path d="M 250 110 Q 220 70 190 90 Q 220 120 250 110 Z" fill="#22c55e" stroke="#15803d" stroke-width="3" />
      <!-- Grapes (Round bubbles) -->
      <!-- Top Row -->
      <circle cx="190" cy="180" r="30" fill="#9333ea" stroke="#581c87" stroke-width="4" />
      <circle cx="250" cy="170" r="30" fill="#a855f7" stroke="#581c87" stroke-width="4" />
      <circle cx="310" cy="180" r="30" fill="#9333ea" stroke="#581c87" stroke-width="4" />
      <!-- Middle Row -->
      <circle cx="170" cy="230" r="30" fill="#7e22ce" stroke="#581c87" stroke-width="4" />
      <circle cx="225" cy="225" r="32" fill="#9333ea" stroke="#581c87" stroke-width="4" />
      <circle cx="280" cy="225" r="32" fill="#a855f7" stroke="#581c87" stroke-width="4" />
      <circle cx="330" cy="230" r="30" fill="#7e22ce" stroke="#581c87" stroke-width="4" />
      <!-- Lower Rows -->
      <circle cx="200" cy="280" r="28" fill="#9333ea" stroke="#581c87" stroke-width="4" />
      <circle cx="255" cy="280" r="28" fill="#a855f7" stroke="#581c87" stroke-width="4" />
      <circle cx="300" cy="280" r="28" fill="#7e22ce" stroke="#581c87" stroke-width="4" />
      <circle cx="225" cy="330" r="26" fill="#9333ea" stroke="#581c87" stroke-width="4" />
      <circle cx="275" cy="330" r="26" fill="#7e22ce" stroke="#581c87" stroke-width="4" />
      <circle cx="250" cy="375" r="22" fill="#6b21a8" stroke="#581c87" stroke-width="4" />
    `;
    badgeLabel = "Uva";
  }

  else if (p.includes("abacaxi") || p.includes("pineapple")) {
    bgGradient = ["#fefce8", "#fef08a", "#ca8a04"];
    mainGraphic = `
      <!-- PINEAPPLE -->
      <!-- Crown Leaves -->
      <polygon points="250,70 235,160 265,160" fill="#15803d" />
      <polygon points="210,90 230,160 250,160" fill="#16a34a" />
      <polygon points="290,90 250,160 270,160" fill="#16a34a" />
      <polygon points="180,120 220,170 240,170" fill="#22c55e" />
      <polygon points="320,120 260,170 280,170" fill="#22c55e" />
      <!-- Pineapple Body -->
      <ellipse cx="250" cy="265" rx="85" ry="110" fill="#eab308" stroke="#a16207" stroke-width="5" />
      <!-- Crosshatch grid -->
      <path d="M 190 190 L 310 330 M 175 230 L 295 370 M 175 300 L 250 375" stroke="#a16207" stroke-width="3.5" />
      <path d="M 310 190 L 190 330 M 325 230 L 205 370 M 325 300 L 250 375" stroke="#a16207" stroke-width="3.5" />
      <!-- Center Diamonds -->
      <circle cx="250" cy="265" r="5" fill="#713f12" />
      <circle cx="215" cy="235" r="4" fill="#713f12" />
      <circle cx="285" cy="235" r="4" fill="#713f12" />
      <circle cx="215" cy="300" r="4" fill="#713f12" />
      <circle cx="285" cy="300" r="4" fill="#713f12" />
    `;
    badgeLabel = "Abacaxi";
  }

  else if (p.includes("cenoura") || p.includes("carrot")) {
    bgGradient = ["#fff7ed", "#fed7aa", "#ea580c"];
    mainGraphic = `
      <!-- CARROT -->
      <!-- Green Tops -->
      <path d="M 250 140 Q 220 60 190 70 Q 230 110 245 140 Z" fill="#22c55e" stroke="#15803d" stroke-width="3" />
      <path d="M 250 140 Q 250 40 260 40 Q 260 100 255 140 Z" fill="#16a34a" stroke="#15803d" stroke-width="3" />
      <path d="M 250 140 Q 280 60 310 70 Q 270 110 255 140 Z" fill="#22c55e" stroke="#15803d" stroke-width="3" />
      <!-- Carrot Body -->
      <polygon points="190,140 310,140 250,390" fill="#f97316" stroke="#c2410c" stroke-width="5" />
      <ellipse cx="250" cy="140" rx="60" ry="12" fill="#ea580c" />
      <!-- Texture lines -->
      <line x1="215" y1="190" x2="260" y2="190" stroke="#c2410c" stroke-width="3.5" stroke-linecap="round" />
      <line x1="240" y1="240" x2="280" y2="240" stroke="#c2410c" stroke-width="3.5" stroke-linecap="round" />
      <line x1="230" y1="300" x2="265" y2="300" stroke="#c2410c" stroke-width="3.5" stroke-linecap="round" />
      <!-- Cute Face -->
      <circle cx="230" cy="210" r="7" fill="#18181b" />
      <circle cx="270" cy="210" r="7" fill="#18181b" />
      <path d="M 242 225 Q 250 235 258 225" fill="none" stroke="#18181b" stroke-width="3" stroke-linecap="round" />
    `;
    badgeLabel = "Cenoura";
  }

  else if (p.includes("tomate") || p.includes("tomato")) {
    bgGradient = ["#fef2f2", "#fee2e2", "#dc2626"];
    mainGraphic = `
      <!-- TOMATO -->
      <!-- Green Star Leaves -->
      <polygon points="250,110 260,145 295,135 270,160 290,185 255,170 240,195 235,165 205,175 230,150 210,125 240,145" fill="#16a34a" stroke="#14532d" stroke-width="3" />
      <path d="M 250 145 Q 255 100 245 85" fill="none" stroke="#15803d" stroke-width="6" stroke-linecap="round" />
      <!-- Tomato Body -->
      <circle cx="250" cy="255" r="120" fill="#ef4444" stroke="#b91c1c" stroke-width="5" />
      <!-- Shading & Highlights -->
      <ellipse cx="195" cy="205" rx="18" ry="30" fill="#fca5a5" opacity="0.6" transform="rotate(-30 195 205)" />
      <!-- Cute Face -->
      <circle cx="215" cy="255" r="9" fill="#18181b" />
      <circle cx="212" cy="251" r="3" fill="#ffffff" />
      <circle cx="285" cy="255" r="9" fill="#18181b" />
      <circle cx="282" cy="251" r="3" fill="#ffffff" />
      <path d="M 238 275 Q 250 290 262 275" fill="none" stroke="#18181b" stroke-width="4" stroke-linecap="round" />
      <circle cx="180" cy="270" r="12" fill="#f87171" opacity="0.6" />
      <circle cx="320" cy="270" r="12" fill="#f87171" opacity="0.6" />
    `;
    badgeLabel = "Tomate";
  }

  else if (p.includes("brócolis") || p.includes("brocolis") || p.includes("broccoli")) {
    bgGradient = ["#f0fdf4", "#dcfce7", "#16a34a"];
    mainGraphic = `
      <!-- BROCCOLI -->
      <!-- Stalk -->
      <path d="M 220 280 L 210 380 L 290 380 L 280 280 Z" fill="#86efac" stroke="#15803d" stroke-width="5" />
      <!-- Florets Tree -->
      <circle cx="190" cy="220" r="50" fill="#22c55e" stroke="#15803d" stroke-width="4" />
      <circle cx="310" cy="220" r="50" fill="#22c55e" stroke="#15803d" stroke-width="4" />
      <circle cx="250" cy="170" r="60" fill="#16a34a" stroke="#15803d" stroke-width="4" />
      <circle cx="170" cy="160" r="40" fill="#15803d" />
      <circle cx="330" cy="160" r="40" fill="#15803d" />
      <circle cx="250" cy="240" r="45" fill="#4ade80" stroke="#15803d" stroke-width="3" />
      <!-- Texture florets -->
      <circle cx="230" cy="150" r="6" fill="#14532d" />
      <circle cx="270" cy="150" r="6" fill="#14532d" />
      <circle cx="190" cy="200" r="5" fill="#14532d" />
      <circle cx="310" cy="200" r="5" fill="#14532d" />
      <!-- Cute Face on Stalk -->
      <circle cx="235" cy="320" r="6" fill="#18181b" />
      <circle cx="265" cy="320" r="6" fill="#18181b" />
      <path d="M 244 335 Q 250 342 256 335" fill="none" stroke="#18181b" stroke-width="3" stroke-linecap="round" />
    `;
    badgeLabel = "Brócolis";
  }

  else if (p.includes("berinjela") || p.includes("eggplant") || p.includes("aubergine")) {
    bgGradient = ["#faf5ff", "#f3e8ff", "#7e22ce"];
    mainGraphic = `
      <!-- EGGPLANT -->
      <!-- Green Calyx -->
      <polygon points="250,90 265,140 310,135 275,160 290,185 250,165 210,185 225,160 190,135 235,140" fill="#16a34a" stroke="#14532d" stroke-width="4" />
      <path d="M 250 110 Q 255 65 245 50" fill="none" stroke="#15803d" stroke-width="7" stroke-linecap="round" />
      <!-- Glossy Body -->
      <path d="M 210 160 C 170 190, 160 280, 180 340 C 200 390, 300 390, 320 340 C 340 280, 310 190, 270 160 Z" fill="#581c87" stroke="#3b0764" stroke-width="5" />
      <!-- Shiny Reflection -->
      <path d="M 200 240 Q 190 320 220 350" fill="none" stroke="#c084fc" stroke-width="8" stroke-linecap="round" opacity="0.6" />
      <!-- Eyes & Smile -->
      <circle cx="230" cy="270" r="8" fill="#ffffff" />
      <circle cx="230" cy="270" r="5" fill="#18181b" />
      <circle cx="275" cy="270" r="8" fill="#ffffff" />
      <circle cx="275" cy="270" r="5" fill="#18181b" />
      <path d="M 245 295 Q 255 305 265 295" fill="none" stroke="#f3e8ff" stroke-width="3.5" stroke-linecap="round" />
    `;
    badgeLabel = "Berinjela";
  }

  else if (p.includes("milho") || p.includes("corn")) {
    bgGradient = ["#fefce8", "#fef08a", "#ca8a04"];
    mainGraphic = `
      <!-- CORN ON THE COB -->
      <!-- Husk Leaves -->
      <path d="M 180 370 C 130 300, 150 200, 200 170 C 180 250, 190 330, 220 370 Z" fill="#84cc16" stroke="#4d7c0f" stroke-width="4" />
      <path d="M 320 370 C 370 300, 350 200, 300 170 C 320 250, 310 330, 280 370 Z" fill="#84cc16" stroke="#4d7c0f" stroke-width="4" />
      <!-- Corn Cob -->
      <rect x="210" y="110" width="80" height="240" rx="40" fill="#facc15" stroke="#ca8a04" stroke-width="5" />
      <!-- Corn Kernels Grid -->
      <line x1="210" y1="160" x2="290" y2="160" stroke="#ca8a04" stroke-width="3" />
      <line x1="210" y1="200" x2="290" y2="200" stroke="#ca8a04" stroke-width="3" />
      <line x1="210" y1="240" x2="290" y2="240" stroke="#ca8a04" stroke-width="3" />
      <line x1="210" y1="280" x2="290" y2="280" stroke="#ca8a04" stroke-width="3" />
      <line x1="210" y1="320" x2="290" y2="320" stroke="#ca8a04" stroke-width="3" />
      <line x1="236" y1="120" x2="236" y2="340" stroke="#ca8a04" stroke-width="3" />
      <line x1="264" y1="120" x2="264" y2="340" stroke="#ca8a04" stroke-width="3" />
      <!-- Cute Eyes & Smile -->
      <circle cx="235" cy="220" r="7" fill="#18181b" />
      <circle cx="265" cy="220" r="7" fill="#18181b" />
      <path d="M 244 235 Q 250 242 256 235" fill="none" stroke="#18181b" stroke-width="3" stroke-linecap="round" />
    `;
    badgeLabel = "Milho";
  }

  else if (p.includes("cereja") || p.includes("cherry")) {
    bgGradient = ["#fff1f2", "#ffe4e6", "#e11d48"];
    mainGraphic = `
      <!-- CHERRIES PAIR -->
      <!-- Green Joined Stems -->
      <path d="M 250 100 C 230 160, 190 180, 190 240" fill="none" stroke="#15803d" stroke-width="5" stroke-linecap="round" />
      <path d="M 250 100 C 270 160, 310 180, 310 240" fill="none" stroke="#15803d" stroke-width="5" stroke-linecap="round" />
      <path d="M 250 100 Q 285 70 300 90 Q 275 110 250 100 Z" fill="#22c55e" stroke="#15803d" stroke-width="3" />
      <!-- Left Cherry -->
      <circle cx="190" cy="270" r="55" fill="#be123c" stroke="#881337" stroke-width="5" />
      <ellipse cx="170" cy="250" rx="10" ry="16" fill="#fda4af" opacity="0.7" transform="rotate(-20 170 250)" />
      <circle cx="180" cy="270" r="6" fill="#18181b" />
      <circle cx="205" cy="270" r="6" fill="#18181b" />
      <path d="M 188 285 Q 193 292 198 285" fill="none" stroke="#18181b" stroke-width="3" stroke-linecap="round" />
      <!-- Right Cherry -->
      <circle cx="310" cy="270" r="55" fill="#be123c" stroke="#881337" stroke-width="5" />
      <ellipse cx="290" cy="250" rx="10" ry="16" fill="#fda4af" opacity="0.7" transform="rotate(-20 290 250)" />
      <circle cx="300" cy="270" r="6" fill="#18181b" />
      <circle cx="325" cy="270" r="6" fill="#18181b" />
      <path d="M 308 285 Q 313 292 318 285" fill="none" stroke="#18181b" stroke-width="3" stroke-linecap="round" />
    `;
    badgeLabel = "Cerejas";
  }

  else if (p.includes("limão") || p.includes("limao") || p.includes("lemon") || p.includes("lime")) {
    bgGradient = ["#fefce8", "#fef08a", "#84cc16"];
    mainGraphic = `
      <!-- LEMON / LIME -->
      <g transform="translate(250, 250) rotate(-25)">
        <path d="M -110 0 C -90 -70, 90 -70, 110 0 C 90 70, -90 70, -110 0 Z" fill="#eab308" stroke="#a16207" stroke-width="5" />
        <circle cx="-110" cy="0" r="6" fill="#a16207" />
        <circle cx="110" cy="0" r="6" fill="#a16207" />
        <!-- Face -->
        <circle cx="-30" cy="-10" r="8" fill="#18181b" />
        <circle cx="30" cy="-10" r="8" fill="#18181b" />
        <path d="M -15 10 Q 0 22 15 10" fill="none" stroke="#18181b" stroke-width="3.5" stroke-linecap="round" />
      </g>
    `;
    badgeLabel = "Limão";
  }

  else if (p.includes("pera") || p.includes("pêra") || p.includes("pear")) {
    bgGradient = ["#f7fee7", "#d9f99d", "#65a30d"];
    mainGraphic = `
      <!-- PEAR -->
      <!-- Stem and Leaf -->
      <path d="M 250 130 Q 255 80 265 70" fill="none" stroke="#78350f" stroke-width="6" stroke-linecap="round" />
      <path d="M 255 100 Q 295 80 305 105 Q 280 125 255 100 Z" fill="#22c55e" stroke="#15803d" stroke-width="3" />
      <!-- Pear Body -->
      <path d="M 250 130 C 220 130, 210 180, 200 230 C 160 270, 160 370, 250 370 C 340 370, 340 270, 300 230 C 290 180, 280 130, 250 130 Z" fill="#a3e635" stroke="#4d7c0f" stroke-width="5" />
      <!-- Highlight -->
      <ellipse cx="205" cy="280" rx="16" ry="35" fill="#bef264" opacity="0.7" transform="rotate(-20 205 280)" />
      <!-- Eyes & Smile -->
      <circle cx="225" cy="250" r="8" fill="#18181b" />
      <circle cx="275" cy="250" r="8" fill="#18181b" />
      <path d="M 240 270 Q 250 282 260 270" fill="none" stroke="#18181b" stroke-width="3.5" stroke-linecap="round" />
    `;
    badgeLabel = "Pêra";
  }

  else if (p.includes("abacate") || p.includes("avocado")) {
    bgGradient = ["#f7fee7", "#dcfce7", "#15803d"];
    mainGraphic = `
      <!-- AVOCADO -->
      <!-- Outer Rind & Flesh -->
      <path d="M 250 120 C 210 120, 200 180, 180 230 C 150 280, 150 370, 250 370 C 350 370, 350 280, 320 230 C 300 180, 290 120, 250 120 Z" fill="#166534" stroke="#14532d" stroke-width="6" />
      <path d="M 250 135 C 220 135, 210 190, 190 235 C 165 280, 165 355, 250 355 C 335 355, 335 280, 310 235 C 290 190, 280 135, 250 135 Z" fill="#bef264" />
      <!-- Pit -->
      <circle cx="250" cy="275" r="50" fill="#78350f" stroke="#451a03" stroke-width="5" />
      <ellipse cx="235" cy="260" rx="10" ry="18" fill="#9a3412" opacity="0.6" transform="rotate(-20 235 260)" />
      <!-- Cute Eyes on Pit -->
      <circle cx="235" cy="270" r="6" fill="#ffffff" />
      <circle cx="235" cy="270" r="3" fill="#18181b" />
      <circle cx="265" cy="270" r="6" fill="#ffffff" />
      <circle cx="265" cy="270" r="3" fill="#18181b" />
      <path d="M 245 285 Q 250 292 255 285" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
    `;
    badgeLabel = "Abacate";
  }

  // 15B. GENERIC FRUIT / FOOD FALLBACK
  else if (p.includes("fruta") || p.includes("legume") || p.includes("vegetal") || p.includes("horta") || p.includes("comida")) {
    const fruitIndex = seed % 6;
    if (fruitIndex === 0) {
      bgGradient = ["#fef2f2", "#fee2e2", "#ef4444"];
      mainGraphic = `
        <!-- APPLE -->
        <path d="M 250 140 Q 260 90 275 80" fill="none" stroke="#78350f" stroke-width="7" stroke-linecap="round" />
        <path d="M 255 110 Q 300 90 310 115 Q 285 135 255 110 Z" fill="#22c55e" stroke="#15803d" stroke-width="3" />
        <path d="M 250 160 C 210 120, 140 150, 140 240 C 140 330, 200 370, 250 370 C 300 370, 360 330, 360 240 C 360 150, 290 120, 250 160 Z" fill="#dc2626" stroke="#991b1b" stroke-width="5" />
        <circle cx="210" cy="245" r="9" fill="#18181b" /><circle cx="290" cy="245" r="9" fill="#18181b" />
        <path d="M 235 270 Q 250 285 265 270" fill="none" stroke="#18181b" stroke-width="4" stroke-linecap="round" />
      `;
      badgeLabel = "Maçã";
    } else if (fruitIndex === 1) {
      bgGradient = ["#fefce8", "#fef08a", "#eab308"];
      mainGraphic = `
        <!-- BANANA -->
        <path d="M 170 120 Q 140 260 220 340 Q 340 380 370 280 Q 300 310 230 270 Q 170 210 200 130 Z" fill="#fde047" stroke="#ca8a04" stroke-width="5" />
        <rect x="165" y="110" width="18" height="20" rx="4" fill="#65a30d" stroke="#3f6212" stroke-width="3" transform="rotate(-15 165 110)" />
        <circle cx="230" cy="235" r="8" fill="#18181b" /><circle cx="280" cy="260" r="8" fill="#18181b" />
        <path d="M 245 265 Q 260 280 270 270" fill="none" stroke="#18181b" stroke-width="3.5" stroke-linecap="round" />
      `;
      badgeLabel = "Banana";
    } else if (fruitIndex === 2) {
      bgGradient = ["#f0fdf4", "#bbf7d0", "#22c55e"];
      mainGraphic = `
        <!-- WATERMELON -->
        <g transform="translate(250, 240)">
          <path d="M -160 0 C -160 160, 160 160, 160 0 Z" fill="#15803d" stroke="#14532d" stroke-width="5" />
          <path d="M -150 0 C -150 145, 150 145, 150 0 Z" fill="#bbf7d0" />
          <path d="M -140 0 C -140 130, 140 130, 140 0 Z" fill="#ef4444" />
          <ellipse cx="-60" cy="40" rx="6" ry="10" fill="#18181b" />
          <ellipse cx="60" cy="40" rx="6" ry="10" fill="#18181b" />
          <ellipse cx="0" cy="50" rx="6" ry="10" fill="#18181b" />
          <circle cx="-35" cy="15" r="5" fill="#18181b" /><circle cx="35" cy="15" r="5" fill="#18181b" />
          <path d="M -12 25 Q 0 35 12 25" fill="none" stroke="#7f1d1d" stroke-width="3" stroke-linecap="round" />
        </g>
      `;
      badgeLabel = "Melancia";
    } else if (fruitIndex === 3) {
      bgGradient = ["#fff7ed", "#ffedd5", "#f97316"];
      mainGraphic = `
        <!-- ORANGE -->
        <circle cx="250" cy="250" r="125" fill="#f97316" stroke="#c2410c" stroke-width="5" />
        <circle cx="210" cy="240" r="12" fill="#18181b" /><circle cx="290" cy="240" r="12" fill="#18181b" />
        <path d="M 235 265 Q 250 282 265 265" fill="none" stroke="#7c2d12" stroke-width="4" stroke-linecap="round" />
      `;
      badgeLabel = "Laranja";
    } else if (fruitIndex === 4) {
      bgGradient = ["#fff7ed", "#fed7aa", "#ea580c"];
      mainGraphic = `
        <!-- CARROT -->
        <polygon points="190,140 310,140 250,390" fill="#f97316" stroke="#c2410c" stroke-width="5" />
        <ellipse cx="250" cy="140" rx="60" ry="12" fill="#ea580c" />
        <circle cx="230" cy="210" r="7" fill="#18181b" /><circle cx="270" cy="210" r="7" fill="#18181b" />
        <path d="M 242 225 Q 250 235 258 225" fill="none" stroke="#18181b" stroke-width="3" stroke-linecap="round" />
      `;
      badgeLabel = "Cenoura";
    } else {
      bgGradient = ["#f0fdf4", "#dcfce7", "#16a34a"];
      mainGraphic = `
        <!-- BROCCOLI -->
        <path d="M 220 280 L 210 380 L 290 380 L 280 280 Z" fill="#86efac" stroke="#15803d" stroke-width="5" />
        <circle cx="190" cy="220" r="50" fill="#22c55e" stroke="#15803d" stroke-width="4" />
        <circle cx="310" cy="220" r="50" fill="#22c55e" stroke="#15803d" stroke-width="4" />
        <circle cx="250" cy="170" r="60" fill="#16a34a" stroke="#15803d" stroke-width="4" />
        <circle cx="235" cy="320" r="6" fill="#18181b" /><circle cx="265" cy="320" r="6" fill="#18181b" />
        <path d="M 244 335 Q 250 342 256 335" fill="none" stroke="#18181b" stroke-width="3" stroke-linecap="round" />
      `;
      badgeLabel = "Brócolis";
    }
  }

  // 16. MARINE LIFE (Fish, Dolphin, Turtle, Octopus)
  else if (p.includes("peixe") || p.includes("mar") || p.includes("oceano") || p.includes("golfinho") || p.includes("tartaruga") || p.includes("tubarão") || p.includes("tubarao") || p.includes("polvo")) {
    bgGradient = ["#ecfeff", "#06b6d4", "#0369a1"];
    mainGraphic = `
      <!-- CUTE CLOWNFISH / MARINE -->
      <!-- Bubbles -->
      <circle cx="120" cy="140" r="10" fill="#ffffff" opacity="0.6" />
      <circle cx="140" cy="90" r="6" fill="#ffffff" opacity="0.7" />
      <!-- Tail & Fins -->
      <polygon points="120,250 60,190 60,310" fill="#ea580c" stroke="#9a3412" stroke-width="4" />
      <path d="M 240 160 Q 200 110 160 160 Z" fill="#ea580c" stroke="#9a3412" stroke-width="3" />
      <!-- Body -->
      <ellipse cx="240" cy="250" rx="130" ry="85" fill="#f97316" stroke="#9a3412" stroke-width="5" />
      <!-- White Stripes -->
      <path d="M 180 175 Q 200 250 180 325 Q 155 250 180 175 Z" fill="#ffffff" stroke="#18181b" stroke-width="3" />
      <path d="M 260 165 Q 280 250 260 335 Q 240 250 260 165 Z" fill="#ffffff" stroke="#18181b" stroke-width="3" />
      <!-- Big Eye -->
      <circle cx="315" cy="230" r="16" fill="#ffffff" stroke="#000000" stroke-width="3" />
      <circle cx="320" cy="230" r="9" fill="#0f172a" />
      <circle cx="317" cy="226" r="3.5" fill="#ffffff" />
      <!-- Smile -->
      <path d="M 335 260 Q 345 270 335 278" fill="none" stroke="#9a3412" stroke-width="4" stroke-linecap="round" />
    `;
    badgeLabel = "Oceano";
  }

  // 17. ALGORITHMIC BESPOKE THEMED VECTOR MASCOT
  // For ANY other specific noun (e.g. superhero, magic castle, musical instrument, etc.)
  // Generates a fully unique harmonic color palette and mascot badge with crisp typography!
  else {
    const paletteList: [string, string, string][] = [
      ["#f43f5e", "#fb7185", "#ffe4e6"],
      ["#8b5cf6", "#a78bfa", "#ede9fe"],
      ["#06b6d4", "#38bdf8", "#ecfeff"],
      ["#10b981", "#34d399", "#ecfdf5"],
      ["#f59e0b", "#fbbf24", "#fef3c7"],
      ["#ec4899", "#f472b6", "#fdf2f8"],
      ["#3b82f6", "#60a5fa", "#eff6ff"],
      ["#6366f1", "#818cf8", "#e0e7ff"],
    ];
    const pal = paletteList[seed % paletteList.length];
    bgGradient = [pal[0], pal[1], pal[2]];

    // Extract first 1-2 words for display badge
    const words = rawPrompt.split(/[\s,-]+/).filter(w => w.length > 2);
    const displayWord = words.length > 0 ? words.slice(0, 2).join(" ") : "Carta Especial";

    mainGraphic = `
      <!-- THEMED BESPOKE EMBLEM -->
      <circle cx="250" cy="240" r="150" fill="#ffffff" opacity="0.2" />
      <circle cx="250" cy="240" r="120" fill="#ffffff" opacity="0.3" />
      
      <!-- Central Shield / Star Badge -->
      <g transform="translate(250, 230)">
        <polygon points="0,-90 65,-40 80,40 0,90 -80,40 -65,-40" fill="#ffffff" stroke="${pal[0]}" stroke-width="8" />
        <circle cx="0" cy="0" r="48" fill="${pal[0]}" />
        <!-- Inner Iconic Star -->
        <polygon points="0,-30 8,-8 30,-8 12,6 18,28 0,14 -18,28 -12,6 -30,-8 -8,-8" fill="#ffffff" />
        <!-- Sparkles around -->
        <circle cx="-65" cy="-60" r="8" fill="#ffffff" />
        <circle cx="65" cy="-60" r="8" fill="#ffffff" />
        <circle cx="-65" cy="60" r="6" fill="#ffffff" />
        <circle cx="65" cy="60" r="6" fill="#ffffff" />
      </g>

      <!-- Label Ribbon on Bottom -->
      <g transform="translate(250, 390)">
        <rect x="-160" y="-24" width="320" height="48" rx="24" fill="#ffffff" stroke="${pal[0]}" stroke-width="4" />
        <text x="0" y="8" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="20" fill="${pal[0]}" text-anchor="middle">
          ${displayWord.toUpperCase()}
        </text>
      </g>
    `;
    badgeLabel = displayWord;
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="1000" height="1000">
  <defs>
    <linearGradient id="bgGrad_${seed}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradient[0]}" />
      <stop offset="50%" stop-color="${bgGradient[1]}" />
      <stop offset="100%" stop-color="${bgGradient[2]}" />
    </linearGradient>
    <filter id="shadow_${seed}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="500" height="500" rx="32" fill="url(#bgGrad_${seed})" />

  <!-- Main Illustration Group -->
  <g filter="url(#shadow_${seed})">
    ${mainGraphic}
  </g>

  <!-- Clean Framing Border -->
  <rect x="14" y="14" width="472" height="472" rx="24" fill="none" stroke="#ffffff" stroke-width="4" stroke-opacity="0.4" />
</svg>
  `.trim();

  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
