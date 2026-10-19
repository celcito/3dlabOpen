// =====================================================================
// ESTOJO COM PORTA DE ENROLAR (TAMBOUR / ROLL-TIP) - FORMATO BORRACHA
// ESCOLAR - OpenSCAD
// 4 pecas: CAIXA, PORTA (ja articulada, print-in-place), PLUGUE e CAPA
// (faixa deslizante estilo "sleeve" de borracha, 2a cor).
//
// COMO USAR
// 1) Ajuste os parametros abaixo (comp_interno = comprimento do lapis).
// 2) Para cada peca troque "modo" e exporte o STL (F6 e depois F7):
//      "caixa"    -> corpo do estojo (imprimir em pe, como esta)
//      "porta"    -> a porta articulada (imprimir deitada, como esta)
//      "plugue"   -> tampa do fundo do corredor (imprimir deitado)
//      "capa"     -> faixa deslizante (imprimir com a abertura para cima)
//      "montagem" -> so para visualizar (nao imprimir)
// 3) Antes do lote: imprima "porta" com 3 ripas (n_ripas = 3) e teste a
//    folga. Se as juntas ficarem presas, aumente "folga" em 0.05.
// 4) Teste o deslize da capa: se frouxa/apertada, ajuste capa_folga.
//
// MONTAGEM
// a) Imprima as 4 pecas e dobre cada junta da porta uma vez para soltar.
// b) Entre os pinos-guia da porta nos sulcos pela ABERTURA INFERIOR do
//    corredor (parte de baixo da caixa), cabeca da porta primeiro, e
//    empurre a porta para cima, ela contorna a curva e sai no topo.
// c) Feche o fundo do corredor com o plugue (cola instantanea ou epoxi).
//    O plugue tambem serve de batente quando a porta abre ate o fim.
// d) Deslize a capa por um dos topos de Y ate centrar (topo aberto: a
//    porta e o puxador ficam livres).
//
// IMPRESSAO
// - CAIXA: use suporte so sob a divisoria inclinada (45 graus), dentro do
//   compartimento. O resto imprime sem suporte. 3 perimetros.
// - PORTA: camada 0.16 a 0.20, sem suporte, sem brim nas juntas. PLA ou
//   PETG. Cabe em mesa 220 x 220 com comp_interno ate ~185.
// - CAPA: abertura para cima, sem suporte. Texto na parede vertical nao
//   gera ponte. 2a cor / outro filamento.
// - Lixe levemente os sulcos se a porta travar.
// - Curso da porta (abertura maxima) = curso_max, calculado abaixo.
//   Quer abrir mais? Aumente altura_total.
// =====================================================================

modo = "montagem";    // "caixa", "porta", "plugue", "capa" ou "montagem"

// ---- Parametros principais (mm) ----
comp_interno  = 180;  // comprimento interno (direcao das ripas = do lapis)
altura_total  = 60;   // altura da caixa (define quanto a porta abre)
n_ripas       = 9;    // numero de ripas (largura da abertura ~ n*passo - arco)
passo         = 10;   // distancia entre juntas
espessura     = 5.2;  // espessura da porta (nao reduza muito: furo do pino)
raio_curva    = 16;   // raio da curva da porta (minimo ~13 para passo 10)

folga         = 0.35; // folga de impressao: pinos, furos, sulcos (AJUSTE)
folga_porta   = 1.2;  // folga entre porta e corredor
abertura      = 20;   // so para "montagem": quanto a porta esta aberta

// ---- Acabamento "borracha escolar" ----
raio_canto  = 6;    // cantos verticais da caixa (topo/piso ficam planos)
capa_esp    = 2.0;  // espessura da parede da capa
capa_folga  = 0.35; // folga de deslize capa x caixa (AJUSTE do deslize)
capa_larg   = 80;   // largura da faixa ao longo de Y (centrada)
texto       = "ANA";// nome na capa ("" = sem texto)
texto_alt   = 9;    // altura da letra (mm)
texto_prof  = 1.0;  // relevo (+), vazio (-), 0 = off

// ---- Parametros secundarios ----
fw = 3;      // parede frontal
bw = 3;      // parede traseira
fl = 2.4;    // piso
pw = 2.0;    // espessura da divisoria
gd = 3.0;    // profundidade do sulco na parede lateral
peg_d = 3.6; // diametro do pino-guia da porta
gx = 0.6;    // espaco entre ripas
e  = 3.0;    // espessura das orelhas da junta
gy = 0.4;    // folga lateral da junta
hd = 4.0;    // profundidade do furo do pino
pd = 2.6;    // diametro do pino da junta
ye = 0.5;    // folga entre ripa e parede lateral
ph = 4.0;    // altura do plugue
borda = 3.0; // quanto as paredes laterais passam acima da porta

$fn = 40;

// ---- Geometria derivada (nao mexa) ----
re  = espessura / 2;
R   = raio_curva;
cc  = folga_porta;
Rd  = R - re - cc;                 // raio interno livre
Ro  = R + re + cc;                 // raio externo livre
arco = PI / 2 * R;
gw  = peg_d + 2 * folga;           // largura do sulco
pl  = gd - 0.6;                    // comprimento do pino-guia
wy  = gd + 3;                      // espessura da parede lateral
Ly  = comp_interno - 2 * ye;       // comprimento da ripa
Yo  = comp_interno + 2 * wy;       // comprimento externo da caixa
Lt  = n_ripas * passo - arco;      // trecho reto de cima
x_p0 = fw + re + 0.5;              // posicao da cabeca da porta (fechada)
xa  = x_p0 + Lt;                   // inicio da curva
zt  = altura_total - re;           // linha de centro da porta no topo
zc  = zt - R;                      // centro da curva
ztc = zt - re - cc;                // teto do compartimento
Xo  = xa + Ro + bw;                // comprimento externo (X)
mch = pw * sqrt(2);
curso_max = zc - ph - re - 0.9;    // abertura maxima da porta
Hb  = altura_total + borda;        // altura externa da caixa

// ---------------------------------------------------------------------
// Utilitario: extruda formas 2D (x,z) ao longo de y
module yext(y0, y1) {
    translate([0, y1, 0]) rotate([90, 0, 0]) linear_extrude(y1 - y0) children();
}

// ---------------------------------------------------------------------
// FOOTPRINT ARREDONDADO (cantos verticais; topo/piso planos)
module rrect(x0, z0, x1, z1, r) {
    translate([x0 + r, z0 + r])
        offset(r = r) square([x1 - x0 - 2 * r, z1 - z0 - 2 * r]);
}

module footprint(r) { rrect(0, 0, Xo, Yo, r); }

module capa_perfil() {
    f  = capa_folga;
    t  = capa_esp;
    co = raio_canto + t;
    difference() {
        // corpo com cantos SUPERIORES arredondados; base viva (sem raio)
        // para fundo e paredes ficarem em uma peca so
        hull() {
            translate([-f - t, -f - t]) square([Xo + 2 * (f + t), 0.01]);
            translate([-f - t + co, Hb + f - co]) circle(r = co);
            translate([Xo + f + t - co, Hb + f - co]) circle(r = co);
        }
        // cavidade VIVA: a caixa tem cantos vivos no plano X-Z, o
        // arredondamento dela e so nas arestas verticais (Z)
        translate([-f, -f]) square([Xo + 2 * f, Hb + 2 * f]);
    }
}

// ---------------------------------------------------------------------
// CAIXA
module sulco2d() {
    pts = concat(
        [[x_p0 - 0.3, zt], [xa, zt]],
        [for (a = [10 : 10 : 90]) [xa + R * sin(a), zc + R * cos(a)]],
        [[xa + R, -1]]
    );
    for (i = [0 : len(pts) - 2])
        hull() {
            translate(pts[i])     circle(d = gw, $fn = 32);
            translate(pts[i + 1]) circle(d = gw, $fn = 32);
        }
}

module perfil_interno() {
    square([xa + Rd, fl]);                                   // piso
    square([fw, altura_total]);                              // frente
    translate([xa + Ro, 0]) square([bw, altura_total]);      // fundo
    polygon([                                                // divisoria 45 graus
        [xa, ztc], [xa + Rd, zc], [xa + Rd, 0], [xa + Rd - pw, 0],
        [xa + Rd - pw, zc - mch + pw], [xa - mch, ztc]
    ]);
}

module caixa() {
    intersection() {
        linear_extrude(Hb) footprint(raio_canto);
        difference() {
            union() {
                cube([Xo, wy, Hb]);
                translate([0, Yo - wy, 0]) cube([Xo, wy, Hb]);
                yext(wy - 0.01, Yo - wy + 0.01) perfil_interno();
            }
            yext(wy - gd, wy + 0.01) sulco2d();
            yext(Yo - wy - 0.01, Yo - wy + gd) sulco2d();
        }
    }
}

// ---------------------------------------------------------------------
// PLUGUE (fecha o fundo do corredor)
module plugue() {
    intersection() {
        linear_extrude(ph) footprint(raio_canto);
        union() {
            cx0 = xa + Rd + 0.2;  cx1 = xa + Ro - 0.2;
            translate([cx0, wy + 0.2, 0]) cube([cx1 - cx0, Yo - 2 * wy - 0.4, ph]);
            gx0 = xa + R - gw / 2 + 0.2;  gx1 = xa + R + gw / 2 - 0.2;
            translate([gx0, wy - gd + 0.2, 0]) cube([gx1 - gx0, Yo - 2 * wy + 2 * gd - 0.4, ph]);
        }
    }
}

// ---------------------------------------------------------------------
// CAPA (faixa deslizante estilo borracha escolar, topo aberto)
// texto sai no plano Y-Z da face frontal; a extrusao (-X) aponta para
// fora da parede, logo o origen deslocado em +X define a profundidade.
module capa_texto(x0, h) {
    translate([-(capa_folga + capa_esp) + x0, Yo / 2, Hb / 2])
        rotate([90, 0, -90])
            linear_extrude(h)
                text(texto, size = texto_alt, halign = "center",
                     valign = "center");
}

module capa() {
    if (texto != "" && texto_prof < 0)
        difference() {
            capa_corpo();
            capa_texto(abs(texto_prof), abs(texto_prof));   // vaza da face p/ dentro
        }
    else {
        capa_corpo();
        if (texto != "" && texto_prof > 0)
            capa_texto(0.4, texto_prof + 0.4);             // relevo embutido 0,4
    }
}

module capa_corpo() {
    yext(Yo / 2 - capa_larg / 2, Yo / 2 + capa_larg / 2) capa_perfil();
}

// ---------------------------------------------------------------------
// PORTA: formas 2D (x,z) da ripa
module buraco2d() {
    rh = pd / 2 + folga;
    intersection() {
        circle(r = rh);
        translate([-rh, -rh]) square([2 * rh, 1.8 * rh]);   // topo plano (sem suporte)
    }
}

module pino2d() {
    translate([passo, 0])
        intersection() {
            circle(d = pd);
            translate([-pd / 2, -0.8 * pd / 2]) square([pd, pd]);  // base plana
        }
}

module orelha2d() {
    xc1 = passo - re - gx;
    hull() {
        translate([passo, 0]) circle(r = re);
        translate([xc1 - 0.01, -re]) square([0.01, 2 * re]);
    }
}

module ripa(i) {
    primeira = (i == 0);
    ultima   = (i == n_ripas - 1);
    xc0 = re + gx;
    xc1 = passo - re - gx;

    // nucleo
    yext(0, Ly) translate([xc0, -re]) square([xc1 - xc0, 2 * re]);

    // cabeca (primeira ripa)
    if (primeira)
        yext(0, Ly) hull() {
            circle(r = re);
            translate([0, -re]) square([xc0 + 0.5, 2 * re]);
        }

    // lingueta com furos cegos
    if (!primeira)
        difference() {
            yext(e + gy, Ly - e - gy) hull() {
                circle(r = re);
                translate([0, -re]) square([xc0 + 0.5, 2 * re]);
            }
            yext(e + gy - 0.01, e + gy + hd) buraco2d();
            yext(Ly - e - gy - hd, Ly - e - gy + 0.01) buraco2d();
        }

    // cauda (ultima ripa)
    if (ultima)
        yext(0, Ly) hull() {
            translate([passo, 0]) circle(r = re);
            translate([xc1 - 0.5, -re]) square([passo - xc1 + 0.5, 2 * re]);
        }

    // garfo: orelhas e pinos
    if (!ultima) {
        yext(0, e) orelha2d();
        yext(Ly - e, Ly) orelha2d();
        yext(e - 0.01, e + gy + hd - 0.6) pino2d();
        yext(Ly - e - gy - hd + 0.6, Ly - e + 0.01) pino2d();
    }

    // pinos-guia que correm nos sulcos
    yext(-pl, 0.01) translate([passo, 0]) circle(d = peg_d);
    yext(Ly - 0.01, Ly + pl) translate([passo, 0]) circle(d = peg_d);
    if (primeira) {
        yext(-pl, 0.01) circle(d = peg_d);
        yext(Ly - 0.01, Ly + pl) circle(d = peg_d);
        // puxador
        yext(Ly / 2 - 30, Ly / 2 + 30)
            translate([xc0 + 0.5, re - 0.01]) square([xc1 - xc0 - 1, 4]);
    }
}

module porta_plana() {
    for (i = [0 : n_ripas - 1])
        translate([i * passo, 0, re]) ripa(i);
}

// ---------------------------------------------------------------------
// MONTAGEM (so visualizacao): porta posicionada ao longo do trilho
function pth(s) =
    s <= Lt ? [x_p0 + s, zt] :
    s <= Lt + arco ? let(a = (s - Lt) / R * 180 / PI) [xa + R * sin(a), zc + R * cos(a)] :
    [xa + R, zc - (s - Lt - arco)];

function prox_s(P, lo, hi, it) =
    it == 0 ? (lo + hi) / 2 :
    let(m = (lo + hi) / 2)
    norm(pth(m) - P) < passo ? prox_s(P, m, hi, it - 1) : prox_s(P, lo, m, it - 1);

function pivs(k, s) =
    let(P = pth(s))
    (k == n_ripas) ? [P] : concat([P], pivs(k + 1, prox_s(P, s, s + 1.5 * passo, 30)));

module porta_montada(s0) {
    pts = pivs(0, s0);
    for (i = [0 : n_ripas - 1]) {
        A = pts[i];  B = pts[i + 1];
        ang = atan2(B[1] - A[1], B[0] - A[0]);
        translate([A[0], wy + ye, A[1]]) rotate([0, -ang, 0]) ripa(i);
    }
}

// ---------------------------------------------------------------------
// SAIDA
if (modo == "caixa") caixa();
else if (modo == "porta") porta_plana();
else if (modo == "plugue") plugue();
else if (modo == "capa") capa();
else {
    color("Peru") caixa();
    color("SteelBlue") porta_montada(min(abertura, curso_max));
    color("Gray") plugue();
    color("LightBlue") capa();
}
