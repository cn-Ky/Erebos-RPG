import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import * as Tone from "tone";
import {
  Sword, Shield, Gem, FlaskConical, Coins, Package, Store,
  Heart, Zap, X, ArrowLeftRight, Skull, LogOut, MapPin, Trash2, Tag
} from "lucide-react";

/* =========================================================================
   EREBOS — data tables
   ========================================================================= */

const RARITIES = {
  common:    { label: "Sıradan",   color: "#9a9a93", mult: 1.0, weight: 100 },
  uncommon:  { label: "Nadide",    color: "#4caf6d", mult: 1.4, weight: 42 },
  rare:      { label: "Ender",     color: "#4d8fd6", mult: 2.0, weight: 15 },
  epic:      { label: "Destansı",  color: "#a24dd6", mult: 2.8, weight: 5 },
  legendary: { label: "Efsanevi",  color: "#d6a84d", mult: 4.2, weight: 1 },
};
const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

const ITEM_BASES = [
  { type: "weapon",    slot: "weapon",    names: ["Kılıç", "Balta", "Mızrak", "Gaddare"], stat: "atk", base: 5, icon: "sword" },
  { type: "armor",     slot: "armor",     names: ["Zırh", "Cübbe", "Deri Yelek", "Zincir Gömlek"], stat: "def", base: 4, icon: "shield" },
  { type: "accessory", slot: "accessory", names: ["Yüzük", "Muska", "Amulet", "Pelerin Tokası"], stat: "int", base: 3, icon: "gem" },
  { type: "potion",    slot: null,        names: ["İksir"], stat: "heal", base: 35, icon: "potion" },
];

const PREFIXES = {
  common: [""], uncommon: ["Sağlam", "Keskin", "Dengeli"],
  rare: ["Gölgelenmiş", "Buzlu", "Alevli"], epic: ["Lanetli", "Kadim", "Yankılanan"],
  legendary: ["Erebos'un", "Unutulmuş Tanrının", "Sonsuz Karanlığın"],
};

function rollRarity(tierBoost = 0) {
  const weights = RARITY_ORDER.map((k, i) => Math.max(1, RARITIES[k].weight - i * tierBoost * 4));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < RARITY_ORDER.length; i++) {
    if (r < weights[i]) return RARITY_ORDER[i];
    r -= weights[i];
  }
  return "common";
}

function makeItem(rarityOverride, tierBoost = 0) {
  const base = ITEM_BASES[Math.floor(Math.random() * ITEM_BASES.length)];
  const rarity = rarityOverride || rollRarity(tierBoost);
  const rdef = RARITIES[rarity];
  const name = PREFIXES[rarity][Math.floor(Math.random() * PREFIXES[rarity].length)];
  const baseName = base.names[Math.floor(Math.random() * base.names.length)];
  const fullName = name ? `${name} ${baseName}` : baseName;
  const value = Math.round(base.base * rdef.mult * (1 + tierBoost * 0.5) * (8 + Math.random() * 6));
  const statValue = Math.round(base.base * rdef.mult * (1 + tierBoost * 0.35));
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    name: fullName, type: base.type, slot: base.slot, icon: base.icon,
    stat: base.stat, statValue, rarity, value,
  };
}

const MONSTER_DEFS = {
  slime:     { name: "Balçık",         hp: 32,  atk: 4,  def: 1, speed: 1.6, aggro: 6,  atkRange: 1.3, xp: 8,   tier: 0, color: 0x4caf6d, scale: 0.85, shape: "slime" },
  skeleton:  { name: "İskelet Savaşçı",hp: 58,  atk: 9,  def: 3, speed: 2.1, aggro: 7.5,atkRange: 1.6, xp: 16,  tier: 0, color: 0xd8d2c2, scale: 1,    shape: "skeleton" },
  champion:  { name: "Zindan Şefi",    hp: 150, atk: 15, def: 6, speed: 1.9, aggro: 9,  atkRange: 1.9, xp: 60,  tier: 1, color: 0xc1502e, scale: 1.4,  shape: "skeleton", boss: true },
  wraith:    { name: "Gölge Ruh",      hp: 76,  atk: 13, def: 2, speed: 2.6, aggro: 8.5,atkRange: 1.7, xp: 26,  tier: 1, color: 0x6f4fae, scale: 1,    shape: "wraith" },
  minotaur:  { name: "Minotor",        hp: 260, atk: 23, def: 9, speed: 1.7, aggro: 11, atkRange: 2.2, xp: 130, tier: 2, color: 0x8f2f2f, scale: 1.8,  shape: "minotaur", boss: true },
};

const CLASS_DEFS = {
  knight: {
    name: "Şövalye", color: 0xb33a3a,
    hp: 150, mana: 45, atk: 12, def: 13, dex: 5, intel: 3,
    abilities: [
      { key: "W", name: "Kalkan Hücumu",     cost: 14, cd: 8,  type: "dash",     range: 6,  mult: 1.8, cc: { type: "stun", dur: 1.1 }, color: "#e8703f" },
      { key: "A", name: "Demir Duruş",       cost: 16, cd: 12, type: "buff",     atkBonus: 4, defBonus: 10, dur: 6, heal: 22, color: "#4d8fd6" },
      { key: "S", name: "Yer Sarsıntısı",    cost: 18, cd: 7,  type: "cone",     range: 5,  angleDeg: 100, mult: 1.4, cc: { type: "slow", dur: 2, mult: 0.5 }, color: "#d6a84d" },
      { key: "D", name: "Şampiyonun Öfkesi", cost: 32, cd: 18, type: "aoe_self", radius: 5, mult: 2.6, cc: { type: "stun", dur: 1 }, color: "#c1502e" },
    ],
  },
  pyromancer: {
    name: "Ateş Büyücüsü", color: 0xe8703f,
    hp: 92, mana: 100, atk: 8, def: 4, dex: 5, intel: 16,
    abilities: [
      { key: "W", name: "Ateş Mızrağı",   cost: 14, cd: 2.6, type: "skillshot", range: 9,  mult: 2.1, width: 0.9, speed: 20, color: "#e8703f" },
      { key: "A", name: "Alev Halkası",   cost: 16, cd: 6,   type: "aoe_self",  radius: 4.2, mult: 1.5, color: "#c1502e" },
      { key: "S", name: "Buz Zinciri",    cost: 16, cd: 7,   type: "skillshot", range: 8,  mult: 1.0, width: 0.9, speed: 16, cc: { type: "slow", dur: 2.5, mult: 0.4 }, color: "#7fd0e8" },
      { key: "D", name: "Meteor Yağmuru", cost: 38, cd: 17,  type: "aoe_point", radius: 5, mult: 3.2, maxRange: 10, cc: { type: "stun", dur: 0.8 }, color: "#a24dd6" },
    ],
  },
  assassin: {
    name: "Gölge Suikastçı", color: 0x4caf6d,
    hp: 100, mana: 60, atk: 13, def: 5, dex: 16, intel: 4,
    abilities: [
      { key: "W", name: "Hançer Atışı",    cost: 9,  cd: 1.6, type: "skillshot",  range: 7,   mult: 1.3, width: 0.7, speed: 24, color: "#c7e84c" },
      { key: "A", name: "Gölgeye Karışma", cost: 15, cd: 6.5, type: "dash",       range: 5,   mult: 1.6, color: "#a24dd6" },
      { key: "S", name: "Zehirli Bıçak",   cost: 12, cd: 9,   type: "poison_next", dur: 5,    dps: 6, poisonDur: 3, color: "#4caf6d" },
      { key: "D", name: "Ölüm Vuruşu",     cost: 26, cd: 13,  type: "nearest",    range: 3.4, mult: 3.6, execute: 0.3, color: "#e84c6c" },
    ],
  },
  ranger: {
    name: "Okçu", color: 0xd6a84d,
    hp: 105, mana: 65, atk: 12, def: 6, dex: 13, intel: 6,
    abilities: [
      { key: "W", name: "Nişan Atışı",  cost: 12, cd: 2.2, type: "skillshot", range: 11, mult: 2.0, width: 0.6, speed: 26, color: "#d6a84d" },
      { key: "A", name: "Çoklu Atış",   cost: 16, cd: 6,   type: "volley",    range: 8,  mult: 1.1, width: 0.8, speed: 20, count: 3, spreadDeg: 16, color: "#e8703f" },
      { key: "S", name: "Tuzak",        cost: 14, cd: 8,   type: "trap",      radius: 2.6, mult: 1.8, dur: 8, cc: { type: "root", dur: 1.6 }, color: "#4caf6d" },
      { key: "D", name: "Ok Yağmuru",   cost: 30, cd: 15,  type: "aoe_point", radius: 4.6, mult: 2.8, maxRange: 10, color: "#c1502e" },
    ],
  },
  shaman: {
    name: "Şaman", color: 0x6f4fae,
    hp: 110, mana: 90, atk: 10, def: 7, dex: 6, intel: 12,
    abilities: [
      { key: "W", name: "Doğa Darbesi",   cost: 12, cd: 2.6, type: "nearest",  range: 6,   mult: 1.6, lifesteal: 0.4, color: "#4caf6d" },
      { key: "A", name: "Şifa Dalgası",   cost: 22, cd: 11,  type: "heal",     heal: 46,               color: "#4d8fd6" },
      { key: "S", name: "Diken Kökler",   cost: 18, cd: 9,   type: "aoe_self", radius: 4.4, mult: 1.2, cc: { type: "root", dur: 1.8 }, color: "#3f7a34" },
      { key: "D", name: "Ruhsal Uyanış",  cost: 36, cd: 20,  type: "buff",     atkBonus: 8, defBonus: 8, dur: 8, heal: 60, color: "#a24dd6" },
    ],
  },
};

const DUNGEONS = {
  ironcrypt: {
    id: "ironcrypt", name: "Demir Mahzen", glow: "#4d8fd6", tier: 0, minLevel: 1, theme: "iron",
    rooms: [
      { cx: 0,  cz: 24,  w: 22, d: 22, monsters: ["slime", "slime", "slime"] },
      { cx: 0,  cz: 0,   w: 13, d: 26, corridor: true, monsters: ["skeleton"] },
      { cx: 0,  cz: -28, w: 26, d: 24, monsters: ["skeleton", "skeleton", "champion"], boss: true, pillars: true },
    ],
  },
  shadowabyss: {
    id: "shadowabyss", name: "Gölge Uçurumu", glow: "#a24dd6", tier: 1, minLevel: 4, theme: "shadow",
    rooms: [
      { cx: 0,  cz: 24,  w: 24, d: 22, monsters: ["wraith", "wraith"] },
      { cx: 0,  cz: 0,   w: 13, d: 26, corridor: true, monsters: ["wraith"] },
      { cx: 0,  cz: -30, w: 28, d: 26, monsters: ["wraith", "wraith", "minotaur"], boss: true, pillars: true },
    ],
  },
};

function xpToNext(level) { return Math.round(45 * Math.pow(level, 1.55)); }
function newPlayer(name, cls) {
  const c = CLASS_DEFS[cls];
  return {
    name, cls, level: 1, xp: 0, xpNext: xpToNext(1),
    gold: 40,
    baseHp: c.hp, baseMana: c.mana, baseAtk: c.atk, baseDef: c.def, baseDex: c.dex, baseInt: c.intel,
    hp: c.hp, mana: c.mana,
    equipment: { weapon: null, armor: null, accessory: null },
    inventory: [],
  };
}
function effectiveStats(p) {
  const c = CLASS_DEFS[p.cls];
  let atk = p.baseAtk, def = p.baseDef, maxHp = p.baseHp, maxMana = p.baseMana;
  ["weapon", "armor", "accessory"].forEach((slot) => {
    const it = p.equipment[slot];
    if (!it) return;
    if (it.stat === "atk") atk += it.statValue;
    if (it.stat === "def") def += it.statValue;
    if (it.stat === "int") { maxMana += it.statValue * 2; atk += Math.round(it.statValue * 0.3); }
  });
  maxHp += (p.level - 1) * 12;
  maxMana += (p.level - 1) * 4;
  atk += (p.level - 1) * 1.5;
  def += (p.level - 1) * 0.8;
  if (p.buffUntil && performance.now() < p.buffUntil) { atk += p.buffAtk || 0; def += p.buffDef || 0; }
  return { atk, def, maxHp: Math.round(maxHp), maxMana: Math.round(maxMana), className: c.name, abilities: c.abilities, color: c.color };
}

/* =========================================================================
   Small helpers
   ========================================================================= */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; };
const ICONS = { sword: Sword, shield: Shield, gem: Gem, potion: FlaskConical };

/* =========================================================================
   THREE.js engine (imperative, lives in a ref, survives React re-renders)
   ========================================================================= */

function createHealthSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 40;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.0, 0.6, 1);
  sprite.renderOrder = 999;
  function redraw(name, ratio, boss) {
    ctx.clearRect(0, 0, 128, 40);
    ctx.font = boss ? "bold 15px Georgia" : "13px Georgia";
    ctx.textAlign = "center";
    ctx.fillStyle = boss ? "#e8703f" : "#e9dfc7";
    ctx.fillText(name, 64, 14);
    ctx.fillStyle = "#2a2420";
    ctx.fillRect(10, 20, 108, 8);
    ctx.fillStyle = ratio > 0.5 ? "#7fae4d" : ratio > 0.25 ? "#d6a84d" : "#c1502e";
    ctx.fillRect(10, 20, 108 * clamp(ratio, 0, 1), 8);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(10, 20, 108, 8);
    texture.needsUpdate = true;
  }
  return { sprite, redraw };
}

function buildCharacterMesh(colorHex, shape = "humanoid") {
  const g = new THREE.Group();
  const parts = {};
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.65, metalness: 0.1, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.85, flatShading: true });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.7, flatShading: true });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xc4ccd6, roughness: 0.3, metalness: 0.6, flatShading: true });

  if (shape === "slime") {
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 0), mat);
    body.position.y = 0.6; body.scale.y = 0.85; g.add(body); parts.body = body;
  } else if (shape === "wraith") {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 6), mat);
    body.position.y = 1.0; g.add(body); parts.body = body;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat);
    head.position.y = 1.9; g.add(head); parts.head = head;
  } else if (shape === "minotaur") {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.7), mat);
    torso.position.y = 1.1; g.add(torso); parts.body = torso;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.55), darkMat);
    head.position.y = 2.0; g.add(head); parts.head = head;
    const hornGeo = new THREE.ConeGeometry(0.08, 0.4, 5);
    [-0.2, 0.2].forEach((x) => { const h = new THREE.Mesh(hornGeo, new THREE.MeshStandardMaterial({ color: 0xe9dfc7, flatShading: true })); h.position.set(x, 2.3, 0); h.rotation.z = x > 0 ? -0.5 : 0.5; g.add(h); });
    const legGeo = new THREE.BoxGeometry(0.35, 0.9, 0.35);
    const legL = new THREE.Group(); legL.position.set(-0.3, 0.9, 0); const legLm = new THREE.Mesh(legGeo, darkMat); legLm.position.y = -0.45; legL.add(legLm); g.add(legL); parts.legL = legL;
    const legR = new THREE.Group(); legR.position.set(0.3, 0.9, 0); const legRm = new THREE.Mesh(legGeo, darkMat); legRm.position.y = -0.45; legR.add(legRm); g.add(legR); parts.legR = legR;
  } else {
    // humanoid (player / skeleton / champion)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.9, 6), mat);
    torso.position.y = 1.05; g.add(torso); parts.body = torso;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 0), shape === "skeleton" ? skinMat : mat);
    head.position.y = 1.72; g.add(head); parts.head = head;

    const legGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.75, 6);
    const legL = new THREE.Group(); legL.position.set(-0.16, 0.75, 0);
    const legLm = new THREE.Mesh(legGeo, darkMat); legLm.position.y = -0.375; legL.add(legLm); g.add(legL); parts.legL = legL;
    const legR = new THREE.Group(); legR.position.set(0.16, 0.75, 0);
    const legRm = new THREE.Mesh(legGeo, darkMat); legRm.position.y = -0.375; legR.add(legRm); g.add(legR); parts.legR = legR;

    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.65, 6);
    const armL = new THREE.Group(); armL.position.set(-0.46, 1.42, 0);
    const armLm = new THREE.Mesh(armGeo, mat); armLm.position.y = -0.32; armL.add(armLm); g.add(armL); parts.armL = armL;
    const armR = new THREE.Group(); armR.position.set(0.46, 1.42, 0);
    const armRm = new THREE.Mesh(armGeo, mat); armRm.position.y = -0.32; armR.add(armRm); g.add(armR); parts.armR = armR;

    // weapon, swung with the right arm during attacks
    const weapon = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.05), metalMat);
    blade.position.y = -0.62; weapon.add(blade);
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 5), darkMat);
    hilt.position.y = -0.34; weapon.add(hilt);
    armR.add(weapon); parts.weapon = weapon;

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), darkMat);
    nose.position.set(0, 1.05, 0.4); nose.rotation.x = Math.PI / 2; g.add(nose);
  }
  g.userData.parts = parts;
  g.userData.walkPhase = Math.random() * 10;
  return g;
}

function computeAttackT(group) {
  if (!group || !group.userData.attackStart) return null;
  const el = performance.now() - group.userData.attackStart;
  if (el >= group.userData.attackDur) { group.userData.attackStart = null; return null; }
  return el / group.userData.attackDur;
}
function triggerAttackAnim(group, dur = 260) {
  if (!group) return;
  group.userData.attackStart = performance.now();
  group.userData.attackDur = dur;
}
function animateCharacter(group, dt, opts) {
  if (!group) return;
  const parts = group.userData.parts || {};
  const moving = !!opts.moving;
  const attackT = opts.attackT;
  if (!parts.legL) {
    // non-humanoid: squash/stretch bob for movement + attack pulse
    if (group.userData.baseScale == null) group.userData.baseScale = group.scale.x || 1;
    const base = group.userData.baseScale;
    if (attackT != null) {
      const s = 1 - Math.sin(attackT * Math.PI) * 0.22;
      group.scale.y = base * s; group.scale.x = group.scale.z = base * (1 + (1 - s) * 0.35);
      group.position.y = 0;
    } else if (moving) {
      group.userData.walkPhase += dt * 7;
      const bob = Math.abs(Math.sin(group.userData.walkPhase)) * 0.14;
      group.position.y = bob;
      group.scale.y = base * (1 - bob * 0.3); group.scale.x = group.scale.z = base * (1 + bob * 0.1);
    } else {
      group.position.y = 0;
      group.scale.x += (base - group.scale.x) * 0.2; group.scale.y += (base - group.scale.y) * 0.2; group.scale.z += (base - group.scale.z) * 0.2;
    }
    return;
  }
  if (attackT != null) {
    const swing = Math.sin(attackT * Math.PI) * -1.7;
    parts.armR.rotation.x = swing;
    parts.armL.rotation.x = 0.15;
    parts.legL.rotation.x *= 0.7; parts.legR.rotation.x *= 0.7;
  } else if (moving) {
    group.userData.walkPhase += dt * 9;
    const ph = group.userData.walkPhase;
    parts.legL.rotation.x = Math.sin(ph) * 0.55;
    parts.legR.rotation.x = -Math.sin(ph) * 0.55;
    parts.armL.rotation.x = -Math.sin(ph) * 0.45;
    parts.armR.rotation.x = Math.sin(ph) * 0.45;
  } else {
    parts.legL.rotation.x *= 0.8; parts.legR.rotation.x *= 0.8;
    parts.armL.rotation.x *= 0.8; parts.armR.rotation.x *= 0.8;
  }
}

function makeDropMesh(kind, payload) {
  if (kind === "gold") {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 6), new THREE.MeshStandardMaterial({ color: 0xb98a3d, flatShading: true, emissive: 0x553a12, emissiveIntensity: 0.4, metalness: 0.55, roughness: 0.3 }));
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }
  const rdef = RARITIES[payload.rarity];
  const matOpts = { color: rdef.color, flatShading: true, emissive: rdef.color, emissiveIntensity: 0.4, roughness: 0.5 };
  const group = new THREE.Group();
  if (payload.type === "weapon") {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.58, 0.06), new THREE.MeshStandardMaterial(matOpts));
    blade.position.y = 0.3; group.add(blade);
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 5), new THREE.MeshStandardMaterial({ color: 0x2a2420, flatShading: true }));
    group.add(hilt);
  } else if (payload.type === "armor") {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.28), new THREE.MeshStandardMaterial(matOpts));
    chest.position.y = 0.22; group.add(chest);
  } else if (payload.type === "accessory") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 10), new THREE.MeshStandardMaterial(matOpts));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.24; group.add(ring);
  } else {
    const flask = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 0.34, 6), new THREE.MeshStandardMaterial({ color: rdef.color, flatShading: true, transparent: true, opacity: 0.85, emissive: rdef.color, emissiveIntensity: 0.4 }));
    flask.position.y = 0.2; group.add(flask);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.13, 5), new THREE.MeshStandardMaterial({ color: 0x8a7a5a, flatShading: true }));
    neck.position.y = 0.42; group.add(neck);
  }
  group.scale.setScalar(0.95);
  return group;
}

function flashMesh(group, color = 0xffffff) {
  group.traverse((o) => {
    if (o.isMesh) {
      if (!o.userData.origColor) o.userData.origColor = o.material.color.clone();
      o.material.emissive = new THREE.Color(color);
      o.material.emissiveIntensity = 0.9;
    }
  });
  group.userData.flashUntil = performance.now() + 120;
}

/* =========================================================================
   Main Component
   ========================================================================= */

export default function ErebosGame() {
  const [screen, setScreen] = useState("loading"); // loading | create | town | dungeon | dead
  const [hasSave, setHasSave] = useState(false);
  const [ui, setUi] = useState({ panel: null }); // panel: null|inventory|market|character
  const uiPanelRef = useRef(null);
  useEffect(() => { uiPanelRef.current = ui.panel; }, [ui.panel]);
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState(null);
  const [feed, setFeed] = useState([]);
  const [nearPortal, setNearPortal] = useState(null);
  const [flashDamage, setFlashDamage] = useState(false);

  const [inGame, setInGame] = useState(false);
  const sfxRef = useRef(null);
  function ensureSfx() {
    if (sfxRef.current) return sfxRef.current;
    const synth = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 } }).toDestination();
    const pluck = new Tone.PluckSynth().toDestination();
    const membrane = new Tone.MembraneSynth().toDestination();
    const metal = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.3, release: 0.05 }, harmonicity: 5.1, modulationIndex: 16, resonance: 2000, octaves: 0.7 }).toDestination();
    const noise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.005, decay: 0.15, sustain: 0 } }).toDestination();
    metal.volume.value = -14; noise.volume.value = -20; membrane.volume.value = -6;
    sfxRef.current = { synth, pluck, membrane, metal, noise };
    return sfxRef.current;
  }
  async function playSfx(name) {
    try {
      if (Tone.context.state !== "running") await Tone.start();
      const s = ensureSfx();
      const now = Tone.now();
      switch (name) {
        case "hit": s.pluck.triggerAttack("C4", now); break;
        case "ability": s.synth.triggerAttackRelease("E5", "16n", now); s.synth.triggerAttackRelease("G5", "16n", now + 0.06); break;
        case "levelup": ["C5", "E5", "G5", "C6"].forEach((n, i) => s.synth.triggerAttackRelease(n, "16n", now + i * 0.09)); break;
        case "loot": s.synth.triggerAttackRelease("A5", "32n", now); break;
        case "gold": s.metal.triggerAttackRelease("C6", "32n", now); break;
        case "death": s.membrane.triggerAttackRelease("C2", "8n", now); break;
        case "portal": s.noise.triggerAttackRelease("8n", now); break;
        case "buy": s.synth.triggerAttackRelease("C5", "16n", now); s.synth.triggerAttackRelease("E5", "16n", now + 0.05); break;
        default: break;
      }
    } catch (e) { /* audio blocked/unavailable — fail silently */ }
  }
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const gs = useRef({
    player: null, zone: "town", dungeonId: null,
    cooldowns: { W: 0, A: 0, S: 0, D: 0 },
    mana: 0, hp: 0,
  });
  const three = useRef({});
  const screenRef = useRef("town");
  const goScreen = useCallback((s) => { screenRef.current = s; setScreen(s); }, []);

  /* ---------------- fonts ---------------- */
  useEffect(() => {
    if (!document.getElementById("erebos-fonts")) {
      const link = document.createElement("link");
      link.id = "erebos-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Inter:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  /* ---------------- lock page scroll, full-viewport responsive shell ---------------- */
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    const hadMeta = !!meta;
    const prevContent = meta ? meta.getAttribute("content") : null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlHeight = document.documentElement.style.height;
    const prevBodyHeight = document.body.style.height;
    const prevBodyMargin = document.body.style.margin;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.style.height = "100%";
    document.body.style.height = "100%";
    document.body.style.margin = "0";

    return () => {
      if (!hadMeta) meta.remove(); else meta.setAttribute("content", prevContent || "");
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.height = prevHtmlHeight;
      document.body.style.height = prevBodyHeight;
      document.body.style.margin = prevBodyMargin;
    };
  }, []);

  /* ---------------- load save ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("erebos-save-v1", false);
        if (res && res.value) setHasSave(true);
      } catch (e) { /* no save */ }
      setScreen("create");
    })();
  }, []);

  const pushFeed = useCallback((shared, text) => {
    setFeed((f) => [{ id: Math.random(), text }, ...f].slice(0, 6));
    if (shared) {
      (async () => {
        try {
          let arr = [];
          try { const r = await window.storage.get("erebos-eventlog", true); arr = JSON.parse(r.value || "[]"); } catch (e) {}
          arr.unshift({ t: Date.now(), text });
          arr = arr.slice(0, 40);
          await window.storage.set("erebos-eventlog", JSON.stringify(arr), true);
        } catch (e) {}
      })();
    }
  }, []);

  const showToast = useCallback((text, kind = "info") => {
    setToast({ text, kind, id: Math.random() });
    setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 2200);
  }, []);

  /* ---------------- save ---------------- */
  const saveGame = useCallback(async () => {
    const p = gs.current.player;
    if (!p) return;
    try { await window.storage.set("erebos-save-v1", JSON.stringify(p), false); } catch (e) {}
  }, []);

  /* =====================================================================
     ENGINE SETUP — runs once
     ===================================================================== */
  useEffect(() => {
    if (!inGame) return;
    if (three.current.renderer) return; // already initialized

    const container = containerRef.current;
    const width = container.clientWidth, height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0a08);
    scene.fog = new THREE.FogExp2(0x0b0a08, 0.018);

    let viewSize = 20;
    const MIN_ZOOM = 11, MAX_ZOOM = 34;
    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 400);
    const camOffset = new THREE.Vector3(26, 28, 26);
    camera.position.copy(camOffset);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const hemi = new THREE.HemisphereLight(0x8fa7c9, 0x2a2015, 0.55);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe8c9, 1.05);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -46; sun.shadow.camera.right = 46;
    sun.shadow.camera.top = 46; sun.shadow.camera.bottom = -46;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0018;
    scene.add(sun);
    scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0x7f9fc9, 0.25);
    fill.position.set(-12, 14, -10);
    scene.add(fill);

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // player
    const playerGroup = new THREE.Group();
    scene.add(playerGroup);

    three.current = {
      scene, camera, renderer, worldGroup, playerGroup, camOffset, sun,
      monsters: [], drops: [], portals: [], interactables: [],
      projectiles: [], traps: [], fx: [],
      playerPos: new THREE.Vector3(0, 0, 8),
      playerFacing: 0,
      moveTarget: null, attackTarget: null, autoAtkCd: 0,
      raf: null, lastT: performance.now(),
      lastSync: 0, lastAutosave: 0,
      dashUntil: 0, dashVec: new THREE.Vector3(),
      raycaster: new THREE.Raycaster(),
      groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      mouseNDC: null,
    };

    function resize() {
      const w = container.clientWidth, h = container.clientHeight;
      const a = w / h;
      camera.left = -viewSize * a; camera.right = viewSize * a; camera.top = viewSize; camera.bottom = -viewSize;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    three.current.ro = ro;

    function onWheel(e) {
      if (uiPanelRef.current) return; // a panel is open — let it scroll normally
      e.preventDefault();
      const dir = Math.sign(e.deltaY);
      viewSize = clamp(viewSize + dir * 1.6, MIN_ZOOM, MAX_ZOOM);
      resize();
    }
    container.addEventListener("wheel", onWheel, { passive: false });

    function onMouseMove(e) {
      const rect = container.getBoundingClientRect();
      three.current.mouseNDC = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((e.clientY - rect.top) / rect.height) * 2 - 1),
      };
    }
    container.addEventListener("mousemove", onMouseMove);

    function onCanvasClick(e) {
      if (uiPanelRef.current) return;
      const t = three.current; const p = gs.current.player;
      if (!p || screenRef.current === "dead") return;
      const rect = canvasRef.current.getBoundingClientRect();
      const ndc = { x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: -(((e.clientY - rect.top) / rect.height) * 2 - 1) };
      t.raycaster.setFromCamera(ndc, t.camera);
      if (screenRef.current === "dungeon") {
        const meshes = t.monsters.filter((m) => m.alive).map((m) => m.group);
        const hits = t.raycaster.intersectObjects(meshes, true);
        if (hits.length > 0) {
          const mRef = findMonsterFromObject(hits[0].object);
          if (mRef) { t.attackTarget = mRef; t.moveTarget = null; spawnClickMarker(hits[0].point, true); return; }
        }
      }
      const hit = new THREE.Vector3();
      if (t.raycaster.ray.intersectPlane(t.groundPlane, hit)) {
        t.moveTarget = hit.clone();
        t.attackTarget = null;
        spawnClickMarker(hit, false);
      }
    }
    canvasRef.current.addEventListener("click", onCanvasClick);

    function onKeyDown(e) {
      if (e.repeat) return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(k)) { if (!uiPanelRef.current) triggerAbility(k.toUpperCase()); return; }
      if (k === "f") { doInteract(); return; }
      if (k === "i") { setUi((u) => ({ panel: u.panel === "inventory" ? null : "inventory" })); return; }
      if (k === "m") { setUi((u) => ({ panel: u.panel === "map" ? null : "map" })); return; }
      if (k === "p") { setUi((u) => ({ panel: u.panel === "market" ? null : "market" })); return; }
      if (k === "escape") { setUi({ panel: null }); return; }
    }
    function onKeyUp() {}
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    three.current.onKeyDown = onKeyDown;
    three.current.onKeyUp = onKeyUp;

    buildZone(gs.current.zone, gs.current.dungeonId);

    three.current.raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(three.current.raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("mousemove", onMouseMove);
      if (canvasRef.current) canvasRef.current.removeEventListener("click", onCanvasClick);
      renderer.dispose();
      three.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inGame]);

  /* ---------------- zone building ---------------- */
  function clearZone() {
    const t = three.current;
    if (!t.worldGroup) return;
    while (t.worldGroup.children.length) {
      const o = t.worldGroup.children.pop();
      o.traverse((c) => { if (c.isMesh) { c.geometry.dispose(); if (c.material.map) c.material.map.dispose(); c.material.dispose(); } });
    }
    if (t.skyDome) { t.scene.remove(t.skyDome); t.skyDome.geometry.dispose(); t.skyDome.material.dispose(); t.skyDome = null; }
    t.monsters = []; t.drops = []; t.portals = []; t.interactables = []; t.pond = null;
    t.projectiles = []; t.traps = []; t.fx = []; t.attackTarget = null; t.moveTarget = null;
    t.pondMesh = null; t.seaMesh = null;
  }

  function enableShadows(root) {
    root.traverse((o) => {
      if (o.userData.noShadow) return;
      if (o.isInstancedMesh) { o.castShadow = false; o.receiveShadow = false; return; }
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  function groundMesh(w, d, color) {
    const geo = new THREE.PlaneGeometry(w, d, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  function wallMesh(w, h, d, color = 0x1c1815) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
    return new THREE.Mesh(geo, mat);
  }
  function buildSkyDome(topColor, bottomColor, radius) {
    const geo = new THREE.SphereGeometry(radius, 20, 14);
    const pos = geo.attributes.position;
    const top = new THREE.Color(topColor), bottom = new THREE.Color(bottomColor);
    const colors = [];
    for (let i = 0; i < pos.count; i++) {
      const k = THREE.MathUtils.clamp((pos.getY(i) / radius) * 0.6 + 0.42, 0, 1);
      const c = bottom.clone().lerp(top, k);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.noShadow = true;
    mesh.renderOrder = -10;
    return mesh;
  }
  function addDirtPath(group, x1, z1, x2, z2, width) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(1, Math.ceil(len / (width * 0.55)));
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const x = x1 + (x2 - x1) * k, z = z1 + (z2 - z1) * k;
      const patch = new THREE.Mesh(new THREE.CircleGeometry(width / 2 + Math.random() * 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x5a4a2e, flatShading: true, roughness: 0.95 }));
      patch.rotation.x = -Math.PI / 2; patch.rotation.z = Math.random() * Math.PI; patch.position.set(x, 0.013, z);
      group.add(patch);
    }
  }
  function addLamp(group, x, z, color = 0xffbb66) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x2a2420, flatShading: true }));
    pole.position.set(x, 1.1, z);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, flatShading: true }));
    head.position.set(x, 2.35, z);
    const light = new THREE.PointLight(color, 0.85, 10, 2);
    light.position.set(x, 2.35, z);
    group.add(pole, head, light);
  }
  function addWell(group, x, z) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0x6a655c, flatShading: true }));
    base.position.set(x, 0.45, z);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.05, 10), new THREE.MeshStandardMaterial({ color: 0x2f7fa0, flatShading: true, emissive: 0x0f3a4a, emissiveIntensity: 0.35 }));
    water.rotation.x = -Math.PI / 2; water.position.set(x, 0.91, z);
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3323, flatShading: true });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dz]) => { const p = new THREE.Mesh(postGeo, postMat); p.position.set(x + dx, 1.7, z + dz); group.add(p); });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1, 4), new THREE.MeshStandardMaterial({ color: 0x5a2a20, flatShading: true }));
    roof.position.set(x, 2.9, z); roof.rotation.y = Math.PI / 4;
    group.add(base, water, roof);
  }
  function addPillar(group, x, z, h, color) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, h, 8), new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 }));
    p.position.set(x, h / 2, z);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 1.3), new THREE.MeshStandardMaterial({ color, flatShading: true }));
    cap.position.set(x, h + 0.1, z);
    group.add(p, cap);
  }
  function addSarcophagus(group, x, z, rot) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: 0x454f5c, flatShading: true, roughness: 0.85 }));
    body.position.set(x, 0.45, z); body.rotation.y = rot;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.16, 0.82), new THREE.MeshStandardMaterial({ color: 0x5c6b7c, flatShading: true, metalness: 0.25, roughness: 0.5 }));
    lid.position.set(x, 0.96, z); lid.rotation.y = rot;
    group.add(body, lid);
  }
  function addCrystalCluster(group, x, z, color) {
    for (let i = 0; i < 4; i++) {
      const h = 0.6 + Math.random() * 1.1;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.16 + Math.random() * 0.12, h, 5), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, flatShading: true, transparent: true, opacity: 0.9 }));
      c.position.set(x + (Math.random() - 0.5) * 0.7, h / 2, z + (Math.random() - 0.5) * 0.7);
      c.rotation.z = (Math.random() - 0.5) * 0.5; c.rotation.x = (Math.random() - 0.5) * 0.5;
      group.add(c);
    }
  }
  function addTorch(group, x, z, color, withLight) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x2a2420, flatShading: true }));
    pole.position.set(x, 0.7, z);
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, flatShading: true }));
    flame.position.set(x, 1.5, z);
    group.add(pole, flame);
    if (withLight) { const l = new THREE.PointLight(color, 0.75, 9, 2); l.position.set(x, 1.6, z); group.add(l); }
  }

  function addMonster(defKey, x, z) {
    const def = MONSTER_DEFS[defKey];
    const group = buildCharacterMesh(def.color, def.shape);
    group.scale.setScalar(def.scale);
    group.position.set(x, 0, z);
    const hpBar = createHealthSprite();
    hpBar.sprite.position.set(0, 2.6 * def.scale, 0);
    group.add(hpBar.sprite);
    const hitSphere = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hitSphere.position.y = 1;
    group.add(hitSphere);
    const m = {
      key: defKey, def, group, hpBar,
      hp: def.hp, hpMax: def.hp,
      pos: new THREE.Vector3(x, 0, z),
      state: "idle", atkCd: 0, alive: true,
      ccType: null, ccUntil: 0, slowMult: 1, poison: null,
    };
    group.userData.monsterRef = m;
    hpBar.redraw(def.name, 1, def.boss);
    three.current.worldGroup.add(group);
    three.current.monsters.push(m);
  }

  function findMonsterFromObject(obj) {
    let o = obj;
    while (o) { if (o.userData && o.userData.monsterRef) return o.userData.monsterRef; o = o.parent; }
    return null;
  }

  function addDrop(x, z, kind, payload) {
    const t = three.current;
    const mesh = makeDropMesh(kind, payload);
    mesh.position.set(x, 0.6, z);
    t.worldGroup.add(mesh);
    t.drops.push({ mesh, kind, payload, bornAt: performance.now(), pos: new THREE.Vector3(x, 0.6, z) });
  }

  function buildTown() {
    const t = three.current;
    clearZone();
    t.scene.fog = new THREE.Fog(0x8fb0c4, 60, 220);
    t.scene.background = new THREE.Color(0x8fb0c4);
    t.skyDome = buildSkyDome(0x2a6fb8, 0xdcebf2, 260);
    t.scene.add(t.skyDome);

    const TOWN_RADIUS = 78;
    const MOUNTAIN_RADIUS = 84;
    const pondPos = new THREE.Vector3(-30, 0, 26);
    const pondRadius = 8.5;

    // sea, glimpsed beyond a gap in the mountain ring (north side)
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 260), new THREE.MeshStandardMaterial({ color: 0x1f6580, flatShading: true, roughness: 0.3, metalness: 0.3, emissive: 0x0a2a3a, emissiveIntensity: 0.35 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.4, -220);
    sea.userData.noShadow = true;
    t.worldGroup.add(sea);
    t.seaMesh = sea;

    // base grass field
    const ground = groundMesh(TOWN_RADIUS * 2.2, TOWN_RADIUS * 2.2, 0x3f6b34);
    t.worldGroup.add(ground);

    // mottled grass patches for natural color variation
    for (let i = 0; i < 70; i++) {
      const ang = Math.random() * Math.PI * 2, rad = Math.random() * TOWN_RADIUS * 0.92;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const patch = new THREE.Mesh(new THREE.CircleGeometry(3 + Math.random() * 5, 6), new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x4a7a3a : 0x35592b, flatShading: true }));
      patch.rotation.x = -Math.PI / 2; patch.rotation.z = Math.random() * Math.PI; patch.position.set(x, 0.01, z);
      t.worldGroup.add(patch);
    }
    // small flower speckles for charm
    [0xe8d34c, 0xe8703f, 0xe9dfc7].forEach((color) => {
      const geo = new THREE.SphereGeometry(0.09, 5, 4);
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, flatShading: true });
      const inst = new THREE.InstancedMesh(geo, mat, 70);
      const dm = new THREE.Object3D();
      let n = 0, tries = 0;
      while (n < 70 && tries < 300) {
        tries++;
        const ang = Math.random() * Math.PI * 2, rad = 14 + Math.random() * TOWN_RADIUS * 0.8;
        const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
        if (Math.hypot(x - pondPos.x, z - pondPos.z) < pondRadius + 1) continue;
        dm.position.set(x, 0.2, z); dm.updateMatrix();
        inst.setMatrixAt(n, dm.matrix); n++;
      }
      inst.count = n;
      t.worldGroup.add(inst);
    });

    // dirt plaza + paths connecting the landmarks
    const ring = new THREE.Mesh(new THREE.CircleGeometry(15, 24), new THREE.MeshStandardMaterial({ color: 0x5a4a2e, flatShading: true }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.015;
    t.worldGroup.add(ring);
    addDirtPath(t.worldGroup, 0, 4, -19, -8, 2.4);
    addDirtPath(t.worldGroup, 0, 4, 16, 9, 2.4);
    addDirtPath(t.worldGroup, 0, 6, -17, -26, 2.6);
    addDirtPath(t.worldGroup, 0, 6, 17, -26, 2.6);

    // well, plaza centerpiece
    addWell(t.worldGroup, 0, -3);

    // pond + reeds + lily pads
    const pond = new THREE.Mesh(new THREE.CircleGeometry(pondRadius, 22), new THREE.MeshStandardMaterial({ color: 0x2f7fa0, flatShading: true, roughness: 0.2, metalness: 0.35, transparent: true, opacity: 0.88, emissive: 0x0f3a4a, emissiveIntensity: 0.3 }));
    pond.rotation.x = -Math.PI / 2; pond.position.set(pondPos.x, 0.03, pondPos.z);
    pond.userData.noShadow = true;
    t.worldGroup.add(pond);
    t.pondMesh = pond;
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const rx = pondPos.x + Math.cos(ang) * (pondRadius + 0.6), rz = pondPos.z + Math.sin(ang) * (pondRadius + 0.6);
      const reed = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9, 5), new THREE.MeshStandardMaterial({ color: 0x4a7a3a, flatShading: true }));
      reed.position.set(rx, 0.45, rz); t.worldGroup.add(reed);
    }
    for (let i = 0; i < 5; i++) {
      const ang = Math.random() * Math.PI * 2, rad = Math.random() * pondRadius * 0.6;
      const lily = new THREE.Mesh(new THREE.CircleGeometry(0.4 + Math.random() * 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x3f7a34, flatShading: true }));
      lily.rotation.x = -Math.PI / 2; lily.position.set(pondPos.x + Math.cos(ang) * rad, 0.06, pondPos.z + Math.sin(ang) * rad);
      lily.userData.noShadow = true;
      t.worldGroup.add(lily);
    }
    t.pond = { pos: pondPos, radius: pondRadius };

    // near mountain ring (climbable boundary), gap toward the sea (north, negative Z)
    const mCount = 34;
    for (let i = 0; i < mCount; i++) {
      const ang = (i / mCount) * Math.PI * 2;
      const dirZ = Math.sin(ang), dirX = Math.cos(ang);
      if (dirZ < -0.55 && Math.abs(dirX) < 0.8) continue;
      const rad = MOUNTAIN_RADIUS + (Math.random() - 0.5) * 8;
      const x = dirX * rad, z = dirZ * rad;
      const h = 11 + Math.random() * 15;
      const mMesh = new THREE.Mesh(new THREE.ConeGeometry(7 + Math.random() * 4, h, 6), new THREE.MeshStandardMaterial({ color: 0x5a5850, flatShading: true, roughness: 0.95 }));
      mMesh.position.set(x, h / 2 - 1, z);
      mMesh.rotation.y = Math.random() * Math.PI;
      t.worldGroup.add(mMesh);
      if (h > 19) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(3, 4.5, 6), new THREE.MeshStandardMaterial({ color: 0xe8e4da, flatShading: true }));
        cap.position.set(x, h - 2.4, z);
        t.worldGroup.add(cap);
      }
    }
    // distant second mountain ring for parallax depth (hazy, desaturated)
    const farCount = 26;
    for (let i = 0; i < farCount; i++) {
      const ang = (i / farCount) * Math.PI * 2;
      const dirZ = Math.sin(ang), dirX = Math.cos(ang);
      if (dirZ < -0.5 && Math.abs(dirX) < 0.9) continue;
      const rad = MOUNTAIN_RADIUS + 26 + Math.random() * 14;
      const x = dirX * rad, z = dirZ * rad;
      const h = 18 + Math.random() * 20;
      const far = new THREE.Mesh(new THREE.ConeGeometry(9 + Math.random() * 5, h, 6), new THREE.MeshStandardMaterial({ color: 0x8a9bb0, flatShading: true, roughness: 1, fog: true }));
      far.position.set(x, h / 2 - 1, z);
      far.userData.noShadow = true;
      t.worldGroup.add(far);
    }
    // low coastal cliffs framing the sea gap
    for (let i = -1; i <= 1; i += 2) {
      const cliff = new THREE.Mesh(new THREE.ConeGeometry(9, 9, 6), new THREE.MeshStandardMaterial({ color: 0x6a655c, flatShading: true }));
      cliff.position.set(i * 34, 3.5, -76);
      t.worldGroup.add(cliff);
    }

    // scattered trees, pines, bushes & rocks
    for (let i = 0; i < 65; i++) {
      const ang = Math.random() * Math.PI * 2, rad = 20 + Math.random() * (TOWN_RADIUS * 0.75);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (Math.hypot(x - pondPos.x, z - pondPos.z) < pondRadius + 3) continue;
      if (Math.hypot(x, z) < 16) continue;
      const roll = Math.random();
      if (roll < 0.4) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 2, 6), new THREE.MeshStandardMaterial({ color: 0x4a3323, flatShading: true }));
        trunk.position.set(x, 1, z);
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + Math.random() * 0.5, 0), new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x3f7a34 : 0x4a8a3a, flatShading: true }));
        leaves.position.set(x, 2.5 + Math.random() * 0.4, z);
        t.worldGroup.add(trunk, leaves);
      } else if (roll < 0.62) {
        // pine, stacked cones — more common near the mountain ring
        const dist = Math.hypot(x, z);
        if (dist < MOUNTAIN_RADIUS * 0.55 && Math.random() > 0.35) { /* thin out near center */ }
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, flatShading: true }));
        trunk.position.set(x, 0.8, z);
        const tiers = [[1.1, 1.6, 1.6], [0.85, 1.4, 2.7], [0.6, 1.2, 3.7]];
        const pineMat = new THREE.MeshStandardMaterial({ color: 0x2f5f38, flatShading: true });
        const grp = new THREE.Group();
        tiers.forEach(([r, h, y]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), pineMat); c.position.set(x, y, z); grp.add(c); });
        t.worldGroup.add(trunk, grp);
      } else if (roll < 0.8) {
        const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.35, 0), new THREE.MeshStandardMaterial({ color: 0x3f6a34, flatShading: true }));
        bush.position.set(x, 0.35, z); bush.scale.y = 0.7;
        t.worldGroup.add(bush);
      } else {
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + Math.random() * 0.6, 0), new THREE.MeshStandardMaterial({ color: 0x6a655c, flatShading: true }));
        rock.position.set(x, 0.3, z); rock.rotation.set(Math.random(), Math.random(), Math.random());
        t.worldGroup.add(rock);
      }
    }

    // grass tufts, instanced for performance
    const tuftGeo = new THREE.ConeGeometry(0.06, 0.35, 4);
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0x5a9a45, flatShading: true });
    const tuftCount = 600;
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
    const dummy = new THREE.Object3D();
    let placed = 0, attempts = 0;
    while (placed < tuftCount && attempts < tuftCount * 3) {
      attempts++;
      const ang = Math.random() * Math.PI * 2, rad = Math.random() * TOWN_RADIUS * 0.88;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (Math.hypot(x - pondPos.x, z - pondPos.z) < pondRadius + 1) continue;
      if (Math.hypot(x, z) < 11) continue;
      dummy.position.set(x, 0.17, z);
      dummy.rotation.y = Math.random() * Math.PI;
      const s = 0.7 + Math.random() * 0.8;
      dummy.scale.set(s, s * (0.7 + Math.random() * 0.6), s);
      dummy.updateMatrix();
      tufts.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    tufts.count = placed;
    t.worldGroup.add(tufts);

    // blacksmith building (interactable shop)
    const smith = new THREE.Group();
    const smithBody = wallMesh(6, 4, 5, 0x3a332b); smithBody.position.set(-19, 2, -8);
    t.interactables.push({ type: "shop", pos: new THREE.Vector3(-19, 0, -8), radius: 3.4, label: "Demirci" });
    const smithRoof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.4, 4), new THREE.MeshStandardMaterial({ color: 0x5a2a20, flatShading: true }));
    smithRoof.position.set(-19, 5.2, -8); smithRoof.rotation.y = Math.PI / 4;
    const forge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.1), new THREE.MeshStandardMaterial({ color: 0x2a2420, flatShading: true }));
    forge.position.set(-19, 0.4, -5);
    const ember = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0xe8703f, emissive: 0xe8703f, emissiveIntensity: 1.4, flatShading: true }));
    ember.position.set(-19, 0.85, -5);
    const emberLight = new THREE.PointLight(0xe8703f, 0.7, 6, 2); emberLight.position.set(-19, 1, -5);
    smith.add(smithBody, smithRoof, forge, ember, emberLight);
    t.worldGroup.add(smith);

    // marketplace stall
    const stall = new THREE.Group();
    const post = (x, z) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), new THREE.MeshStandardMaterial({ color: 0x4a3b28, flatShading: true })); p.position.set(x, 1.5, z); return p; };
    [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([x, z]) => stall.add(post(16 + x, 9 + z)));
    const awning = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.2, 4.6), new THREE.MeshStandardMaterial({ color: 0xc1502e, flatShading: true }));
    awning.position.set(16, 3, 9);
    stall.add(awning);
    const table = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 2), new THREE.MeshStandardMaterial({ color: 0x5a4a30, flatShading: true }));
    table.position.set(16, 0.45, 9);
    stall.add(table);
    t.worldGroup.add(stall);
    t.interactables.push({ type: "market", pos: new THREE.Vector3(16, 0, 9), radius: 3.2, label: "Pazar" });

    // dungeon portals, with banners
    Object.values(DUNGEONS).forEach((dg, i) => {
      const px = i === 0 ? -17 : 17, pz = -26;
      const portal = new THREE.Group();
      const ringGeo = new THREE.TorusGeometry(2.1, 0.28, 8, 16);
      const glowColor = new THREE.Color(dg.glow);
      const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0x1c1815, emissive: glowColor, emissiveIntensity: 0.9, flatShading: true }));
      ringMesh.position.set(px, 2.2, pz);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 20), new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
      disc.position.set(px, 2.2, pz);
      disc.userData.noShadow = true;
      portal.add(ringMesh, disc);
      const base = wallMesh(4.6, 0.4, 2, 0x1c1815); base.position.set(px, 0.2, pz);
      portal.add(base);
      [-2.6, 2.6].forEach((dx) => {
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), new THREE.MeshStandardMaterial({ color: glowColor, flatShading: true, side: THREE.DoubleSide }));
        banner.position.set(px + dx, 3.4, pz - 1.1);
        portal.add(banner);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 6), new THREE.MeshStandardMaterial({ color: 0x2a2420, flatShading: true }));
        pole.position.set(px + dx, 2.3, pz - 1.1);
        portal.add(pole);
      });
      const glowLight = new THREE.PointLight(glowColor, 0.6, 7, 2); glowLight.position.set(px, 2.2, pz);
      portal.add(glowLight);
      t.worldGroup.add(portal);
      t.portals.push({ id: dg.id, pos: new THREE.Vector3(px, 0, pz), radius: 3, name: dg.name, minLevel: dg.minLevel });
      t.interactables.push({ type: "portal", dungeonId: dg.id, pos: new THREE.Vector3(px, 0, pz), radius: 3, label: `${dg.name}'e gir` });
    });

    // lamp posts lighting the paths and plaza
    [[-7, -3], [7, -3], [-7, 5], [7, 5]].forEach(([x, z]) => addLamp(t.worldGroup, x, z, 0xe8703f));
    [[-9, -17], [9, -17]].forEach(([x, z]) => addLamp(t.worldGroup, x, z, 0xd6a84d));

    enableShadows(t.worldGroup);
    t.townRadius = TOWN_RADIUS;
    t.playerPos.set(0, 0, 6);
    positionPlayer();
  }

  function buildDungeon(dungeonId) {
    const t = three.current;
    clearZone();
    const dg = DUNGEONS[dungeonId];
    const theme = dg.theme || "iron";
    const iron = theme === "iron";
    const palette = iron
      ? { fog: 0x0b0f14, floor: 0x232a30, corridor: 0x1a2024, wall: 0x1c2228, wallEdge: 0x2a343c, pillar: 0x3a4048, torch: 0xe8703f, prop: 0x454f5c }
      : { fog: 0x0d0714, floor: 0x241a2c, corridor: 0x1c1420, wall: 0x1e1424, wallEdge: 0x2c1e34, pillar: 0x2a2030, torch: 0xa24dd6, prop: 0x3a2a44 };
    t.scene.fog = new THREE.FogExp2(palette.fog, 0.021);
    t.scene.background = new THREE.Color(palette.fog);

    dg.rooms.forEach((room) => {
      const g = groundMesh(room.w, room.d, room.corridor ? palette.corridor : palette.floor);
      g.position.set(room.cx, 0, room.cz);
      t.worldGroup.add(g);

      if (room.boss) {
        // glowing rune-circle marking the boss arena
        const rad = Math.min(room.w, room.d) * 0.3;
        const rune = new THREE.Mesh(new THREE.RingGeometry(rad * 0.82, rad, 28), new THREE.MeshBasicMaterial({ color: dg.glow, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
        rune.rotation.x = -Math.PI / 2; rune.position.set(room.cx, 0.03, room.cz);
        rune.userData.noShadow = true;
        const rune2 = new THREE.Mesh(new THREE.RingGeometry(rad * 0.5, rad * 0.56, 24), new THREE.MeshBasicMaterial({ color: dg.glow, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
        rune2.rotation.x = -Math.PI / 2; rune2.position.set(room.cx, 0.03, room.cz);
        rune2.userData.noShadow = true;
        t.worldGroup.add(rune, rune2);
      }

      // wall borders (only for non-corridor rooms, skip shared edges roughly)
      if (!room.corridor) {
        const wallH = 3.4;
        const north = wallMesh(room.w, wallH, 0.5, palette.wall); north.position.set(room.cx, wallH / 2, room.cz - room.d / 2);
        const south = wallMesh(room.w, wallH, 0.5, palette.wall); south.position.set(room.cx, wallH / 2, room.cz + room.d / 2);
        const east = wallMesh(0.5, wallH, room.d, palette.wall); east.position.set(room.cx + room.w / 2, wallH / 2, room.cz);
        const west = wallMesh(0.5, wallH, room.d, palette.wall); west.position.set(room.cx - room.w / 2, wallH / 2, room.cz);
        [north, south, east, west].forEach((w) => t.worldGroup.add(w));
        // trim strip along the top of the walls for a less flat look
        const trimH = 0.35;
        const trimMat = () => new THREE.MeshStandardMaterial({ color: palette.wallEdge, flatShading: true, roughness: 0.7 });
        const nt = new THREE.Mesh(new THREE.BoxGeometry(room.w, trimH, 0.6), trimMat()); nt.position.set(room.cx, wallH, room.cz - room.d / 2);
        const stT = new THREE.Mesh(new THREE.BoxGeometry(room.w, trimH, 0.6), trimMat()); stT.position.set(room.cx, wallH, room.cz + room.d / 2);
        t.worldGroup.add(nt, stT);

        // corner torches, real light only on the first corner per room to limit light count
        const corners = [
          [room.cx - room.w / 2 + 1.6, room.cz - room.d / 2 + 1.6],
          [room.cx + room.w / 2 - 1.6, room.cz - room.d / 2 + 1.6],
          [room.cx - room.w / 2 + 1.6, room.cz + room.d / 2 - 1.6],
          [room.cx + room.w / 2 - 1.6, room.cz + room.d / 2 - 1.6],
        ];
        corners.forEach((c, i) => addTorch(t.worldGroup, c[0], c[1], palette.torch, i === 0 || (room.boss && i === 2)));

        if (room.pillars) {
          const pillarCount = 6;
          const rad = Math.min(room.w, room.d) * 0.36;
          for (let i = 0; i < pillarCount; i++) {
            const a = (i / pillarCount) * Math.PI * 2;
            addPillar(t.worldGroup, room.cx + Math.cos(a) * rad, room.cz + Math.sin(a) * rad, 3.3, palette.pillar);
          }
        }

        if (iron) {
          if (!room.boss) {
            addSarcophagus(t.worldGroup, room.cx - room.w / 2 + 2.4, room.cz, Math.PI / 2);
            addSarcophagus(t.worldGroup, room.cx + room.w / 2 - 2.4, room.cz, Math.PI / 2);
          }
          // rubble
          for (let i = 0; i < 4; i++) {
            const rx = room.cx + (Math.random() - 0.5) * room.w * 0.7, rz = room.cz + (Math.random() - 0.5) * room.d * 0.7;
            const rub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.3, 0), new THREE.MeshStandardMaterial({ color: 0x3a3f46, flatShading: true }));
            rub.position.set(rx, 0.25, rz); rub.rotation.set(Math.random(), Math.random(), Math.random());
            t.worldGroup.add(rub);
          }
        } else {
          const crystalCount = room.boss ? 5 : 3;
          for (let i = 0; i < crystalCount; i++) {
            const cx2 = room.cx + (Math.random() - 0.5) * room.w * 0.65;
            const cz2 = room.cz + (Math.random() - 0.5) * room.d * 0.65;
            addCrystalCluster(t.worldGroup, cx2, cz2, dg.glow);
          }
          // glowing floor cracks
          for (let i = 0; i < 3; i++) {
            const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2 + Math.random() * 2), new THREE.MeshBasicMaterial({ color: dg.glow, transparent: true, opacity: 0.45 }));
            crack.rotation.x = -Math.PI / 2; crack.rotation.z = Math.random() * Math.PI;
            crack.position.set(room.cx + (Math.random() - 0.5) * room.w * 0.6, 0.025, room.cz + (Math.random() - 0.5) * room.d * 0.6);
            crack.userData.noShadow = true;
            t.worldGroup.add(crack);
          }
        }
      }

      (room.monsters || []).forEach((mk, idx) => {
        const angle = (idx / Math.max(1, room.monsters.length)) * Math.PI * 2;
        const rad = Math.min(room.w, room.d) * 0.28;
        addMonster(mk, room.cx + Math.cos(angle) * rad, room.cz + Math.sin(angle) * rad);
      });
    });

    // atmospheric ceiling over the whole dungeon footprint
    const allX = dg.rooms.flatMap((r) => [r.cx - r.w / 2, r.cx + r.w / 2]);
    const allZ = dg.rooms.flatMap((r) => [r.cz - r.d / 2, r.cz + r.d / 2]);
    const cw = Math.max(...allX) - Math.min(...allX), cd = Math.max(...allZ) - Math.min(...allZ);
    const ccx = (Math.max(...allX) + Math.min(...allX)) / 2, ccz = (Math.max(...allZ) + Math.min(...allZ)) / 2;
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(cw + 14, cd + 14), new THREE.MeshBasicMaterial({ color: palette.fog, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ceiling.rotation.x = Math.PI / 2; ceiling.position.set(ccx, 9.5, ccz);
    ceiling.userData.noShadow = true;
    t.worldGroup.add(ceiling);

    // exit portal + entrance gate, near entrance room
    const entrance = dg.rooms[0];
    const exitPos = new THREE.Vector3(entrance.cx, 0, entrance.cz + entrance.d / 2 - 2);
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.24, 10, 20), new THREE.MeshStandardMaterial({ color: 0x1c1815, emissive: 0xe9dfc7, emissiveIntensity: 0.7 }));
    ringMesh.position.set(exitPos.x, 2, exitPos.z);
    t.worldGroup.add(ringMesh);
    [-2.4, 2.4].forEach((dx) => addPillar(t.worldGroup, exitPos.x + dx, exitPos.z + 1.6, 3, palette.pillar));
    t.interactables.push({ type: "exit", pos: exitPos, radius: 3, label: "Kasabaya dön" });

    enableShadows(t.worldGroup);
    t.playerPos.set(entrance.cx, 0, entrance.cz + entrance.d / 2 - 4);
    positionPlayer();
  }

  function buildZone(zone, dungeonId) {
    const p = gs.current.player;
    const t = three.current;
    // (re)build player mesh with class color
    if (t.playerGroup) {
      while (t.playerGroup.children.length) t.playerGroup.remove(t.playerGroup.children[0]);
      const stats = effectiveStats(p);
      const mesh = buildCharacterMesh(stats.color, "humanoid");
      mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      t.playerGroup.add(mesh);
      t.playerMesh = mesh;
    }
    if (zone === "town") buildTown();
    else buildDungeon(dungeonId);
  }

  function positionPlayer() {
    const t = three.current;
    t.playerGroup.position.copy(t.playerPos);
    t.camera.position.copy(t.playerPos).add(t.camOffset);
    t.camera.lookAt(t.playerPos);
    if (t.sun) {
      t.sun.position.set(t.playerPos.x + 18, t.playerPos.y + 30, t.playerPos.z + 12);
      t.sun.target.position.copy(t.playerPos);
      t.sun.target.updateMatrixWorld();
    }
  }

  /* ---------------- interaction ---------------- */
  function doInteract() {
    const t = three.current;
    const near = t.nearInteract;
    if (!near) return;
    if (near.type === "market") setUi({ panel: "market" });
    if (near.type === "shop") { ensureShopStock(); setUi({ panel: "shop" }); }
    if (near.type === "portal") enterDungeon(near.dungeonId);
    if (near.type === "exit") returnToTown();
  }

  function enterDungeon(dungeonId) {
    const dg = DUNGEONS[dungeonId];
    const p = gs.current.player;
    if (p && p.level < dg.minLevel) {
      showToast(`Dikkat: bu zindan Seviye ${dg.minLevel}+ için tasarlandı!`, "bad");
    }
    gs.current.zone = "dungeon";
    gs.current.dungeonId = dungeonId;
    buildZone("dungeon", dungeonId);
    goScreen("dungeon");
    playSfx("portal");
    pushFeed(true, `${gs.current.player.name} ${dg.name}'e girdi.`);
  }
  function returnToTown() {
    gs.current.zone = "town";
    buildZone("town", null);
    goScreen("town");
    playSfx("portal");
    saveGame();
  }

  /* ---------------- combat ---------------- */
  function damageMonster(m, amount) {
    if (!m.alive) return;
    m.hp = Math.max(0, m.hp - amount);
    m.hpBar.redraw(m.def.name, m.hp / m.hpMax, m.def.boss);
    flashMesh(m.group, 0xffffff);
    if (m.hp <= 0) killMonster(m);
  }
  function killMonster(m) {
    m.alive = false;
    three.current.worldGroup.remove(m.group);
    three.current.monsters = three.current.monsters.filter((x) => x !== m);
    const p = gs.current.player;
    const gold = Math.round((6 + Math.random() * 10) * (1 + m.def.tier));
    addDrop(m.pos.x + (Math.random() - 0.5), m.pos.z + (Math.random() - 0.5), "gold", gold);
    const dropChance = m.def.boss ? 1 : 0.55;
    if (Math.random() < dropChance) {
      const item = m.def.boss ? makeItem(rollRarity(2 + m.def.tier) === "common" ? "uncommon" : undefined, m.def.tier) : makeItem(undefined, m.def.tier);
      addDrop(m.pos.x + (Math.random() - 0.5) * 1.4, m.pos.z + (Math.random() - 0.5) * 1.4, "item", item);
    }
    gainXp(m.def.xp);
    if (m.def.boss) { pushFeed(true, `${p.name}, ${m.def.name} adlı canavarı alt etti!`); showToast(`${m.def.name} yenildi!`, "good"); }
  }
  function gainXp(amount) {
    const p = gs.current.player;
    p.xp += amount;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level += 1;
      p.xpNext = xpToNext(p.level);
      const st = effectiveStats(p);
      p.hp = st.maxHp; p.mana = st.maxMana;
      showToast(`Seviye atladın! Seviye ${p.level}`, "good");
      playSfx("levelup");
    }
  }

  function abilityTargets(type, origin, range) {
    return three.current.monsters.filter((m) => m.alive && dist2(m.pos, origin) <= range * range);
  }
  function nearestMonster(origin, range) {
    let best = null, bd = Infinity;
    three.current.monsters.forEach((m) => {
      if (!m.alive) return;
      const d = dist2(m.pos, origin);
      if (d <= range * range && d < bd) { bd = d; best = m; }
    });
    return best;
  }

  function getAimPoint() {
    const t = three.current;
    if (t.mouseNDC) {
      t.raycaster.setFromCamera(t.mouseNDC, t.camera);
      const hit = new THREE.Vector3();
      if (t.raycaster.ray.intersectPlane(t.groundPlane, hit)) return hit;
    }
    return new THREE.Vector3(t.playerPos.x + Math.sin(t.playerFacing) * 5, 0, t.playerPos.z + Math.cos(t.playerFacing) * 5);
  }
  function getAimDir() {
    const t = three.current;
    const pt = getAimPoint();
    const dir = new THREE.Vector3(pt.x - t.playerPos.x, 0, pt.z - t.playerPos.z);
    if (dir.lengthSq() < 0.0001) return new THREE.Vector3(Math.sin(t.playerFacing), 0, Math.cos(t.playerFacing));
    return dir.normalize();
  }
  function faceMouse() {
    const t = three.current;
    if (!t.mouseNDC || !t.playerMesh) return;
    t.raycaster.setFromCamera(t.mouseNDC, t.camera);
    const hit = new THREE.Vector3();
    if (t.raycaster.ray.intersectPlane(t.groundPlane, hit)) {
      const dx = hit.x - t.playerPos.x, dz = hit.z - t.playerPos.z;
      if (Math.hypot(dx, dz) > 0.2) { t.playerFacing = Math.atan2(dx, dz); t.playerMesh.rotation.y = t.playerFacing; }
    }
  }

  function computeAbilityDamage(target, stats, ab) {
    let dmg = stats.atk * (ab.mult || 1) - target.def.def * 0.4;
    if (ab.execute && target.hp / target.hpMax <= ab.execute) dmg *= 2;
    return Math.max(1, Math.round(dmg));
  }
  function applyAbilityDamage(target, stats, ab) { damageMonster(target, computeAbilityDamage(target, stats, ab)); }
  function applyCC(m, type, dur, mult) {
    m.ccType = type; m.ccUntil = performance.now() + dur * 1000; if (mult) m.slowMult = mult;
    flashMesh(m.group, type === "stun" ? 0xffe066 : type === "root" ? 0x8a6a3a : 0x66ccff);
  }

  function performAutoAttack(target) {
    const t = three.current; const p = gs.current.player;
    if (!target.alive) return;
    const stats = effectiveStats(p);
    const dmg = Math.max(1, Math.round(stats.atk * (0.85 + Math.random() * 0.3) - target.def.def * 0.5));
    damageMonster(target, dmg);
    playSfx("hit");
    if (p.poisonBuffUntil && performance.now() < p.poisonBuffUntil) {
      target.poison = { dps: p.poisonDps, until: performance.now() + (p.poisonTickDur || 3) * 1000 };
    }
    triggerAttackAnim(t.playerMesh, 240);
    flashMesh(t.playerMesh.parent, 0xffe08a);
  }

  function spawnClickMarker(point, isAttack) {
    const t = three.current;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 16), new THREE.MeshBasicMaterial({ color: isAttack ? 0xc1502e : 0xe9dfc7, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(point.x, 0.06, point.z);
    t.worldGroup.add(ring);
    t.fx.push({ mesh: ring, bornAt: performance.now(), dur: 450, grow: true, opacity: 0.9 });
  }
  function spawnGroundFX(center, radius, color) {
    const t = three.current;
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.85, radius, 20), new THREE.MeshBasicMaterial({ color: color || "#c1502e", transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(center.x, 0.08, center.z);
    t.worldGroup.add(ring);
    t.fx.push({ mesh: ring, bornAt: performance.now(), dur: 400, grow: true, opacity: 0.55 });
  }
  function updateFX() {
    const t = three.current; const now = performance.now();
    t.fx = (t.fx || []).filter((f) => {
      const el = now - f.bornAt;
      if (el > f.dur) { t.worldGroup.remove(f.mesh); return false; }
      const k = el / f.dur;
      if (f.grow) f.mesh.scale.setScalar(1 + k * 0.4);
      f.mesh.material.opacity = f.opacity * (1 - k);
      return true;
    });
  }

  function spawnProjectile(dir, ab, stats) {
    const t = three.current;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), new THREE.MeshStandardMaterial({ color: ab.color || "#e8703f", emissive: ab.color || "#e8703f", emissiveIntensity: 0.8, flatShading: true }));
    mesh.position.set(t.playerPos.x + dir.x * 0.8, 1.1, t.playerPos.z + dir.z * 0.8);
    t.worldGroup.add(mesh);
    t.projectiles.push({ mesh, dir: dir.clone(), speed: ab.speed || 18, range: ab.range, traveled: 0, mult: ab.mult, execute: ab.execute, hitRadius: ab.width || 0.8, cc: ab.cc, stats });
  }
  function updateProjectiles(dt) {
    const t = three.current;
    t.projectiles = (t.projectiles || []).filter((pr) => {
      pr.mesh.position.addScaledVector(pr.dir, pr.speed * dt);
      pr.traveled += pr.speed * dt;
      for (const m of t.monsters) {
        if (!m.alive) continue;
        const dx = m.pos.x - pr.mesh.position.x, dz = m.pos.z - pr.mesh.position.z;
        if (dx * dx + dz * dz <= pr.hitRadius * pr.hitRadius) {
          const dmg = computeAbilityDamage(m, pr.stats, { mult: pr.mult, execute: pr.execute });
          damageMonster(m, dmg);
          if (pr.cc) applyCC(m, pr.cc.type, pr.cc.dur, pr.cc.mult);
          t.worldGroup.remove(pr.mesh);
          return false;
        }
      }
      if (pr.traveled >= pr.range) { t.worldGroup.remove(pr.mesh); return false; }
      return true;
    });
  }

  function spawnTrap(pos, ab) {
    const t = three.current;
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(ab.radius, 16), new THREE.MeshStandardMaterial({ color: 0x4caf6d, transparent: true, opacity: 0.35, flatShading: true }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(pos.x, 0.05, pos.z);
    t.worldGroup.add(mesh);
    t.traps.push({ pos: pos.clone(), radius: ab.radius, mult: ab.mult, cc: ab.cc, mesh, expireAt: performance.now() + (ab.dur || 8) * 1000 });
  }
  function updateTraps() {
    const t = three.current; const now = performance.now();
    t.traps = (t.traps || []).filter((trap) => {
      if (now > trap.expireAt) { t.worldGroup.remove(trap.mesh); return false; }
      for (const m of t.monsters) {
        if (!m.alive) continue;
        const dx = m.pos.x - trap.pos.x, dz = m.pos.z - trap.pos.z;
        if (dx * dx + dz * dz <= trap.radius * trap.radius) {
          const stats = effectiveStats(gs.current.player);
          const dmg = computeAbilityDamage(m, stats, { mult: trap.mult });
          damageMonster(m, dmg);
          if (trap.cc) applyCC(m, trap.cc.type, trap.cc.dur, trap.cc.mult);
          t.worldGroup.remove(trap.mesh);
          return false;
        }
      }
      return true;
    });
  }

  function triggerAbility(key) {
    const t = three.current; const p = gs.current.player;
    if (!p || screenRef.current !== "dungeon") return;
    if (gs.current.cooldowns[key] > 0) return;
    const stats = effectiveStats(p);
    const ab = stats.abilities.find((a) => a.key === key);
    if (!ab) return;
    if (p.mana < ab.cost) { showToast("Yetersiz mana!", "bad"); return; }
    p.mana -= ab.cost;
    gs.current.cooldowns[key] = ab.cd;

    const aimDir = getAimDir();
    const aimPoint = getAimPoint();

    switch (ab.type) {
      case "heal": {
        p.hp = Math.min(stats.maxHp, p.hp + ab.heal);
        showToast(`${ab.name}!`, "good");
        break;
      }
      case "buff": {
        p.buffUntil = performance.now() + ab.dur * 1000;
        p.buffAtk = ab.atkBonus || 0; p.buffDef = ab.defBonus || 0;
        if (ab.heal) p.hp = Math.min(effectiveStats(p).maxHp, p.hp + ab.heal);
        showToast(`${ab.name}!`, "good");
        break;
      }
      case "aoe_self": {
        abilityTargets(null, t.playerPos, ab.radius).forEach((m) => { applyAbilityDamage(m, stats, ab); if (ab.cc) applyCC(m, ab.cc.type, ab.cc.dur, ab.cc.mult); });
        spawnGroundFX(t.playerPos, ab.radius, ab.color);
        break;
      }
      case "aoe_point": {
        const dist = Math.min(ab.maxRange, Math.hypot(aimPoint.x - t.playerPos.x, aimPoint.z - t.playerPos.z));
        const dir = new THREE.Vector3(aimPoint.x - t.playerPos.x, 0, aimPoint.z - t.playerPos.z);
        if (dir.lengthSq() < 0.0001) dir.set(Math.sin(t.playerFacing), 0, Math.cos(t.playerFacing)); else dir.normalize();
        const center = new THREE.Vector3(t.playerPos.x + dir.x * dist, 0, t.playerPos.z + dir.z * dist);
        spawnGroundFX(center, ab.radius, ab.color);
        abilityTargets(null, center, ab.radius).forEach((m) => { applyAbilityDamage(m, stats, ab); if (ab.cc) applyCC(m, ab.cc.type, ab.cc.dur, ab.cc.mult); });
        break;
      }
      case "nearest": {
        const target = nearestMonster(t.playerPos, ab.range);
        if (target) {
          const dmg = computeAbilityDamage(target, stats, ab);
          damageMonster(target, dmg);
          if (ab.lifesteal) p.hp = Math.min(effectiveStats(p).maxHp, p.hp + Math.round(dmg * ab.lifesteal));
        }
        break;
      }
      case "skillshot": {
        spawnProjectile(aimDir, ab, stats);
        break;
      }
      case "volley": {
        const baseAngle = Math.atan2(aimDir.x, aimDir.z);
        const n = ab.count;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * ((ab.spreadDeg * Math.PI) / 180) / (n - 1 || 1);
          const a = baseAngle + off;
          spawnProjectile(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), ab, stats);
        }
        break;
      }
      case "trap": {
        spawnTrap(aimPoint, ab);
        break;
      }
      case "poison_next": {
        p.poisonBuffUntil = performance.now() + ab.dur * 1000;
        p.poisonDps = ab.dps; p.poisonTickDur = ab.poisonDur;
        showToast(`${ab.name}!`, "good");
        break;
      }
      case "cone": {
        abilityTargets(null, t.playerPos, ab.range).filter((m) => {
          const dx = m.pos.x - t.playerPos.x, dz = m.pos.z - t.playerPos.z;
          const len = Math.hypot(dx, dz) || 1;
          const dot = (dx / len) * aimDir.x + (dz / len) * aimDir.z;
          return dot >= Math.cos(((ab.angleDeg * Math.PI) / 180) / 2);
        }).forEach((m) => { applyAbilityDamage(m, stats, ab); if (ab.cc) applyCC(m, ab.cc.type, ab.cc.dur, ab.cc.mult); });
        break;
      }
      case "dash": {
        const dashDur = 220;
        t.dashUntil = performance.now() + dashDur;
        t.dashVec = aimDir.clone().multiplyScalar(ab.range / (dashDur / 1000));
        t.playerFacing = Math.atan2(aimDir.x, aimDir.z);
        if (t.playerMesh) t.playerMesh.rotation.y = t.playerFacing;
        const target = nearestMonster(t.playerPos, ab.range);
        if (target) applyAbilityDamage(target, stats, ab);
        break;
      }
      default: break;
    }
    if (ab.type !== "dash") triggerAttackAnim(t.playerMesh, 320);
    playSfx("ability");
    flashMesh(t.playerMesh.parent, 0xffffff);
  }

  function usePotion(item) {
    const p = gs.current.player;
    if (!p) return;
    const stats = effectiveStats(p);
    p.hp = Math.min(stats.maxHp, p.hp + item.statValue);
    p.inventory = p.inventory.filter((i) => i.id !== item.id);
    showToast("İksir kullanıldı", "good");
    setTick((x) => x + 1);
  }

  /* =====================================================================
     GAME LOOP
     ===================================================================== */
  function loop(time) {
    const t = three.current;
    if (!t.renderer) return;
    const dt = Math.min((time - t.lastT) / 1000, 0.05);
    t.lastT = time;
    const p = gs.current.player;

    if (p && screenRef.current === "dungeon") updateDungeonFrame(dt, time);
    if (p && screenRef.current === "town") updateTownFrame(dt);

    updateProjectiles(dt);
    updateTraps();
    updateFX();
    if (t.pondMesh) t.pondMesh.material.emissiveIntensity = 0.3 + Math.sin(time * 0.0012) * 0.08;
    if (t.seaMesh) t.seaMesh.material.emissiveIntensity = 0.35 + Math.sin(time * 0.0009 + 1.4) * 0.08;

    // cooldown ticking
    Object.keys(gs.current.cooldowns).forEach((k) => { if (gs.current.cooldowns[k] > 0) gs.current.cooldowns[k] = Math.max(0, gs.current.cooldowns[k] - dt); });

    // drops bob + pickup
    updateDrops(dt);

    // unflash meshes
    t.monsters.forEach((m) => { if (m.group.userData.flashUntil && performance.now() > m.group.userData.flashUntil) unflash(m.group); });
    if (t.playerMesh && t.playerMesh.parent.userData.flashUntil && performance.now() > t.playerMesh.parent.userData.flashUntil) unflash(t.playerMesh.parent);

    t.renderer.render(t.scene, t.camera);

    if (time - t.lastSync > 130) { t.lastSync = time; setTick((x) => x + 1); }
    if (time - t.lastAutosave > 15000) { t.lastAutosave = time; saveGame(); }

    t.raf = requestAnimationFrame(loop);
  }

  function unflash(group) {
    group.traverse((o) => { if (o.isMesh && o.userData.origColor) { o.material.emissive = new THREE.Color(0x000000); o.material.emissiveIntensity = 0; } });
    group.userData.flashUntil = 0;
  }

  function movePlayer(dt, speed, bounds) {
    const t = three.current; const p = gs.current.player;
    let moving = false;
    let facingSet = false;

    if (t.attackTarget && !t.attackTarget.alive) t.attackTarget = null;

    if (t.attackTarget) {
      const dx = t.attackTarget.pos.x - t.playerPos.x, dz = t.attackTarget.pos.z - t.playerPos.z;
      const dist = Math.hypot(dx, dz);
      const atkRange = 2.5;
      if (dist > atkRange) {
        moving = true;
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        t.playerPos.addScaledVector(dir, speed * dt);
        t.playerFacing = Math.atan2(dir.x, dir.z);
        if (t.playerMesh) t.playerMesh.rotation.y = t.playerFacing;
        facingSet = true;
      } else {
        if (dist > 0.05) { t.playerFacing = Math.atan2(dx, dz); if (t.playerMesh) t.playerMesh.rotation.y = t.playerFacing; }
        facingSet = true;
        t.autoAtkCd = (t.autoAtkCd || 0) - dt;
        if (t.autoAtkCd <= 0) { t.autoAtkCd = 0.85; performAutoAttack(t.attackTarget); }
      }
    } else if (t.moveTarget) {
      const dx = t.moveTarget.x - t.playerPos.x, dz = t.moveTarget.z - t.playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.25) {
        moving = true;
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        const step = speed * dt;
        if (step >= dist) { t.playerPos.x = t.moveTarget.x; t.playerPos.z = t.moveTarget.z; t.moveTarget = null; }
        else t.playerPos.addScaledVector(dir, step);
        t.playerFacing = Math.atan2(dir.x, dir.z);
        if (t.playerMesh) t.playerMesh.rotation.y = t.playerFacing;
        facingSet = true;
      } else { t.moveTarget = null; }
    }

    const dashing = performance.now() < t.dashUntil;
    if (dashing) { t.playerPos.addScaledVector(t.dashVec, dt); moving = true; }

    if (bounds) {
      if (bounds.type === "circle") {
        const d = Math.hypot(t.playerPos.x, t.playerPos.z);
        if (d > bounds.radius) { const s = bounds.radius / d; t.playerPos.x *= s; t.playerPos.z *= s; }
      } else {
        t.playerPos.x = clamp(t.playerPos.x, bounds.minX, bounds.maxX);
        t.playerPos.z = clamp(t.playerPos.z, bounds.minZ, bounds.maxZ);
      }
    }
    if (t.pond) {
      const dx = t.playerPos.x - t.pond.pos.x, dz = t.playerPos.z - t.pond.pos.z;
      const d = Math.hypot(dx, dz);
      const minD = t.pond.radius + 0.8;
      if (d < minD && d > 0.0001) { const s = minD / d; t.playerPos.x = t.pond.pos.x + dx * s; t.playerPos.z = t.pond.pos.z + dz * s; }
    }
    positionPlayer();
    if (!facingSet) faceMouse();
    if (t.playerMesh) animateCharacter(t.playerMesh, dt, { moving, attackT: computeAttackT(t.playerMesh) });
  }

  function updateTownFrame(dt) {
    const t = three.current;
    movePlayer(dt, 8, { type: "circle", radius: (t.townRadius || 78) - 4 });
    let near = null;
    for (const it of t.interactables) {
      if (dist2(it.pos, t.playerPos) <= it.radius * it.radius) { near = it; break; }
    }
    t.nearInteract = near;
    setNearPortal(near);
  }

  function updateDungeonFrame(dt, time) {
    const t = three.current; const p = gs.current.player;
    const bounds = { minX: -16, maxX: 16, minZ: -42, maxZ: 34 };
    movePlayer(dt, 6.4, bounds);
    const stats = effectiveStats(p);

    let near = null;
    for (const it of t.interactables) {
      if (dist2(it.pos, t.playerPos) <= it.radius * it.radius) { near = it; break; }
    }
    t.nearInteract = near;
    setNearPortal(near);

    // mana regen
    p.mana = Math.min(stats.maxMana, p.mana + dt * 4);

    // monsters AI
    const now = performance.now();
    t.monsters.forEach((m) => {
      if (!m.alive) return;

      if (m.poison && now < m.poison.until) { damageMonster(m, m.poison.dps * dt); if (!m.alive) return; }
      else if (m.poison && now >= m.poison.until) m.poison = null;

      let speedMult = 1, disabledMove = false, disabledAtk = false;
      if (m.ccType) {
        if (now < m.ccUntil) {
          if (m.ccType === "slow") speedMult = m.slowMult || 0.5;
          if (m.ccType === "root") disabledMove = true;
          if (m.ccType === "stun") { disabledMove = true; disabledAtk = true; }
        } else { m.ccType = null; }
      }

      const d = Math.sqrt(dist2(m.pos, t.playerPos));
      if (d < m.def.aggro) m.state = "chase";
      let moving = false;
      if (m.state === "chase") {
        if (d > m.def.atkRange) {
          if (!disabledMove) {
            moving = true;
            const dir = new THREE.Vector3().subVectors(t.playerPos, m.pos);
            dir.y = 0; dir.normalize();
            m.pos.addScaledVector(dir, m.def.speed * speedMult * dt);
            m.group.position.x = m.pos.x; m.group.position.z = m.pos.z;
            m.group.rotation.y = Math.atan2(dir.x, dir.z);
          }
        } else if (!disabledAtk) {
          m.atkCd -= dt;
          if (m.atkCd <= 0) {
            m.atkCd = 1.1;
            triggerAttackAnim(m.group, 300);
            const dmg = Math.max(1, Math.round(m.def.atk * (0.85 + Math.random() * 0.3) - stats.def * 0.5));
            p.hp = Math.max(0, p.hp - dmg);
            setFlashDamage(true); setTimeout(() => setFlashDamage(false), 180);
            flashMesh(t.playerMesh.parent, 0xff4444);
            if (p.hp <= 0) onPlayerDeath();
          }
        }
      }
      animateCharacter(m.group, dt, { moving, attackT: computeAttackT(m.group) });
    });
  }

  function updateDrops(dt) {
    const t = three.current; const p = gs.current.player;
    if (!p) return;
    const now = performance.now();
    const remaining = [];
    t.drops.forEach((d) => {
      d.mesh.position.y = 0.5 + Math.sin((now - d.bornAt) / 300) * 0.12;
      d.mesh.rotation.y += dt * 1.6;
      const dd = dist2(d.pos, t.playerPos);
      if (dd < 1.6) {
        if (d.kind === "gold") { p.gold += d.payload; showToast(`+${d.payload} altın`, "gold"); playSfx("gold"); }
        else { p.inventory.push(d.payload); showToast(`Eşya alındı: ${d.payload.name}`, d.payload.rarity); playSfx("loot"); if (RARITY_ORDER.indexOf(d.payload.rarity) >= 2) pushFeed(true, `${p.name} bir ${RARITIES[d.payload.rarity].label} eşya buldu: ${d.payload.name}`); }
        t.worldGroup.remove(d.mesh);
      } else remaining.push(d);
    });
    t.drops = remaining;
  }

  function onPlayerDeath() {
    const p = gs.current.player;
    p.gold = Math.round(p.gold * 0.9);
    playSfx("death");
    goScreen("dead");
    setTimeout(() => {
      const stats = effectiveStats(p);
      p.hp = Math.round(stats.maxHp * 0.5);
      p.mana = stats.maxMana;
      gs.current.zone = "town";
      buildZone("town", null);
      goScreen("town");
    }, 2200);
  }

  /* =====================================================================
     Character creation
     ===================================================================== */
  const [form, setForm] = useState({ name: "", cls: "knight" });

  async function startNew() {
    if (!form.name.trim()) { showToast("Bir isim gir", "bad"); return; }
    const p = newPlayer(form.name.trim().slice(0, 16), form.cls);
    gs.current.player = p;
    gs.current.zone = "town";
    screenRef.current = "town";
    setInGame(true);
    setScreen("town");
    pushFeed(true, `${p.name} Erebos'a adım attı.`);
  }
  async function continueSave() {
    try {
      const res = await window.storage.get("erebos-save-v1", false);
      const p = JSON.parse(res.value);
      gs.current.player = p;
      gs.current.zone = "town";
      screenRef.current = "town";
      setInGame(true);
      setScreen("town");
    } catch (e) { showToast("Kayıt yüklenemedi", "bad"); }
  }

  /* =====================================================================
     Marketplace
     ===================================================================== */
  const [listings, setListings] = useState([]);
  const [marketTab, setMarketTab] = useState("browse");
  const [payoutPending, setPayoutPending] = useState(0);
  const [marketLoading, setMarketLoading] = useState(false);

  /* ---------------- blacksmith shop (solo gold sink) ---------------- */
  const [shopStock, setShopStockState] = useState([]);
  const shopStockRef = useRef([]);
  function setShopStock(stock) { shopStockRef.current = stock; setShopStockState(stock); }
  function rollShopStock() {
    const p = gs.current.player;
    const tierBoost = p ? Math.min(2, Math.floor((p.level - 1) / 3)) : 0;
    const potions = [
      { id: "pot_s", name: "Küçük İksir", type: "potion", slot: null, icon: "potion", stat: "heal", statValue: 30, rarity: "common", value: 18 },
      { id: "pot_m", name: "Orta İksir", type: "potion", slot: null, icon: "potion", stat: "heal", statValue: 65, rarity: "uncommon", value: 42 },
    ];
    const gear = [1, 2, 3].map(() => makeItem(Math.random() > 0.7 ? "uncommon" : "common", tierBoost));
    return [...potions, ...gear].map((it) => ({ ...it, id: it.id || (Math.random().toString(36).slice(2) + Date.now().toString(36)), shopPrice: Math.round((it.value || 20) * 1.4) }));
  }
  function ensureShopStock() {
    if (shopStockRef.current.length === 0) setShopStock(rollShopStock());
  }
  function restockShop() {
    const p = gs.current.player;
    if (!p) return;
    if (p.gold < 10) { showToast("Yenilemek için 10 altın gerek", "bad"); return; }
    p.gold -= 10;
    setShopStock(rollShopStock());
    setTick((x) => x + 1);
  }
  function buyFromShop(stockItem) {
    const p = gs.current.player;
    if (!p || p.gold < stockItem.shopPrice) { showToast("Yetersiz altın", "bad"); return; }
    p.gold -= stockItem.shopPrice;
    const { shopPrice, ...item } = stockItem;
    p.inventory.push({ ...item, id: Math.random().toString(36).slice(2) + Date.now().toString(36) });
    showToast(`${item.name} satın alındı`, "good");
    playSfx("buy");
    setTick((x) => x + 1);
  }

  async function refreshMarket() {
    setMarketLoading(true);
    try {
      const list = await window.storage.list("listing:", true);
      const keys = (list && list.keys) || [];
      const vals = await Promise.all(keys.slice(0, 60).map(async (k) => {
        try { const r = await window.storage.get(k, true); return JSON.parse(r.value); } catch (e) { return null; }
      }));
      setListings(vals.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) { /* empty market */ setListings([]); }
    try {
      const p = gs.current.player;
      const r = await window.storage.get(`payout:${p.name}`, true);
      const arr = JSON.parse(r.value || "[]");
      setPayoutPending(arr.reduce((a, b) => a + b, 0));
    } catch (e) { setPayoutPending(0); }
    setMarketLoading(false);
  }
  useEffect(() => { if (ui.panel === "market") refreshMarket(); }, [ui.panel]);

  async function listItem(item, price) {
    const p = gs.current.player;
    price = Math.max(1, Math.round(price));
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const listing = { id, seller: p.name, item, price, createdAt: Date.now() };
    try {
      await window.storage.set(`listing:${id}`, JSON.stringify(listing), true);
      p.inventory = p.inventory.filter((i) => i.id !== item.id);
      showToast("İlan oluşturuldu", "good");
      pushFeed(true, `${p.name}, "${item.name}" eşyasını ${price} altına pazara koydu.`);
      setTick((x) => x + 1);
      refreshMarket();
    } catch (e) { showToast("İlan başarısız", "bad"); }
  }
  async function buyListing(listing) {
    const p = gs.current.player;
    if (listing.seller === p.name) { showToast("Kendi eşyanı alamazsın", "bad"); return; }
    if (p.gold < listing.price) { showToast("Yetersiz altın", "bad"); return; }
    try {
      const stillThere = await window.storage.get(`listing:${listing.id}`, true).catch(() => null);
      if (!stillThere) { showToast("Bu eşya artık mevcut değil", "bad"); refreshMarket(); return; }
      await window.storage.delete(`listing:${listing.id}`, true);
      p.gold -= listing.price;
      p.inventory.push(listing.item);
      let arr = [];
      try { const r = await window.storage.get(`payout:${listing.seller}`, true); arr = JSON.parse(r.value || "[]"); } catch (e) {}
      arr.push(listing.price);
      await window.storage.set(`payout:${listing.seller}`, JSON.stringify(arr), true);
      showToast(`${listing.item.name} satın alındı`, "good");
      playSfx("buy");
      pushFeed(true, `${p.name}, ${listing.seller} adlı oyuncudan "${listing.item.name}" satın aldı.`);
      setTick((x) => x + 1);
      refreshMarket();
    } catch (e) { showToast("Satın alma başarısız", "bad"); }
  }
  async function claimPayout() {
    const p = gs.current.player;
    try {
      const r = await window.storage.get(`payout:${p.name}`, true);
      const arr = JSON.parse(r.value || "[]");
      const total = arr.reduce((a, b) => a + b, 0);
      if (total <= 0) return;
      p.gold += total;
      await window.storage.set(`payout:${p.name}`, JSON.stringify([]), true);
      showToast(`${total} altın alındı`, "gold");
      setPayoutPending(0);
      setTick((x) => x + 1);
    } catch (e) {}
  }
  async function cancelListing(listing) {
    const p = gs.current.player;
    try {
      await window.storage.delete(`listing:${listing.id}`, true);
      p.inventory.push(listing.item);
      setTick((x) => x + 1);
      refreshMarket();
    } catch (e) {}
  }

  /* ---------------- shared feed polling in town ---------------- */
  useEffect(() => {
    if (screen !== "town" && screen !== "dungeon") return;
    let stop = false;
    async function poll() {
      try {
        const r = await window.storage.get("erebos-eventlog", true);
        const arr = JSON.parse(r.value || "[]");
        if (!stop) setFeed(arr.slice(0, 6).map((e) => ({ id: e.t + Math.random(), text: e.text })));
      } catch (e) {}
    }
    poll();
    const iv = setInterval(poll, 9000);
    return () => { stop = true; clearInterval(iv); };
  }, [screen]);

  /* =====================================================================
     RENDER
     ===================================================================== */
  const p = gs.current.player;
  const stats = p ? effectiveStats(p) : null;

  return (
    <div className="erb-root">
      <style>{CSS}</style>

      {screen === "loading" && (
        <div className="erb-loading"><div className="erb-title-glow">EREBOS</div></div>
      )}

      {screen === "create" && (
        <CharacterCreate
          form={form} setForm={setForm} hasSave={hasSave}
          onStart={startNew} onContinue={continueSave}
        />
      )}

      {inGame && p && (
        <div className="erb-game" ref={containerRef}>
          <canvas ref={canvasRef} className={"erb-canvas" + (flashDamage ? " erb-hit" : "")} />

          {/* top bar */}
          <div className="erb-topbar">
            <div className="erb-zonepill">{screen === "dungeon" ? DUNGEONS[gs.current.dungeonId].name : "Erebos Kasabası"}</div>
            <div className="erb-gold"><Coins size={16} color="#d6a84d" /> {p.gold}</div>
          </div>

          {/* HUD bottom */}
          <div className="erb-hud">
            <div className="erb-portrait" style={{ borderColor: `#${stats.color.toString(16).padStart(6, "0")}` }}>
              <div className="erb-portrait-lv">{p.level}</div>
            </div>
            <div className="erb-bars">
              <div className="erb-barrow">
                <div className="erb-bar erb-bar-hp"><div className="erb-bar-fill" style={{ width: `${(p.hp / stats.maxHp) * 100}%` }} /></div>
                <span className="erb-bar-label">{Math.ceil(p.hp)}/{stats.maxHp}</span>
              </div>
              <div className="erb-barrow">
                <div className="erb-bar erb-bar-mp"><div className="erb-bar-fill" style={{ width: `${(p.mana / stats.maxMana) * 100}%` }} /></div>
                <span className="erb-bar-label">{Math.ceil(p.mana)}/{stats.maxMana}</span>
              </div>
              <div className="erb-barrow erb-barrow-xp">
                <div className="erb-bar erb-bar-xp"><div className="erb-bar-fill" style={{ width: `${(p.xp / p.xpNext) * 100}%` }} /></div>
              </div>
            </div>
            <div className="erb-abilities">
              {stats.abilities.map((a) => {
                const cd = gs.current.cooldowns[a.key] || 0;
                const pct = cd / a.cd;
                return (
                  <div key={a.key} className="erb-ability" style={{ "--ab-color": a.color }} title={a.name}>
                    <div className="erb-ability-key">{a.key}</div>
                    <div className="erb-ability-name">{a.name}</div>
                    {cd > 0 && <div className="erb-ability-cd" style={{ height: `${pct * 100}%` }} />}
                  </div>
                );
              })}
            </div>
            <div className="erb-hudbtns">
              <button className="erb-iconbtn" onClick={() => setUi((u) => ({ panel: u.panel === "inventory" ? null : "inventory" }))}><Package size={18} /></button>
              <button className="erb-iconbtn" onClick={() => setUi((u) => ({ panel: u.panel === "market" ? null : "market" }))}><Store size={18} /></button>
              {screen === "dungeon" && <button className="erb-iconbtn erb-fleebtn" onClick={returnToTown} title="Kasabaya dön"><LogOut size={18} /></button>}
            </div>
          </div>

          {/* interact prompt */}
          {nearPortal && screen !== "dead" && (
            <div className="erb-interact">
              <MapPin size={14} /> {nearPortal.label} — <b>{nearPortal.type === "portal" ? "Git" : "F"}</b> tuşuna bas
            </div>
          )}

          {/* feed */}
          <div className="erb-feed">
            {feed.map((f) => <div key={f.id} className="erb-feed-item">{f.text}</div>)}
          </div>

          {/* toast */}
          {toast && <div className={`erb-toast erb-toast-${toast.kind}`}>{toast.text}</div>}

          {/* controls hint */}
          <div className="erb-controls">Sol tık: hareket / hedef · W A S D: yetenekler · F: etkileşim · I: envanter · M: harita · P: pazar · Tekerlek: zoom</div>

          {ui.panel === "inventory" && (
            <InventoryPanel
              player={p} stats={stats}
              onClose={() => setUi({ panel: null })}
              onEquip={(item) => {
                const prev = p.equipment[item.slot];
                p.inventory = p.inventory.filter((i) => i.id !== item.id);
                p.equipment[item.slot] = item;
                if (prev) p.inventory.push(prev);
                setTick((x) => x + 1);
              }}
              onUnequip={(slot) => { const it = p.equipment[slot]; if (it) { p.inventory.push(it); p.equipment[slot] = null; setTick((x) => x + 1); } }}
              onUse={(item) => usePotion(item)}
              onDiscard={(item) => { p.inventory = p.inventory.filter((i) => i.id !== item.id); setTick((x) => x + 1); }}
              onSell={(item) => setUi({ panel: "market", sellDraft: item })}
            />
          )}

          {ui.panel === "market" && (
            <MarketplacePanel
              player={p} listings={listings} tab={marketTab} setTab={setMarketTab}
              loading={marketLoading} payoutPending={payoutPending}
              sellDraft={ui.sellDraft}
              onClose={() => setUi({ panel: null })}
              onRefresh={refreshMarket}
              onList={listItem}
              onBuy={buyListing}
              onClaim={claimPayout}
              onCancel={cancelListing}
            />
          )}

          {ui.panel === "map" && (
            <WorldMapPanel three={three} zone={gs.current.zone} dungeonId={gs.current.dungeonId} onClose={() => setUi({ panel: null })} />
          )}

          {ui.panel === "shop" && (
            <ShopPanel player={p} stock={shopStock} onClose={() => setUi({ panel: null })} onBuy={buyFromShop} onRestock={restockShop} />
          )}

          {screen === "dead" && (
            <div className="erb-deathscreen">
              <Skull size={64} color="#c1502e" />
              <div className="erb-death-title">YENİLDİN</div>
              <div>Kasabaya dönülüyor...</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   Character creation screen
   ========================================================================= */
function CharacterCreate({ form, setForm, hasSave, onStart, onContinue }) {
  return (
    <div className="erb-create">
      <style>{CSS}</style>
      <div className="erb-title-glow">EREBOS</div>
      <div className="erb-subtitle">Karanlığın Diyarına Hoş Geldin</div>

      {hasSave && (
        <button className="erb-btn erb-btn-gold" onClick={onContinue}>Kayıtlı Karaktere Devam Et</button>
      )}

      <div className="erb-createbox">
        <label className="erb-label">Karakter Adı</label>
        <input className="erb-input" maxLength={16} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="İsmini yaz..." />

        <label className="erb-label">Sınıf Seç</label>
        <div className="erb-classrow">
          {Object.entries(CLASS_DEFS).map(([key, c]) => (
            <button key={key} className={"erb-classcard" + (form.cls === key ? " erb-classcard-active" : "")} onClick={() => setForm((f) => ({ ...f, cls: key }))}>
              <div className="erb-classcard-swatch" style={{ background: `#${c.color.toString(16).padStart(6, "0")}` }} />
              <div className="erb-classcard-name">{c.name}</div>
              <div className="erb-classcard-stats">GÜÇ {c.atk} · SAV {c.def} · ZEK {c.intel}</div>
              <div className="erb-classcard-abilities">{c.abilities.map((a) => a.name).join(" · ")}</div>
            </button>
          ))}
        </div>

        <button className="erb-btn erb-btn-ember" onClick={onStart}>Erebos'a Gir</button>
      </div>
    </div>
  );
}

/* =========================================================================
   Inventory panel
   ========================================================================= */
function InventoryPanel({ player, stats, onClose, onEquip, onUnequip, onUse, onDiscard, onSell }) {
  return (
    <div className="erb-panel-overlay" onClick={onClose}>
      <div className="erb-panel" onClick={(e) => e.stopPropagation()}>
        <div className="erb-panel-head">
          <div className="erb-panel-title"><Package size={18} /> Envanter</div>
          <button className="erb-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="erb-equip-row">
          {["weapon", "armor", "accessory"].map((slot) => {
            const it = player.equipment[slot];
            const Icon = it ? ICONS[it.icon] : slot === "weapon" ? Sword : slot === "armor" ? Shield : Gem;
            return (
              <div key={slot} className="erb-equip-slot" onClick={() => it && onUnequip(slot)} title={it ? `${it.name} (çıkar)` : "Boş"}>
                <Icon size={20} color={it ? RARITIES[it.rarity].color : "#5a5348"} />
                <span style={{ color: it ? RARITIES[it.rarity].color : "#5a5348" }}>{it ? it.name : slot === "weapon" ? "Silah" : slot === "armor" ? "Zırh" : "Aksesuar"}</span>
              </div>
            );
          })}
        </div>
        <div className="erb-statsline">Saldırı {Math.round(stats.atk)} · Savunma {Math.round(stats.def)} · Can {stats.maxHp} · Mana {stats.maxMana}</div>

        <div className="erb-invgrid">
          {player.inventory.length === 0 && <div className="erb-empty">Envanterin boş. Zindanlara in, ganimet topla.</div>}
          {player.inventory.map((item) => {
            const Icon = ICONS[item.icon];
            const rdef = RARITIES[item.rarity];
            return (
              <div key={item.id} className="erb-item" style={{ borderColor: rdef.color }}>
                <Icon size={22} color={rdef.color} />
                <div className="erb-item-name" style={{ color: rdef.color }}>{item.name}</div>
                <div className="erb-item-sub">{item.type === "potion" ? `+${item.statValue} Can` : `+${item.statValue} ${item.stat === "atk" ? "SAL" : item.stat === "def" ? "SAV" : "ZEK"}`}</div>
                <div className="erb-item-value"><Coins size={11} color="#b98a3d" /> {item.value}</div>
                <div className="erb-item-actions">
                  {item.type === "potion" ? (
                    <button className="erb-minibtn" onClick={() => onUse(item)}>Kullan</button>
                  ) : (
                    <button className="erb-minibtn" onClick={() => onEquip(item)}>Kuşan</button>
                  )}
                  <button className="erb-minibtn" onClick={() => onSell(item)}><Tag size={12} /></button>
                  <button className="erb-minibtn erb-minibtn-danger" onClick={() => onDiscard(item)}><Trash2 size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Marketplace panel
   ========================================================================= */
function ShopPanel({ player, stock, onClose, onBuy, onRestock }) {
  return (
    <div className="erb-panel-overlay" onClick={onClose}>
      <div className="erb-panel" onClick={(e) => e.stopPropagation()}>
        <div className="erb-panel-head">
          <div className="erb-panel-title"><Store size={18} /> Demirci</div>
          <button className="erb-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="erb-tabrow">
          <div className="erb-statsline" style={{ marginBottom: 0 }}>Altının: {player.gold}</div>
          <button className="erb-minibtn" style={{ marginLeft: "auto" }} onClick={onRestock}><ArrowLeftRight size={12} /> Stoğu Yenile (10 altın)</button>
        </div>
        <div className="erb-invgrid">
          {stock.length === 0 && <div className="erb-empty">Stok yükleniyor...</div>}
          {stock.map((item) => {
            const Icon = ICONS[item.icon];
            const rdef = RARITIES[item.rarity];
            return (
              <div key={item.id} className="erb-item" style={{ borderColor: rdef.color }}>
                <Icon size={22} color={rdef.color} />
                <div className="erb-item-name" style={{ color: rdef.color }}>{item.name}</div>
                <div className="erb-item-sub">{item.type === "potion" ? `+${item.statValue} Can` : `+${item.statValue} ${item.stat === "atk" ? "SAL" : item.stat === "def" ? "SAV" : "ZEK"}`}</div>
                <div className="erb-item-value"><Coins size={11} color="#b98a3d" /> {item.shopPrice}</div>
                <button className="erb-minibtn erb-minibtn-buy" disabled={player.gold < item.shopPrice} onClick={() => onBuy(item)}>Satın Al</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WorldMapPanel({ three, zone, dungeonId, onClose }) {
  const t = three.current || {};
  const px = t.playerPos ? t.playerPos.x : 0, pz = t.playerPos ? t.playerPos.z : 0;

  if (zone === "dungeon" && dungeonId) {
    const dg = DUNGEONS[dungeonId];
    const allX = dg.rooms.flatMap((r) => [r.cx - r.w / 2, r.cx + r.w / 2]);
    const allZ = dg.rooms.flatMap((r) => [r.cz - r.d / 2, r.cz + r.d / 2]);
    const minX = Math.min(...allX) - 4, maxX = Math.max(...allX) + 4;
    const minZ = Math.min(...allZ) - 4, maxZ = Math.max(...allZ) + 4;
    return (
      <div className="erb-panel-overlay" onClick={onClose}>
        <div className="erb-panel" onClick={(e) => e.stopPropagation()}>
          <div className="erb-panel-head">
            <div className="erb-panel-title"><MapPin size={18} /> {dg.name} Haritası</div>
            <button className="erb-iconbtn" onClick={onClose}><X size={18} /></button>
          </div>
          <svg viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`} style={{ width: "100%", height: "auto", background: "#0e0c09", borderRadius: 8 }}>
            {dg.rooms.map((r, i) => (
              <rect key={i} x={r.cx - r.w / 2} y={r.cz - r.d / 2} width={r.w} height={r.d} fill={r.corridor ? "#1c1815" : "#231e19"} stroke="#3a332b" strokeWidth={0.4} />
            ))}
            {(t.monsters || []).filter((m) => m.alive).map((m, i) => (
              <circle key={i} cx={m.pos.x} cy={m.pos.z} r={0.8} fill={m.def.boss ? "#e8703f" : "#c1502e"} />
            ))}
            <circle cx={px} cy={pz} r={1.1} fill="#4d8fd6" stroke="#e9dfc7" strokeWidth={0.3} />
          </svg>
          <div className="erb-statsline">Mavi: sen · Kırmızı/Turuncu: canavarlar (turuncu = şef/boss)</div>
        </div>
      </div>
    );
  }

  const R = t.townRadius || 78;
  return (
    <div className="erb-panel-overlay" onClick={onClose}>
      <div className="erb-panel" onClick={(e) => e.stopPropagation()}>
        <div className="erb-panel-head">
          <div className="erb-panel-title"><MapPin size={18} /> Erebos Haritası</div>
          <button className="erb-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <svg viewBox={`${-R - 10} ${-R - 10} ${2 * R + 20} ${2 * R + 20}`} style={{ width: "100%", height: "auto", background: "#1f3d2a", borderRadius: 8 }}>
          <circle cx={0} cy={0} r={R} fill="#2f5a2a" stroke="#5a5850" strokeWidth={2} />
          <circle cx={-30} cy={26} r={8.5} fill="#2f7fa0" />
          <circle cx={0} cy={0} r={15} fill="#4a3b28" opacity={0.5} />
          {Object.values(DUNGEONS).map((dg, i) => {
            const posx = i === 0 ? -17 : 17, posz = -26;
            return (
              <g key={dg.id}>
                <circle cx={posx} cy={posz} r={3} fill={dg.glow} />
                <text x={posx} y={posz - 5} fontSize={5} fill="#e9dfc7" textAnchor="middle">{dg.name}</text>
              </g>
            );
          })}
          <circle cx={16} cy={9} r={2} fill="#c1502e" />
          <text x={16} y={4} fontSize={5} fill="#e9dfc7" textAnchor="middle">Pazar</text>
          <circle cx={px} cy={pz} r={2.2} fill="#4d8fd6" stroke="#e9dfc7" strokeWidth={0.5} />
        </svg>
        <div className="erb-statsline">Mavi: sen · Renkli halkalar: zindan girişleri · Kırmızı: pazar</div>
      </div>
    </div>
  );
}

function MarketplacePanel({ player, listings, tab, setTab, loading, payoutPending, sellDraft, onClose, onRefresh, onList, onBuy, onClaim, onCancel }) {
  const [priceDraft, setPriceDraft] = useState(sellDraft ? sellDraft.value : 0);
  const [selling, setSelling] = useState(sellDraft || null);

  const mine = listings.filter((l) => l.seller === player.name);
  const others = listings.filter((l) => l.seller !== player.name);

  return (
    <div className="erb-panel-overlay" onClick={onClose}>
      <div className="erb-panel" onClick={(e) => e.stopPropagation()}>
        <div className="erb-panel-head">
          <div className="erb-panel-title"><Store size={18} /> Pazar</div>
          <button className="erb-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="erb-tabrow">
          <button className={"erb-tab" + (tab === "browse" ? " erb-tab-active" : "")} onClick={() => setTab("browse")}>Satılık Eşyalar</button>
          <button className={"erb-tab" + (tab === "sell" ? " erb-tab-active" : "")} onClick={() => setTab("sell")}>Sat</button>
          <button className={"erb-tab" + (tab === "mine" ? " erb-tab-active" : "")} onClick={() => setTab("mine")}>İlanlarım</button>
          <button className="erb-minibtn" style={{ marginLeft: "auto" }} onClick={onRefresh}><ArrowLeftRight size={12} /> Yenile</button>
        </div>

        {payoutPending > 0 && (
          <div className="erb-payout" onClick={onClaim}>
            <Coins size={14} color="#b98a3d" /> Bekleyen kazancın: <b>{payoutPending} altın</b> — Almak için tıkla
          </div>
        )}

        {tab === "browse" && (
          <div className="erb-invgrid">
            {loading && <div className="erb-empty">Yükleniyor...</div>}
            {!loading && others.length === 0 && <div className="erb-empty">Pazarda henüz eşya yok. İlk ilanı sen ver!</div>}
            {others.map((l) => {
              const Icon = ICONS[l.item.icon];
              const rdef = RARITIES[l.item.rarity];
              return (
                <div key={l.id} className="erb-item" style={{ borderColor: rdef.color }}>
                  <Icon size={22} color={rdef.color} />
                  <div className="erb-item-name" style={{ color: rdef.color }}>{l.item.name}</div>
                  <div className="erb-item-sub">Satıcı: {l.seller}</div>
                  <div className="erb-item-value"><Coins size={11} color="#b98a3d" /> {l.price}</div>
                  <button className="erb-minibtn erb-minibtn-buy" disabled={player.gold < l.price} onClick={() => onBuy(l)}>Satın Al</button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "sell" && (
          <div className="erb-sellgrid">
            {player.inventory.length === 0 && <div className="erb-empty">Satacak eşyan yok.</div>}
            {player.inventory.map((item) => {
              const Icon = ICONS[item.icon];
              const rdef = RARITIES[item.rarity];
              const active = selling && selling.id === item.id;
              return (
                <div key={item.id} className="erb-item" style={{ borderColor: rdef.color }}>
                  <Icon size={22} color={rdef.color} />
                  <div className="erb-item-name" style={{ color: rdef.color }}>{item.name}</div>
                  {active ? (
                    <div className="erb-sellform">
                      <input type="number" className="erb-input erb-input-sm" value={priceDraft} onChange={(e) => setPriceDraft(Number(e.target.value))} />
                      <button className="erb-minibtn erb-minibtn-buy" onClick={() => { onList(item, priceDraft); setSelling(null); }}>Onayla</button>
                    </div>
                  ) : (
                    <button className="erb-minibtn" onClick={() => { setSelling(item); setPriceDraft(item.value); }}><Tag size={12} /> Fiyat Belirle</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "mine" && (
          <div className="erb-invgrid">
            {mine.length === 0 && <div className="erb-empty">Aktif ilanın yok.</div>}
            {mine.map((l) => {
              const Icon = ICONS[l.item.icon];
              const rdef = RARITIES[l.item.rarity];
              return (
                <div key={l.id} className="erb-item" style={{ borderColor: rdef.color }}>
                  <Icon size={22} color={rdef.color} />
                  <div className="erb-item-name" style={{ color: rdef.color }}>{l.item.name}</div>
                  <div className="erb-item-value"><Coins size={11} color="#b98a3d" /> {l.price}</div>
                  <button className="erb-minibtn erb-minibtn-danger" onClick={() => onCancel(l)}>İlanı Kaldır</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   CSS
   ========================================================================= */
const CSS = `
html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; overscroll-behavior: none; }
.erb-root { width: 100vw; height: 100vh; height: 100dvh; background: #0b0a08; color: #e9dfc7; font-family: 'Inter', sans-serif; position: relative; overflow: hidden; touch-action: none; box-sizing: border-box; }
.erb-root * { box-sizing: border-box; }
.erb-loading { width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
.erb-title-glow { font-family: 'Cinzel', serif; font-weight: 900; font-size: clamp(30px, 9vw, 64px); letter-spacing: clamp(3px,2vw,10px); color: #e9dfc7; text-shadow: 0 0 24px rgba(193,80,46,0.55), 0 0 60px rgba(111,79,174,0.35); animation: erbPulse 3.2s ease-in-out infinite; text-align:center; }
@keyframes erbPulse { 0%,100% { text-shadow: 0 0 24px rgba(193,80,46,0.45), 0 0 50px rgba(111,79,174,0.25);} 50% { text-shadow: 0 0 34px rgba(193,80,46,0.85), 0 0 80px rgba(111,79,174,0.5);} }

.erb-create { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap: clamp(10px,2vh,18px); padding: clamp(12px,3vh,32px) clamp(10px,3vw,16px); background: radial-gradient(ellipse at 50% 0%, #241d16 0%, #0b0a08 70%); overflow-y: auto; }
.erb-subtitle { font-family:'Cinzel',serif; letter-spacing:3px; color:#a89e88; font-size: clamp(10px,2vw,14px); margin-top:-4px; text-align:center; }
.erb-createbox { width:100%; max-width: 560px; max-height: 78vh; max-height: 78dvh; overflow-y:auto; background:#15120e; border:1px solid #2a2420; border-radius:10px; padding: clamp(14px,3vw,22px); display:flex; flex-direction:column; gap:10px; }
.erb-label { font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#a89e88; margin-top:8px; }
.erb-input { background:#0e0c09; border:1px solid #3a332b; color:#e9dfc7; padding:10px 12px; border-radius:6px; font-size:15px; font-family:'Inter',sans-serif; outline:none; width:100%; }
.erb-input:focus { border-color:#c1502e; }
.erb-input-sm { width: 80px; padding: 6px 8px; font-size:13px; }
.erb-classrow { display:grid; grid-template-columns: repeat(auto-fit,minmax(120px,1fr)); gap:10px; margin-top:4px; }
.erb-classcard { background:#0e0c09; border:1px solid #3a332b; border-radius:8px; padding:12px; text-align:left; cursor:pointer; color:#e9dfc7; display:flex; flex-direction:column; gap:6px; transition: border-color .15s, transform .15s; }
.erb-classcard:hover { transform: translateY(-2px); }
.erb-classcard-active { border-color:#c1502e; box-shadow: 0 0 0 1px #c1502e, 0 0 18px rgba(193,80,46,0.25); }
.erb-classcard-swatch { width:22px; height:22px; border-radius:5px; }
.erb-classcard-name { font-family:'Cinzel',serif; font-weight:700; font-size:15px; }
.erb-classcard-stats { font-size:11px; color:#a89e88; }
.erb-classcard-abilities { font-size:10.5px; color:#7d7461; }
.erb-btn { font-family:'Cinzel',serif; font-weight:700; letter-spacing:1px; padding:13px 20px; border-radius:8px; border:none; cursor:pointer; font-size:14px; }
.erb-btn-ember { background: linear-gradient(180deg,#e8703f,#c1502e); color:#0b0a08; margin-top:8px; }
.erb-btn-ember:hover { filter:brightness(1.08); }
.erb-btn-gold { background: transparent; border:1px solid #b98a3d; color:#d6a84d; }

.erb-game { position:relative; width:100%; height:100%; overflow:hidden; }
.erb-canvas { width:100%; height:100%; display:block; transition: filter .15s; touch-action:none; }
.erb-hit { filter: saturate(1.4) sepia(0.15); }

.erb-topbar { position:absolute; top: max(10px, env(safe-area-inset-top)); left:10px; right:10px; display:flex; justify-content:space-between; align-items:center; pointer-events:none; }
.erb-zonepill { font-family:'Cinzel',serif; font-size: clamp(9px,2.2vw,12px); letter-spacing:1.5px; background:rgba(11,10,8,0.75); border:1px solid #3a332b; padding: 5px clamp(8px,2vw,14px); border-radius:20px; white-space:nowrap; }
.erb-gold { font-weight:600; background:rgba(11,10,8,0.75); border:1px solid #3a332b; padding: 5px clamp(8px,2vw,12px); border-radius:20px; display:flex; align-items:center; gap:6px; font-size: clamp(10px,2.2vw,13px); }

.erb-hud { position:absolute; bottom: max(10px, env(safe-area-inset-bottom)); left:10px; right:10px; display:flex; align-items:flex-end; gap: clamp(4px,1.5vw,12px); }
.erb-portrait { width: clamp(38px,8vw,52px); height: clamp(38px,8vw,52px); border-radius:50%; background:#15120e; border:2px solid #c1502e; display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0; }
.erb-portrait-lv { font-family:'Cinzel',serif; font-weight:700; font-size: clamp(13px,3vw,18px); }
.erb-bars { flex:1; display:flex; flex-direction:column; gap:4px; max-width: min(340px, 42vw); min-width: 90px; }
.erb-barrow { display:flex; align-items:center; gap:6px; }
.erb-barrow-xp { margin-top: 2px; }
.erb-bar { flex:1; height: clamp(9px,2vw,14px); background:#1c1815; border:1px solid #3a332b; border-radius:4px; overflow:hidden; }
.erb-bar-xp { height: 5px; }
.erb-bar-fill { height:100%; transition: width .2s; }
.erb-bar-hp .erb-bar-fill { background: linear-gradient(90deg,#7a1f1f,#c1502e); }
.erb-bar-mp .erb-bar-fill { background: linear-gradient(90deg,#2f5f8f,#4d8fd6); }
.erb-bar-xp .erb-bar-fill { background: linear-gradient(90deg,#7a6a2f,#d6a84d); }
.erb-bar-label { font-size: clamp(8px,1.8vw,11px); color:#a89e88; min-width: 40px; flex-shrink:0; }
.erb-abilities { display:flex; gap: clamp(3px,1vw,8px); }
.erb-ability { --ab-color:#c1502e; width: clamp(36px,7.5vw,58px); height: clamp(36px,7.5vw,58px); background:#15120e; border:1px solid #3a332b; border-radius:8px; position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02); flex-shrink:0; }
.erb-ability::before { content:''; position:absolute; inset:0; box-shadow: inset 0 0 12px var(--ab-color); opacity:0.35; }
.erb-ability-key { font-family:'Cinzel',serif; font-weight:700; font-size: clamp(10px,2.4vw,14px); color: var(--ab-color); }
.erb-ability-name { font-size: clamp(6px,1.4vw,8px); text-align:center; color:#a89e88; padding:0 3px; line-height:1.15; margin-top:2px; display: none; }
@media (min-width: 520px) { .erb-ability-name { display:block; } }
.erb-ability-cd { position:absolute; left:0; right:0; bottom:0; background:rgba(0,0,0,0.72); transition: height .1s linear; }
.erb-hudbtns { display:flex; flex-direction:column; gap:5px; flex-shrink:0; }
.erb-iconbtn { background:#15120e; border:1px solid #3a332b; color:#e9dfc7; width: clamp(30px,6vw,38px); height: clamp(30px,6vw,38px); border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
.erb-iconbtn:hover { border-color:#c1502e; }
.erb-fleebtn:hover { border-color:#8f2f2f; color:#e87070; }

.erb-interact { position:absolute; top: calc(max(10px, env(safe-area-inset-top)) + 40px); left:50%; transform:translateX(-50%); background:rgba(11,10,8,0.85); border:1px solid #c1502e; padding:6px clamp(10px,2.5vw,16px); border-radius:20px; font-size: clamp(10px,2vw,12.5px); display:flex; align-items:center; gap:6px; white-space:nowrap; max-width: 90vw; }
.erb-feed { position:absolute; top: calc(max(10px, env(safe-area-inset-top)) + 40px); right:10px; width: min(230px, 34vw); display:flex; flex-direction:column; gap:4px; pointer-events:none; }
.erb-feed-item { font-size:10.5px; color:#a89e88; background:rgba(11,10,8,0.6); padding:5px 9px; border-radius:5px; border-left:2px solid #6f4fae; }
.erb-controls { position:absolute; top: calc(max(10px, env(safe-area-inset-top)) + 40px); left:10px; font-size:10px; color:#7d7461; background:rgba(11,10,8,0.6); padding:5px 10px; border-radius:5px; max-width: 40vw; }

.erb-toast { position:absolute; top: calc(max(10px, env(safe-area-inset-top)) + 88px); left:50%; transform:translateX(-50%); background:#15120e; border:1px solid #3a332b; padding:8px 18px; border-radius:8px; font-size:13px; font-weight:600; animation: erbToast .25s ease; z-index: 20; max-width: 88vw; text-align:center; }
@keyframes erbToast { from { opacity:0; transform:translate(-50%,-8px);} to { opacity:1; transform:translate(-50%,0);} }
.erb-toast-good { border-color:#4caf6d; color:#4caf6d; }
.erb-toast-bad { border-color:#c1502e; color:#e87070; }
.erb-toast-gold { border-color:#b98a3d; color:#d6a84d; }
.erb-toast-common { border-color:#9a9a93; } .erb-toast-uncommon { border-color:#4caf6d; color:#4caf6d; }
.erb-toast-rare { border-color:#4d8fd6; color:#4d8fd6; } .erb-toast-epic { border-color:#a24dd6; color:#a24dd6; }
.erb-toast-legendary { border-color:#d6a84d; color:#d6a84d; }

.erb-deathscreen { position:absolute; inset:0; background:rgba(11,10,8,0.88); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; }
.erb-death-title { font-family:'Cinzel',serif; font-size: clamp(22px,6vw,34px); letter-spacing:5px; color:#c1502e; }

.erb-panel-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center; z-index:30; padding: 12px; }
.erb-panel { width: min(680px, 100%); max-height: 80vh; max-height: min(80dvh, 640px); overflow-y:auto; -webkit-overflow-scrolling:touch; background:#131009; border:1px solid #3a332b; border-radius:12px; padding: clamp(12px,3vw,18px); }
.erb-panel-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.erb-panel-title { font-family:'Cinzel',serif; font-weight:700; font-size:16px; display:flex; align-items:center; gap:8px; }

.erb-equip-row { display:flex; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
.erb-equip-slot { flex:1; min-width: 90px; background:#0e0c09; border:1px dashed #3a332b; border-radius:8px; padding:10px; display:flex; flex-direction:column; align-items:center; gap:5px; cursor:pointer; font-size:11px; text-align:center; }
.erb-statsline { font-size:12px; color:#a89e88; margin-bottom:14px; }

.erb-invgrid, .erb-sellgrid { display:grid; grid-template-columns: repeat(auto-fill,minmax(115px,1fr)); gap:10px; }
.erb-item { background:#0e0c09; border:1px solid; border-radius:8px; padding:10px; display:flex; flex-direction:column; align-items:center; gap:4px; text-align:center; }
.erb-item-name { font-size:11.5px; font-weight:600; line-height:1.2; }
.erb-item-sub { font-size:10px; color:#a89e88; }
.erb-item-value { font-size:10.5px; color:#d6a84d; display:flex; align-items:center; gap:3px; }
.erb-item-actions { display:flex; gap:4px; margin-top:4px; flex-wrap:wrap; justify-content:center; }
.erb-minibtn { background:#1c1815; border:1px solid #3a332b; color:#e9dfc7; font-size:10.5px; padding:5px 8px; border-radius:5px; cursor:pointer; display:flex; align-items:center; gap:3px; }
.erb-minibtn:hover { border-color:#c1502e; }
.erb-minibtn-danger:hover { border-color:#8f2f2f; color:#e87070; }
.erb-minibtn-buy { background:#213a26; border-color:#4caf6d; color:#7fd99a; }
.erb-minibtn:disabled { opacity:0.4; cursor:not-allowed; }
.erb-empty { color:#7d7461; font-size:12.5px; padding:20px; text-align:center; grid-column: 1/-1; }

.erb-tabrow { display:flex; gap:6px; margin-bottom:12px; align-items:center; flex-wrap:wrap; }
.erb-tab { background:transparent; border:1px solid #3a332b; color:#a89e88; padding:6px 12px; border-radius:20px; font-size:11.5px; cursor:pointer; white-space:nowrap; }
.erb-tab-active { border-color:#c1502e; color:#e9dfc7; }
.erb-payout { background:#241c10; border:1px solid #b98a3d; padding:8px 14px; border-radius:8px; font-size:12.5px; margin-bottom:12px; cursor:pointer; }
.erb-sellform { display:flex; gap:6px; align-items:center; margin-top:4px; }

@media (max-width: 560px) {
  .erb-feed { display:none; }
  .erb-controls { display:none; }
}
@media (max-height: 480px) {
  .erb-title-glow { font-size: clamp(22px,7vh,36px); }
  .erb-createbox { max-height: 90dvh; padding: 10px; gap:6px; }
  .erb-hud { bottom: 4px; }
  .erb-topbar { top: 4px; }
}
@media (max-width: 380px) {
  .erb-bars { max-width: 38vw; }
  .erb-ability-name { display:none !important; }
}
`;
