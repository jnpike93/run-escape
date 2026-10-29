/**
 * 04-characters.patch.js - Modular Domain Patch Rules
 */

const RULES = [
  {"label":"Qa characters array [warrior] (#1)","target":"rr=[{id:\"warrior\"","replacement":"rr=[{id:\"dipper\",name:\"Dipper\",description:\"A fierce corgi. Starts with bronze throwing knives. +25% movement speed, +50% pickup range, and +1 flat damage reduction.\",style:\"ranged\",startingWeapon:\"throwing_knives\",iconObjId:-16370,equipment:{},bonus:{moveSpeed:.25,magnet:.5,armor:1},unlock:{kind:\"code\",code:\"dipperthedog\"}},{id:\"elias\",name:\"Elias\",description:\"A feisty melee chihuahua. Starts with a bronze scimitar. +30% movement speed, +20% attack speed, +15% damage, and +1 flat damage reduction.\",style:\"melee\",startingWeapon:\"scimitar\",iconObjId:-16543,equipment:{},bonus:{moveSpeed:.3,cooldown:.2,might:.15,armor:1},unlock:{kind:\"code\",code:\"barkelly\"}},{id:\"warrior\""},
  {"label":"Qa characters array [warrior] (#2)","target":"imitar. Takes 1 less damage.\",style","replacement":"imitar. +1 flat damage reduction.\",style"},
  {"label":"Qa characters array [wizard]","target":"Strike. Weapons are 5% faster.\",style","replacement":"Strike. +5% attack speed.\",style"},
  {"label":"Qa characters array [ranger]","target":"knives. Moves 10% faster.\",style","replacement":"knives. +10% movement speed.\",style"},
  {"label":"Qa characters array [monk]","target":"Strike. Weapons are 15% faster.\",style","replacement":"Strike. +15% attack speed.\",style"},
  {"label":"Qa characters array [barbarian]","target":" sword. 20% more hitpoin","replacement":" sword. +20% max hitpoin"},
  {"label":"Qa characters array [ancient_mage]","target":" Burst. Weapons cover 15% more area.\",style","replacement":" Burst. +15% attack size (reach & AoE).\",style"},
  {"label":"Qa characters array [hunter]","target":"ortbow. Picks things up from 50% further away.\",style","replacement":"ortbow. +50% pickup range.\",style"},
  {"label":"Qa characters array [rogue]","target":"knives. Finds 25% more coins and is luckier.\",style","replacement":"knives. +25% coin gain and +10% drop rate & rarity luck.\",style"},
  {"label":"Qa characters array [dragon_slayer]","target":"imitar. Hits 15% harder.\",style","replacement":"imitar. +15% damage.\",style"},
  {"label":"Qa characters array [nomad]","target":"g axes. Moves 5% faster and hits 10% harder.\",style","replacement":"g axes. +5% movement speed and +10% damage.\",style"},
  {"label":"Qa characters array [menaphite]","target":" Burst. Gains 15% more experience.\",style","replacement":" Burst. +15% XP gain.\",style"},
  {"label":"Qa characters array [seer]","target":" runes. Effects last 25% longer.\",style","replacement":" runes. +25% effect & DoT duration.\",style"},
  {"label":"Qa characters array [berserker]","target":" sword. Takes 0.5 less damage and hits back for 3.\",style","replacement":" sword. +0.5 flat damage reduction and +3 recoil damage.\",style"},
  {"label":"Qa characters array [obby_mauler]","target":"ket-om. Hits 10% harder and has 10% more hitpoin","replacement":"ket-om. +10% damage and +10% max hitpoin"},
  {"label":"Qa characters array [pirate]","target":"knives. One more reroll a run, and 5% luckier.\",style","replacement":"knives. +1 reroll per run and +5% drop rate & rarity luck.\",style"},
  {"label":"Qa characters array [shayzien_soldier]","target":"imitar. Takes 0.5 less damage and heals 3 hitpoints a minute.\",style","replacement":"imitar. +0.5 flat damage reduction and +3 HP regen / min.\",style"},
  {"label":"Qa characters array [gladiator]","target":"ahuitl. Weapons are 10% faster and hit 5% harder.\",style","replacement":"ahuitl. +10% attack speed and +5% damage.\",style"},
  {"label":"Qa characters array [javelineer]","target":"atlatl. Projectiles fly 20% faster, and areas are 10% bigger.\",style","replacement":"atlatl. +20% projectile speed and +10% attack size.\",style"},
  {"label":"Qa characters array [scammer]","target":"knives. 50% more coins, and luckier. Trust ","replacement":"knives. +50% coin gain and +10% drop rate & rarity luck. Trust "},
  {"label":"Qa characters array [f2p_pker]","target":" sword. Hits 10% harder and moves 5% faster.\",style","replacement":" sword. +10% damage and +5% movement speed.\",style"},
  {"label":"Qa characters array [durial321]","target":"ip, but has 30% less hitpoin","replacement":"ip, but -30% max hitpoin"},
  {"label":"Qa characters array [lms_sweat]","target":" Burst. Weapons are 10% faster, and areas are 10% bigger.\",style","replacement":" Burst. +10% attack speed and +10% attack size.\",style"},
  {"label":"$h secret code unlock text","target":"i,t=!0){const e=","replacement":"i,t=!0){if(i.kind===\"code\")return\"Redeem secret code in Settings\";const e="},
  {"label":"Gear stat labels (#1)","target":"{label:\"armour\",unit:\"","replacement":"{label:\"flat damage reduction\",unit:\""},
  {"label":"Gear stat labels (#2)","target":"{label:\"hitpoints a minute\",unit:\"flat\"},cooldown:{label:\"weapon speed\",unit:\"percent\"},area:{label:\"area\",unit:\"","replacement":"{label:\"HP regen / min\",unit:\"flat\"},cooldown:{label:\"attack speed\",unit:\"percent\"},area:{label:\"attack size\",unit:\""},
  {"label":"Gear stat labels (#3)","target":":{label:\"effect duration\",unit:\"","replacement":":{label:\"effect & DoT duration\",unit:\""},
  {"label":"Gear stat labels (#4)","target":"{label:\"luck\",unit:\"percent\"},growth:{label:\"experience\",unit:\"percent\"},greed:{label:\"coins\",unit:\"","replacement":"{label:\"drop rate & rarity luck\",unit:\"percent\"},growth:{label:\"XP gain\",unit:\"percent\"},greed:{label:\"coin gain\",unit:\""},
  {"label":"Skills descriptions [defence]","target":"iption:\"Take 1 less damage\",stat:\"","replacement":"iption:\"+1 flat damage reduction\",stat:\""},
  {"label":"Skills descriptions [hitpoints]","target":"ption:\"+5 max hitpoints\",stat:\"","replacement":"ption:\"+20% max hitpoints (+5 base HP)\",stat:\""},
  {"label":"Skills descriptions [prayer]","target":"iption:\"Heal 1.5 hitpoints a minute\",stat:\"","replacement":"iption:\"+1.5 HP regen / min\",stat:\""},
  {"label":"Skills descriptions [attack]","target":"iption:\"Weapons 2.5% faster\",stat:\"","replacement":"iption:\"+2.5% attack speed\",stat:\""},
  {"label":"Skills descriptions [magic]","target":"n:\"+5% area\",stat:\"","replacement":"n:\"+5% attack size (reach & AoE)\",stat:\""},
  {"label":"Skills descriptions [herblore]","target":"on:\"+15% effect duration\",stat:\"","replacement":"on:\"+15% effect & DoT duration\",stat:\""},
  {"label":"Skills descriptions [fletching]","target":"iption:\"One more projectile\",stat:\"","replacement":"iption:\"+1 projectile per attack\",stat:\""},
  {"label":"Skills descriptions [slayer]","target":"n:\"+10% luck\",st","replacement":"n:\"+10% drop rate & rarity luck\",st"},
  {"label":"Skills descriptions [farming]","target":"on:\"+3% experience\",stat:\"","replacement":"on:\"+3% XP gain\",stat:\""},
  {"label":"Skills descriptions [mining]","target":"10% coins\",stat:\"","replacement":"10% coin gain\",stat:\""},
  {"label":"pw default save unlockedCodes","target":"unlockedItems:[],runs:0","replacement":"unlockedCodes:[],unlockedItems:[],runs:0"},
  {"label":"wC load save unlockedCodes and dipper/elias check (#1)","target":"if(t.upgrad","replacement":"if(Array.isArray(e.unlockedCodes))for(const s of e.unlockedCodes)typeof s==\"string\"&&!t.unlockedCodes.includes(s)&&t.unlockedCodes.push(s);if(t.upgrad"},
  {"label":"wC load save unlockedCodes and dipper/elias check (#2)","target":"acters)(rr.some(","replacement":"acters)(s!==\"dipper\"||t.unlockedCodes.includes(\"dipperthedog\"))&&(s!==\"elias\"||t.unlockedCodes.includes(\"barkelly\"))&&(rr.some("},
  {"label":"getBaseRequests corgi and chihuahua","target":"st t=[];for(const s of Yp){","replacement":"st t=[];t.push({kind:\"npc\",key:\"corgi\",npcId:16370,seqIds:[6561,6560]}),t.push({kind:\"npc\",key:\"chihuahua\",npcId:16543,seqIds:[6561,6560]});for(const s of Yp){"},
  {"label":"drawPlayer corgi & chihuahua & moving attackSeq window (#1)","target":"){const s=this.assets.getPlayer();if(!s)return;const a=e.player,r=e.tick;let l,h;const d=","replacement":"){const a=e.player;if(a.spectating&&a.deathTick!==-1&&e.tick-a.deathTick>nw)return;const cId=e.characterId||(this.store&&this.store.getSnapshot().characterId),isCorgi=cId===\"dipper\",isChih=cId===\"elias\",isDog=isCorgi||isChih;let s=isCorgi?(this.assets.get(\"corgi\")||this.assets.getPlayer()):isChih?(this.assets.get(\"chihuahua\")||this.assets.getPlayer()):this.assets.getPlayer();if(!s)return;const r=e.tick;let l,h;if(isDog){l=a.moving?(s.getAnim(6560)||s.anims[0]):(s.getAnim(6561)||s.anims[0]);h=l?l.getFrame(r-a.moveStart):0}else{const d="},
  {"label":"drawPlayer corgi & chihuahua & moving attackSeq window (#2)","target":"ackSeq&&!a.moving&&r-a.at","replacement":"ackSeq&&(!a.moving||a.attackSeq===1979||r-a.attackStart<12)&&r-a.at"},
  {"label":"drawPlayer corgi & chihuahua & moving attackSeq window (#3)","target":"eStart));const u=","replacement":"eStart))}const u="},
  {"label":"drawPlayer corgi & chihuahua & moving attackSeq window (#4)","target":"&(g=.5),t.draw(s,l,h,u,this.ground(e,u,f),f,a.yaw,{silhouette:!0,tint:p,flash:g})}","replacement":"&(g=.5),l&&t.draw(s,l,h,u,this.ground(e,u,f)-(isDog?0.22:0),f,a.yaw,{silhouette:!0,tint:p,flash:g,scale:isDog?3.0:1})}"},
  {"label":"drawOverlay dog height & prayer overlay hook","target":"e,d,u)-(h?.height??200)/128-uT,p=t.project(d,f,u,this.screen);p.visible&&_T(s,p.x,p.y,r,l.hp/l.maxHp)}","replacement":"e,d,u)-(e.characterId===\"dipper\"||e.characterId===\"elias\"?110:(h?.height??200))/128-uT,p=t.project(d,f,u,this.screen);p.visible&&(_T(s,p.x,p.y,r,l.hp/l.maxHp),window._drawOsrsPrayerOverlay?.(t,e,n,s,r,p))}"},
  {"label":"submitActors attract screen dog support & drawOverlay prayer hide (#1)","target":"n}const s=this.assets.getPlayer();if(s){const a=s.getAni","replacement":"n}const cId=this.store&&this.store.getSnapshot().characterId,isDipper=cId===\"dipper\",isElias=cId===\"elias\",isDog=isDipper||isElias;const s=isDipper?(this.assets.get(\"corgi\")||this.assets.getPlayer()):isElias?(this.assets.get(\"chihuahua\")||this.assets.getPlayer()):this.assets.getPlayer();if(s){const a=isDog?(s.getAnim(6561)||s.anims[0]):s.getAni"},
  {"label":"submitActors attract screen dog support & drawOverlay prayer hide (#2)","target":"ctTick);t.draw(s","replacement":"ctTick);a&&t.draw(s"},
  {"label":"submitActors attract screen dog support & drawOverlay prayer hide (#3)","target":"n.y)/128,Ms.spawn.y,0)}}drawO","replacement":"n.y)/128-(isDog?0.22:0),Ms.spawn.y,0,{scale:isDog?3.0:1})}}drawO"},
  {"label":"submitActors attract screen dog support & drawOverlay prayer hide (#4)","target":"is.sim;n&&(this.vi","replacement":"is.sim;n?(this.vi"},
  {"label":"submitActors attract screen dog support & drawOverlay prayer hide (#5)","target":"lpha())),this.st","replacement":"lpha())):window._hideOsrsPrayerBar?.(),this.st"},
  {"label":"vZ Adventurer select filter dipper/elias until unlocked and use iconObjId (#1)","target":"State(),a=rr.filter(","replacement":"State(),vChars=rr.filter(r=>(r.id!==\"dipper\"&&r.id!==\"elias\")||e.includes(r.id)),a=vChars.filter("},
  {"label":"vZ Adventurer select filter dipper/elias until unlocked and use iconObjId (#2)","target":"a,\" / \",rr.length]","replacement":"a,\" / \",vChars.length]"},
  {"label":"vZ Adventurer select filter dipper/elias until unlocked and use iconObjId (#3)","target":"hildren:rr.filter(","replacement":"hildren:vChars.filter("},
  {"label":"vZ Adventurer select filter dipper/elias until unlocked and use iconObjId (#4)","target":"objId:h.equipment[ue.TORSO]??rw(h),size:34}),L.jsx(\"s","replacement":"objId:h.iconObjId??h.equipment[ue.TORSO]??rw(h),size:34}),!h.iconObjId&&L.jsx(\"s"},
  {"label":"vZ Adventurer select filter dipper/elias until unlocked and use iconObjId (#5)","target":",{objId:rw(t),size:36})","replacement":",{objId:t.iconObjId??rw(t),size:36})"}
];

function apply(code, replaceExact, symbols) {
  for (const rule of RULES) {
    code = replaceExact(code, rule.label, rule.target, rule.replacement);
  }
  return code;
}

module.exports = { RULES, apply };
